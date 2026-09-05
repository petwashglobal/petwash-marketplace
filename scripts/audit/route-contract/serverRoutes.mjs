/**
 * Server route table builder — MOUNT-PREFIX AWARE.
 *
 * The previous route scanner produced false positives because it matched
 * `router.get('/foo')` handlers textually and never resolved WHERE that
 * router is mounted. This module builds a real routing table by:
 *
 *   1. Indexing every server/**\/*.ts module: its imports, its Router()
 *      declarations, what it default-exports / named-exports, every
 *      `<obj>.use(path, arg…)` and every `<obj>.<verb>(path, …)`.
 *   2. Seeding a BFS from the express `app` objects in the known entry
 *      modules (server/routes.ts, server/index.ts, server/enterprise/routes.ts,
 *      plus any `export function registerX(app…)`).
 *   3. Walking `.use(prefix, childRouter)` edges — resolving `childRouter`
 *      through the import graph — and COMPOSING the prefix TRANSITIVELY,
 *      so a `router.get('/start')` inside auth-sms.ts mounted via
 *      `app.use('/api/auth/sms', authSmsRouter)` resolves to
 *      `/api/auth/sms/start`, and a nested `parent.use('/sub', child)`
 *      composes again.
 *
 * Output: a flat list of { method, path, file, line, source, auth }.
 *
 * Deliberately regex/heuristic based (no TS compiler dependency) so it
 * runs in CI in <2s with zero install. Every unresolved mount is reported
 * so the harness can never silently under-report.
 */
import fs from 'node:fs';
import path from 'node:path';

const VERBS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'all'];

/** Files that mount an express `app` we should seed the walk from. */
const ENTRY_HINTS = [
  'server/routes.ts',
  'server/index.ts',
  'server/enterprise/routes.ts',
  'server/app.ts',
];

const SKIP_DIR = new Set(['node_modules', 'tests', '__tests__', 'dist', 'build', '.git']);

export function listServerFiles(root) {
  const out = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIR.has(e.name)) continue;
        walk(full);
        continue;
      }
      if (!e.name.endsWith('.ts')) continue;
      if (/\.(test|spec)\.ts$/.test(e.name)) continue;
      out.push(full);
    }
  };
  walk(path.join(root, 'server'));
  return out;
}

/** `./routes/foo` from `server/routes.ts` -> `server/routes/foo.ts` (rel to root). */
function resolveImport(root, fromRel, spec) {
  if (!spec.startsWith('.')) {
    // path aliases used in this repo
    if (spec.startsWith('@shared/')) spec = './' + path.relative(path.dirname(fromRel), 'shared/' + spec.slice(8));
    else if (spec.startsWith('@server/')) spec = './' + path.relative(path.dirname(fromRel), 'server/' + spec.slice(8));
    else return null;
  }
  const base = path.normalize(path.join(path.dirname(fromRel), spec));
  const candidates = [`${base}.ts`, `${base}/index.ts`, `${base}.tsx`, base];
  for (const c of candidates) {
    if (fs.existsSync(path.join(root, c)) && fs.statSync(path.join(root, c)).isFile()) return c;
  }
  return null;
}

/**
 * Blank out COMMENTS while preserving string literals and byte offsets.
 *
 * This must be string-aware: a naive scanner blanks everything after the
 * `//` inside `'https://x'`, which silently deletes hundreds of real
 * `app.use(...)` calls from a 14k-line routes.ts. That exact bug is what
 * made the previous scanner under-report. Offsets are preserved (we
 * substitute spaces / keep newlines) so line numbers stay exact.
 */
function blankComments(src) {
  const out = new Array(src.length);
  let i = 0;
  const n = src.length;
  const put = (idx, ch) => { out[idx] = ch; };
  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];
    // line comment
    if (c === '/' && c2 === '/') {
      while (i < n && src[i] !== '\n') { put(i, ' '); i++; }
      continue;
    }
    // block comment
    if (c === '/' && c2 === '*') {
      put(i, ' '); put(i + 1, ' '); i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        put(i, src[i] === '\n' ? '\n' : ' ');
        i++;
      }
      if (i < n) { put(i, ' '); put(i + 1, ' '); i += 2; }
      continue;
    }
    // string / template literal — copy through verbatim (we need the content)
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      put(i, c); i++;
      while (i < n) {
        if (src[i] === '\\') { put(i, src[i]); put(i + 1, src[i + 1] ?? ' '); i += 2; continue; }
        if (src[i] === quote) { put(i, src[i]); i++; break; }
        if (quote !== '`' && src[i] === '\n') break; // unterminated — bail out
        put(i, src[i]); i++;
      }
      continue;
    }
    put(i, c);
    i++;
  }
  for (let k = 0; k < n; k++) if (out[k] === undefined) out[k] = src[k] === '\n' ? '\n' : ' ';
  return out.join('');
}

/** O(log n) line lookup. The naive O(n) scan is quadratic on the 14k-line
 *  server/routes.ts and dominated the whole scan's runtime. */
function makeLineIndex(src) {
  const nl = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === '\n') nl.push(i + 1);
  return (idx) => {
    let lo = 0, hi = nl.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (nl[mid] <= idx) lo = mid; else hi = mid - 1; }
    return lo + 1;
  };
}

/** Grab the raw argument text of a call starting at the `(` index. */
function readArgs(src, openParen) {
  let depth = 0;
  for (let i = openParen; i < src.length; i++) {
    const c = src[i];
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return src.slice(openParen + 1, i);
    }
  }
  return src.slice(openParen + 1, Math.min(src.length, openParen + 600));
}

/**
 * Auth detection is PATTERN based, not a fixed allow-list. A fixed list
 * flagged `requireAdminPanelAccess` (a locally built
 * requireAuthenticatedRole([...])) and `requireKYCPermission(...)` as
 * "unguarded" — 279 false AUTH findings. Any identifier that reads like a
 * guard counts, and the rank is taken from what the name asserts.
 */
const GUARD_NAME = /^(require|ensure|assert|verify|validate|check|is|has|guard|only|protect|authorize|authenticate)[A-Z_]/;
const GUARDISH = /(admin|auth|role|permission|mfa|token|guard|staff|super|kyc|verified|approved|owner|member|firebase|session|csrf)/i;

export function detectAuth(argText) {
  const idents = [...argText.matchAll(/\b([A-Za-z_$][\w$]*)\s*(\(|,|\)|$)/g)].map((x) => x[1]);
  const guards = idents.filter((n) => GUARD_NAME.test(n) && GUARDISH.test(n));
  if (!guards.length) return 'none';
  if (guards.some((g) => /super/i.test(g))) return 'super_admin';
  if (guards.some((g) => /(admin|staff|role|permission|mfa)/i.test(g))) return 'admin';
  return 'user';
}

const AUTH_RANK = { none: 0, user: 1, admin: 2, super_admin: 3 };
export function strongerAuth(a, b) { return AUTH_RANK[a] >= AUTH_RANK[b] ? a : b; }

/** Parse one module into a structured record. */
function parseModule(root, rel) {
  const raw = fs.readFileSync(path.join(root, rel), 'utf8');
  const src = blankComments(raw);
  const lineOf = makeLineIndex(src);

  /** binding name -> { file, exported } */
  const imports = new Map();
  // import Default from 'x'  |  import Default, { A, B as C } from 'x'  |  import { A } from 'x'
  const importRe = /import\s+(type\s+)?([^;]*?)\s+from\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = importRe.exec(src))) {
    if (m[1]) continue; // type-only
    const clause = m[2].trim();
    const target = resolveImport(root, rel, m[3]);
    if (!target) continue;
    // default part
    const defMatch = clause.match(/^([A-Za-z_$][\w$]*)\s*(,|$)/);
    if (defMatch) imports.set(defMatch[1], { file: target, exported: 'default' });
    const namedMatch = clause.match(/\{([^}]*)\}/);
    if (namedMatch) {
      for (const piece of namedMatch[1].split(',')) {
        const p = piece.trim();
        if (!p) continue;
        const asM = p.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/);
        if (asM) imports.set(asM[2], { file: target, exported: asM[1] });
        else if (/^[A-Za-z_$][\w$]*$/.test(p)) imports.set(p, { file: target, exported: p });
      }
    }
    const starM = clause.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
    if (starM) imports.set(starM[1], { file: target, exported: '*' });
  }

  // Dynamic imports — this repo lazily loads a LOT of routers:
  //   const authSmsRoutes = (await import('./routes/auth-sms')).default;
  //   const x = (await import('./routes/y')).someRouter;
  //   const { default: x } = await import('./routes/y');
  const dynRe = /(?:const|let|var)\s+(?:\{\s*default\s*:\s*([A-Za-z_$][\w$]*)\s*\}|([A-Za-z_$][\w$]*))\s*=\s*\(?\s*await\s+import\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\)?\s*(?:\.\s*([A-Za-z_$][\w$]*))?/g;
  while ((m = dynRe.exec(src))) {
    const name = m[1] || m[2];
    const target = resolveImport(root, rel, m[3]);
    if (!name || !target) continue;
    const exported = m[1] ? 'default' : (m[4] || 'default');
    imports.set(name, { file: target, exported });
  }

  //   const { providerPhoneRouter, other } = await import('./routes/provider-phone');
  const dynDestrRe = /(?:const|let|var)\s*\{([^}]*)\}\s*=\s*await\s+import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = dynDestrRe.exec(src))) {
    const target = resolveImport(root, rel, m[2]);
    if (!target) continue;
    for (const piece of m[1].split(',')) {
      const p = piece.trim();
      if (!p) continue;
      const asM = p.match(/^([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$]*)$/);
      if (asM) imports.set(asM[2], { file: target, exported: asM[1] });
      else if (/^[A-Za-z_$][\w$]*$/.test(p)) imports.set(p, { file: target, exported: p });
    }
  }

  // Router FACTORIES: `const ledRouter = createLedRouter({ … })`. The routes
  // live on a Router() declared inside the factory's module, so bind the
  // local name to that module and let resolution fall through to its single
  // Router() declaration.
  const factoryRe = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*((?:create|make|build)[A-Za-z0-9_$]*Router)\s*\(/g;
  while ((m = factoryRe.exec(src))) {
    if (imports.has(m[1])) continue;
    const src2 = imports.get(m[2]);
    if (src2) imports.set(m[1], { file: src2.file, exported: '__factoryRouter__' });
  }

  /** Local `const x = Router()` / `express.Router()`. */
  const routers = new Set();
  const routerRe = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:express\s*\.\s*)?Router\s*\(/g;
  while ((m = routerRe.exec(src))) routers.add(m[1]);

  /** What `export default X` names. */
  let defaultExport = null;
  const defExpRe = /export\s+default\s+([A-Za-z_$][\w$]*)\s*;/;
  const dm = src.match(defExpRe);
  if (dm) defaultExport = dm[1];
  // `export default Router()` inline (rare) — synthesise a name
  if (!defaultExport && /export\s+default\s+(?:express\s*\.\s*)?Router\s*\(/.test(src)) {
    defaultExport = '__defaultRouter__';
    routers.add('__defaultRouter__');
  }

  /** Named exports of routers: `export const x = Router()` etc. */
  const namedExports = new Set();
  const namedExpRe = /export\s+(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/g;
  while ((m = namedExpRe.exec(src))) namedExports.add(m[1]);
  const exportListRe = /export\s*\{([^}]*)\}/g;
  while ((m = exportListRe.exec(src))) {
    for (const piece of m[1].split(',')) {
      const p = piece.trim();
      const asM = p.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/);
      if (asM) namedExports.add(asM[2]);
      else if (/^[A-Za-z_$][\w$]*$/.test(p)) namedExports.add(p);
    }
  }

  /**
   * `export function registerFooRoutes(app: Express)` — the parameter is an
   * app-like object. Record { fnName, paramName }.
   */
  const registrars = [];
  const regRe = /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(\s*([A-Za-z_$][\w$]*)\s*(?::\s*(?:Express|Application|Router|any))?/g;
  while ((m = regRe.exec(src))) registrars.push({ fn: m[1], param: m[2] });

  /** `<obj>.use(...)` calls. */
  const uses = [];
  const useRe = /\b([A-Za-z_$][\w$]*)\s*\.\s*use\s*\(/g;
  while ((m = useRe.exec(src))) {
    const open = useRe.lastIndex - 1;
    const args = readArgs(src, open);
    const line = lineOf(m.index);
    const pathM = args.match(/^\s*(['"])([^'"]*)\1\s*(,|$)/);
    const mountPath = pathM ? pathM[2] : null;
    const rest = pathM ? args.slice(pathM[0].length) : args;
    const idents = [...rest.matchAll(/\b([A-Za-z_$][\w$]*)\b/g)].map((x) => x[1]);
    uses.push({ obj: m[1], mountPath, idents, line, args });
  }

  /** `<obj>.<verb>(...)` calls. */
  const handlers = [];
  const verbRe = new RegExp(`\\b([A-Za-z_$][\\w$]*)\\s*\\.\\s*(${VERBS.join('|')})\\s*\\(`, 'g');
  while ((m = verbRe.exec(src))) {
    const open = verbRe.lastIndex - 1;
    const args = readArgs(src, open);
    const pathM = args.match(/^\s*(['"])([^'"]*)\1\s*(,|$)/);
    if (!pathM) continue; // e.g. `res.get('header')` with no comma, or axios.get(url)
    handlers.push({
      obj: m[1],
      method: m[2].toUpperCase(),
      path: pathM[2],
      line: lineOf(m.index),
      // Middleware on the registration line, OR a gate written INSIDE the
      // handler body (prestige-pass checks firebase customClaims.admin and
      // returns 403 inline — invisible to middleware-only analysis).
      auth: (() => {
        const mw = detectAuth(args.slice(0, 400));
        if (mw !== 'none') return mw;
        const body = args.slice(0, 4000);
        if (!/res\s*\.\s*status\s*\(\s*40[13]\s*\)/.test(body)) return 'none';
        if (/(customClaims|isSuperAdmin|super_admin|SUPER_ADMIN)/.test(body)) return 'super_admin';
        if (/\b(admin|adminUser|isAdmin|role|permission)\b/i.test(body)) return 'admin';
        return 'user';
      })(),
      is410: /\b410\b/.test(args.slice(0, 800)) && /(V1_DEPRECATED|ENDPOINT_RETIRED|Gone|RETIRED|DEPRECATED)/i.test(args.slice(0, 800)),
    });
  }

  /** Calls like `registerStaffOnboardingRoutes(app)`. */
  const registrarCalls = [];
  const callRe = /\b([A-Za-z_$][\w$]*)\s*\(\s*([A-Za-z_$][\w$]*)\s*[,)]/g;
  while ((m = callRe.exec(src))) registrarCalls.push({ fn: m[1], arg: m[2], line: lineOf(m.index) });

  return { rel, imports, routers, defaultExport, namedExports, registrars, uses, handlers, registrarCalls };
}

function joinPath(prefix, p) {
  if (p == null) return prefix;
  let a = prefix.replace(/\/+$/, '');
  let b = p.startsWith('/') ? p : '/' + p;
  if (b === '/') b = '';
  const joined = (a + b) || '/';
  return joined.replace(/\/{2,}/g, '/');
}

/**
 * Build the full server routing table.
 * @returns {{routes: Array, unresolved: Array, modules: Map}}
 */
export function buildServerRouteTable(root) {
  const files = listServerFiles(root);
  const modules = new Map();
  for (const abs of files) {
    const rel = path.relative(root, abs);
    try {
      modules.set(rel, parseModule(root, rel));
    } catch (err) {
      // never let one unparsable file blind the whole scan
      modules.set(rel, { rel, imports: new Map(), routers: new Set(), defaultExport: null, namedExports: new Set(), registrars: [], uses: [], handlers: [], registrarCalls: [], parseError: String(err) });
    }
  }

  const routes = [];
  const unresolved = [];
  /** visited key = file::objName::prefix */
  const visited = new Set();

  /** Resolve an identifier used as a `.use()` argument to a (file, obj) router node. */
  function resolveRouterIdent(mod, ident) {
    if (mod.routers.has(ident)) return { file: mod.rel, obj: ident };
    const imp = mod.imports.get(ident);
    if (!imp) return null;
    const target = modules.get(imp.file);
    if (!target) return null;
    if (imp.exported === 'default') {
      if (target.defaultExport) return { file: target.rel, obj: target.defaultExport };
      // module default-exports something we could not name; if it has exactly
      // one Router() declaration, use it.
      if (target.routers.size === 1) return { file: target.rel, obj: [...target.routers][0] };
      return null;
    }
    if (target.routers.has(imp.exported)) return { file: target.rel, obj: imp.exported };
    if (imp.exported === '__factoryRouter__' && target.routers.size === 1) {
      return { file: target.rel, obj: [...target.routers][0] };
    }
    // named export that is a router assigned indirectly, e.g.
    // `const r = Router(); … export { r as providerPhoneRouter }`
    if (target.namedExports.has(imp.exported) && target.routers.size === 1) {
      return { file: target.rel, obj: [...target.routers][0] };
    }
    return null;
  }

  /** Resolve an identifier that names a registrar FUNCTION (registerXRoutes). */
  function resolveRegistrar(mod, ident) {
    const local = mod.registrars.find((r) => r.fn === ident);
    if (local) return { mod, param: local.param };
    const imp = mod.imports.get(ident);
    if (!imp) return null;
    const target = modules.get(imp.file);
    if (!target) return null;
    const fnName = imp.exported === 'default' ? target.defaultExport : imp.exported;
    const reg = target.registrars.find((r) => r.fn === fnName || r.fn === ident);
    if (reg) return { mod: target, param: reg.param };
    return null;
  }

  function walk(fileRel, objName, prefix, chain, inheritedAuth = 'none') {
    const key = `${fileRel}::${objName}::${prefix}::${inheritedAuth}`;
    if (visited.has(key)) return;
    visited.add(key);
    if (chain.length > 12) return;
    const mod = modules.get(fileRel);
    if (!mod) return;

    // Guards applied to the WHOLE router inside its own module —
    // `router.use(requireAuth)` / `router.use('/admin', requireAdmin)`.
    let moduleAuth = inheritedAuth;
    const scopedGuards = [];
    for (const u of mod.uses) {
      if (u.obj !== objName) continue;
      const a = detectAuth(u.args);
      if (a === 'none') continue;
      const looksLikeRouterMount = u.idents.some((id) => resolveRouterIdent(mod, id));
      if (looksLikeRouterMount) continue;
      if (!u.mountPath) moduleAuth = strongerAuth(moduleAuth, a);
      else scopedGuards.push({ prefix: u.mountPath, auth: a });
    }

    for (const h of mod.handlers) {
      if (h.obj !== objName) continue;
      let auth = strongerAuth(h.auth, moduleAuth);
      for (const g of scopedGuards) {
        if (h.path === g.prefix || h.path.startsWith(g.prefix.replace(/\/$/, '') + '/')) auth = strongerAuth(auth, g.auth);
      }
      routes.push({
        method: h.method,
        path: joinPath(prefix, h.path),
        file: fileRel,
        line: h.line,
        auth,
        is410: h.is410,
        mountChain: [...chain, `${fileRel}#${objName}`],
      });
    }

    for (const u of mod.uses) {
      if (u.obj !== objName) continue;
      const childPrefix = joinPath(prefix, u.mountPath);
      let matched = false;
      for (const ident of u.idents) {
        const node = resolveRouterIdent(mod, ident);
        if (node) {
          matched = true;
          walk(node.file, node.obj, childPrefix, [...chain, `${fileRel}:${u.line}`], strongerAuth(inheritedAuth, detectAuth(u.args)));
        }
      }
      if (!matched && u.mountPath && u.idents.length && /[Rr]out(er|es)|[Hh]andler/.test(u.idents.join(' '))) {
        unresolved.push({ file: fileRel, line: u.line, mount: childPrefix, idents: u.idents });
      }
    }

    // registrar calls: registerFoo(app) — the callee registers on `app`
    for (const c of mod.registrarCalls) {
      if (c.arg !== objName) continue;
      if (!/^(register|mount|setup|install|attach|add)[A-Z]/.test(c.fn)) continue;
      const target = resolveRegistrar(mod, c.fn);
      if (target) walk(target.mod.rel, target.param, prefix, [...chain, `${fileRel}:${c.line}`], inheritedAuth);
    }
  }

  // Seed: every entry module's app-like objects.
  for (const hint of ENTRY_HINTS) {
    const mod = modules.get(hint);
    if (!mod) continue;
    const seeds = new Set(['app']);
    for (const r of mod.registrars) {
      if (/^(registerRoutes|createServer|registerAllRoutes|setupRoutes|registerEnterpriseRoutes)/.test(r.fn) || /app/i.test(r.param)) seeds.add(r.param);
    }
    for (const s of seeds) walk(hint, s, '', [`seed:${hint}#${s}`], 'none');
  }

  // Second pass: routers that are reachable but whose mount we could not
  // resolve are reported. Also collect ORPHAN handlers — routers defined in
  // a module that never got walked — so we can tell "route exists but is
  // not mounted" apart from "route does not exist at all".
  const reached = new Set([...visited].map((k) => k.split('::').slice(0, 2).join('::')));
  const orphans = [];
  for (const mod of modules.values()) {
    for (const h of mod.handlers) {
      if (!mod.routers.has(h.obj)) continue;
      if (reached.has(`${mod.rel}::${h.obj}`)) continue;
      orphans.push({ method: h.method, rawPath: h.path, file: mod.rel, line: h.line });
    }
  }

  return { routes, unresolved, orphans, modules };
}

/** Turn `/api/users/:id/pets/:petId` into `/api/users/:p/pets/:p` for positional matching. */
export function normalizePattern(p) {
  return p
    .replace(/\/+$/, '')
    .replace(/:[A-Za-z_$][\w$]*\??/g, ':p')
    .replace(/\*+/g, '*')
    || '/';
}

/** Segment list with `:p` for params and `*` for wildcards. Memoised — the
 *  matcher calls this millions of times across the 3k x 1.5k cross-product. */
const _segCache = new Map();
export function segments(p) {
  let v = _segCache.get(p);
  if (v === undefined) {
    v = normalizePattern(p).split('/').filter((s) => s.length > 0);
    _segCache.set(p, v);
  }
  return v;
}

/**
 * Does a concrete client path match a server pattern positionally?
 * Params match ANY single segment (so `/api/users/:p` matches `/api/users/:p`
 * from a template literal, and also `/api/users/42`).
 */
export function pathMatches(clientPath, serverPattern) {
  const c = segments(clientPath);
  const s = segments(serverPattern);
  let i = 0;
  for (; i < s.length; i++) {
    if (s[i] === '*') return true; // express wildcard swallows the rest
    if (i >= c.length) return false;
    if (s[i] === ':p' || c[i] === ':p') continue; // positional param match
    if (s[i] !== c[i]) return false;
  }
  return i === c.length;
}

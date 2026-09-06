/**
 * Client↔server PATH-SHAPE contracts.
 *
 * The sibling harness (`octopusRouteContracts.test.ts`) asks "is this path
 * mounted anywhere?". That question has a blind spot: it answers YES for a
 * client call whose path *prefix* is mounted but whose actual request URL can
 * never match the handler's pattern.
 *
 * The two defects pinned below are exactly that shape:
 *
 *   1. The client requests `/api/marketplace/rankings/audit?userId=X`.
 *      The server declares `router.get('/audit/:userId')`. Express matches on
 *      the PATH only — the query string is not a path segment — so
 *      `/audit` never matches `/audit/:userId`. Every request 404s.
 *
 *   2. The client requests `/api/finance/commissions`. `/api/finance` IS
 *      mounted, so a prefix-based check passes, but no router under it
 *      declares `/commissions`. Every request 404s.
 *
 * WHY THESE TESTS ARE WRITTEN "INVERTED"
 * --------------------------------------
 * Both defects are owned by other lanes in this sprint; this lane is tests
 * only. A test asserting the FIXED behaviour would land red on main and block
 * everyone. So each entry is a CHARACTERIZATION test: it asserts the defect is
 * still present, stays green today, and fails loudly the moment someone fixes
 * the route — with a message telling them to delete the entry. Green here does
 * NOT mean the route works; read KNOWN_BROKEN.
 *
 * Pure static analysis over source text. Starts no server, touches no data.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

// ── source snapshot ───────────────────────────────────────────────────────

function collectServerSources(): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'tests') continue;
        walk(full);
        continue;
      }
      if (!/\.ts$/.test(entry.name)) continue;
      out.set(full.slice(root.length + 1), fs.readFileSync(full, 'utf8'));
    }
  };
  walk(path.join(root, 'server'));
  return out;
}
const SERVER_FILES = collectServerSources();

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Resolve an identifier used as a router argument back to the server file
 * that defines it, via either static or dynamic import in the same file.
 */
function resolveRouterFile(sourceFile: string, src: string, ident: string): string | null {
  const bare = ident.replace(/\.default$/, '');
  const b = esc(bare);
  const patterns = [
    new RegExp(`import\\s+${b}\\s+from\\s*["']([^"']+)["']`),
    new RegExp(`import\\s*\\{[^}]*\\b${b}\\b[^}]*\\}\\s*from\\s*["']([^"']+)["']`),
    new RegExp(`(?:const|let|var)\\s+${b}\\s*=\\s*await\\s+import\\(\\s*["']([^"']+)["']`),
  ];
  let spec: string | null = null;
  for (const re of patterns) {
    const m = re.exec(src);
    if (m) { spec = m[1]; break; }
  }
  if (!spec || !spec.startsWith('.')) return null;

  const baseDir = path.dirname(sourceFile);
  const joined = path.posix.normalize(path.posix.join(baseDir, spec));
  for (const cand of [`${joined}.ts`, `${joined}/index.ts`, joined]) {
    if (SERVER_FILES.has(cand)) return cand;
  }
  return null;
}

interface Mount { prefix: string; file: string | null }

/**
 * Every `app.use('/api/…', …, <router>)` with the router resolved back to
 * its defining file. Binding the mount to ONE file is what stops a
 * `router.get('/:id')` in an unrelated router from matching every literal
 * segment in the app — the flaw that makes a naive prefix check useless.
 */
function collectMounts(): Mount[] {
  const mounts: Mount[] = [];
  const re = /\bapp\.use\(\s*["'](\/api\/[^"']*)["']\s*,([^;]*?)\)\s*;/g;
  for (const [file, src] of SERVER_FILES) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const prefix = m[1].replace(/\/$/, '');
      const args = m[2].split(',').map((a) => a.trim()).filter(Boolean);
      const last = args[args.length - 1];
      if (!last || !/^[A-Za-z_$][\w$.]*$/.test(last)) { mounts.push({ prefix, file: null }); continue; }
      mounts.push({ prefix, file: resolveRouterFile(file, src, last) });
    }
  }
  return mounts.sort((a, b) => b.prefix.length - a.prefix.length);
}
const MOUNTS = collectMounts();

/** `router.<verb>('<suffix>')` declared in ONE file. */
function routerSuffixesIn(file: string, method: string): string[] {
  const src = SERVER_FILES.get(file);
  if (!src) return [];
  const out: string[] = [];
  const re = new RegExp(
    `\\b\\w*[Rr]outer\\.${method.toLowerCase()}\\(\\s*["']([^"']+)["']`,
    'g',
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.push(m[1]);
  // A router file may itself `.use('<sub>', subRouter)`; fold those in.
  const useRe = /\brouter\.use\(\s*["']([^"']+)["']\s*,\s*([A-Za-z_$][\w$.]*)\s*\)/g;
  while ((m = useRe.exec(src))) {
    const sub = resolveRouterFile(file, src, m[2]);
    if (sub) for (const s of routerSuffixesIn(sub, method)) {
      out.push(path.posix.join(m[1], s === '/' ? '' : s) || '/');
    }
  }
  return out;
}

/** Turn an express pattern ('/audit/:userId', '/x/*') into a matcher. */
function patternMatches(pattern: string, concrete: string): boolean {
  const rx =
    '^' +
    pattern
      .split('/')
      .map((seg) => {
        if (seg === '') return '';
        if (seg.startsWith(':')) return '[^/]+';
        if (seg === '*') return '.*';
        return esc(seg);
      })
      .join('/') +
    '/?$';
  return new RegExp(rx).test(concrete);
}

/**
 * Does a CONCRETE request path (query string stripped) reach a handler?
 */
function resolvesToHandler(concretePath: string, method: string): boolean {
  const lc = method.toLowerCase();

  // (a) absolute app.<verb>('/api/…') / router.<verb>('/api/…')
  const absRe = new RegExp(
    `\\b(?:app|\\w*[Rr]outer)\\.${lc}\\(\\s*["'](\\/api\\/[^"']*)["']`,
    'g',
  );
  for (const src of SERVER_FILES.values()) {
    let m: RegExpExecArray | null;
    while ((m = absRe.exec(src))) {
      if (patternMatches(m[1], concretePath)) return true;
    }
  }

  // (b) app.use('<prefix>', <router>) + that router's own suffixes
  for (const mount of MOUNTS) {
    if (concretePath !== mount.prefix && !concretePath.startsWith(mount.prefix + '/')) continue;
    if (!mount.file) continue;
    const rest = concretePath.slice(mount.prefix.length) || '/';
    for (const suffix of routerSuffixesIn(mount.file, method)) {
      if (patternMatches(suffix, rest)) return true;
    }
  }
  return false;
}

// ── the pinned defects ────────────────────────────────────────────────────

interface KnownBroken {
  id: string;
  /** Concrete URL the client actually requests, query string included. */
  clientUrl: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** File that issues the call, for the fixer. */
  callSite: string;
  /** What the server declares instead. */
  serverDeclares: string;
  owner: string;
}

const KNOWN_BROKEN: KnownBroken[] = [
  {
    id: 'marketplace-rankings-audit-query-vs-param',
    clientUrl: '/api/marketplace/rankings/audit?userId=abc123',
    method: 'GET',
    callSite: 'client/src/pages/MarketplaceIntelligenceDashboard.tsx:113',
    serverDeclares:
      "server/routes/marketplace-ranking.ts:465 router.get('/audit/:userId') " +
      "mounted at server/routes.ts:13590 app.use('/api/marketplace/rankings')",
    owner: 'admin / marketplace lane',
  },
  {
    id: 'finance-commissions-no-handler',
    clientUrl: '/api/finance/commissions?period=recent',
    method: 'GET',
    callSite:
      'client/src/components/control-panel/FinanceSettlementsView.tsx:104',
    serverDeclares:
      "nothing — server/routes/finance.ts declares /profitability/*, " +
      '/capital-signals, /ownership-comparison, /friction-analytics, /summary',
    owner: 'finance / admin lane',
  },
];

describe('client↔server path-shape contracts', () => {
  describe('KNOWN BROKEN (characterization — green means STILL BROKEN)', () => {
    for (const d of KNOWN_BROKEN) {
      it(`${d.id} — client call still 404s`, () => {
        const concrete = d.clientUrl.split('?')[0];
        const resolved = resolvesToHandler(concrete, d.method);
        expect(
          resolved,
          `\n\nGOOD NEWS: ${d.method} ${concrete} now resolves to a handler — ` +
            `this defect appears FIXED.\n` +
            `Delete the "${d.id}" entry from KNOWN_BROKEN in this file and add ` +
            `the path to a positive contract instead.\n` +
            `(call site: ${d.callSite})\n`,
        ).toBe(false);
      });
    }
  });

  describe('sanity — the matcher is not vacuously failing', () => {
    it('resolves a route that genuinely exists', () => {
      // /api/finance/summary IS declared (server/routes/finance.ts:172).
      expect(resolvesToHandler('/api/finance/summary', 'GET')).toBe(true);
    });

    it('resolves a :param route when the client supplies the segment', () => {
      // The SAME rankings router matches once the id is a path segment —
      // proving defect #1 is the query-vs-param shape, not a missing handler.
      expect(
        resolvesToHandler('/api/marketplace/rankings/audit/abc123', 'GET'),
      ).toBe(true);
    });

    it('rejects a path nobody mounts', () => {
      expect(resolvesToHandler('/api/definitely/not/mounted/xyz', 'GET')).toBe(
        false,
      );
    });
  });

  describe('the client call sites still look the way this pin assumes', () => {
    for (const d of KNOWN_BROKEN) {
      it(`${d.id} — call site file still exists`, () => {
        const file = d.callSite.split(':')[0];
        expect(
          fs.existsSync(path.join(root, file)),
          `${file} moved; re-point the "${d.id}" pin.`,
        ).toBe(true);
      });
    }
  });
});

/**
 * Client API-call extractor.
 *
 * Finds every place the web client asks the server for something, and
 * normalises it to { method, path, file, line, kind, raw }.
 *
 * Handles:
 *   - apiRequest(...)  — BOTH argument orders this repo's wrapper accepts:
 *       apiRequest('POST', '/api/x', body)
 *       apiRequest('/api/x', 'POST', body)
 *       apiRequest('/api/x', { method: 'PATCH', body })
 *       apiRequest('/api/x')                      -> GET
 *   - raw fetch('/api/x', { method }) and fetch(getApiUrl('/api/x'), …)
 *   - axios.get/post/put/patch/delete('/api/x', …) and axios({ url, method })
 *   - new EventSource('/api/x') / new WebSocket('…/ws')
 *   - TanStack Query `queryKey: ['/api/x', …]` WITH NO sibling queryFn —
 *     the repo's default queryFn does GET getApiUrl(queryKey[0]), so a
 *     bare queryKey IS a real GET. When a sibling queryFn exists the key
 *     is only a cache key and is NOT a request: emitting it anyway is a
 *     classic false positive, so we skip it.
 *
 * Template literals are normalised: `/api/x/${id}/y` -> /api/x/:p/y
 * String concat  '/api/x/' + id                      -> /api/x/:p
 */
import fs from 'node:fs';
import path from 'node:path';

const SKIP_DIR = new Set(['node_modules', 'dist', 'build', '.git', '__snapshots__']);
const EXT = /\.(ts|tsx|js|jsx)$/;

export function listClientFiles(root, roots = ['client/src', 'shared']) {
  const out = [];
  const walk = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (!SKIP_DIR.has(e.name)) walk(full); continue; }
      if (!EXT.test(e.name)) continue;
      if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(e.name)) continue;
      out.push(full);
    }
  };
  for (const r of roots) walk(path.join(root, r));
  return out;
}

/** Same string-aware comment blanker as the server side. */
function blankComments(src) {
  const out = new Array(src.length);
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i], c2 = src[i + 1];
    if (c === '/' && c2 === '/') { while (i < n && src[i] !== '\n') { out[i] = ' '; i++; } continue; }
    if (c === '/' && c2 === '*') {
      out[i] = ' '; out[i + 1] = ' '; i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { out[i] = src[i] === '\n' ? '\n' : ' '; i++; }
      if (i < n) { out[i] = ' '; out[i + 1] = ' '; i += 2; }
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; out[i] = c; i++;
      while (i < n) {
        if (src[i] === '\\') { out[i] = src[i]; out[i + 1] = src[i + 1] ?? ' '; i += 2; continue; }
        if (src[i] === q) { out[i] = src[i]; i++; break; }
        if (q !== '`' && src[i] === '\n') break;
        out[i] = src[i]; i++;
      }
      continue;
    }
    out[i] = c; i++;
  }
  for (let k = 0; k < n; k++) if (out[k] === undefined) out[k] = src[k] === '\n' ? '\n' : ' ';
  return out.join('');
}

/** O(log n) line lookup — the naive O(n) scan makes a 900-file sweep quadratic. */
function makeLineIndex(src) {
  const nl = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === '\n') nl.push(i + 1);
  return (idx) => {
    let lo = 0, hi = nl.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (nl[mid] <= idx) lo = mid; else hi = mid - 1; }
    return lo + 1;
  };
}

function readArgs(src, openParen) {
  let depth = 0;
  for (let i = openParen; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')') { depth--; if (depth === 0) return src.slice(openParen + 1, i); }
  }
  return src.slice(openParen + 1, Math.min(src.length, openParen + 1500));
}

/** Split a top-level argument list on commas (respecting nesting/strings). */
function splitArgs(text) {
  const parts = [];
  let depth = 0, cur = '', q = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      cur += c;
      if (c === '\\') { cur += text[i + 1] ?? ''; i++; continue; }
      if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { q = c; cur += c; continue; }
    if ('([{'.includes(c)) depth++;
    if (')]}'.includes(c)) depth--;
    if (c === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) parts.push(cur);
  return parts.map((p) => p.trim());
}

const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

/**
 * Turn one argument expression into a concrete API path, or null.
 * Recognises: '…', "…", `…${x}…`, getApiUrl('…'), `${API_BASE}/api/x`,
 * '/api/x/' + id.
 */
export function toPath(expr) {
  if (!expr) return null;
  let e = expr.trim();
  // unwrap helper wrappers: getApiUrl(...), buildUrl(...), apiUrl(...)
  const wrap = e.match(/^(?:getApiUrl|apiUrl|buildApiUrl|withBase|resolveApiUrl)\s*\(([\s\S]*)\)$/);
  if (wrap) e = splitArgs(wrap[1])[0] ?? '';
  e = e.trim();

  // string concatenation: take the leading literal, params for the rest
  if (/^['"`]/.test(e) && /\+/.test(e)) {
    const lead = e.match(/^(['"`])([\s\S]*?)\1/);
    if (lead) {
      const tail = e.slice(lead[0].length);
      let p = lead[2];
      // each + <expr> that is not a string literal becomes one param segment
      const pieces = tail.split('+').map((s) => s.trim()).filter(Boolean);
      for (const piece of pieces) {
        const lit = piece.match(/^(['"`])([\s\S]*?)\1$/);
        if (lit) p += lit[2];
        else p += ':p';
      }
      return normalise(p);
    }
  }

  const plain = e.match(/^(['"])([\s\S]*?)\1$/);
  if (plain) return normalise(plain[2]);

  const tpl = e.match(/^`([\s\S]*)`$/);
  if (tpl) return normalise(collapseTemplate(tpl[1]));
  return null;
}

/**
 * Replace every `${…}` in a template body with `:p`, matching BRACES
 * PROPERLY. A naive /\$\{.*?\}/ stops at the first `}` and mangles
 * nested templates such as
 *   `/api/admin/suppliers${q ? `?limit=${n}` : ''}`
 * into the garbage path `/api/admin/suppliers:p` : ''}` — a guaranteed
 * false positive. If an interpolation itself contains a `?`, everything
 * from that point is a QUERY STRING, so the path ends there.
 */
export function collapseTemplate(body) {
  let out = '';
  for (let i = 0; i < body.length; i++) {
    if (body[i] === '$' && body[i + 1] === '{') {
      let depth = 0, j = i + 1;
      for (; j < body.length; j++) {
        if (body[j] === '{') depth++;
        else if (body[j] === '}') { depth--; if (depth === 0) break; }
      }
      const inner = body.slice(i + 2, j);
      if (inner.includes('?') && /['"`]\s*\?/.test(inner)) return out; // query-string tail
      out += ':p';
      i = j;
      continue;
    }
    if (body[i] === '?') return out; // literal query string starts here
    out += body[i];
  }
  return out;
}

function normalise(p) {
  if (!p) return null;
  // absolute URLs: keep only the path
  const abs = p.match(/^https?:\/\/[^/]*(\/.*)?$/i);
  if (abs) p = abs[1] || '/';
  // strip a leading :p that came from `${API_BASE}` etc.
  if (p.startsWith(':p/')) p = p.slice(2);
  // drop query + hash
  p = p.split('?')[0].split('#')[0];
  if (!p.startsWith('/')) return null;
  p = p.replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/';
  // A `:p` glued inside a segment (`user_${id}` -> `user_:p`) still denotes
  // ONE dynamic segment — normalise it so positional matching works.
  p = p.split('/').map((seg) => (seg.includes(':p') ? ':p' : seg)).join('/');
  return p;
}

function hasQuery(expr) { return /\?/.test(expr ?? ''); }

/** Find the object literal enclosing `idx` and return its text. */
function enclosingObject(src, idx) {
  let depth = 0;
  let start = -1;
  for (let i = idx; i >= 0 && i > idx - 6000; i--) {
    const c = src[i];
    if (c === '}') depth++;
    else if (c === '{') { if (depth === 0) { start = i; break; } depth--; }
  }
  if (start < 0) return '';
  depth = 0;
  for (let i = start; i < src.length && i < start + 12000; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  return src.slice(start, Math.min(src.length, start + 12000));
}

export function extractClientCalls(root, files) {
  const calls = [];
  for (const abs of files) {
    const rel = path.relative(root, abs);
    const raw = fs.readFileSync(abs, 'utf8');
    const src = blankComments(raw);
    const lineOf = ((f) => (i) => f(i))(makeLineIndex(src));
    const push = (o) => { if (o.path && o.path.startsWith('/api')) calls.push({ file: rel, ...o }); };

    // ── apiRequest(...) ────────────────────────────────────────────────
    for (const m of src.matchAll(/\bapiRequest\s*\(/g)) {
      const open = m.index + m[0].length - 1;
      const args = splitArgs(readArgs(src, open));
      const line = lineOf(m.index);
      if (!args.length) continue;
      const a0 = args[0], a1 = args[1], a2 = args[2];
      const a0Lit = a0.match(/^(['"])([\s\S]*?)\1$/);
      let method = null, pathExpr = null, bodyExpr = null;
      if (a0Lit && METHODS.has(a0Lit[2].toUpperCase())) {
        method = a0Lit[2].toUpperCase(); pathExpr = a1; bodyExpr = a2;
      } else {
        pathExpr = a0;
        const a1Lit = a1?.match(/^(['"])([\s\S]*?)\1$/);
        if (a1Lit && METHODS.has(a1Lit[2].toUpperCase())) { method = a1Lit[2].toUpperCase(); bodyExpr = a2; }
        else if (a1 && a1.startsWith('{')) {
          const mm = a1.match(/method\s*:\s*['"]([A-Za-z]+)['"]/);
          method = mm ? mm[1].toUpperCase() : 'GET';
          bodyExpr = /\bbody\s*:/.test(a1) ? a1 : undefined;
        } else method = 'GET';
      }
      push({ method: method ?? 'GET', path: toPath(pathExpr), line, kind: 'apiRequest', raw: pathExpr, hasQuery: hasQuery(pathExpr), hasBody: !!bodyExpr });
    }

    // ── raw fetch(...) ────────────────────────────────────────────────
    for (const m of src.matchAll(/(?<![.\w])fetch(?:WithRetry)?\s*\(/g)) {
      const open = m.index + m[0].length - 1;
      const args = splitArgs(readArgs(src, open));
      const line = lineOf(m.index);
      if (!args.length) continue;
      const opts = args[1] ?? '';
      const mm = opts.match(/method\s*:\s*['"]([A-Za-z]+)['"]/);
      push({
        method: mm ? mm[1].toUpperCase() : 'GET',
        path: toPath(args[0]), line, kind: 'fetch', raw: args[0],
        hasQuery: hasQuery(args[0]), hasBody: /\bbody\s*:/.test(opts),
      });
    }

    // ── axios ─────────────────────────────────────────────────────────
    for (const m of src.matchAll(/\baxios\s*\.\s*(get|post|put|patch|delete|head|options)\s*\(/g)) {
      const open = m.index + m[0].length - 1;
      const args = splitArgs(readArgs(src, open));
      push({ method: m[1].toUpperCase(), path: toPath(args[0]), line: lineOf(m.index), kind: 'axios', raw: args[0], hasQuery: hasQuery(args[0]), hasBody: args.length > 1 });
    }

    // ── EventSource / WebSocket ───────────────────────────────────────
    for (const m of src.matchAll(/new\s+(EventSource|WebSocket)\s*\(/g)) {
      const open = m.index + m[0].length - 1;
      const args = splitArgs(readArgs(src, open));
      const p = toPath(args[0]);
      if (!p) continue;
      push({ method: 'GET', path: p, line: lineOf(m.index), kind: m[1] === 'EventSource' ? 'sse' : 'ws', raw: args[0], hasQuery: hasQuery(args[0]), hasBody: false });
    }

    // ── TanStack queryKey with NO sibling queryFn -> default GET ───────
    for (const m of src.matchAll(/\bqueryKey\s*:\s*\[/g)) {
      const bracket = m.index + m[0].length - 1;
      // read the array
      let depth = 0, end = bracket;
      for (let i = bracket; i < src.length; i++) {
        if (src[i] === '[') depth++;
        else if (src[i] === ']') { depth--; if (depth === 0) { end = i; break; } }
      }
      const arr = src.slice(bracket + 1, end);
      const first = splitArgs(arr)[0];
      const p = toPath(first);
      if (!p) continue;
      const obj = enclosingObject(src, m.index);
      const hasFn = /\bqueryFn\s*[:(]/.test(obj);
      const line = lineOf(m.index);
      if (hasFn) {
        calls.push({ file: rel, method: 'GET', path: p, line, kind: 'queryKey-with-queryFn', raw: first, hasQuery: false, hasBody: false, informational: true });
        continue;
      }
      // invalidateQueries / setQueryData / removeQueries are cache ops, not requests
      const before = src.slice(Math.max(0, m.index - 220), m.index);
      if (/(invalidateQueries|setQueryData|getQueryData|removeQueries|cancelQueries|refetchQueries|resetQueries|prefetchQuery|ensureQueryData)\s*\(\s*\{?\s*$/.test(before)) {
        calls.push({ file: rel, method: 'GET', path: p, line, kind: 'cache-op', raw: first, informational: true });
        continue;
      }
      push({ method: 'GET', path: p, line, kind: 'queryKey', raw: first, hasQuery: false, hasBody: false });
    }
  }
  return calls;
}

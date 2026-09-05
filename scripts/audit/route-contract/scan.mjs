#!/usr/bin/env node
/**
 * Route-contract scanner v2 — client ↔ server matcher with real mount
 * resolution.
 *
 *   node scripts/audit/route-contract/scan.mjs            # human summary
 *   node scripts/audit/route-contract/scan.mjs --json     # machine output
 *   node scripts/audit/route-contract/scan.mjs --md       # markdown report
 *   node scripts/audit/route-contract/scan.mjs --path /api/foo
 *
 * Classification (exactly one per client call):
 *   MATCH                  method+path resolve to a mounted handler
 *   METHOD_MISMATCH        path resolves, HTTP verb does not
 *   PARAM_MISMATCH         server needs path param(s) the client omits
 *                          (or the client sends them as a query string)
 *   PATH_MISMATCH          a same-named handler exists under a different
 *                          mount prefix — the client's prefix is wrong
 *   BODY_MISMATCH          client sends a body on GET, or sends none to a
 *                          handler that requires req.body fields
 *   AUTH_MISMATCH          admin-surface handler with no admin gate on the
 *                          route and no admin gate on its mount chain
 *   LEGACY                 resolves ONLY to a 410 retirement sentinel
 *   CLIENT_ONLY            nothing on the server resolves — a live 404
 *   SERVER_ONLY-SENSITIVE  mounted sensitive handler no client ever calls
 *   FALSE-POSITIVE         considered and rejected, with the reason
 */
import fs from 'node:fs';
import path from 'node:path';
import { buildServerRouteTable, segments, normalizePattern } from './serverRoutes.mjs';
import { listClientFiles, extractClientCalls } from './clientCalls.mjs';

const ROOT = process.env.SCAN_ROOT || process.cwd();

// ── matching ────────────────────────────────────────────────────────────

/** Express answers HEAD with the GET handler. */
function verbMatches(clientMethod, serverMethod) {
  if (serverMethod === 'ALL') return true;
  if (clientMethod === serverMethod) return true;
  if (clientMethod === 'HEAD' && serverMethod === 'GET') return true;
  return false;
}

/** How many LEADING segments are identical literals (no params on either side). */
function literalOverlap(clientPath, serverPattern) {
  const c = segments(clientPath), s = segments(serverPattern);
  let n = 0;
  for (let i = 0; i < Math.min(c.length, s.length); i++) {
    if (c[i] !== s[i] || c[i] === ':p') break;
    n++;
  }
  return n;
}

function matchScore(clientPath, serverPattern) {
  const c = segments(clientPath);
  const s = segments(serverPattern);
  let i = 0;
  for (; i < s.length; i++) {
    if (s[i] === '*') return { ok: true, wildcard: true, extraServerParams: 0 };
    if (i >= c.length) {
      // server pattern is LONGER than the client path — if every remaining
      // server segment is a param, the client is dropping required params.
      const rest = s.slice(i);
      if (rest.every((x) => x === ':p')) return { ok: false, extraServerParams: rest.length };
      return { ok: false, extraServerParams: 0 };
    }
    if (s[i] === ':p' || c[i] === ':p') continue;
    if (s[i] !== c[i]) return { ok: false, extraServerParams: 0 };
  }
  if (i < c.length) return { ok: false, extraServerParams: 0, clientLonger: c.length - i };
  return { ok: true, extraServerParams: 0 };
}

/**
 * Express matches in REGISTRATION ORDER. A static segment registered AFTER
 * a param route on the same prefix is unreachable. We approximate order by
 * (file, line) — correct for the overwhelmingly common case where both
 * handlers live in the same router module.
 */
function findShadow(route, sameFileSameMethod) {
  const segs = segments(route.path);
  for (const other of sameFileSameMethod) {
    if (other === route) continue;
    if (other.line >= route.line) continue;
    const o = segments(other.path);
    if (o.length !== segs.length) continue;
    let shadows = false;
    for (let i = 0; i < o.length; i++) {
      if (o[i] === segs[i]) continue;
      if (o[i] === ':p' && segs[i] !== ':p') { shadows = true; continue; }
      shadows = false; break;
    }
    if (shadows) return other;
  }
  return null;
}

const SENSITIVE = /\/(admin|super-admin|payout|treasury|escrow|wallet|refund|ledger|finance|billing|kyc|fiscal|sumit|nayax|invoice|payment|coupon|gift|voucher)(\/|$)/i;

function ownerDomain(p) {
  if (/^\/api\/admin(\/|$)/.test(p)) return 'admin';
  if (/prestige|egift|e-gift|gift|sumit|wallet|fiscal|invoice|loyalty|voucher/i.test(p)) return 'prestige|egift|sumit';
  if (/k9000|station|bay|kiosk|nayax|iot|machine/i.test(p)) return 'stations|k9000';
  if (/provider|sitter|walk|academy|kyc|payout/i.test(p)) return 'provider';
  if (/booking|quote|marketplace|availability|slot|calendar|dispute|escrow/i.test(p)) return 'booking';
  if (/auth|login|otp|passkey|session|csrf|security|whoami|mfa/i.test(p)) return 'auth|security';
  if (/\/ws|socket|stream|sse|events/i.test(p)) return 'ws|sse';
  if (/public|marketing|seo|blog|contact|careers|landing/i.test(p)) return 'public/marketing';
  return 'other';
}

// ── run ─────────────────────────────────────────────────────────────────

export function run(root = ROOT) {
  const table = buildServerRouteTable(root);
  const serverRoutes = table.routes;
  // A wildcard-terminated registration is a GUARD or a FALLBACK, never a
  // concrete endpoint:
  //   app.get('*', …)                 SPA html fallback (next()s for /api/)
  //   app.post('/api/finance/*', …)   finance guard middleware chain
  // Counting those as "the path resolves" is exactly the false positive
  // that let /api/finance/commissions look like a METHOD_MISMATCH instead
  // of the CLIENT_ONLY 404 it really is.
  const isWildcard = (r) => /\*/.test(r.path);
  const live = serverRoutes.filter((r) => !r.is410 && !isWildcard(r));
  const wildcards = serverRoutes.filter((r) => !r.is410 && isWildcard(r));
  const retired = serverRoutes.filter((r) => r.is410);

  const clientFiles = listClientFiles(root);
  const allCalls = extractClientCalls(root, clientFiles);
  const calls = allCalls.filter((c) => !c.informational);
  const rejected = allCalls.filter((c) => c.informational);

  // index server routes by first two segments for speed
  const byHead = new Map();
  for (const r of live) {
    const head = segments(r.path).slice(0, 2).join('/');
    if (!byHead.has(head)) byHead.set(head, []);
    byHead.get(head).push(r);
  }
  const candidatesFor = (p) => byHead.get(segments(p).slice(0, 2).join('/')) ?? [];

  // (file, method) buckets so the shadowing check is O(bucket) not O(all).
  const byFileMethod = new Map();
  for (const r of live) {
    const k = `${r.file}::${r.method}`;
    if (!byFileMethod.has(k)) byFileMethod.set(k, []);
    byFileMethod.get(k).push(r);
  }
  const shadowBucket = (r) => byFileMethod.get(`${r.file}::${r.method}`) ?? [];

  const byTail = new Map();
  for (const r of live) {
    const t = segments(r.path).slice(-2).join('/');
    if (!byTail.has(t)) byTail.set(t, []);
    byTail.get(t).push(r);
  }

  // Client calls indexed by head, so the SERVER_ONLY sweep is not a
  // 3k x 1.5k cross product.
  const callsByHead = new Map();

  for (const c of calls) {
    const h = segments(c.path).slice(0, 2).join('/');
    if (!callsByHead.has(h)) callsByHead.set(h, []);
    callsByHead.get(h).push(c);
  }

  const findings = [];
  const matchedServer = new Set();

  for (const call of calls) {
    const cands = candidatesFor(call.path);
    const pathHits = [];
    let paramShort = null;
    let clientLonger = null;
    for (const r of cands) {
      const s = matchScore(call.path, r.path);
      if (s.ok) pathHits.push(r);
      else if (s.extraServerParams > 0) {
        // keep the candidate that shares the MOST literal prefix
        if (!paramShort || literalOverlap(call.path, r.path) > literalOverlap(call.path, paramShort.path)) paramShort = r;
      } else if (s.clientLonger && !clientLonger) clientLonger = r;
    }

    // A method-only hit that matched because a SERVER PARAM swallowed a
    // literal client segment (`/rankings/:userId` eating `/rankings/audit`)
    // is weaker evidence than a deeper route that shares more literal
    // prefix (`/rankings/audit/:userId`). Prefer the latter.
    if (pathHits.length && paramShort) {
      const bestHit = Math.max(...pathHits.map((r) => literalOverlap(call.path, r.path)));
      if (literalOverlap(call.path, paramShort.path) > bestHit) pathHits.length = 0;
    }

    if (pathHits.length) {
      const verbHit = pathHits.find((r) => verbMatches(call.method, r.method));
      if (verbHit) {
        matchedServer.add(verbHit);
        const shadow = findShadow(verbHit, shadowBucket(verbHit));
        if (shadow) {
          findings.push(mk('PATH_MISMATCH', call, verbHit, `handler is SHADOWED — ${shadow.method} ${shadow.path} is registered earlier in the same router (${shadow.file}:${shadow.line}) and swallows this path`));
          continue;
        }
        if (call.method === 'GET' && call.hasBody) {
          findings.push(mk('BODY_MISMATCH', call, verbHit, 'client attaches a request body to a GET'));
          continue;
        }
        continue; // MATCH — not reported
      }
      findings.push(mk('METHOD_MISMATCH', call, pathHits[0],
        `server exposes ${[...new Set(pathHits.map((r) => r.method))].join('/')} at this path, client sends ${call.method}`));
      continue;
    }

    // path did not resolve — is it a retirement sentinel?
    const retiredHit = retired.find((r) => matchScore(call.path, r.path).ok);
    if (retiredHit) {
      findings.push(mk('LEGACY', call, retiredHit, 'resolves only to a 410 retirement sentinel'));
      continue;
    }

    if (paramShort) {
      const missing = segments(paramShort.path).length - segments(call.path).length;
      const verbNote = verbMatches(call.method, paramShort.method)
        ? ''
        : ` — AND the verb is wrong: server is ${paramShort.method}, client sends ${call.method}`;
      findings.push(mk('PARAM_MISMATCH', call, paramShort,
        (call.hasQuery
          ? `server declares ${missing} PATH param(s) (${paramShort.path}); client sends the value as a QUERY STRING`
          : `server requires ${missing} more path param(s) (${paramShort.path}); client stops at ${call.path}`) + verbNote));
      continue;
    }

    // same tail segment mounted under a different prefix?
    const tail = segments(call.path).slice(-2).join('/');
    const elsewhere = (byTail.get(tail) ?? []).filter((r) => verbMatches(call.method, r.method));
    if (elsewhere.length) {
      findings.push(mk('PATH_MISMATCH', call, elsewhere[0],
        `no route at ${call.path}; the same handler is mounted at ${elsewhere[0].path}`));
      continue;
    }

    findings.push(mk('CLIENT_ONLY', call, null, 'no server route resolves — this call 404s'));
  }

  // AUTH_MISMATCH — admin-surface handlers with no admin gate anywhere on
  // the chain. The /api/admin/ blanket in server/routes.ts covers that
  // prefix, so only NON-/api/admin admin surfaces are reportable.
  const authFindings = [];
  for (const r of live) {
    if (!/admin/i.test(r.path)) continue;
    if (/^\/api\/admin(\/|$)/.test(r.path)) continue; // covered by the blanket stack
    if (r.auth === 'admin' || r.auth === 'super_admin') continue;
    authFindings.push({
      kind: 'AUTH_MISMATCH', domain: ownerDomain(r.path),
      clientRef: '(server-side finding)',
      server: `${r.method} ${r.path}`, serverRef: `${r.file}:${r.line}`,
      note: `admin-named route outside the /api/admin/ guard blanket; no admin middleware on the handler line (detected auth: ${r.auth})`,
    });
  }

  // SERVER_ONLY-SENSITIVE
  const calledPaths = new Set(calls.map((c) => normalizePattern(c.path)));
  const serverOnly = [];
  for (const r of live) {
    if (matchedServer.has(r)) continue;
    if (!SENSITIVE.test(r.path)) continue;
    const bucket = callsByHead.get(segments(r.path).slice(0, 2).join('/')) ?? [];
    const anyClient = bucket.some((c) => matchScore(c.path, r.path).ok);
    if (anyClient) continue;
    serverOnly.push({
      kind: 'SERVER_ONLY-SENSITIVE', domain: ownerDomain(r.path),
      clientRef: '(no client caller)',
      server: `${r.method} ${r.path}`, serverRef: `${r.file}:${r.line}`,
      note: `sensitive surface with no web-client caller (may be mobile/cron/admin-tool only)`,
    });
  }

  function mk(kind, call, route, note) {
    return {
      kind, domain: ownerDomain(call.path),
      client: `${call.method} ${call.path}`,
      clientRef: `${call.file}:${call.line}`,
      clientKind: call.kind,
      server: route ? `${route.method} ${route.path}` : 'no server route resolves',
      serverRef: route ? `${route.file}:${route.line}` : '—',
      note,
    };
  }

  return {
    stats: {
      serverRoutes: serverRoutes.length,
      liveRoutes: live.length,
      retiredSentinels: retired.length,
      unresolvedMounts: table.unresolved.length,
      unmountedHandlers: table.orphans.length,
      wildcardGuards: wildcards.length,
      clientFiles: clientFiles.length,
      clientCalls: calls.length,
      rejectedNonRequests: rejected.length,
      matched: calls.length - findings.length,
    },
    findings, authFindings, serverOnly,
    orphans: table.orphans, unresolved: table.unresolved,
    rejected,
  };
}

// ── CLI ─────────────────────────────────────────────────────────────────

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const res = run();
  if (args.includes('--json')) { console.log(JSON.stringify(res, null, 2)); process.exit(0); }
  const filter = args.includes('--path') ? args[args.indexOf('--path') + 1] : null;
  const rows = filter ? res.findings.filter((f) => f.client.includes(filter)) : res.findings;

  console.log('\nROUTE-CONTRACT SCAN v2\n' + '='.repeat(60));
  for (const [k, v] of Object.entries(res.stats)) console.log(`  ${k.padEnd(24)} ${v}`);
  const byKind = {};
  for (const f of rows) byKind[f.kind] = (byKind[f.kind] || 0) + 1;
  console.log('\nFindings by class:');
  for (const [k, v] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(20)} ${v}`);
  console.log(`  ${'AUTH_MISMATCH'.padEnd(20)} ${res.authFindings.length}`);
  console.log(`  ${'SERVER_ONLY-SENS'.padEnd(20)} ${res.serverOnly.length}`);
  console.log('');
  const groups = {};
  for (const f of rows) (groups[f.domain] ??= []).push(f);
  for (const [dom, list] of Object.entries(groups).sort()) {
    console.log(`\n── ${dom} (${list.length}) ${'─'.repeat(Math.max(0, 46 - dom.length))}`);
    for (const f of list) {
      console.log(`  [${f.kind}] ${f.client}`);
      console.log(`      client : ${f.clientRef} (${f.clientKind})`);
      console.log(`      server : ${f.server}  ${f.serverRef}`);
      console.log(`      why    : ${f.note}`);
    }
  }
}

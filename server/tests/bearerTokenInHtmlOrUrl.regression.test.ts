/**
 * Regression pin — no Firebase bearer secret in rendered HTML or URL
 * (CEO invariant, AUDIT-LOG-13 / #216 landing anchor).
 *
 * The CEO's stated invariant, verbatim:
 *   "No Firebase custom token, session token, OTP, bearer token or
 *    equivalent secret should be embedded into rendered HTML where
 *    browser extensions, logs, caching, analytics or page source can
 *    expose it."
 *
 * Two failure modes this pin defends against:
 *
 *   1. Interpolating a Firebase custom token, ID token, or session
 *      cookie value into an HTML template string served from
 *      res.send / res.type('html') / setHeader Content-Type text/html.
 *      Once in the HTML source it is visible to every browser
 *      extension on the page, page-source viewers, HAR exports,
 *      analytics/RUM snapshots, and any bfcache reload.
 *
 *   2. Attaching a Firebase custom token, ID token, or session
 *      cookie value as a URL query parameter (e.g.
 *      `?token=${customToken}`). URLs are visible to browser history,
 *      referer headers on outbound links, CDN edge logs, and
 *      server access logs.
 *
 * The fix (landed in #216) is a Redis-backed one-time handoff:
 * mint the token, stash it under a random code, expose only the
 * code — the actual bearer secret arrives via a POST response body
 * (a surface not scraped by extensions, history, referer, CDN, or
 * page-source).
 *
 * This pin walks the server tree and refuses any regression that
 * puts a real Firebase bearer secret back into either surface. It
 * carve-outs the two files where the anti-pattern's shape is
 * described but NOT executed — the comments inside them explain
 * WHY the pattern is banned.
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');

/** Files where the anti-pattern lives ONLY as a doc-comment or
 *  cautionary reference — allowlist so their prose text can name it
 *  without tripping the pin. */
const ALLOWED = new Set<string>([
  'server/security/productionHardeningAndOneTap.ts', // documented shape (fixed)
  'server/security/oneTapHandoff.ts',                // doc-comment names the fix
]);

function grepRepo(pattern: string): string[] {
  try {
    const out = execSync(
      `rg --no-heading -n -g '*.ts' -g '!server/tests/**' -g '!**/node_modules/**' -g '!client/**' ${JSON.stringify(pattern)} ${ROOT}`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 30_000 },
    );
    return out.split('\n').filter(Boolean);
  } catch (err: any) {
    if (err?.status === 1) return [];
    throw err;
  }
}

function stray(hits: string[]): string[] {
  return hits
    .map((l) => l.split(':')[0].replace(ROOT + '/', ''))
    .filter((f) => !ALLOWED.has(f));
}

describe('CEO invariant — no bearer secret in HTML or URL', () => {
  it('no server code interpolates a Firebase customToken into an HTML template literal', () => {
    // The concrete anti-pattern is `${customToken}` (or with a member
    // access variant like `${opts.customToken}`) anywhere in the file.
    // A template literal is the exact shape #216 fixed. Callers that
    // legitimately need the token in the response body use `JSON.stringify`
    // outside a template-literal render context (fetch bodies, JSON
    // response) — those are fine and don't match this pattern.
    const hits = grepRepo(String.raw`\$\{[a-zA-Z_.]*customToken[a-zA-Z_.]*\}`);
    const strays = stray(hits);
    expect(
      strays,
      `customToken interpolated into a template literal (HTML render risk). Use the Redis handoff (server/security/oneTapHandoff.ts) instead:\n${strays.join('\n')}`,
    ).toEqual([]);
  });

  it('no server code emits `?token=<customToken>` in a URL query', () => {
    // `?token=${…customToken…}` is the URL-leak shape #216 fixed on
    // employees.ts. Any reintroduction — for a custom token, ID token,
    // or session cookie — trips this.
    const hits = grepRepo(String.raw`\?token=\$\{[^}]*(?:customToken|idToken|sessionCookie)`);
    const strays = stray(hits);
    expect(
      strays,
      `bearer token in URL query. URLs leak to history, referer, CDN and access logs. Use the Redis handoff:\n${strays.join('\n')}`,
    ).toEqual([]);
  });

  it('no server code puts a Firebase ID token in a URL query at all', () => {
    // Broader than the customToken carve-out — a raw idToken in a URL
    // is even more dangerous because it directly authenticates the
    // Firebase user, no createCustomToken round-trip required.
    const hits = grepRepo(String.raw`[?&]idToken=\$\{`);
    const strays = stray(hits);
    expect(
      strays,
      `Firebase idToken in URL query — refused. ID tokens are sent in Authorization: Bearer headers or fetch bodies, never URLs:\n${strays.join('\n')}`,
    ).toEqual([]);
  });

  it('one-tap HTML template carries only the handoff CODE, never the token itself', () => {
    // Anchor the fix: the autoSignHtml template must reference
    // `opts.handoffCode` (never `opts.customToken`) and the exchange
    // path fetches the token via POST /api/oauth/one-tap/exchange.
    const src = readFileSync(join(ROOT, 'server/security/productionHardeningAndOneTap.ts'), 'utf8');
    expect(src).toMatch(/opts\.handoffCode/);
    expect(src).not.toMatch(/JSON\.stringify\(opts\.customToken/);
    expect(src).toMatch(/\/api\/oauth\/one-tap\/exchange/);
  });
});

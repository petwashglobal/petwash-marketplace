/**
 * PR-MONEY-FIX-NAYAX-STATION-KEY — burn-side x-station-key is validated.
 *
 * Audit Agent C (2026-08-15) HIGH-1 finding. The two Nayax burn
 * endpoints in server/routes/credit-wallet.ts —
 *
 *   POST /api/credit-wallet/nayax/validate-code   — reserves burn on a
 *                                                    live wallet credit
 *   POST /api/credit-wallet/nayax/acknowledge     — finalizes that burn
 *                                                    against the ledger
 *
 * — used to gate on x-station-key PRESENCE only. Any non-empty header
 * value passed the check (`if (!stationApiKey) return 401`). That is
 * D12 territory: a spoofed header let an unauthenticated caller
 * enumerate live redemption codes and finalize burns on real
 * customer credit.
 *
 * The proven validator (used by /api/nayax/redeem in routes.ts:4875)
 * is validateStationKey() in nayaxFirestoreService — a Firestore
 * lookup on nayax_terminals WHERE apiKey==key AND isActive==true,
 * returning the terminal record or null → 403 on null. This fix wires
 * both burn endpoints through the same helper (extracted as
 * authorizeStationCaller) so the burn rails cannot drift from the
 * redeem rails again.
 *
 * Also: /validate-code additionally binds the caller's terminal to
 * the body stationId — a valid Station-A key MUST NOT act on
 * Station-B. Grep-pinned so a refactor cannot silently regress.
 *
 * Sections:
 *   A. Fix present — validateStationKey imported and called
 *   B. Cross-station isolation — body stationId matched to terminal
 *   C. Fail-closed — pre-fix presence-only pattern is gone
 *   D. Rails match /api/nayax/redeem (same helper name, same shape)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const ROUTE = 'server/routes/credit-wallet.ts';

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}
function codeOnly(src: string): string {
  let out = src;
  out = out.replace(/\/\*[\s\S]*?\*\//g, '');
  out = out.replace(/(^|[^:])\/\/.*$/gm, '$1');
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// A. Fix is present — validator is imported AND actually called
// ─────────────────────────────────────────────────────────────────────────
describe('PR-MONEY-FIX-NAYAX-STATION-KEY — A. validator wired', () => {
  const src = read(ROUTE);
  const code = codeOnly(src);

  it('A1. file exists', () => {
    expect(existsSync(resolve(ROOT, ROUTE))).toBe(true);
  });

  it('A2. imports validateStationKey from ../nayaxFirestoreService', () => {
    // Lazy-imported (same pattern as routes.ts:4873) — the burn
    // helper must not diverge to a different symbol.
    expect(
      /import\(\s*['"]\.\.\/nayaxFirestoreService['"]\s*\)/.test(code) ||
        /from\s+['"]\.\.\/nayaxFirestoreService['"]/.test(code),
    ).toBe(true);
    expect(/validateStationKey\s*[,}\s]/.test(code)).toBe(true);
  });

  it('A3. shared authorizeStationCaller helper exists (single-source-of-truth)', () => {
    // Both burn endpoints go through ONE gate. If the helper is
    // deleted / renamed, this test fails so the reviewer notices.
    expect(/async\s+function\s+authorizeStationCaller\s*\(/.test(code)).toBe(true);
  });

  it('A4. helper calls validateStationKey() with the header value', () => {
    // The pre-fix code never called validateStationKey — the whole
    // point of the bug. Pin that the helper actually invokes it.
    expect(/const\s*\{\s*validateStationKey\s*\}\s*=\s*await\s+import\(/.test(code)).toBe(true);
    expect(/await\s+validateStationKey\s*\(\s*stationApiKey\s*\)/.test(code)).toBe(true);
  });

  it('A5. helper 403s (not 200) when validator returns null', () => {
    // A 401/500 would be a regression too — routes.ts:4877 uses 403,
    // and probing must be uniform across all Nayax endpoints. Pin
    // that a 403 branch exists that ties to a null terminal.
    expect(/if\s*\(\s*!\s*terminal\s*\)\s*\{[\s\S]{0,400}?res\.status\(\s*403\s*\)/.test(code)).toBe(true);
  });

  it('A6. both burn endpoints go through the helper (not inline presence-only checks)', () => {
    // The two route handlers must both call authorizeStationCaller.
    const validateHandler = src.match(/router\.post\(\s*['"]\/nayax\/validate-code['"][\s\S]*?^\}\);/m)?.[0] || '';
    const ackHandler = src.match(/router\.post\(\s*['"]\/nayax\/acknowledge['"][\s\S]*?^\}\);/m)?.[0] || '';
    expect(validateHandler).toContain('authorizeStationCaller');
    expect(ackHandler).toContain('authorizeStationCaller');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// B. Cross-station isolation — /validate-code binds terminal.stationId
// ─────────────────────────────────────────────────────────────────────────
describe('PR-MONEY-FIX-NAYAX-STATION-KEY — B. cross-station isolation', () => {
  const src = read(ROUTE);
  const code = codeOnly(src);

  it('B1. helper compares terminal.stationId to requiredStationId', () => {
    // The mismatch check must live in the helper so both callers
    // (present + future) share it.
    expect(/terminalStationId\s*!==\s*requiredStationId/.test(code)).toBe(true);
  });

  it('B2. /validate-code passes body.stationId as requiredStationId', () => {
    const validateHandler = src.match(/router\.post\(\s*['"]\/nayax\/validate-code['"][\s\S]*?^\}\);/m)?.[0] || '';
    // Body stationId must reach the helper as the required-station
    // argument; a bare authorizeStationCaller(req, res) call would
    // regress the isolation to header-only again.
    expect(/authorizeStationCaller\s*\(\s*req\s*,\s*res\s*,\s*String\(\s*stationId\s*\)\s*\)/.test(validateHandler)).toBe(true);
  });

  it('B3. cross-station rejection returns 403 (not 400/200)', () => {
    // The wrong-station branch must fail-closed with 403 so the
    // rate limiter + logs can distinguish it from body-shape errors.
    expect(/Station key does not authorize this station/.test(src)).toBe(true);
    expect(/res\.status\(\s*403\s*\)\.json\(\s*\{\s*success:\s*false\s*,\s*error:\s*['"]Station key does not authorize this station['"]/.test(code)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// C. Fail-closed — pre-fix presence-only pattern is gone
// ─────────────────────────────────────────────────────────────────────────
describe('PR-MONEY-FIX-NAYAX-STATION-KEY — C. no presence-only bypass', () => {
  const src = read(ROUTE);
  const code = codeOnly(src);

  it('C1. neither burn handler still ships the exact pre-fix presence-only body', () => {
    // Pre-fix body inside each handler:
    //   const stationApiKey = req.headers['x-station-key'] as string;
    //   if (!stationApiKey) {
    //     return res.status(401).json({ success: false, error: 'Station API key required' });
    //   }
    //   <business logic — NO validateStationKey call>
    // With the helper in place, each HANDLER body should not read
    // the header directly at all (the helper does it). Any handler
    // that still touches req.headers['x-station-key'] itself has
    // regressed to the pre-fix shape.
    const validateHandler = src.match(/router\.post\(\s*['"]\/nayax\/validate-code['"][\s\S]*?^\}\);/m)?.[0] || '';
    const ackHandler = src.match(/router\.post\(\s*['"]\/nayax\/acknowledge['"][\s\S]*?^\}\);/m)?.[0] || '';
    expect(validateHandler.includes("req.headers['x-station-key']")).toBe(false);
    expect(ackHandler.includes("req.headers['x-station-key']")).toBe(false);
  });

  it('C2. helper reads the header exactly once — the single source-of-truth', () => {
    const helperBlock = src.match(/async\s+function\s+authorizeStationCaller\s*\([\s\S]*?^\}/m)?.[0] || '';
    expect(helperBlock.includes("req.headers['x-station-key']")).toBe(true);
    // Fail-closed 401 on missing (still 401 here — this is the
    // "you didn't send it" case, distinct from the 403 "you sent
    // something and it's wrong" case).
    expect(/res\.status\(\s*401\s*\)/.test(helperBlock)).toBe(true);
    expect(/res\.status\(\s*403\s*\)/.test(helperBlock)).toBe(true);
  });
});

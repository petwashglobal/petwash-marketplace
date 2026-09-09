/**
 * Task 31 — CEO fire order 101-140.
 *
 * VERIFIED-EMAIL OWNERSHIP sweep. Endpoints that read email from
 * req.query/params/body and look up state should verify the caller
 * owns that email (verified-email match against req.firebaseUser).
 *
 * Findings:
 *
 *   [HIGH] server/routes/pin-auth.ts:590 — GET /api/pin-auth/status
 *   is UNAUTHENTICATED and returns
 *   { hasPin, pinLength, isLocked, lockoutMinutes } for any email.
 *   Enumeration vector: anyone can probe emails to find PetWash
 *   users with PINs + whether the PIN is locked.
 *
 *   [MEDIUM] server/routes/messages.ts:32 — GET /messages/lookup-user
 *   is authenticated but returns { uid, email, displayName } for ANY
 *   email queried. An authenticated attacker can iterate to build a
 *   user directory.
 *
 * Both are flagged for CEO decision — fixing means changing the
 * response shape (existence-agnostic response for pin-auth, and a
 * hash-based recipient-resolution API for messages) which touches
 * user-facing product flows.
 *
 * NO code change in this PR. Findings pinned + documented so a
 * future author cannot silently make it worse.
 *
 * Related pass endpoints reviewed + safe:
 *   - loyalty.ts:140 defaults email to req.firebaseUser.email (self)
 *   - admin-lynx.ts:221 is admin-only
 *   - kyc2026.ts:179 default sender email, not lookup
 *   - reviews.ts:40 OVERWRITES req.body.userEmail with decoded token
 *     (server-side truth wins)
 *   - wallet.ts:664 is inside a CEO-only wallet endpoint
 *   - publicAuthRoutes.ts:853 verifies match against session identity
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');

// INVERTED 2026-09-08. These two were CHARACTERISATION pins: they asserted the
// endpoint was still unauthenticated and still enumerable, deliberately, so
// that "a future PR that adds a guard will trip this test". A guard did land
// (pin-auth.ts: `validateFirebaseToken`, caller-scoped, 2026-08-17) — and the
// test tripped exactly as designed, then sat red for three weeks because no CI
// job runs this file. Nobody read the trip as the good news it was.
//
// A characterisation pin has to be inverted the moment the defect is fixed, or
// it inverts the incentive instead: the cheapest way to a green suite becomes
// re-introducing the vulnerability. These now assert the CLOSED state.
describe('CLOSED (was HIGH): GET /api/pin-auth/status is authenticated + caller-scoped', () => {
  const SRC = R('routes/pin-auth.ts');
  const region = () => {
    const idx = SRC.indexOf("router.get('/status'");
    expect(idx).toBeGreaterThan(-1);
    return SRC.slice(idx, idx + 1500);
  };
  it('the /status handler is registered', () => {
    expect(SRC).toMatch(/router\.get\('\/status'/);
  });
  it('it is behind auth, and no longer keyed on an attacker-supplied email', () => {
    expect(region()).toMatch(/validateFirebaseToken|requireAuth|req\.firebaseUser/);
    expect(region()).not.toContain('req.query.email');
  });
  it('the identity resolver reads the TOKEN, never a supplied email', () => {
    // The assertion above is only meaningful if the resolver it trusts is
    // itself token-derived. Pin that too, or the guard moves one function away.
    const i = SRC.indexOf('export async function resolvePinIdentityFromRequest');
    expect(i).toBeGreaterThan(-1);
    const fn = SRC.slice(i, SRC.indexOf('\n}', i));
    expect(fn).toMatch(/req\.firebaseUser\?\.uid/);
    expect(fn).not.toMatch(/req\.query/);
    expect(fn).not.toMatch(/req\.body/);
  });
  it('the PIN posture it reports is the CALLER\'s own', () => {
    // hasPin / pinLength / isLocked are fine to return — about YOURSELF. The
    // finding was never these fields; it was answering them for anyone.
    const r = region();
    expect(r).toContain('hasPin');
    // Identity comes from resolvePinIdentityFromRequest, which reads
    // req.firebaseUser?.uid and the TOKEN email — never the query string —
    // and the PIN lookup is keyed on the id it returns.
    expect(r).toMatch(/resolvePinIdentityFromRequest\(req\)/);
    expect(r).toMatch(/eq\(userPins\.userId,\s*userInfo\.id\)/);
    expect(r).not.toMatch(/req\.query/);
  });
});

describe('CLOSED (was MEDIUM): GET /messages/lookup-user no longer resolves anyone by email', () => {
  const SRC = R('routes/messages.ts');
  it('the lookup handler is registered', () => {
    expect(SRC).toMatch(/router\.get\('\/lookup-user'/);
  });
  it('the handler is RETIRED — it can no longer resolve anyone by email', () => {
    const idx = SRC.indexOf("router.get('/lookup-user'");
    const region = SRC.slice(idx, idx + 1200);
    // INVERTED 2026-09-08. This asserted the endpoint STILL leaked — it was a
    // characterisation test for an open finding. The endpoint was RETIRED
    // (410 ENDPOINT_RETIRED), so the test began failing BECAUSE the hole was
    // closed, and the only way to make it green again was to reopen the hole.
    // A guard that rewards re-introducing the defect is worse than no guard.
    expect(region).toMatch(/410/);
    expect(region).toMatch(/ENDPOINT_RETIRED|INBOX_LOOKUP_RETIRED/);
    // Nothing about another account may come back from here, ever again.
    expect(region).not.toMatch(/uid:\s*userRecord\.uid/);
    expect(region).not.toMatch(/email:\s*userRecord\.email/);
    expect(region).not.toContain('req.query.email');
  });
});

describe('safe cases (defensive pin — future refactor must preserve)', () => {
  it('reviews.ts overwrites req.body.userEmail with the decoded token email', () => {
    const SRC = R('routes/reviews.ts');
    expect(SRC).toMatch(/req\.body\.userEmail = decodedToken\.email/);
  });
  it('loyalty.ts defaults email to the caller req.firebaseUser.email first', () => {
    const SRC = R('routes/loyalty.ts');
    expect(SRC).toMatch(/req\.firebaseUser!\.email \|\|/);
  });
  it('publicAuthRoutes.ts /register providedEmail is used for input validation only', () => {
    const SRC = R('routes/publicAuthRoutes.ts');
    // The `providedEmail` local is trimmed + lowercased then compared
    // against session identity, never trusted for cross-user lookup.
    expect(SRC).toContain("providedEmail = typeof req.body?.email === 'string'");
  });
});

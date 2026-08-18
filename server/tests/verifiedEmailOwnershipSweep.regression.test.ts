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

describe('HIGH FINDING: GET /api/pin-auth/status is unauth + enumeration vector', () => {
  const SRC = R('routes/pin-auth.ts');
  it('the /status handler is registered', () => {
    expect(SRC).toMatch(/router\.get\('\/status'/);
  });
  it('the handler currently reads email from req.query (no auth check on ownership)', () => {
    const idx = SRC.indexOf("router.get('/status'");
    const region = SRC.slice(idx, idx + 1500);
    expect(region).toContain('req.query.email');
    // The handler DOES NOT gate on req.firebaseUser? / requireAuth /
    // requireStaffPass — pinning the current (broken) state so a future
    // PR that adds a guard will trip this test.
    expect(region).not.toMatch(/req\.firebaseUser\?/);
    expect(region).not.toMatch(/requireAuth/);
  });
  it('response leaks hasPin / pinLength / isLocked — enumeration', () => {
    const idx = SRC.indexOf("router.get('/status'");
    const region = SRC.slice(idx, idx + 1500);
    expect(region).toContain('hasPin');
    expect(region).toContain('pinLength');
    expect(region).toContain('isLocked');
  });
});

describe('MEDIUM FINDING: GET /messages/lookup-user returns UID + email + name for any queried email', () => {
  const SRC = R('routes/messages.ts');
  it('the lookup handler is registered', () => {
    expect(SRC).toMatch(/router\.get\('\/lookup-user'/);
  });
  it('the handler does NOT restrict lookups to the caller\'s own email', () => {
    const idx = SRC.indexOf("router.get('/lookup-user'");
    const region = SRC.slice(idx, idx + 1200);
    // Authenticated but no ownership check on the queried email.
    expect(region).toContain("req.firebaseUser?.uid");
    expect(region).toContain('req.query.email');
    // Response returns uid + email + displayName for any queried email.
    expect(region).toMatch(/uid:\s*userRecord\.uid/);
    expect(region).toMatch(/email:\s*userRecord\.email/);
    expect(region).toMatch(/displayName:/);
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

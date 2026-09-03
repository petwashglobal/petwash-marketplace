/**
 * Regression pin — Phase 6.c account-linking flow.
 *
 * Contract invariants for /api/identity/link/{initiate,confirm,unlink}:
 *
 *   1. All three endpoints require validateFirebaseToken + requireStepUp.
 *      /initiate + /confirm use purpose 'link_provider'.
 *      /unlink uses distinct purpose 'unlink_provider' so a challenge
 *      for one cannot be replayed as the other.
 *
 *   2. /initiate verifies the OTHER-provider ID token via
 *      admin.auth().verifyIdToken(idToken, checkRevoked=true).
 *
 *   3. /initiate refuses SAME_IDENTITY (linking uid=uid) and
 *      IDENTITY_OWNED_BY_ANOTHER (cross-user) and ALREADY_LINKED_TO_YOU.
 *
 *   4. /confirm re-checks ownership after challenge verify (race-safe),
 *      never re-runs loginOrLink (linkAdditionalProvider only).
 *
 *   5. /unlink refuses LAST_LINK_FORBIDDEN so the account never ends up
 *      with zero auth methods.
 *
 *   6. The challenge issuer/verifier is bound to (uid, provider,
 *      providerAccountId, email, emailVerified) — no field-swap replay.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const router = readFileSync(join(ROOT, 'server/routes/me-identity-links.ts'), 'utf8');
const svc = readFileSync(join(ROOT, 'server/services/LinkChallengeService.ts'), 'utf8');

describe('identity link flow (Phase 6.c)', () => {
  it('every endpoint sits behind validateFirebaseToken + requireStepUp', () => {
    // /initiate and /confirm are gated by 'link_provider'.
    const initiate = router.match(
      /router\.post\(\s*['"]\/link\/initiate['"][\s\S]{0,500}?requireStepUp\(\s*['"]link_provider['"]\s*\)/,
    );
    expect(initiate, '/link/initiate must be requireStepUp("link_provider")').toBeTruthy();

    const confirm = router.match(
      /router\.post\(\s*['"]\/link\/confirm['"][\s\S]{0,500}?requireStepUp\(\s*['"]link_provider['"]\s*\)/,
    );
    expect(confirm, '/link/confirm must be requireStepUp("link_provider")').toBeTruthy();

    // /unlink uses a distinct step-up purpose so challenges are not
    // replayable between add and remove.
    const unlink = router.match(
      /router\.post\(\s*['"]\/link\/unlink['"][\s\S]{0,500}?requireStepUp\(\s*['"]unlink_provider['"]\s*\)/,
    );
    expect(unlink, '/link/unlink must be requireStepUp("unlink_provider")').toBeTruthy();

    // validateFirebaseToken must appear as middleware on each POST.
    expect((router.match(/validateFirebaseToken/g) || []).length).toBeGreaterThanOrEqual(3);
  });

  it('/initiate verifies provider token with checkRevoked=true', () => {
    expect(router).toMatch(/admin\.auth\(\)\.verifyIdToken\(\s*idToken\s*,\s*true\s*\)/);
  });

  it('/initiate refuses SAME_IDENTITY / ALREADY_LINKED_TO_YOU / IDENTITY_OWNED_BY_ANOTHER', () => {
    expect(router).toMatch(/error:\s*['"]SAME_IDENTITY['"]/);
    expect(router).toMatch(/error:\s*['"]ALREADY_LINKED_TO_YOU['"]/);
    expect(router).toMatch(/error:\s*['"]IDENTITY_OWNED_BY_ANOTHER['"]/);
  });

  it('/confirm calls linkAdditionalProvider (never loginOrLink from authed context)', () => {
    expect(router).toMatch(/linkAdditionalProvider\(\s*callerUid\s*,/);
    // Guard: an authenticated linking route MUST NOT reach into loginOrLink
    // as an INVOCATION (the RESOLUTION path is for UNAUTHENTICATED login).
    // Filter comment lines so the docstring naming loginOrLink doesn't
    // false-positive.
    const codeOnly = router
      .split('\n')
      .filter((l) => !/^\s*(\*|\/\/)/.test(l))
      .join('\n');
    expect(/\bawait\s+loginOrLink\s*\(/.test(codeOnly)).toBe(false);
    expect(/=\s*loginOrLink\s*\(/.test(codeOnly)).toBe(false);
  });

  it('/unlink refuses LAST_LINK_FORBIDDEN so an account cannot lose all its links', () => {
    expect(router).toMatch(/error:\s*['"]LAST_LINK_FORBIDDEN['"]/);
    expect(router).toMatch(/links\.length\s*<=\s*1/);
  });

  it('LinkChallengeService binds token to (uid, provider, providerAccountId, email, emailVerified)', () => {
    // The payload construction must include ALL five identity fields —
    // if any is dropped, a token from one identity could be replayed
    // against another.
    const payloadBlock = svc.match(/const payload\s*=\s*\[[\s\S]*?\]\.join\('\.'\);/);
    expect(payloadBlock, 'LinkChallengeService must build a payload array').toBeTruthy();
    const p = payloadBlock![0];
    expect(p).toMatch(/challenge\.uid/);
    expect(p).toMatch(/challenge\.provider/);
    expect(p).toMatch(/challenge\.providerAccountId/);
    expect(p).toMatch(/enc\(challenge\.email\)/);
    expect(p).toMatch(/challenge\.emailVerified\s*\?\s*'1'\s*:\s*'0'/);
    // Verifier rejects UID mismatch, so a leaked token can't be used
    // by a different signed-in user.
    expect(svc).toMatch(/decoded\.uid\s*!==\s*callerUid/);
    expect(svc).toMatch(/reason:\s*['"]UID_MISMATCH['"]/);
  });

  it('LinkChallengeService fails CLOSED when no HMAC secret is configured', () => {
    // If neither env var is present, loadSecret returns '' and every
    // issue/verify call returns null / not-ok. Landing this pin means
    // the guard cannot be silently removed.
    expect(svc).toMatch(/LINK_CHALLENGE_HMAC_SECRET/);
    expect(svc).toMatch(/STEP_UP_HMAC_SECRET/);
    expect(svc).toMatch(/service is CLOSED/);
    expect(svc).toMatch(/if \(!secret\) return null;/);
    expect(svc).toMatch(/if \(!secret\) return \{ ok: false, reason: 'NO_SECRET' \};/);
  });
});

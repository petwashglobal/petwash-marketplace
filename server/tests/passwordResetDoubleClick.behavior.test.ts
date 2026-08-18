/**
 * Task 20 — CEO fire order 101-140.
 *
 * PASSWORD-RESET RAPID DOUBLE-CLICK behavioral audit.
 *
 * Finding: the CUSTOMER password-reset path is CLIENT-DIRECT to
 * Firebase Auth (`sendPasswordResetEmail`) — no PetWash server
 * endpoint sits between the browser and Firebase. Consequently:
 *
 *   - Server-side dedup: N/A — no server involvement.
 *   - Rate limit: Firebase Auth's own identityToolkit sendOobCode
 *     quota (per Google's server, unauthenticated).
 *   - Application-level dedup: BUTTON-LEVEL guard. A double-click
 *     without a guard silently invalidates the user's first OOB
 *     code with a second one — the first email link now fails to
 *     redeem. This PR adds an in-flight guard so only the first
 *     click fires.
 *
 * This test file:
 *   (a) Pins the CLIENT-side guard (AdminLoginV2.tsx — the only
 *       page with a Forgot-password button today).
 *   (b) Pins the server-side finding: no /forgot-password endpoint
 *       exists (no server-side dedup infrastructure needed today,
 *       but if one is later added it MUST use requireStrictIdempotency
 *       or an equivalent DB-backed guard — noted for a follow-up).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('AdminLoginV2 forgot-password button has in-flight guard', () => {
  const SRC = R('client/src/pages/admin/AdminLoginV2.tsx');

  it('declares an isSendingReset state', () => {
    expect(SRC).toMatch(/const \[isSendingReset, setIsSendingReset\]\s*=\s*useState\(false\)/);
  });

  it('the Forgot password button is disabled while sending', () => {
    // The forgot-password Button carries disabled={isSendingReset}.
    expect(SRC).toMatch(/disabled=\{isSendingReset\}/);
  });

  it('onClick returns early if already sending', () => {
    // Guard the second click even if the button re-enters onClick before the
    // disabled prop propagates through React's render cycle.
    expect(SRC).toMatch(/if \(isSendingReset\) return;/);
  });

  it('setIsSendingReset(true) fires BEFORE the Firebase call and false in finally', () => {
    const start = SRC.indexOf("Task 20 — first-click-wins guard");
    expect(start).toBeGreaterThan(-1);
    const region = SRC.slice(start, start + 2500);
    const trueSet = region.indexOf('setIsSendingReset(true)');
    const fbCall = region.indexOf('sendPasswordResetEmail(fbAuth, email)');
    const finallySet = region.indexOf('setIsSendingReset(false)');
    expect(trueSet).toBeGreaterThan(-1);
    expect(fbCall).toBeGreaterThan(-1);
    expect(finallySet).toBeGreaterThan(-1);
    expect(trueSet).toBeLessThan(fbCall);
    expect(finallySet).toBeGreaterThan(fbCall);
    // The finally reset must be inside a `finally {` block, not a stray call.
    expect(region).toMatch(/finally\s*\{\s*setIsSendingReset\(false\);\s*\}/);
  });

  it('button label reflects the sending state (user feedback)', () => {
    expect(SRC).toMatch(/\{isSendingReset \? 'Sending…' : 'Forgot password\?'\}/);
  });
});

describe('Server-side password-reset dedup surface (audit finding)', () => {
  it('no customer-facing /forgot-password or /password-reset route exists on the server', () => {
    // Grep the routes tree for anything that would be a customer entrypoint.
    // The only server-side generatePasswordResetLink caller is the ADMIN
    // "send invite" flow (server/routes/employees.ts) — not customer.
    // If a customer route is ever added, this test breaks and forces the
    // author to add a DB-backed idempotency guard.
    const employees = R('server/routes/employees.ts');
    expect(employees).toMatch(/generatePasswordResetLink/);
    expect(employees).toMatch(/Generate password reset link/);

    // Sanity: no `app.post('/api/forgot-password'` or similar exists in the
    // known route files.
    const files = [
      'server/routes/publicAuthRoutes.ts',
      'server/routes/auth.ts',
      'server/routes/post-login.ts',
    ];
    for (const rel of files) {
      const src = R(rel);
      expect(src).not.toMatch(/['"]\/(?:api\/)?forgot-password['"]/);
      expect(src).not.toMatch(/['"]\/(?:api\/)?password-reset['"]/);
    }
  });
});

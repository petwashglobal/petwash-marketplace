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

/**
 * 2026-09-18 — RETARGETED. These five pinned a first-click-wins guard on the
 * admin Forgot-password button. The button is gone, and so is the entire
 * email+password form it belonged to: admin sign-in is Google-only under the
 * MASTER AUTH contract, so an operator's leaked or re-used password can no
 * longer walk into an admin session, and the SUPER_ADMIN_EMAILS +
 * email_verified gate on /api/auth/session is the sole authorization boundary.
 *
 * Guarding a double-click on a control that must not exist is the weaker
 * promise. These now pin the removal itself — a password door re-appearing on
 * the admin login is the regression that matters.
 */
describe('admin sign-in has NO password door to double-click', () => {
  const SRC = R('client/src/pages/admin/AdminLoginV2.tsx');

  it('there is no password field and no password submit', () => {
    expect(SRC).not.toMatch(/type=["']password["']/);
    expect(SRC).not.toMatch(/signInWithEmailAndPassword/);
    expect(SRC).not.toMatch(/handleStandardLogin\s*=/);
  });

  it('there is no forgot-password / reset-email path on this screen', () => {
    expect(SRC).not.toMatch(/sendPasswordResetEmail/);
    expect(SRC).not.toMatch(/isSendingReset/);
  });

  it('the removal is documented in place, so nobody re-adds it as missing', () => {
    expect(SRC).toMatch(/retired email\+password/);
  });

  it('Google is the sign-in path that remains', () => {
    expect(SRC).toMatch(/signInWithPopup|GoogleAuthProvider|Continue with Google/);
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

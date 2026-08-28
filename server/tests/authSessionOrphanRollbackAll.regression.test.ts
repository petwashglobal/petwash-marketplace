/**
 * CEO §7 (2026-08-28) — email/phone session orphan-UID rollback covers
 * ANY bootstrap failure, not only `AuthBootstrapUsersRowFailed`.
 *
 * Prior code deleted the newly-created Firebase UID only when the
 * bootstrap rethrew that specific error class. An unrelated exception
 * (Firestore down, foreign-key violation, network glitch) rethrew and
 * landed on the outer 500, leaving the just-minted Firebase auth
 * account alive. Retry hit getUserByEmail (or the phone lookup),
 * skipped the create branch (account exists!), and threw the same
 * bootstrap → permanent lockout.
 *
 * Pin: both /api/auth/email-session and /api/auth/phone-session must
 * delete the just-created uid on ANY bootErr when the request minted
 * a new Firebase user in this call.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'publicAuthRoutes.ts'),
  'utf8',
);

describe('email/phone-session orphan-UID rollback covers ANY bootstrap failure (CEO §7)', () => {
  describe('email-session', () => {
    it('rollback runs UNCONDITIONAL of the boot-error class — no instanceof gate', () => {
      // Anchor to the email-session handler block. The delete call
      // must sit OUTSIDE the AuthBootstrapUsersRowFailed instanceof
      // conditional, keyed on createdNewFirebaseUser alone.
      const start = SRC.indexOf('ensureUserProvisioned(user.uid, { channel: \'email\'');
      expect(start).toBeGreaterThan(0);
      const end = SRC.indexOf('const customToken = await adminAuth.createCustomToken', start);
      const block = SRC.slice(start, end);
      // The delete must be gated on createdNewFirebaseUser + NOT on
      // (bootErr instanceof AuthBootstrapUsersRowFailed).
      const deleteIdx = block.indexOf('adminAuth.deleteUser(user.uid)');
      expect(deleteIdx).toBeGreaterThan(0);
      // Find the enclosing `if` — it must key on createdNewFirebaseUser
      // WITHOUT combining with the instanceof check.
      const preceding = block.slice(Math.max(0, deleteIdx - 200), deleteIdx);
      expect(preceding).toMatch(/if \(createdNewFirebaseUser\) \{/);
      expect(preceding).not.toMatch(/instanceof AuthBootstrapUsersRowFailed/);
    });

    it('non-users-row bootstrap failure returns 502 with BOOTSTRAP_UNAVAILABLE (never a bare rethrow)', () => {
      expect(SRC).toMatch(/\[EmailAuth\] Bootstrap threw an unexpected error — returning 502/);
      expect(SRC).toMatch(/code:\s*'BOOTSTRAP_UNAVAILABLE'/);
      // The old `throw bootErr` bareword MUST be gone from the email
      // block, otherwise the outer 500 handler swallows the rollback
      // discipline.
      const start = SRC.indexOf('ensureUserProvisioned(user.uid, { channel: \'email\'');
      const end   = SRC.indexOf('const customToken = await adminAuth.createCustomToken', start);
      const block = SRC.slice(start, end);
      expect(block).not.toMatch(/^\s*throw bootErr;\s*$/m);
    });
  });

  describe('phone-session', () => {
    it('rollback runs UNCONDITIONAL of the boot-error class', () => {
      const start = SRC.indexOf('ensureUserProvisioned(user.uid, { channel: \'phone\'');
      expect(start).toBeGreaterThan(0);
      const end = SRC.indexOf('const customToken = await adminAuth.createCustomToken', start);
      const block = SRC.slice(start, end);
      const deleteIdx = block.indexOf('adminAuth.deleteUser(user.uid)');
      expect(deleteIdx).toBeGreaterThan(0);
      const preceding = block.slice(Math.max(0, deleteIdx - 200), deleteIdx);
      expect(preceding).toMatch(/if \(isNewUser\) \{/);
      expect(preceding).not.toMatch(/instanceof AuthBootstrapUsersRowFailed/);
    });

    it('non-users-row bootstrap failure returns 502 with BOOTSTRAP_UNAVAILABLE', () => {
      expect(SRC).toMatch(/\[PhoneAuth\] Bootstrap threw an unexpected error — returning 502/);
      const start = SRC.indexOf('ensureUserProvisioned(user.uid, { channel: \'phone\'');
      const end   = SRC.indexOf('const customToken = await adminAuth.createCustomToken', start);
      const block = SRC.slice(start, end);
      expect(block).not.toMatch(/^\s*throw bootErr;\s*$/m);
    });
  });
});

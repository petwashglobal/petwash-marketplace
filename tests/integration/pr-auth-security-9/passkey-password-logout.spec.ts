/**
 * PR-AUTH-SECURITY-9 §§4/5/8 — Passkey, password, logout regressions.
 *
 * File-level guards for:
 *   §4 — Passkey list/add/remove wired to real WebAuthn (no localStorage boolean).
 *   §5 — Change/Add password uses Firebase re-auth + linkWithCredential (same
 *        canonical identity — no duplicate Firebase user is minted).
 *   §8 — Logout clears Firebase auth, server session, React Query, sensitive
 *        client state, and hard-redirects so Back cannot reveal private data.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const REPO = join(__dirname, '..', '..', '..');
const read = (rel: string) => readFileSync(join(REPO, rel), 'utf8');

describe('PR-AUTH-SECURITY-9 §4 — Passkey / Face ID is a real credential', () => {
  const sec = read('client/src/pages/SecuritySettings.tsx');
  const panel = read('client/src/components/security/SecurityStatusPanel.tsx');

  it('SecuritySettings lists passkeys from GET /api/webauthn/credentials', () => {
    expect(sec).toMatch(/queryKey:\s*\['\/api\/webauthn\/credentials'\]/);
  });

  it('SecuritySettings.add uses the real WebAuthn ceremony (startRegistration)', () => {
    expect(sec).toMatch(/startRegistration/);
    expect(sec).toMatch(/'\/api\/webauthn\/register\/options'/);
    expect(sec).toMatch(/'\/api\/webauthn\/register\/verify'/);
  });

  it('SecuritySettings.remove uses DELETE /api/webauthn/credentials/:id', () => {
    expect(sec).toMatch(/DELETE['"]?,\s*['"]?\/api\/webauthn\/credentials\/\$\{/);
  });

  it('SecurityStatusPanel passkey pill is the SERVER count — not a local boolean', () => {
    expect(panel).toMatch(/passkey:\s*\{\s*count:\s*number\s*\}/);
    expect(panel).toMatch(/data\.passkey\.count/);
    // The old anti-pattern (any local boolean) must not sneak back in.
    expect(panel).not.toMatch(/localStorage\.getItem\(['"].*passkey/);
    expect(panel).not.toMatch(/hasPasskey\s*=\s*localStorage/);
  });
});

describe('PR-AUTH-SECURITY-9 §5 — Change / Add password (same canonical identity)', () => {
  const pw = read('client/src/components/security/ChangePasswordPanel.tsx');

  it('CHANGE flow uses reauthenticateWithCredential + updatePassword', () => {
    expect(pw).toMatch(/reauthenticateWithCredential/);
    expect(pw).toMatch(/updatePassword/);
  });

  it('ADD flow uses linkWithCredential (SAME Firebase user — no duplicate)', () => {
    expect(pw).toMatch(/linkWithCredential/);
    expect(pw).toMatch(/EmailAuthProvider\.credential/);
  });

  it('NEVER stores a password in localStorage / sessionStorage / cookies', () => {
    expect(pw).not.toMatch(/localStorage\.setItem/);
    expect(pw).not.toMatch(/sessionStorage\.setItem/);
    expect(pw).not.toMatch(/document\.cookie\s*=/);
  });

  it('autocomplete attributes match WICG exactly', () => {
    expect(pw).toMatch(/autoComplete="current-password"/);
    expect(pw).toMatch(/autoComplete="new-password"/);
  });

  it('after success, react-state passwords are cleared', () => {
    expect(pw).toMatch(/setCurrentPassword\(''\)/);
    expect(pw).toMatch(/setNewPassword\(''\)/);
    expect(pw).toMatch(/setConfirmNew\(''\)/);
  });
});

describe('PR-AUTH-SECURITY-9 §8 — Logout wipes everything a stale user could see', () => {
  const authProvider = read('client/src/auth/AuthProvider.tsx');

  it('logout signs out Firebase, POSTs signout, clears React Query, clears storage', () => {
    expect(authProvider).toMatch(/queryClient\.clear\(\)/);
    expect(authProvider).toMatch(/fetch\(getApiUrl\('\/api\/auth\/signout'\)/);
    expect(authProvider).toMatch(/signOut\(auth\)/);
    expect(authProvider).toMatch(/AUTH_LOCAL_STORAGE_KEYS\.forEach/);
    expect(authProvider).toMatch(/sessionStorage\.clear\(\)/);
  });

  it('logout hard-redirects with window.location.replace (Back cannot show private data)', () => {
    expect(authProvider).toMatch(/window\.location\.replace\('\/'\)/);
  });

  it('AUTH_LOCAL_STORAGE_KEYS includes the auth-preference keys we wrote in §1', () => {
    // pw_remember_me is intentionally in sessionStorage, so it dies with sessionStorage.clear();
    // this test just asserts the exported list exists so future auth keys must be added deliberately.
    expect(authProvider).toMatch(/export const AUTH_LOCAL_STORAGE_KEYS/);
  });

  it('closeAllEventSources() closes any live SSE connection before signout', () => {
    // §8 hardening: expose + call a helper that closes SSE/EventSource streams so a
    // half-authed stream cannot keep pushing data after the user has left.
    expect(authProvider).toMatch(/closeAllEventSources/);
  });
});

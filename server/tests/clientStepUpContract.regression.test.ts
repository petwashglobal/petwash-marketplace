/**
 * Regression pin — client/src/auth/stepUp.ts contract.
 *
 * The client helper is the ONE place that turns a Firebase re-auth
 * into a server-issued step-up proof. It sits between two invariants
 * that must not silently regress:
 *
 *   1. Never store the proof anywhere durable — no localStorage /
 *      sessionStorage / IndexedDB reads or writes for the proof.
 *      Callers keep it in memory only, long enough for one send.
 *
 *   2. Always mint the proof with a token whose auth_time is fresh.
 *      Password path MUST call reauthenticateWithCredential (which
 *      updates auth_time). Passkey path MUST call signInWithPasskey
 *      (which mints a custom token and signs in, updating auth_time).
 *      A plain getIdToken(true) alone does NOT change auth_time and
 *      cannot mint a proof — this pin catches "shortcut" attempts.
 *
 *   3. mintProofFromServer sends { purpose, freshIdToken } and puts
 *      the SAME token on Authorization — validateFirebaseToken reads
 *      it there, and the server verifies it a second time for the
 *      auth_time check. Any regression that drops one of those two
 *      uses is a bug.
 *
 *   4. Error surface exposes serverCode so callers can distinguish
 *      recency vs uid mismatch vs service down.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const src = readFileSync(join(ROOT, 'client/src/auth/stepUp.ts'), 'utf8');

describe('client stepUp helper contract', () => {
  it('never touches durable storage (no localStorage / sessionStorage / indexedDB)', () => {
    expect(/localStorage\./.test(src)).toBe(false);
    expect(/sessionStorage\./.test(src)).toBe(false);
    expect(/indexedDB\./.test(src)).toBe(false);
  });

  it('password path calls reauthenticateWithCredential + fresh getIdToken', () => {
    // The password re-auth MUST happen before we mint. The helper
    // MUST also force-refresh the ID token so the just-minted
    // auth_time is on the wire.
    expect(src).toMatch(/reauthenticateWithCredential\(\s*user\s*,\s*EmailAuthProvider\.credential/);
    expect(src).toMatch(/getIdToken\(true\)/);
  });

  it('passkey path calls signInWithPasskey (which updates auth_time)', () => {
    // signInWithPasskey mints a custom token via /webauthn/login/verify
    // and calls signInWithCustomToken — that flow refreshes auth_time.
    // Any regression that skips signInWithPasskey and just does
    // getIdToken(true) would produce a stale auth_time and the server
    // would reject with RECENCY_INSUFFICIENT.
    expect(src).toMatch(/import\s*\{[^}]*\bsignInWithPasskey\b/);
    expect(src).toMatch(/const passkey\s*=\s*await signInWithPasskey\(/);
    // Force-refresh AFTER the passkey ceremony.
    expect(src).toMatch(/refreshed\.getIdToken\(true\)/);
  });

  it('mintProofFromServer sends { purpose, freshIdToken } AND Bearer header', () => {
    // Body carries the fresh token; Authorization header ALSO carries
    // it so validateFirebaseToken accepts the request. Dropping either
    // is a regression.
    expect(src).toMatch(/JSON\.stringify\(\{\s*purpose\s*,\s*freshIdToken\s*\}\)/);
    expect(src).toMatch(/Authorization:\s*`Bearer \$\{freshIdToken\}`/);
    expect(src).toMatch(/['"]\/api\/me\/step-up\/issue['"]/);
  });

  it('error surface distinguishes transport / server / reauth failures', () => {
    const codes = ['NOT_SIGNED_IN', 'PASSKEY_REAUTH_FAILED', 'PASSWORD_REAUTH_FAILED', 'SERVER_REJECTED', 'TRANSPORT_FAILED'];
    for (const c of codes) {
      expect(src.includes(c)).toBe(true);
    }
    // SERVER_REJECTED must carry through the server's structured error code.
    expect(src).toMatch(/serverCode/);
  });

  it('purpose set stays aligned with server STEP_UP_PURPOSES', () => {
    // If a purpose is added on the server, this pin surfaces the drift
    // BEFORE a client tries to request it and hits BAD_REQUEST.
    const serverPurposes = [
      'change_email',
      'change_mobile',
      'change_password',
      'change_payout',
      'delete_account',
      'link_provider',
      'unlink_provider',
      'admin_dangerous_action',
    ];
    for (const p of serverPurposes) {
      expect(src.includes(`'${p}'`), `client stepUp is missing purpose '${p}'`).toBe(true);
    }
  });
});

/**
 * stepUp — client-side orchestration for obtaining a step-up proof.
 *
 * The server surface (auth-rebuild Phase 7) is:
 *   POST /api/me/step-up/issue
 *     body:  { purpose, freshIdToken }
 *     → { proof, purpose, expiresAt }
 *
 * The server enforces that freshIdToken.auth_time is within 5 minutes —
 * i.e. the user JUST re-authenticated. Firebase's `getIdToken(true)`
 * gives a FRESH-BY-EXP token but does NOT change auth_time. Real
 * re-auth means calling reauthenticateWithCredential (password) or
 * completing a WebAuthn passkey ceremony that hands us a custom token
 * we sign in with.
 *
 * This module exposes:
 *   requestStepUpProofWithPassword(purpose, password)
 *     Password users. Reauths via EmailAuthProvider credential, then
 *     asks the server for the proof.
 *
 *   requestStepUpProofWithPasskey(purpose)
 *     Passkey users. Runs signInWithPasskey (which does WebAuthn +
 *     custom-token sign-in, updating auth_time), then asks the server
 *     for the proof.
 *
 * On success returns the opaque proof string. Callers put it in the
 * `X-StepUp-Proof` header on the sensitive request. Never store the
 * proof in localStorage — it is a bearer of privilege; keep it in
 * memory just long enough to send the one request that needs it.
 *
 * ─── ERROR SHAPES ─────────────────────────────────────────────────
 *
 * All rejections throw a StepUpError whose `.code` is one of:
 *   NOT_SIGNED_IN            — auth.currentUser is null
 *   PASSKEY_REAUTH_FAILED    — the WebAuthn ceremony did not complete
 *   PASSWORD_REAUTH_FAILED   — Firebase reauthenticateWithCredential
 *                              rejected (wrong password, network, etc.)
 *   SERVER_REJECTED          — /step-up/issue returned non-2xx
 *   TRANSPORT_FAILED         — fetch / network error
 *
 * The `.serverCode` field carries the server's `error` value when
 * status was non-2xx, so callers can distinguish
 * RECENCY_INSUFFICIENT (user was too slow) from UID_MISMATCH (they
 * signed a token for a different account) from SERVICE_UNAVAILABLE
 * (STEP_UP_HMAC_SECRET misconfigured).
 */
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getApiUrl } from '@/lib/api-config';
import { signInWithPasskey } from '@/auth/passkey';

export type StepUpPurpose =
  | 'change_email'
  | 'change_mobile'
  | 'change_password'
  | 'change_payout'
  | 'delete_account'
  | 'link_provider'
  | 'unlink_provider'
  | 'admin_dangerous_action';

export class StepUpError extends Error {
  readonly code:
    | 'NOT_SIGNED_IN'
    | 'PASSKEY_REAUTH_FAILED'
    | 'PASSWORD_REAUTH_FAILED'
    | 'SERVER_REJECTED'
    | 'TRANSPORT_FAILED';
  readonly serverCode?: string;
  constructor(
    code: StepUpError['code'],
    message: string,
    serverCode?: string,
  ) {
    super(message);
    this.name = 'StepUpError';
    this.code = code;
    this.serverCode = serverCode;
  }
}

async function mintProofFromServer(purpose: StepUpPurpose, freshIdToken: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(getApiUrl('/api/me/step-up/issue'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${freshIdToken}`,
      },
      body: JSON.stringify({ purpose, freshIdToken }),
    });
  } catch (err: any) {
    throw new StepUpError('TRANSPORT_FAILED', err?.message || 'network error');
  }
  if (!response.ok) {
    let serverCode: string | undefined;
    try {
      const body = await response.json();
      serverCode = body?.error;
    } catch {
      /* opaque body */
    }
    throw new StepUpError(
      'SERVER_REJECTED',
      `Server rejected step-up mint (HTTP ${response.status})`,
      serverCode,
    );
  }
  const body = await response.json();
  if (typeof body?.proof !== 'string' || !body.proof) {
    throw new StepUpError('SERVER_REJECTED', 'Server response missing proof');
  }
  return body.proof;
}

/**
 * Reauth with the current user's password, then mint a step-up proof.
 * Requires the caller to already know the account email (typically
 * `auth.currentUser?.email`).
 */
export async function requestStepUpProofWithPassword(
  purpose: StepUpPurpose,
  password: string,
): Promise<string> {
  const user = auth.currentUser;
  if (!user || !user.email) {
    throw new StepUpError('NOT_SIGNED_IN', 'No signed-in email/password user');
  }
  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  } catch (err: any) {
    throw new StepUpError(
      'PASSWORD_REAUTH_FAILED',
      err?.code || err?.message || 'reauthentication rejected',
    );
  }
  // reauthenticateWithCredential updates the session's auth_time. A
  // forced getIdToken(true) picks up the fresh claims.
  const freshIdToken = await user.getIdToken(true);
  return mintProofFromServer(purpose, freshIdToken);
}

/**
 * Reauth by running a fresh WebAuthn passkey ceremony (which mints a
 * server-issued custom token and signs the user in with it, updating
 * auth_time on the resulting ID token). Then mint the step-up proof.
 */
export async function requestStepUpProofWithPasskey(purpose: StepUpPurpose): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new StepUpError('NOT_SIGNED_IN', 'No signed-in user');
  }
  const passkey = await signInWithPasskey(user.uid);
  if (!passkey.success) {
    throw new StepUpError('PASSKEY_REAUTH_FAILED', passkey.error || 'passkey ceremony failed');
  }
  const refreshed = auth.currentUser;
  if (!refreshed) {
    throw new StepUpError('NOT_SIGNED_IN', 'session lost during passkey reauth');
  }
  const freshIdToken = await refreshed.getIdToken(true);
  return mintProofFromServer(purpose, freshIdToken);
}

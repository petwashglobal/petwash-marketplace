/**
 * The signup/login transport: /api/auth/email/*.
 *
 * Why this exists rather than pointing VerificationFlow at /api/verification:
 * that route carries `turnstileGuard({ action: 'signup_email_start' })`, and
 * the generic endpoint does not. Signup is the most-attacked surface in the
 * product; removing its bot check to tidy up a URL would be a bad trade.
 *
 * This is NOT a second OTP implementation. The screen, the copy, the input,
 * the resend countdown, the error mapping and the masked destination are all
 * the shared ones — only the three HTTP calls differ, and underneath both
 * routes are the same UnifiedVerificationService challenge.
 */
import { getApiUrl } from '@/lib/apiConfig';
import type { VerificationTransport } from './useVerificationChallenge';

async function post(path: string, body: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(getApiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  let json: any = null;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json };
}

export interface AuthEmailTransportOptions {
  /** 'signup' or 'login' — decides which purpose the server opens. */
  purpose: 'signup' | 'login';
  /**
   * The address the customer typed. The transport needs it because
   * /api/auth/email/verify is keyed by address for its legacy callers — and it
   * cannot come from the challenge, which is masked by design. The caller
   * already has it; nothing is echoed back from the server to get it.
   */
  getEmail: () => string;
  language?: 'en' | 'he';
  /**
   * Turnstile token for the guarded /start. The caller owns solving the
   * challenge because only it knows when to render the widget; the transport
   * reads it at call time so a token minted after mount is still picked up.
   */
  getTurnstileToken?: () => string | null | undefined;
}

export function createAuthEmailTransport(opts: AuthEmailTransportOptions): VerificationTransport {
  return {
    start: (a) => post('/api/auth/email/start', {
      email: a.destination,
      purpose: opts.purpose,
      language: opts.language,
      turnstileToken: opts.getTurnstileToken?.() ?? null,
    }),

    // /verify is keyed by (email, purpose) rather than challengeId — it uses
    // verifyLatestChallengeForDestination. The email is carried on the
    // challenge we already hold, so the caller does not have to thread it.
    verify: (a) => post('/api/auth/email/verify', {
      email: opts.getEmail(),
      code: a.code,
      purpose: opts.purpose,
      // Exact challenge, not "the latest for this address" — two tabs or a
      // resend would otherwise resolve to a different one than is on screen.
      verificationChallengeId: a.challengeId,
    }),

    resend: (a) => post('/api/auth/email/resend', { challengeId: a.challengeId }),
  };
}

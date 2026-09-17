/**
 * The unguessable path segment SUMIT's trigger posts to (2026-09-18).
 *
 * SUMIT triggers (/triggers/triggers/subscribe/, the Make/Zapier mechanism)
 * post a plain JSON body with no signature, so /api/sumit/webhook — which
 * demands an HMAC — can never accept them. Rather than add another secret to
 * production, the path token is derived from SUMIT_WEBHOOK_SECRET: knowing the
 * URL proves nothing about the body, so the endpoint treats the payload as
 * untrusted and only uses it as a WAKE-UP for the reconciliation we already
 * trust (which re-reads everything from SUMIT itself).
 */
import crypto from 'crypto';

export function sumitTriggerToken(): string | null {
  const secret = process.env.SUMIT_WEBHOOK_SECRET;
  if (!secret || secret.trim().length < 8) return null;
  return crypto.createHmac('sha256', secret).update('sumit-trigger-path-v1').digest('hex').slice(0, 32);
}

/** Constant-time compare of the path token. False when unconfigured. */
export function sumitTriggerTokenMatches(candidate: unknown): boolean {
  const expected = sumitTriggerToken();
  if (!expected || typeof candidate !== 'string' || candidate.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(expected));
  } catch {
    return false;
  }
}

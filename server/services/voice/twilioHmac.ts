/**
 * Twilio webhook signature verification (Stage 3B).
 *
 * Twilio signs each webhook with X-Twilio-Signature.
 * Algorithm (per Twilio docs):
 *   1. take the full URL the request was sent to (including query string)
 *   2. for POST: sort the form params alphabetically; concatenate key+value
 *   3. concatenate URL + sorted_params
 *   4. HMAC-SHA1 with TWILIO_AUTH_TOKEN
 *   5. base64-encode the digest
 *   6. compare with X-Twilio-Signature (timing-safe)
 *
 * Fail-closed: any missing piece → returns false.
 */
import crypto from 'crypto';
import type { Request } from 'express';

export interface TwilioHmacOpts {
  /** Auth token from Twilio console. From env in production. */
  authToken: string;
  /**
   * Full public URL the webhook was reached at (no trailing slash differences).
   * In production behind a proxy/CDN, use the X-Forwarded-* headers or a
   * configured base URL. Twilio computes the signature over the URL it sent
   * the request to — so if you're behind a proxy, the URL must match exactly.
   */
  publicUrl: string;
}

export function verifyTwilioSignature(
  req: Request,
  opts: TwilioHmacOpts,
): boolean {
  const sig = req.headers['x-twilio-signature'];
  if (typeof sig !== 'string' || sig.length === 0) return false;
  if (!opts.authToken) return false;
  if (!opts.publicUrl) return false;

  // Form params for POST. For GET, Twilio uses an empty body.
  const body: Record<string, unknown> =
    (req.body && typeof req.body === 'object') ? (req.body as Record<string, unknown>) : {};

  // Sort keys alphabetically, concatenate key+value (no separator) per Twilio spec.
  const sortedConcat = Object.keys(body)
    .sort()
    .map((k) => `${k}${body[k] == null ? '' : String(body[k])}`)
    .join('');

  const expected = crypto
    .createHmac('sha1', opts.authToken)
    .update(Buffer.from(opts.publicUrl + sortedConcat, 'utf8'))
    .digest('base64');

  // Constant-time compare.
  if (expected.length !== sig.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

/**
 * Build the public URL the request was sent to, honoring proxy headers.
 * Production: behind Cloud Run, use X-Forwarded-Proto + Host + originalUrl.
 * Development: localhost + originalUrl.
 */
export function buildPublicUrl(req: Request, override?: string): string {
  if (override) return override;
  const proto =
    (req.headers['x-forwarded-proto'] as string)?.split(',')[0]?.trim() ??
    (req.protocol || 'https');
  const host =
    (req.headers['x-forwarded-host'] as string)?.split(',')[0]?.trim() ??
    (req.headers['host'] as string) ??
    'localhost';
  return `${proto}://${host}${req.originalUrl}`;
}

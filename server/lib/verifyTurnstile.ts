import { logger } from './logger';

/**
 * Cloudflare Turnstile server-side verification.
 *
 * Used as the secondary step-up fallback when reCAPTCHA v3 scores are suspicious
 * (0.4–0.69) and the user cannot or did not complete phone OTP.
 *
 * Requires TURNSTILE_SECRET_KEY environment variable.
 * If the secret key is not configured the call returns { valid: false, reason: 'not_configured' }
 * so callers can gate accordingly.
 */

export interface TurnstileResult {
  valid: boolean;
  reason?: string;
}

export async function verifyTurnstileToken(token: string, ip?: string): Promise<TurnstileResult> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  if (!secretKey) {
    logger.warn('[Turnstile] TURNSTILE_SECRET_KEY not configured — verification skipped');
    return { valid: false, reason: 'not_configured' };
  }

  if (!token || token.trim() === '') {
    return { valid: false, reason: 'missing_token' };
  }

  try {
    const body = new URLSearchParams({ secret: secretKey, response: token.trim() });
    if (ip) body.append('remoteip', ip);

    const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    if (!resp.ok) {
      logger.warn('[Turnstile] HTTP error from Cloudflare', { status: resp.status });
      return { valid: false, reason: `http_error_${resp.status}` };
    }

    const data: any = await resp.json();
    const errorCodes: string[] = data['error-codes'] || [];

    logger.info('[Turnstile] Verification result', {
      success: data.success,
      hostname: data.hostname,
      action: data.action,
      errorCodes,
    });

    if (!data.success) {
      return { valid: false, reason: errorCodes[0] || 'verification_failed' };
    }

    return { valid: true };
  } catch (err: any) {
    logger.error('[Turnstile] Verification threw exception', { error: err.message });
    return { valid: false, reason: 'exception' };
  }
}

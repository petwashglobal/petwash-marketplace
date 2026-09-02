import * as crypto from 'crypto';
import { logger } from './logger';
import { redis } from '../services/redis';

/**
 * Cloudflare Turnstile server-side verification.
 *
 * Used as the secondary step-up fallback when reCAPTCHA v3 scores are suspicious
 * (0.4–0.69) and the user cannot or did not complete phone OTP.
 *
 * Requires TURNSTILE_SECRET_KEY environment variable.
 * If the secret key is not configured the call returns { valid: false, reason: 'not_configured' }
 * so callers can gate accordingly.
 *
 * AUDIT-SMS-10 (#223): Cloudflare's own verifier already invalidates a
 * token after the first successful check, but there is a small race
 * window in which two concurrent requests carrying the SAME token —
 * hitting two different Cloud Run pods at the same millisecond — can
 * both slip through because neither knows the other has claimed the
 * token yet. Adding a Redis SETNX one-shot claim on the token hash
 * closes that window: the first pod wins, the second sees the key and
 * rejects as `replayed`. The SETNX TTL is short (the token's own
 * short life is enough) so a bot cannot pre-populate the space.
 *
 * Redis-outage semantics: when Redis is unreachable the SETNX call
 * returns false and we conservatively fall through to Cloudflare
 * verification only — the same behaviour as before this guard existed.
 * That means an outage does not open the barn door AND does not lock
 * legitimate users out; the Cloudflare single-use guarantee still
 * holds outside the tiny race window.
 */

const REPLAY_KEY_PREFIX = 'turnstile-replay:';
const REPLAY_TTL_SEC = 300; // 5 minutes — longer than Cloudflare's own token life

function tokenReplayKey(token: string): string {
  return REPLAY_KEY_PREFIX + crypto.createHash('sha256').update(token).digest('hex').slice(0, 32);
}

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

  const trimmed = token.trim();
  // AUDIT-SMS-10 (#223): cross-pod replay guard. Atomic Redis SETNX so
  // only one pod can win the token — every subsequent verify (including
  // the racing concurrent one) sees the key and refuses. Skipped when
  // Redis is unavailable; see doc comment above for outage semantics.
  const claimed = await redis.setNx(tokenReplayKey(trimmed), '1', REPLAY_TTL_SEC);
  if (!claimed && redis.isConnected()) {
    logger.warn('[Turnstile] Replay guard rejected token — already consumed elsewhere');
    return { valid: false, reason: 'replayed' };
  }

  try {
    const body = new URLSearchParams({ secret: secretKey, response: trimmed });
    if (ip) body.append('remoteip', ip);

    const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    // If the upstream verify fails but we've already claimed the replay
    // slot, release it — a real user retrying the SAME token after a
    // transient Cloudflare hiccup would otherwise be locked out.
    // (Successful verifies do not release: the token IS consumed.)

    if (!resp.ok) {
      logger.warn('[Turnstile] HTTP error from Cloudflare', { status: resp.status });
      await redis.del(tokenReplayKey(trimmed)).catch(() => {});
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
      await redis.del(tokenReplayKey(trimmed)).catch(() => {});
      return { valid: false, reason: errorCodes[0] || 'verification_failed' };
    }

    return { valid: true };
  } catch (err: any) {
    logger.error('[Turnstile] Verification threw exception', { error: err.message });
    await redis.del(tokenReplayKey(trimmed)).catch(() => {});
    return { valid: false, reason: 'exception' };
  }
}

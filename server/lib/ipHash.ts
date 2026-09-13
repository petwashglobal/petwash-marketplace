/**
 * IP privacy helpers — the codebase's ONE convention for storing "which IP"
 * without storing the IP.
 *
 * Moved verbatim out of server/services/AuthEventService.ts (2026-09-13) so the
 * passkey security-event trail (server/services/securityEvents.ts) can follow the
 * same IP_HASH_SALT convention instead of writing raw IPs to Firestore.
 */
import crypto from 'crypto';
import { logger } from './logger';

/**
 * Mask the last octet(s) of an IP for safe storage.
 * IPv4: 1.2.3.4 → 1.2.3.xxx
 * IPv6: truncated to first 4 groups + ::xxx
 */
export function maskIp(ip: string): string {
  if (!ip || ip === 'unknown') return 'unknown';
  if (ip.includes(':')) {
    // IPv6 — keep first 4 groups
    const parts = ip.split(':');
    return parts.slice(0, 4).join(':') + '::xxx';
  }
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
  }
  return 'unknown';
}

/**
 * Stable HMAC-SHA256 hash of the raw IP using the userId as per-user salt.
 * Allows us to compare "same IP" across logins without storing the raw IP.
 *
 * IP_HASH_SALT must be set in production (env-validation.ts hard-stops if absent).
 * In development a clearly-labelled placeholder is used with a logged warning.
 * Never falls back to a hardcoded value that could be read from source code.
 */
export function hashIp(ip: string, userId: string): string {
  const SALT = process.env.IP_HASH_SALT;
  if (!SALT) {
    if (process.env.NODE_ENV === 'production') {
      // env-validation.ts should have already hard-stopped, but guard here too.
      throw new Error('[AuthEventService] FATAL: IP_HASH_SALT is required in production');
    }
    logger.warn('[AuthEventService] IP_HASH_SALT not set — using dev-only placeholder. Set this before going to production.');
  }
  const effectiveSalt = SALT || 'dev-only-ip-hash-salt__not-for-production';
  // Use full 64-char hex output for maximum collision resistance
  return crypto
    .createHmac('sha256', `${effectiveSalt}:${userId}`)
    .update(ip)
    .digest('hex');
}

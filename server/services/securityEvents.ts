/**
 * Security Events Audit Log
 * Comprehensive logging of all security-related actions
 *
 * 2026-09-13 (passkey both-ends audit): this is the ONE durable record for every
 * passkey ceremony outcome (enrol / sign-in / step-up / remove / rename), written
 * server-side by server/webauthn/routes.ts. Each record now carries:
 *   uid, type, result, reason, credentialId, device {platform, browser},
 *   ipHash (IP_HASH_SALT convention, server/lib/ipHash), maskedIp, createdAt.
 * Raw IPs and raw user-agents are no longer stored (they used to be), and never
 * a credential public key. Every write also emits one structured log line
 * (info on success, warn on failure) so the outcome is visible in Cloud Run logs.
 */

import { db } from '../lib/firebase-admin';
import { logger } from '../lib/logger';
import { hashIp, maskIp } from '../lib/ipHash';

export type SecurityEventType =
  | 'PASSKEY_CONSENT_ACCEPTED'
  | 'PASSKEY_ENROLL_SUCCESS'
  | 'PASSKEY_ENROLL_FAILED'
  | 'PASSKEY_AUTH_SUCCESS'
  | 'PASSKEY_AUTH_FAILED'
  | 'PASSKEY_STEPUP_SUCCESS'
  | 'PASSKEY_STEPUP_FAILED'
  | 'PASSKEY_REVOKED'
  | 'NEW_DEVICE_ENROLLED'
  | 'DEVICE_RENAMED'
  | 'UNUSUAL_LOCATION_DETECTED'
  | 'MULTIPLE_FAILURES_DETECTED';

/** Event types that describe a passkey ceremony / credential lifecycle outcome. */
export const PASSKEY_EVENT_TYPES: readonly SecurityEventType[] = [
  'PASSKEY_CONSENT_ACCEPTED',
  'PASSKEY_ENROLL_SUCCESS',
  'PASSKEY_ENROLL_FAILED',
  'PASSKEY_AUTH_SUCCESS',
  'PASSKEY_AUTH_FAILED',
  'PASSKEY_STEPUP_SUCCESS',
  'PASSKEY_STEPUP_FAILED',
  'PASSKEY_REVOKED',
  'DEVICE_RENAMED',
];

interface SecurityEventOptions {
  /** null when the server could not attribute the attempt to an account. */
  uid: string | null;
  type: SecurityEventType;
  ip?: string;
  userAgent?: string;
  /** WebAuthn credential id (base64url) — an identifier, never the public key. */
  credentialId?: string | null;
  /** Machine-readable reason code for a failure (e.g. signature_invalid). */
  reason?: string | null;
  meta?: Record<string, any>;
}

function resultOf(type: SecurityEventType): 'success' | 'failure' | 'alert' {
  if (type.endsWith('_FAILED')) return 'failure';
  if (type === 'UNUSUAL_LOCATION_DETECTED' || type === 'MULTIPLE_FAILURES_DETECTED') return 'alert';
  return 'success';
}

function deviceFromUserAgent(ua: string | undefined): { platform: string; browser: string } {
  const s = (ua || '').toLowerCase();
  let platform = 'unknown';
  if (/iphone|ipad|ipod/.test(s)) platform = 'ios';
  else if (s.includes('android')) platform = 'android';
  else if (s.includes('windows')) platform = 'windows';
  else if (s.includes('macintosh') || s.includes('mac os')) platform = 'macos';
  else if (s.includes('linux')) platform = 'linux';

  let browser = 'unknown';
  if (s.includes('edg/') || s.includes('edgios')) browser = 'edge';
  else if (s.includes('crios') || s.includes('chrome/')) browser = 'chrome';
  else if (s.includes('fxios') || s.includes('firefox/')) browser = 'firefox';
  else if (s.includes('safari/')) browser = 'safari';
  return { platform, browser };
}

/**
 * Log a security event to Firestore audit trail
 * Collection: securityEvents
 */
export async function logSecurityEvent(opts: SecurityEventOptions): Promise<void> {
  const { uid, type, ip, userAgent, meta = {} } = opts;
  const now = Date.now();
  const result = resultOf(type);
  const reason = opts.reason ?? null;
  const credentialId = opts.credentialId ?? null;

  let ipHash: string | null = null;
  try {
    ipHash = ip && ip !== 'unknown' ? hashIp(ip, uid || 'anonymous') : null;
  } catch {
    ipHash = null; // missing IP_HASH_SALT in production must not lose the record
  }
  const maskedIp = ip ? maskIp(ip) : null;
  const device = deviceFromUserAgent(userAgent);

  // One structured line per outcome (visible in Cloud Run logs).
  const line = {
    uid,
    type,
    result,
    reason,
    credentialId: credentialId ? credentialId.substring(0, 12) + '…' : null,
    platform: device.platform,
    browser: device.browser,
    maskedIp,
  };
  if (result === 'success') logger.info('[Security Event]', line);
  else logger.warn('[Security Event]', line);

  try {
    await db.collection('securityEvents').add({
      uid,
      type,
      result,
      reason,
      credentialId,
      device,
      ipHash,
      maskedIp,
      meta,
      createdAt: now,
      timestamp: new Date(now).toISOString(),
    });
  } catch (error) {
    logger.error('[Security Events] Failed to log event', error, { uid, type });
  }
}

/**
 * Get recent security events for a user.
 * Throws on a failed read — an unread trail must never be shown as "no events".
 * Uses the (uid ASC, createdAt DESC) composite index (firestore.indexes.json).
 */
export async function getUserSecurityEvents(
  uid: string,
  limit: number = 50
): Promise<any[]> {
  const snapshot = await db
    .collection('securityEvents')
    .where('uid', '==', uid)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

/**
 * Count failed auth attempts in time window
 * Used for burst detection
 */
export async function countFailedAttempts(
  uid: string,
  windowMinutes: number = 10
): Promise<number> {
  try {
    const since = Date.now() - windowMinutes * 60 * 1000;

    const snapshot = await db
      .collection('securityEvents')
      .where('uid', '==', uid)
      .where('type', '==', 'PASSKEY_AUTH_FAILED')
      .where('createdAt', '>=', since)
      .get();

    return snapshot.size;
  } catch (error) {
    logger.error('[Security Events] Failed to count failed attempts', error, { uid });
    return 0;
  }
}

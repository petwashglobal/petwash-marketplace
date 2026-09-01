/**
 * sessionShadowVerify — auth-rebuild Phase 3.c.2
 *
 * Compares the Firebase-derived UID (already present on req.firebaseUser
 * from validateFirebaseToken) against the Pet Wash session-cookie-
 * derived UID (looked up here via SessionService.verifySession). Emits
 * a redacted SECURITY_SESSION_MISMATCH log line on disagreement.
 *
 * ─── FAIL-SAFE MODEL ───────────────────────────────────────────────
 *
 * When SHADOW mode is on and authority has NOT yet flipped (Phase
 * 3.c.3 not shipped), disagreement does NOT block the request — we
 * still serve the Firebase-resolved identity. The middleware only
 * OBSERVES so we can prove the dual-cookie plumbing is coherent
 * against real production traffic.
 *
 * When authority DOES flip, disagreement:
 *   - refuses to auto-choose the more-privileged result
 *   - drops to the LESS-privileged path (safer default)
 *   - continues logging SECURITY_SESSION_MISMATCH
 *
 * Both modes are gated by SystemConfig flags so ops can enable
 * observation without changing behaviour, then flip authority when
 * the observed disagreement rate is 0.
 *
 * ─── PLACEMENT ─────────────────────────────────────────────────────
 *
 * Mount AFTER validateFirebaseToken. This module never populates
 * req.firebaseUser (that's Firebase auth's job) — it only reads it
 * and adds `req.pwSession` when a valid Pet Wash cookie is present.
 *
 * ─── SAFETY GUARANTEES ─────────────────────────────────────────────
 *
 *   * Never throws. Any exception downgrades to observation-only.
 *   * Never blocks the request when in observation mode (only auth-
 *     ority mode may return 401, and only if explicitly enabled).
 *   * Never logs the raw pw_session_id — only its SHA-256 hash prefix
 *     for correlation.
 *   * Never logs the disagreeing UIDs verbatim — only a truncated
 *     prefix for correlation.
 */
import type { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';
import { verifySession, hashSessionId } from '../services/SessionService';
import { getFeatureFlag } from '../services/SystemConfig';

declare global {
  namespace Express {
    interface Request {
      pwSession?: {
        rowId: bigint;
        userId: string;
        authMethod: string | null;
        activeRole: string | null;
      };
    }
  }
}

const COOKIE_NAME = 'pw_session_id';

// Correlation helpers — never leak the raw value.
function hashPrefix(raw: string, len = 12): string {
  return hashSessionId(raw).slice(0, len);
}
function uidPrefix(uid: string | null | undefined): string | null {
  if (!uid) return null;
  return uid.slice(0, 6) + '…';
}

/**
 * Inline flavour used by `validateFirebaseToken` — runs after
 * req.firebaseUser is populated, does the same shadow compare, but
 * as a plain async call rather than express middleware.
 * Never throws.
 */
export async function runSessionShadowCompareInline(req: Request): Promise<void> {
  try {
    const shadowOn = await getFeatureFlag('ff.returning_user.sessions_owned.shadow_verify');
    if (!shadowOn) return;

    const raw = (req as any).cookies?.[COOKIE_NAME];
    if (!raw || typeof raw !== 'string' || raw.length < 32) return;

    const pw = await verifySession(raw, req.ip ?? null, (req.headers['user-agent'] as string) ?? null);
    if (!pw) {
      logger.warn('[sessionShadowVerify:inline] pw_session_id cookie present but invalid', {
        sessionHashPrefix: hashPrefix(raw),
      });
      return;
    }
    req.pwSession = {
      rowId: pw.id as unknown as bigint,
      userId: pw.userId,
      authMethod: pw.authMethod,
      activeRole: pw.activeRole,
    };
    const firebaseUid = req.firebaseUser?.uid ?? null;
    if (firebaseUid && firebaseUid !== pw.userId) {
      logger.error('[sessionShadowVerify:inline] SECURITY_SESSION_MISMATCH', {
        firebaseUidPrefix: uidPrefix(firebaseUid),
        pwUidPrefix: uidPrefix(pw.userId),
        sessionHashPrefix: hashPrefix(raw),
        path: req.path,
        method: req.method,
      });
    }
  } catch (err: any) {
    logger.warn('[sessionShadowVerify:inline] error (observation-only)', {
      error: err?.message,
    });
  }
}

export function sessionShadowVerify() {
  return async function sessionShadowVerifyMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const shadowOn = await getFeatureFlag('ff.returning_user.sessions_owned.shadow_verify');
      if (!shadowOn) return next();

      const raw = (req as any).cookies?.[COOKIE_NAME];
      if (!raw || typeof raw !== 'string' || raw.length < 32) {
        // Cookie absent — nothing to compare.
        return next();
      }

      const pw = await verifySession(raw, req.ip ?? null, (req.headers['user-agent'] as string) ?? null);
      if (!pw) {
        // A present-but-invalid cookie is worth surfacing — stale
        // after logout, minted against a rotated secret, or expired.
        logger.warn('[sessionShadowVerify] pw_session_id cookie present but invalid', {
          sessionHashPrefix: hashPrefix(raw),
        });
        return next();
      }

      req.pwSession = {
        rowId: pw.id as unknown as bigint,
        userId: pw.userId,
        authMethod: pw.authMethod,
        activeRole: pw.activeRole,
      };

      const firebaseUid = req.firebaseUser?.uid ?? null;
      if (firebaseUid && firebaseUid !== pw.userId) {
        // The DISAGREEMENT event. Redacted — never the raw UID, never
        // the raw session id.
        logger.error('[sessionShadowVerify] SECURITY_SESSION_MISMATCH', {
          firebaseUidPrefix: uidPrefix(firebaseUid),
          pwUidPrefix: uidPrefix(pw.userId),
          sessionHashPrefix: hashPrefix(raw),
          path: req.path,
          method: req.method,
        });
        // Observation-only in Phase 3.c.2. Authority mode (Phase
        // 3.c.3) will refuse the more-privileged side and drop to
        // the less-privileged one; that's not this commit's job.
      }
      return next();
    } catch (err: any) {
      logger.warn('[sessionShadowVerify] middleware error (observation-only)', {
        error: err?.message,
      });
      return next();
    }
  };
}

/**
 * /api/me/sessions — auth-rebuild Phase 9 (Account Security surface).
 *
 * The client Account Security page needs three things:
 *   * GET  /api/me/sessions            — list active sessions
 *   * POST /api/me/sessions/:rowId/revoke — revoke ONE (device sign-out)
 *   * POST /api/me/sessions/revoke-all — sign out EVERY device
 *
 * All three read/write sessions_pw only. They are a NO-OP against
 * live users until ff.returning_user.sessions_owned.enabled is ON
 * (nothing has minted a row for them yet). Zero-behaviour-change
 * when the flag is OFF.
 *
 * SAFETY:
 *   * Every endpoint sits behind validateFirebaseToken — the CURRENT
 *     signed-in user only ever sees / mutates THEIR OWN sessions.
 *   * The revoke-current-device path is deliberately excluded from
 *     the "revoke-all except current" idea (Phase 9.b) — Phase 9.a
 *     simply revokes ALL, and the client is expected to force a
 *     re-sign-in flow if the current tab was among them.
 *   * Only the sensitive "revoke-all" endpoint requires step-up
 *     proof (purpose='delete_account' — this IS the same trust
 *     boundary as account destruction, and STEP_UP_PURPOSES already
 *     enumerates it). Single-session revoke does not — the user is
 *     already authenticated and mutating their OWN session graph.
 *   * The public projection NEVER exposes session_id_hash or the
 *     raw UA / IP beyond truncated hints; SessionSummary is already
 *     the sanitised shape.
 *
 * The response body carries UA / IP hints for the "Recognise this
 * device?" UI, but truncates each to the last 40 characters so a
 * user's exact system version can't be extracted from a screenshot
 * shared with support.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { requireStepUp } from '../services/StepUpService';
import {
  listSessionsForUser,
  revokeSessionByRowId,
  revokeAllForUser,
  type SessionSummary,
} from '../services/SessionService';
import { logger } from '../lib/logger';
import { getFeatureFlag } from '../services/SystemConfig';

const router = Router();

const TRUNCATE_UA = 40;

function truncate(s: string | null | undefined, max: number): string | null {
  if (!s) return null;
  return s.length > max ? '…' + s.slice(-max) : s;
}

interface PublicSessionRow {
  rowId: string;
  authMethod: string | null;
  activeRole: string | null;
  deviceRef: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  registrationIpHint: string | null;
  registrationUserAgentHint: string | null;
  lastSeenIpHint: string | null;
  lastSeenUserAgentHint: string | null;
}

function toPublic(s: SessionSummary): PublicSessionRow {
  return {
    // bigint → string so JSON.stringify doesn't throw. Client treats
    // it as opaque.
    rowId: s.rowId.toString(),
    authMethod: s.authMethod,
    activeRole: s.activeRole,
    deviceRef: s.deviceRef,
    createdAt: s.createdAt.toISOString(),
    lastSeenAt: s.lastSeenAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
    registrationIpHint: s.registrationIp,
    registrationUserAgentHint: truncate(s.registrationUserAgent, TRUNCATE_UA),
    lastSeenIpHint: s.lastSeenIp,
    lastSeenUserAgentHint: truncate(s.lastSeenUserAgent, TRUNCATE_UA),
  };
}

// ─── GET /api/me/sessions ─────────────────────────────────────────────
router.get('/sessions', validateFirebaseToken, async (req: Request, res: Response) => {
  const uid = req.firebaseUser?.uid;
  if (!uid) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  try {
    const rows = await listSessionsForUser(uid);
    // TRUTHFULNESS (auth/identity sprint 2026-09-05): sessions_pw is still DARK
    // in production — ff.returning_user.sessions_owned.enabled defaults false and
    // NOTHING mints a row, so this endpoint returns [] for every real user and
    // the Account Security page rendered "No active sessions." to somebody who
    // is demonstrably signed in. An empty list is not the same claim as "the
    // device registry is not recording yet"; the client must be able to tell
    // them apart, so say which one this is.
    const trackingEnabled = await getFeatureFlag('ff.returning_user.sessions_owned.enabled')
      .catch(() => false);
    return res.json({
      userId: uid,
      sessions: rows.map(toPublic),
      /** false => this list is empty because nothing is recorded yet, NOT because the user has no devices. */
      tracking: Boolean(trackingEnabled),
    });
  } catch (err: any) {
    logger.error('[me/sessions] list failed', { uid, error: err?.message });
    return res.status(500).json({ error: 'SESSIONS_LIST_FAILED' });
  }
});

// ─── POST /api/me/sessions/:rowId/revoke ──────────────────────────────
// Revoke ONE specific session. Idempotent: revoking an already-revoked
// row is a no-op and returns { alreadyRevoked: true }.
router.post(
  '/sessions/:rowId/revoke',
  validateFirebaseToken,
  async (req: Request, res: Response) => {
    const uid = req.firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'AUTH_REQUIRED' });

    // Row id is bigint-string on the wire.
    const raw = req.params.rowId;
    if (!/^\d+$/.test(raw)) {
      return res.status(400).json({ error: 'BAD_ROW_ID' });
    }
    const rowId = BigInt(raw);

    // Verify the row belongs to this user BEFORE revoking — otherwise
    // any signed-in user could revoke any known rowId.
    const own = await listSessionsForUser(uid);
    const target = own.find((s) => s.rowId === rowId);
    if (!target) {
      // Either it doesn't exist or doesn't belong to the caller.
      // 404 either way — never reveals row existence to a stranger.
      return res.status(404).json({ error: 'SESSION_NOT_FOUND' });
    }

    try {
      const revoked = await revokeSessionByRowId(rowId, 'user_logout');
      logger.info('[me/sessions] revoke', {
        uid,
        rowId: rowId.toString(),
        revoked,
      });
      return res.json({ ok: true, rowId: rowId.toString(), alreadyRevoked: !revoked });
    } catch (err: any) {
      logger.error('[me/sessions] revoke failed', {
        uid,
        rowId: rowId.toString(),
        error: err?.message,
      });
      return res.status(500).json({ error: 'REVOKE_FAILED' });
    }
  },
);

// ─── POST /api/me/sessions/revoke-all ─────────────────────────────────
// "Sign out everywhere". This can log the caller out immediately —
// gate it behind step-up proof so a phished / hijacked tab cannot
// silently orphan a user from their own devices.
const RevokeAllBody = z.object({
  reason: z.string().max(200).optional(),
});

router.post(
  '/sessions/revoke-all',
  validateFirebaseToken,
  requireStepUp('delete_account'),
  async (req: Request, res: Response) => {
    const uid = req.firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'AUTH_REQUIRED' });

    const parsed = RevokeAllBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'BAD_REQUEST' });
    }

    try {
      const count = await revokeAllForUser(uid, 'user_logout_all');
      logger.warn('[me/sessions] sign-out-everywhere', {
        uid,
        revokedCount: count,
        clientReason: parsed.data.reason?.slice(0, 200) ?? null,
      });
      return res.json({ ok: true, revokedCount: count });
    } catch (err: any) {
      logger.error('[me/sessions] revoke-all failed', { uid, error: err?.message });
      return res.status(500).json({ error: 'REVOKE_ALL_FAILED' });
    }
  },
);

export default router;

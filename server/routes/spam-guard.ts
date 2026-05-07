/**
 * SPAM GUARD — Admin Routes
 *
 * Issue #153 Mission 4 PR-1: this file's previous comment claimed
 * the router was protected by repo-wide /api/admin/* middleware that
 * does not exist. The mount in routes.ts ran only `adminLimiter`
 * (a rate limiter, not auth). Result: every endpoint here was
 * reachable unauthenticated. Three mutations were exposed to the
 * public internet:
 *   POST  /sweep                           (Gemini-backed cost burn / DoS)
 *   POST  /analyze                         (arbitrary content via Gemini)
 *   PATCH /detections/:id/resolve          (data tamper)
 * Plus 2 reads (/status, /detections) leaking moderation state.
 *
 * We now apply `requireAdmin` as router-level middleware so every
 * handler — read AND mutation — requires admin role before it
 * executes. Mutations also emit canonical `audit_events` via
 * `logAuditEvent` for compliance.
 *
 * Mount-side fix in routes.ts:9733 adds `validateFirebaseToken` so
 * `requireAdmin` actually has `req.firebaseUser` to evaluate.
 */

import { Router } from 'express';
import { geminiSpamGuard } from '../services/GeminiSpamGuard';
import { logger } from '../lib/logger';
import { requireAdmin } from '../adminAuth';
import { logAuditEvent } from '../middleware/auditLog';

const router = Router();

// Issue #153 Mission 4 PR-1 — every handler below requires admin role.
router.use(requireAdmin);

/** Emit canonical audit_events for spam-guard admin mutations. */
function emitSpamGuardAudit(params: {
  actionType: string;
  actorUserId: string | undefined;
  targetType: string;
  targetId: string | null | undefined;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}): void {
  setImmediate(() => {
    logAuditEvent({
      actorUserId: params.actorUserId || undefined,
      actorRole: 'admin',
      actionType: params.actionType,
      targetType: params.targetType,
      targetId: params.targetId != null ? String(params.targetId) : undefined,
      ip: params.ip,
      userAgent: params.userAgent,
      metadata: params.metadata ?? {},
    }).catch(() => {});
  });
}

/**
 * GET /api/admin/spam-guard/status
 * Spam guard health, last sweep stats, current scheduler state
 */
router.get('/status', (req, res) => {
  res.json({ ok: true, ...geminiSpamGuard.getStatus() });
});

/**
 * GET /api/admin/spam-guard/detections
 * Recent spam detections (in-memory ring buffer, last 200)
 * Query params: ?limit=50&severity=high&resolved=false
 */
router.get('/detections', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string || '50'), 200);
  const filterSeverity = req.query.severity as string | undefined;
  const filterResolved = req.query.resolved as string | undefined;

  let detections = geminiSpamGuard.getRecentDetections(200);

  if (filterSeverity) {
    detections = detections.filter(d => d.severity === filterSeverity);
  }
  if (filterResolved !== undefined) {
    const wantResolved = filterResolved === 'true';
    detections = detections.filter(d => d.resolved === wantResolved);
  }

  res.json({
    ok: true,
    total: detections.length,
    detections: detections.slice(0, limit),
  });
});

/**
 * POST /api/admin/spam-guard/sweep
 * Manually trigger a spam sweep immediately (admin only)
 */
router.post('/sweep', async (req: any, res) => {
  const adminUid = req.firebaseUser?.uid || req.user?.uid;
  logger.info('[SpamGuard] Manual sweep triggered by admin', {
    adminUid,
  });

  // Run async, return immediately with sweep ID
  const sweepStarted = Date.now();
  geminiSpamGuard.runSweep()
    .then(report => {
      logger.info('[SpamGuard] Manual sweep complete', {
        sweepId: report.sweepId,
        detections: report.detectionsFound,
      });
    })
    .catch(err => {
      logger.error('[SpamGuard] Manual sweep failed', { error: err?.message });
    });

  emitSpamGuardAudit({
    actionType: 'SPAMGUARD_MANUAL_SWEEP',
    actorUserId: adminUid,
    targetType: 'spam_guard',
    targetId: `manual_${sweepStarted}`,
    ip: req.ip,
    userAgent: req.headers['user-agent'] as string | undefined,
  });

  res.json({
    ok: true,
    message: 'Spam sweep started',
    sweepId: `manual_${sweepStarted}`,
    note: 'Check /api/admin/spam-guard/status in 30 seconds for results',
  });
});

/**
 * POST /api/admin/spam-guard/analyze
 * Ad-hoc content analysis — check any text right now
 * Body: { content, contentType, userId?, entityId? }
 */
router.post('/analyze', async (req: any, res) => {
  const { content, contentType = 'message', userId, entityId } = req.body;

  if (!content || typeof content !== 'string') {
    return res.status(400).json({ ok: false, error: 'content is required' });
  }

  try {
    const detection = await geminiSpamGuard.analyzeContent(content, contentType, userId, entityId);
    emitSpamGuardAudit({
      actionType: 'SPAMGUARD_ANALYZE',
      actorUserId: req.firebaseUser?.uid || req.user?.uid,
      targetType: 'spam_guard_analysis',
      targetId: entityId || null,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      // Length only — never echo raw content into the audit log.
      metadata: { contentType, contentLength: content.length, isSpam: !!detection },
    });
    res.json({
      ok: true,
      isSpam: !!detection,
      detection: detection ?? null,
    });
  } catch (err) {
    logger.error('[SpamGuard] Ad-hoc analyze failed', { error: (err as any)?.message });
    res.status(500).json({ ok: false, error: 'Analysis failed' });
  }
});

/**
 * PATCH /api/admin/spam-guard/detections/:id/resolve
 * Mark a detection as resolved (dismissed by admin)
 */
router.patch('/detections/:id/resolve', (req: any, res) => {
  const resolved = geminiSpamGuard.resolveDetection(req.params.id);
  if (!resolved) {
    return res.status(404).json({ ok: false, error: 'Detection not found' });
  }
  emitSpamGuardAudit({
    actionType: 'SPAMGUARD_DETECTION_RESOLVE',
    actorUserId: req.firebaseUser?.uid || req.user?.uid,
    targetType: 'spam_detection',
    targetId: req.params.id,
    ip: req.ip,
    userAgent: req.headers['user-agent'] as string | undefined,
  });
  res.json({ ok: true, message: 'Detection marked resolved' });
});

export default router;

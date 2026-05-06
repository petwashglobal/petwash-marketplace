/**
 * SPAM GUARD — Admin Routes
 * Protected by requireAdmin middleware
 */

import { Router } from 'express';
import { geminiSpamGuard } from '../services/GeminiSpamGuard';
import { logger } from '../lib/logger';
import { logAuditEvent } from '../middleware/auditLog';

const router = Router();
// Admin auth is applied globally to all /api/admin/* routes in routes.ts

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
  logger.info('[SpamGuard] Manual sweep triggered by admin', { adminUid: req.user?.uid });

  const sweepStarted = Date.now();
  geminiSpamGuard.runSweep()
    .then(report => logger.info('[SpamGuard] Manual sweep complete', { sweepId: report.sweepId, detections: report.detectionsFound }))
    .catch(err => logger.error('[SpamGuard] Manual sweep failed', { error: err?.message }));

  setImmediate(() => {
    logAuditEvent({
      actorUserId: req.firebaseUser?.uid || req.user?.uid,
      actorRole: 'admin',
      actionType: 'SPAMGUARD_MANUAL_SWEEP',
      targetType: 'spam_sweep',
      targetId: `manual_${sweepStarted}`,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    }).catch(() => {});
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
    setImmediate(() => {
      logAuditEvent({
        actorUserId: req.firebaseUser?.uid || req.user?.uid,
        actorRole: 'admin',
        actionType: 'SPAMGUARD_ANALYZE',
        targetType: 'spam_detection',
        targetId: (detection as any)?.id ?? entityId ?? 'ad-hoc',
        ip: req.ip,
        userAgent: req.headers['user-agent'] as string | undefined,
        // bodyLength only — never log raw user content
        metadata: { contentType, contentLength: content.length, isSpam: !!detection },
      }).catch(() => {});
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
  setImmediate(() => {
    logAuditEvent({
      actorUserId: req.firebaseUser?.uid || req.user?.uid,
      actorRole: 'admin',
      actionType: 'SPAMGUARD_DETECTION_RESOLVE',
      targetType: 'spam_detection',
      targetId: req.params.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    }).catch(() => {});
  });
  res.json({ ok: true, message: 'Detection marked resolved' });
});

export default router;

/**
 * Admin — job evidence (CEO rule 2026-09-13: cross-examine every provider job
 * before a Pet Wash admin approves the payout). READ-ONLY.
 *
 *   GET  /api/admin/job-evidence/:jobId   → evidence report (walk or booking request)
 *   POST /api/admin/job-evidence/sweep    → run the job watchdog now
 */
import { Router, type Request, type Response } from 'express';
import { requireAdmin } from '../adminAuth';
import { sendSanitizedError } from '../lib/sanitizeErrorResponse';

const router = Router();

router.get('/:jobId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const jobId = String(req.params.jobId || '').slice(0, 64);
    if (!/^[A-Za-z0-9_-]+$/.test(jobId)) return res.status(400).json({ error: 'INVALID_JOB_ID' });
    const { buildJobEvidenceReport } = await import('../services/jobEvidenceLoader');
    const report = await buildJobEvidenceReport(jobId);
    if (!report) return res.status(404).json({ error: 'JOB_NOT_FOUND' });
    return res.json({ ok: true, report });
  } catch (err) {
    return sendSanitizedError(res, err, 'JOB_EVIDENCE_FAILED');
  }
});

router.post('/sweep', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const { runJobEvidenceWatchdog } = await import('../services/jobEvidenceWatchdog');
    return res.json({ ok: true, ...(await runJobEvidenceWatchdog()) });
  } catch (err) {
    return sendSanitizedError(res, err, 'JOB_EVIDENCE_SWEEP_FAILED');
  }
});

export default router;

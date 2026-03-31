/**
 * Phase 12.23 — Learning, Policy Refinement & Capital Feedback
 * Routes under /api/expansion/policy
 *
 * Reads only from 12.22 outcomes and 12.19 friction data.
 * No new financial computation. No retrospective number invention.
 */

import { Router, Request, Response } from 'express';
import { computePolicyFeedback } from '../lib/learning-policy';

const router = Router();

// GET /api/expansion/policy/summary
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const report = await computePolicyFeedback();
    return res.json(report);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;

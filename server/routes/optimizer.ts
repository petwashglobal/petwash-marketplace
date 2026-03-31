/**
 * Phase 12.25 — Autonomous Optimization (Controlled)
 * Routes under /api/expansion/optimizer
 *
 * Proposal lifecycle: proposed → accepted → promoted (OR rejected)
 * Promotion ONLY creates a draft in policy_configs (12.24).
 * Human must still: activate → rollout → evaluate → rollback.
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { generateOptimizationProposals } from '../lib/optimizer';
import { computePolicyFeedback } from '../lib/learning-policy';

const router = Router();

// ---------------------------------------------------------------------------
// GET /proposals — list all
// ---------------------------------------------------------------------------
router.get('/proposals', async (_req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT * FROM optimization_proposals ORDER BY created_at DESC, id DESC
    `);
    return res.json({ proposals: result.rows });
  } catch (err: any) {
    return res.status(500).json({ error: 'OPTIMIZER_LIST_FAILED', message: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /proposals/generate — run engine, persist new proposals (idempotent)
// Skips any proposal whose proposal_key already exists in proposed/accepted state
// ---------------------------------------------------------------------------
router.post('/proposals/generate', async (_req: Request, res: Response) => {
  try {
    const feedback = await computePolicyFeedback();

    const configsResult = await db.execute(sql`
      SELECT policy_key AS "policyKey", config
      FROM policy_configs WHERE status = 'active'
      ORDER BY policy_key, version DESC
    `);

    const proposals = await generateOptimizationProposals(
      configsResult.rows as Array<{ policyKey: string; config: Record<string, unknown> }>
    );

    let inserted = 0;
    let skippedDuplicates = 0;
    const persisted: unknown[] = [];

    for (const p of proposals) {
      // Skip if this exact proposal is already pending
      const exists = await db.execute(sql`
        SELECT id FROM optimization_proposals
        WHERE proposal_key = ${p.proposal_key} AND status IN ('proposed','accepted')
        LIMIT 1
      `);

      if (exists.rows.length > 0) {
        skippedDuplicates++;
        continue;
      }

      const ins = await db.execute(sql`
        INSERT INTO optimization_proposals
          (proposal_key, policy_key, proposal_type, current_config, proposed_config, rationale, confidence, evidence_count, status)
        VALUES (
          ${p.proposal_key},
          ${p.policy_key},
          ${p.proposal_type},
          ${JSON.stringify(p.current_config)}::jsonb,
          ${JSON.stringify(p.proposed_config)}::jsonb,
          ${JSON.stringify(p.rationale)}::jsonb,
          ${p.confidence},
          ${p.evidence_count},
          'proposed'
        )
        ON CONFLICT (proposal_key) DO NOTHING
        RETURNING *
      `);

      if (ins.rows[0]) {
        inserted++;
        persisted.push(ins.rows[0]);
      }
    }

    return res.json({
      generated: inserted,
      skippedDuplicates,
      proposals: persisted,
      measurementReadiness: feedback.dataMaturity.measurementReadiness,
    });
  } catch (err: any) {
    console.error('[Optimizer] generate failed', err);
    return res.status(500).json({ error: 'OPTIMIZER_GENERATE_FAILED', message: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /proposals/:id/accept — proposed → accepted (with optional review note)
// ---------------------------------------------------------------------------
router.post('/proposals/:id/accept', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const reviewNote = String(req.body?.reviewNote || '').trim() || null;

    const result = await db.execute(sql`
      UPDATE optimization_proposals
      SET status = 'accepted', reviewed_at = NOW(), review_note = ${reviewNote}
      WHERE id = ${id}
      RETURNING *
    `);

    if (!result.rows[0]) return res.status(404).json({ error: 'OPTIMIZER_PROPOSAL_NOT_FOUND' });
    return res.json({ proposal: result.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: 'OPTIMIZER_ACCEPT_FAILED', message: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /proposals/:id/reject — any non-promoted → rejected (with optional note)
// ---------------------------------------------------------------------------
router.post('/proposals/:id/reject', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const reviewNote = String(req.body?.reviewNote || '').trim() || null;

    const existing = await db.execute(sql`SELECT status FROM optimization_proposals WHERE id = ${id}`);
    if (!existing.rows[0]) return res.status(404).json({ error: 'OPTIMIZER_PROPOSAL_NOT_FOUND' });
    if (existing.rows[0].status === 'promoted') {
      return res.status(400).json({ error: 'Cannot reject a promoted proposal.' });
    }

    const result = await db.execute(sql`
      UPDATE optimization_proposals
      SET status = 'rejected', reviewed_at = NOW(), review_note = ${reviewNote}
      WHERE id = ${id}
      RETURNING *
    `);

    return res.json({ proposal: result.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: 'OPTIMIZER_REJECT_FAILED', message: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /proposals/:id/promote-to-draft
// CRITICAL CONTROL POINT — creates a DRAFT in policy_configs (12.24) only.
// Does NOT activate. Human must still: activate → rollout → evaluate → rollback.
// ---------------------------------------------------------------------------
router.post('/proposals/:id/promote-to-draft', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const proposalResult = await db.execute(sql`
      SELECT * FROM optimization_proposals WHERE id = ${id} LIMIT 1
    `);
    const proposal = proposalResult.rows[0] as any;

    if (!proposal) return res.status(404).json({ error: 'OPTIMIZER_PROPOSAL_NOT_FOUND' });

    if (proposal.status !== 'accepted') {
      return res.status(400).json({
        error: 'OPTIMIZER_PROPOSAL_NOT_ACCEPTED',
        message: `Proposal must be accepted before promotion. Current status: "${proposal.status}".`,
      });
    }

    // Auto-increment version within this policy_key
    const nextVersionResult = await db.execute(sql`
      SELECT COALESCE(MAX(version), 0) + 1 AS next_version
      FROM policy_configs WHERE policy_key = ${proposal.policy_key as string}
    `);
    const version = Number((nextVersionResult.rows[0] as any)?.next_version ?? 1);

    const draftResult = await db.execute(sql`
      INSERT INTO policy_configs (policy_key, version, config, status, created_at, created_by)
      VALUES (
        ${proposal.policy_key as string},
        ${version},
        ${proposal.proposed_config},
        'draft',
        NOW(),
        'optimizer_promotion'
      )
      RETURNING *
    `);

    await db.execute(sql`
      UPDATE optimization_proposals SET status = 'promoted', reviewed_at = NOW() WHERE id = ${id}
    `);

    return res.json({
      draft: draftResult.rows[0],
      promotedFromProposalId: id,
    });
  } catch (err: any) {
    console.error('[Optimizer] promote failed', err);
    return res.status(500).json({ error: 'OPTIMIZER_PROMOTE_FAILED', message: err.message });
  }
});

export default router;

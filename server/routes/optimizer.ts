/**
 * Phase 12.25 — Autonomous Optimization (Controlled)
 * Routes under /api/expansion/optimizer
 *
 * FLOW: observe → propose → accept/reject → promote → 12.24 control chain
 * The system NEVER activates or deploys policy changes directly.
 * Promote creates a DRAFT in policy_configs — requires human activation in 12.24.
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { generateProposals } from '../lib/optimizer';

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/expansion/optimizer/proposals — list all proposals
// ---------------------------------------------------------------------------
router.get('/proposals', async (req: Request, res: Response) => {
  try {
    const { status } = req.query as Record<string, string>;
    const result = status
      ? await db.execute(sql`SELECT * FROM optimization_proposals WHERE status = ${status} ORDER BY created_at DESC`)
      : await db.execute(sql`SELECT * FROM optimization_proposals ORDER BY created_at DESC`);

    const counts: Record<string, number> = { proposed: 0, accepted: 0, rejected: 0, promoted: 0, total: 0 };
    for (const row of result.rows) {
      const s = row.status as string;
      counts[s] = (counts[s] ?? 0) + 1;
      counts.total++;
    }

    return res.json({ proposals: result.rows, counts });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/expansion/optimizer/generate — run the optimizer engine
// Returns proposals (and persists them to the DB)
// Won't generate duplicates: skips policy_keys already in 'proposed' state
// ---------------------------------------------------------------------------
router.post('/generate', async (req: Request, res: Response) => {
  try {
    // Load active policy configs to check current thresholds
    const configsResult = await db.execute(sql`
      SELECT policy_key AS "policyKey", config FROM policy_configs WHERE status = 'active'
    `);
    const activeConfigs = configsResult.rows as Array<{ policyKey: string; config: Record<string, unknown> }>;

    // Load already-pending proposal keys to avoid duplicates
    const pendingResult = await db.execute(sql`
      SELECT policy_key FROM optimization_proposals WHERE status = 'proposed'
    `);
    const pendingKeys = new Set(pendingResult.rows.map(r => r.policy_key as string));

    // Generate proposals from the optimizer engine
    const proposals = await generateProposals(activeConfigs);

    if (proposals.length === 0) {
      // Explain why nothing was generated
      const maturityResult = await db.execute(sql`
        SELECT COUNT(*) AS total FROM intervention_cases
      `);
      const total = Number(maturityResult.rows[0]?.total ?? 0);
      return res.json({
        proposals: [],
        skipped: 0,
        message: total < 3
          ? 'Insufficient data: fewer than 3 intervention cases exist. The optimizer requires at least 3 resolved cases with economic baselines.'
          : 'No improvement opportunities detected with current data. The optimizer found no cases where a policy change is supported by measured outcomes.',
      });
    }

    // Persist proposals — skip any policy_key already pending review
    const inserted = [];
    const skipped  = [];

    for (const p of proposals) {
      if (pendingKeys.has(p.policy_key)) {
        skipped.push(p.policy_key);
        continue;
      }

      const r = await db.execute(sql`
        INSERT INTO optimization_proposals
          (policy_key, proposal_type, current_config, proposed_config, rationale, confidence, evidence_count)
        VALUES (
          ${p.policy_key},
          ${p.proposal_type},
          ${JSON.stringify(p.current_config)}::jsonb,
          ${JSON.stringify(p.proposed_config)}::jsonb,
          ${JSON.stringify(p.rationale)}::jsonb,
          ${p.confidence},
          ${p.evidence_count}
        )
        RETURNING *
      `);
      inserted.push(r.rows[0]);
    }

    return res.json({
      proposals: inserted,
      skipped: skipped.length,
      skippedKeys: skipped,
      message: inserted.length === 0 && skipped.length > 0
        ? `${skipped.length} proposal(s) already pending review. Resolve them before generating new ones.`
        : null,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/expansion/optimizer/proposals/:id/accept
// ---------------------------------------------------------------------------
router.post('/proposals/:id/accept', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const existing = await db.execute(sql`SELECT * FROM optimization_proposals WHERE id = ${id}`);
    if (!existing.rows.length) return res.status(404).json({ error: 'Proposal not found' });

    const row = existing.rows[0];
    if (row.status !== 'proposed') {
      return res.status(400).json({ error: `Cannot accept a proposal with status "${row.status}". Only proposed can be accepted.` });
    }

    const result = await db.execute(sql`
      UPDATE optimization_proposals SET status = 'accepted', reviewed_at = NOW()
      WHERE id = ${id} RETURNING *
    `);
    return res.json({ proposal: result.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/expansion/optimizer/proposals/:id/reject
// ---------------------------------------------------------------------------
router.post('/proposals/:id/reject', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const existing = await db.execute(sql`SELECT * FROM optimization_proposals WHERE id = ${id}`);
    if (!existing.rows.length) return res.status(404).json({ error: 'Proposal not found' });

    const row = existing.rows[0];
    if (row.status === 'promoted') {
      return res.status(400).json({ error: 'Cannot reject a promoted proposal.' });
    }

    const result = await db.execute(sql`
      UPDATE optimization_proposals SET status = 'rejected', reviewed_at = NOW()
      WHERE id = ${id} RETURNING *
    `);
    return res.json({ proposal: result.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/expansion/optimizer/proposals/:id/promote
// CRITICAL CONTROL POINT:
// Creates a DRAFT in policy_configs (12.24). Does NOT activate it.
// Human must still: activate draft → create rollout → measure → rollback if needed.
// ---------------------------------------------------------------------------
router.post('/proposals/:id/promote', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const existing = await db.execute(sql`SELECT * FROM optimization_proposals WHERE id = ${id}`);
    if (!existing.rows.length) return res.status(404).json({ error: 'Proposal not found' });

    const proposal = existing.rows[0];
    if (proposal.status !== 'accepted') {
      return res.status(400).json({ error: `Proposal must be accepted before promoting. Current status: "${proposal.status}". Accept it first.` });
    }

    // Auto-increment version for this policy_key in policy_configs
    const vResult = await db.execute(sql`
      SELECT COALESCE(MAX(version), 0) + 1 AS next_version
      FROM policy_configs WHERE policy_key = ${proposal.policy_key as string}
    `);
    const nextVersion = Number(vResult.rows[0].next_version);

    // Create draft (status='draft' — requires human activation in 12.24)
    const draftResult = await db.execute(sql`
      INSERT INTO policy_configs (policy_key, version, config, status, created_by)
      VALUES (
        ${proposal.policy_key as string},
        ${nextVersion},
        ${JSON.stringify(proposal.proposed_config)}::jsonb,
        'draft',
        'optimizer-12.25'
      )
      RETURNING *
    `);

    // Mark proposal as promoted
    await db.execute(sql`
      UPDATE optimization_proposals SET status = 'promoted', reviewed_at = NOW()
      WHERE id = ${id}
    `);

    return res.json({
      draft: draftResult.rows[0],
      message: `Draft v${nextVersion} created for "${proposal.policy_key}". Go to Policy Control (12.24) to activate it and create a rollout.`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;

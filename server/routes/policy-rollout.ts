/**
 * Phase 12.24 — Policy Execution Discipline & Controlled Rollout
 * Routes under /api/expansion/policy-rollout
 *
 * All DB operations use raw SQL via db.execute (tables managed outside Drizzle ORM).
 * Result rows accessed as result.rows[n].
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { evaluateRollout, KNOWN_POLICY_KEYS } from '../lib/policy-rollout';
import { computeOutcomeSummary } from '../lib/outcome-measurement';

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/expansion/policy-rollout/keys — available policy keys + metadata
// ---------------------------------------------------------------------------
router.get('/keys', async (req: Request, res: Response) => {
  try {
    return res.json({ policyKeys: KNOWN_POLICY_KEYS });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/expansion/policy-rollout/configs — all policy configs (versioned)
// ---------------------------------------------------------------------------
router.get('/configs', async (req: Request, res: Response) => {
  try {
    const { policyKey } = req.query as Record<string, string>;
    const result = policyKey
      ? await db.execute(sql`SELECT * FROM policy_configs WHERE policy_key = ${policyKey} ORDER BY version DESC`)
      : await db.execute(sql`SELECT * FROM policy_configs ORDER BY policy_key, version DESC`);

    // Group by policy_key for easier consumption
    const grouped: Record<string, any[]> = {};
    for (const row of result.rows) {
      const k = row.policy_key as string;
      if (!grouped[k]) grouped[k] = [];
      grouped[k].push(row);
    }

    return res.json({ configs: result.rows, grouped, total: result.rows.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/expansion/policy-rollout/configs — create new policy version (draft)
// ---------------------------------------------------------------------------
router.post('/configs', async (req: Request, res: Response) => {
  try {
    const user = (req as any).firebaseUser;
    const createdBy = user?.email ?? user?.uid ?? 'admin';

    const { policyKey, config } = req.body;
    if (!policyKey || !config) {
      return res.status(400).json({ error: 'policyKey and config are required' });
    }

    if (typeof config !== 'object' || Array.isArray(config)) {
      return res.status(400).json({ error: 'config must be a JSON object' });
    }

    // Auto-increment version within this policy_key
    const vResult = await db.execute(sql`
      SELECT COALESCE(MAX(version), 0) + 1 AS next_version
      FROM policy_configs WHERE policy_key = ${policyKey}
    `);
    const nextVersion = Number(vResult.rows[0].next_version);

    const insertResult = await db.execute(sql`
      INSERT INTO policy_configs (policy_key, version, config, status, created_by)
      VALUES (${policyKey}, ${nextVersion}, ${JSON.stringify(config)}, 'draft', ${createdBy})
      RETURNING *
    `);

    return res.status(201).json({ config: insertResult.rows[0] });
  } catch (err: any) {
    if (err.message?.includes('unique')) {
      return res.status(409).json({ error: 'A policy config with this key and version already exists' });
    }
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/expansion/policy-rollout/configs/:id/activate — draft → active
// Archives all other active versions of the same policy_key
// ---------------------------------------------------------------------------
router.post('/configs/:id/activate', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    // Get the config to activate
    const existing = await db.execute(sql`SELECT * FROM policy_configs WHERE id = ${id}`);
    if (!existing.rows.length) return res.status(404).json({ error: 'Policy config not found' });

    const row = existing.rows[0];
    if (row.status !== 'draft') {
      return res.status(400).json({ error: `Cannot activate a config with status "${row.status}". Only drafts can be activated.` });
    }

    // Archive all other active versions of this policy_key
    await db.execute(sql`
      UPDATE policy_configs SET status = 'archived'
      WHERE policy_key = ${row.policy_key as string} AND status = 'active'
    `);

    // Activate this one
    const activated = await db.execute(sql`
      UPDATE policy_configs SET status = 'active', activated_at = NOW()
      WHERE id = ${id} RETURNING *
    `);

    return res.json({ config: activated.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/expansion/policy-rollout/rollouts — all rollouts
// ---------------------------------------------------------------------------
router.get('/rollouts', async (req: Request, res: Response) => {
  try {
    const { status } = req.query as Record<string, string>;
    const result = status
      ? await db.execute(sql`SELECT * FROM policy_rollouts WHERE rollout_status = ${status} ORDER BY created_at DESC`)
      : await db.execute(sql`SELECT * FROM policy_rollouts ORDER BY created_at DESC`);

    const counts = {
      planned:     result.rows.filter(r => r.rollout_status === 'planned').length,
      active:      result.rows.filter(r => r.rollout_status === 'active').length,
      paused:      result.rows.filter(r => r.rollout_status === 'paused').length,
      rolled_back: result.rows.filter(r => r.rollout_status === 'rolled_back').length,
      completed:   result.rows.filter(r => r.rollout_status === 'completed').length,
      total:       result.rows.length,
    };

    return res.json({ rollouts: result.rows, counts });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/expansion/policy-rollout/rollouts — create rollout for an active config
// ---------------------------------------------------------------------------
router.post('/rollouts', async (req: Request, res: Response) => {
  try {
    const user = (req as any).firebaseUser;
    const createdBy = user?.email ?? user?.uid ?? 'admin';

    const { policyKey, version, scopeType, scopeKey } = req.body;
    if (!policyKey || !version || !scopeType) {
      return res.status(400).json({ error: 'policyKey, version, and scopeType are required' });
    }

    const VALID_SCOPES = ['global', 'franchise', 'station', 'ownership'];
    if (!VALID_SCOPES.includes(scopeType)) {
      return res.status(400).json({ error: `scopeType must be one of: ${VALID_SCOPES.join(', ')}` });
    }

    // Verify the config exists and is active
    const configCheck = await db.execute(sql`
      SELECT * FROM policy_configs WHERE policy_key = ${policyKey} AND version = ${version}
    `);
    if (!configCheck.rows.length) {
      return res.status(404).json({ error: `No policy config found for key="${policyKey}" version=${version}` });
    }
    if (configCheck.rows[0].status !== 'active') {
      return res.status(400).json({ error: `Policy config must be active before creating a rollout. Current status: "${configCheck.rows[0].status}". Activate it first.` });
    }

    const insertResult = await db.execute(sql`
      INSERT INTO policy_rollouts (policy_key, version, scope_type, scope_key, rollout_status, start_date, created_by)
      VALUES (${policyKey}, ${version}, ${scopeType}, ${scopeKey ?? null}, 'active', NOW(), ${createdBy})
      RETURNING *
    `);

    return res.status(201).json({ rollout: insertResult.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/expansion/policy-rollout/rollouts/:id/rollback — kill switch
// ---------------------------------------------------------------------------
router.post('/rollouts/:id/rollback', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const { reason } = req.body;

    const result = await db.execute(sql`
      UPDATE policy_rollouts
      SET rollout_status = 'rolled_back', end_date = NOW()
      WHERE id = ${id} AND rollout_status NOT IN ('rolled_back', 'completed')
      RETURNING *
    `);

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Rollout not found or already rolled back / completed' });
    }

    return res.json({ rollout: result.rows[0], status: 'rolled_back', reason: reason ?? null });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/expansion/policy-rollout/rollouts/:id/evaluate
// Evaluate rollout effectiveness using 12.22 outcome engine
// ---------------------------------------------------------------------------
router.get('/rollouts/:id/evaluate', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const rolloutResult = await db.execute(sql`SELECT * FROM policy_rollouts WHERE id = ${id}`);
    if (!rolloutResult.rows.length) return res.status(404).json({ error: 'Rollout not found' });

    const rollout = rolloutResult.rows[0];

    // Pull live 12.22 outcomes and evaluate
    const outcomes = await computeOutcomeSummary();
    const evaluation = evaluateRollout(outcomes, {
      id: Number(rollout.id),
      scope_type: rollout.scope_type as string,
      scope_key: rollout.scope_key as string | null,
    });

    // Persist the evaluation
    await db.execute(sql`
      INSERT INTO policy_rollout_evaluations (rollout_id, success_rate, avg_margin_delta, avg_friction_delta, sample_size)
      VALUES (${id}, ${evaluation.successRate}, ${evaluation.avgMarginDelta}, ${evaluation.avgFrictionDelta}, ${evaluation.sampleSize})
    `);

    return res.json({ rollout, evaluation });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/expansion/policy-rollout/rollouts/:id/evaluation-history
// All persisted evaluations for a rollout
// ---------------------------------------------------------------------------
router.get('/rollouts/:id/evaluation-history', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const result = await db.execute(sql`
      SELECT * FROM policy_rollout_evaluations WHERE rollout_id = ${id} ORDER BY measured_at DESC
    `);

    return res.json({ evaluations: result.rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;

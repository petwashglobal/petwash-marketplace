/**
 * server/routes/governance.ts
 * Phase 12.13 — Governance & Automation Layer
 *
 * GET    /api/governance/policies              — list all policies
 * POST   /api/governance/policies              — create policy
 * GET    /api/governance/policies/:id          — get single policy
 * PUT    /api/governance/policies/:id          — update policy
 * DELETE /api/governance/policies/:id          — soft-delete (is_active = false)
 * POST   /api/governance/policies/:id/activate — re-activate
 * GET    /api/governance/executions            — recent execution log
 * POST   /api/governance/evaluate              — test a policy set against a CaseContext
 *
 * Auth: admin (x-admin-secret / decoded.admin) OR active franchise_owner
 */

import { Router, Request, Response } from 'express';
import { db }     from '../db';
import { sql }    from 'drizzle-orm';
import { logger } from '../lib/logger';
import { auth as firebaseAuth } from '../lib/firebase-admin';
import { evaluatePolicies, CaseContext } from '../lib/policy-engine';

const router = Router();

// ─── Auth middleware ───────────────────────────────────────────────────────────

async function requireGovernanceAdmin(req: Request, res: Response, next: Function) {
  try {
    const adminSecret = req.headers['x-admin-secret'];
    if (adminSecret && adminSecret === process.env.ADMIN_SECRET) return next();
    if (adminSecret && adminSecret === process.env.PETWASH_ADMIN_SECRET) return next();

    const token = (req.headers.authorization ?? '').replace('Bearer ', '').trim();
    if (!token) return res.status(401).json({ error: 'unauthorized' });

    const decoded = await firebaseAuth.verifyIdToken(token, true);
    if (decoded.admin) return next();

    // Franchise owners may manage governance policies
    const r = await db.execute(sql.raw(`
      SELECT role FROM user_profiles
      WHERE firebase_uid = '${String(decoded.uid ?? '').replace(/'/g, "''").slice(0, 200)}'
        AND is_active = true
      LIMIT 1
    `));
    const role = (r.rows[0] as any)?.role ?? '';
    if (['franchise_owner', 'manager'].includes(role)) {
      (req as any).callerCtx = { uid: decoded.uid, role };
      return next();
    }

    return res.status(403).json({ error: 'insufficient_role' });
  } catch (err: any) {
    return res.status(401).json({ error: 'auth_failed' });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safe(s: string) {
  return String(s ?? '').replace(/'/g, "''").replace(/\\/g, '\\\\').slice(0, 1000);
}

function toNum(v: unknown) { return v == null ? 0 : Number(v); }

const VALID_TYPES = new Set(['approval_threshold', 'auto_routing', 'escalation_rule', 'playbook']);
const VALID_SCOPES = new Set(['global', 'franchise', 'station']);

function validatePolicy(body: any): string | null {
  if (!body.policy_type || !VALID_TYPES.has(body.policy_type))
    return `policy_type must be one of: ${[...VALID_TYPES].join(', ')}`;
  if (!body.name || typeof body.name !== 'string' || body.name.trim().length < 3)
    return 'name must be a non-empty string (≥3 chars)';
  if (!Array.isArray(body.actions) || body.actions.length === 0)
    return 'actions must be a non-empty array';
  if (body.scope_type && !VALID_SCOPES.has(body.scope_type))
    return `scope_type must be one of: ${[...VALID_SCOPES].join(', ')}`;
  return null;
}

// ─── GET /policies ─────────────────────────────────────────────────────────────

router.get('/policies', requireGovernanceAdmin, async (req: Request, res: Response) => {
  try {
    const { type, active } = req.query;
    const typeFilter   = type   ? `AND policy_type = '${safe(String(type))}'` : '';
    const activeFilter = active === 'false' ? '' : 'AND is_active = true';

    const r = await db.execute(sql.raw(`
      SELECT
        id, policy_type, name, description, case_types, conditions, actions,
        priority, is_active, scope_type, scope_id, created_by, created_at, updated_at
      FROM governance_policies
      WHERE 1=1 ${typeFilter} ${activeFilter}
      ORDER BY priority ASC, policy_type, id ASC
    `));

    res.json({
      policies: (r.rows as any[]).map(row => ({
        id:          toNum(row.id),
        policyType:  row.policy_type,
        name:        row.name,
        description: row.description,
        caseTypes:   row.case_types ?? [],
        conditions:  typeof row.conditions === 'string' ? JSON.parse(row.conditions) : (row.conditions ?? {}),
        actions:     typeof row.actions === 'string' ? JSON.parse(row.actions) : (row.actions ?? []),
        priority:    toNum(row.priority),
        isActive:    Boolean(row.is_active),
        scopeType:   row.scope_type,
        scopeId:     row.scope_id,
        createdBy:   row.created_by,
        createdAt:   row.created_at,
        updatedAt:   row.updated_at,
      })),
      total: r.rows.length,
    });
  } catch (err: any) {
    logger.error('[Governance] list policies error', { error: err.message });
    res.status(500).json({ error: 'policies_fetch_error' });
  }
});

// ─── POST /policies ────────────────────────────────────────────────────────────

router.post('/policies', requireGovernanceAdmin, async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};
    const validationError = validatePolicy(body);
    if (validationError) return res.status(400).json({ error: validationError });

    const ctx     = (req as any).callerCtx;
    const actorUid = ctx?.uid ?? 'system';

    const caseTypes  = JSON.stringify(Array.isArray(body.case_types) ? body.case_types : []);
    const conditions = JSON.stringify(body.conditions ?? {});
    const actions    = JSON.stringify(body.actions);
    const priority   = Math.min(Math.max(1, toNum(body.priority ?? 100)), 999);
    const scopeType  = VALID_SCOPES.has(body.scope_type) ? body.scope_type : 'global';
    const scopeId    = body.scope_id ? `'${safe(String(body.scope_id))}'` : 'NULL';

    const r = await db.execute(sql.raw(`
      INSERT INTO governance_policies
        (policy_type, name, description, case_types, conditions, actions, priority, scope_type, scope_id, created_by)
      VALUES (
        '${safe(body.policy_type)}',
        '${safe(body.name.trim())}',
        ${body.description ? `'${safe(String(body.description))}'` : 'NULL'},
        '${safe(caseTypes)}'::jsonb::text::text[],
        '${safe(conditions)}'::jsonb,
        '${safe(actions)}'::jsonb,
        ${priority},
        '${scopeType}',
        ${scopeId},
        '${safe(actorUid)}'
      )
      RETURNING id
    `));

    const newId = toNum((r.rows[0] as any)?.id);

    // Audit log
    await db.execute(sql.raw(`
      INSERT INTO policy_audit_log (policy_id, action, actor_uid, changes)
      VALUES (${newId}, 'created', '${safe(actorUid)}', '${safe(JSON.stringify({ name: body.name, policyType: body.policy_type }))}')
    `));

    logger.info('[Governance] policy created', { id: newId, type: body.policy_type, name: body.name });
    res.status(201).json({ id: newId, message: 'Policy created' });
  } catch (err: any) {
    logger.error('[Governance] create policy error', { error: err.message });
    res.status(500).json({ error: 'policy_create_error' });
  }
});

// ─── GET /policies/:id ─────────────────────────────────────────────────────────

router.get('/policies/:id', requireGovernanceAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'invalid_id' });

    const r = await db.execute(sql.raw(`
      SELECT * FROM governance_policies WHERE id = ${id} LIMIT 1
    `));
    if (!r.rows.length) return res.status(404).json({ error: 'not_found' });

    const row = r.rows[0] as any;

    // Execution history for this policy
    const execs = await db.execute(sql.raw(`
      SELECT case_type, case_ref_id, trigger_event, actions_taken, created_at
      FROM policy_executions
      WHERE policy_id = ${id}
      ORDER BY created_at DESC
      LIMIT 20
    `));

    res.json({
      id:          toNum(row.id),
      policyType:  row.policy_type,
      name:        row.name,
      description: row.description,
      caseTypes:   row.case_types ?? [],
      conditions:  typeof row.conditions === 'string' ? JSON.parse(row.conditions) : (row.conditions ?? {}),
      actions:     typeof row.actions === 'string' ? JSON.parse(row.actions) : (row.actions ?? []),
      priority:    toNum(row.priority),
      isActive:    Boolean(row.is_active),
      scopeType:   row.scope_type,
      scopeId:     row.scope_id,
      createdBy:   row.created_by,
      createdAt:   row.created_at,
      updatedAt:   row.updated_at,
      recentExecutions: (execs.rows as any[]).map(e => ({
        caseType:    e.case_type,
        caseRefId:   e.case_ref_id,
        triggerEvent: e.trigger_event,
        actionsTaken: typeof e.actions_taken === 'string' ? JSON.parse(e.actions_taken) : (e.actions_taken ?? []),
        executedAt:  e.created_at,
      })),
    });
  } catch (err: any) {
    logger.error('[Governance] get policy error', { error: err.message });
    res.status(500).json({ error: 'policy_fetch_error' });
  }
});

// ─── PUT /policies/:id ─────────────────────────────────────────────────────────

router.put('/policies/:id', requireGovernanceAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'invalid_id' });

    const body = req.body ?? {};
    const ctx      = (req as any).callerCtx;
    const actorUid = ctx?.uid ?? 'system';

    const setParts: string[] = ['updated_at = NOW()'];

    if (body.name)        setParts.push(`name = '${safe(String(body.name).trim())}'`);
    if (body.description !== undefined)
                          setParts.push(`description = ${body.description ? `'${safe(String(body.description))}'` : 'NULL'}`);
    if (body.case_types)  setParts.push(`case_types = '${safe(JSON.stringify(body.case_types))}'::jsonb::text::text[]`);
    if (body.conditions)  setParts.push(`conditions = '${safe(JSON.stringify(body.conditions))}'::jsonb`);
    if (body.actions)     setParts.push(`actions = '${safe(JSON.stringify(body.actions))}'::jsonb`);
    if (body.priority != null) setParts.push(`priority = ${Math.min(Math.max(1, toNum(body.priority)), 999)}`);
    if (body.scope_type && VALID_SCOPES.has(body.scope_type))
                          setParts.push(`scope_type = '${body.scope_type}'`);
    if (body.scope_id !== undefined)
                          setParts.push(`scope_id = ${body.scope_id ? `'${safe(String(body.scope_id))}'` : 'NULL'}`);
    if (body.is_active != null)
                          setParts.push(`is_active = ${Boolean(body.is_active)}`);

    if (setParts.length === 1) return res.status(400).json({ error: 'no_fields_to_update' });

    const r = await db.execute(sql.raw(`
      UPDATE governance_policies SET ${setParts.join(', ')} WHERE id = ${id} RETURNING id
    `));
    if (!r.rows.length) return res.status(404).json({ error: 'not_found' });

    await db.execute(sql.raw(`
      INSERT INTO policy_audit_log (policy_id, action, actor_uid, changes)
      VALUES (${id}, 'updated', '${safe(actorUid)}', '${safe(JSON.stringify(body))}')
    `));

    logger.info('[Governance] policy updated', { id });
    res.json({ id, message: 'Policy updated' });
  } catch (err: any) {
    logger.error('[Governance] update policy error', { error: err.message });
    res.status(500).json({ error: 'policy_update_error' });
  }
});

// ─── DELETE /policies/:id (soft-delete) ────────────────────────────────────────

router.delete('/policies/:id', requireGovernanceAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'invalid_id' });

    const ctx      = (req as any).callerCtx;
    const actorUid = ctx?.uid ?? 'system';

    const r = await db.execute(sql.raw(`
      UPDATE governance_policies SET is_active = false, updated_at = NOW()
      WHERE id = ${id} RETURNING id
    `));
    if (!r.rows.length) return res.status(404).json({ error: 'not_found' });

    await db.execute(sql.raw(`
      INSERT INTO policy_audit_log (policy_id, action, actor_uid)
      VALUES (${id}, 'deactivated', '${safe(actorUid)}')
    `));

    logger.info('[Governance] policy deactivated', { id });
    res.json({ id, message: 'Policy deactivated' });
  } catch (err: any) {
    logger.error('[Governance] deactivate policy error', { error: err.message });
    res.status(500).json({ error: 'policy_deactivate_error' });
  }
});

// ─── POST /policies/:id/activate ──────────────────────────────────────────────

router.post('/policies/:id/activate', requireGovernanceAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'invalid_id' });

    const ctx      = (req as any).callerCtx;
    const actorUid = ctx?.uid ?? 'system';

    const r = await db.execute(sql.raw(`
      UPDATE governance_policies SET is_active = true, updated_at = NOW()
      WHERE id = ${id} RETURNING id
    `));
    if (!r.rows.length) return res.status(404).json({ error: 'not_found' });

    await db.execute(sql.raw(`
      INSERT INTO policy_audit_log (policy_id, action, actor_uid)
      VALUES (${id}, 'activated', '${safe(actorUid)}')
    `));

    res.json({ id, message: 'Policy activated' });
  } catch (err: any) {
    res.status(500).json({ error: 'policy_activate_error' });
  }
});

// ─── GET /executions ───────────────────────────────────────────────────────────

router.get('/executions', requireGovernanceAdmin, async (req: Request, res: Response) => {
  try {
    const { case_type, trigger_event, limit: lim } = req.query;
    const limitN = Math.min(Math.max(1, parseInt(String(lim ?? '50'), 10)), 200);

    const filters: string[] = [];
    if (case_type)     filters.push(`pe.case_type = '${safe(String(case_type))}'`);
    if (trigger_event) filters.push(`pe.trigger_event = '${safe(String(trigger_event))}'`);
    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const r = await db.execute(sql.raw(`
      SELECT
        pe.id, pe.policy_id, gp.name AS policy_name, gp.policy_type,
        pe.case_type, pe.case_ref_id, pe.trigger_event, pe.actions_taken, pe.created_at
      FROM policy_executions pe
      LEFT JOIN governance_policies gp ON gp.id = pe.policy_id
      ${whereClause}
      ORDER BY pe.created_at DESC
      LIMIT ${limitN}
    `));

    res.json({
      executions: (r.rows as any[]).map(e => ({
        id:           toNum(e.id),
        policyId:     toNum(e.policy_id),
        policyName:   e.policy_name,
        policyType:   e.policy_type,
        caseType:     e.case_type,
        caseRefId:    e.case_ref_id,
        triggerEvent: e.trigger_event,
        actionsTaken: typeof e.actions_taken === 'string' ? JSON.parse(e.actions_taken) : (e.actions_taken ?? []),
        executedAt:   e.created_at,
      })),
    });
  } catch (err: any) {
    logger.error('[Governance] executions fetch error', { error: err.message });
    res.status(500).json({ error: 'executions_fetch_error' });
  }
});

// ─── POST /evaluate — test policy evaluation without side-effects ──────────────

router.post('/evaluate', requireGovernanceAdmin, async (req: Request, res: Response) => {
  try {
    const ctx: CaseContext = req.body?.context ?? {};
    if (!ctx.caseType || !ctx.caseRefId) {
      return res.status(400).json({ error: 'context.caseType and context.caseRefId required' });
    }

    const policyType = req.body?.policyType ?? undefined;
    const result = await evaluatePolicies('evaluate_test', ctx, policyType);

    res.json({
      context:      ctx,
      matchedCount: result.matched.length,
      autoApproved: result.autoApproved,
      requireLevel: result.requireLevel,
      message:      result.message,
      matched: result.matched.map(m => ({
        policyId:   m.policyId,
        policyType: m.policyType,
        name:       m.name,
        actions:    m.actions,
      })),
    });
  } catch (err: any) {
    logger.error('[Governance] evaluate error', { error: err.message });
    res.status(500).json({ error: 'evaluate_error' });
  }
});

export default router;

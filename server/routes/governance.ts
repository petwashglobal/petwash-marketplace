/**
 * server/routes/governance.ts
 * Phase 12.13 — Governance & Automation Layer
 * Phase 12.14 — Trust, Explainability & Safety
 *
 * Existing endpoints:
 *   GET    /api/governance/policies              — list all policies
 *   POST   /api/governance/policies              — create policy (now: versions + deep validation)
 *   GET    /api/governance/policies/:id          — get single policy
 *   PUT    /api/governance/policies/:id          — update policy (now: versions)
 *   DELETE /api/governance/policies/:id          — soft-delete (now: versions)
 *   POST   /api/governance/policies/:id/activate — re-activate (now: versions)
 *   GET    /api/governance/executions            — recent execution log (now: includes why_matched)
 *   POST   /api/governance/evaluate              — test a policy set against a CaseContext
 *
 * New in Phase 12.14:
 *   POST   /api/governance/simulate              — dry-run with per-condition breakdown
 *   GET    /api/governance/trace/:caseType/:caseRefId — full decision chain for a case
 *   GET    /api/governance/policies/:id/versions — version history for a policy
 *   POST   /api/governance/policies/:id/rollback/:versionId — restore a previous version
 *
 * Auth: admin (x-admin-secret / decoded.admin) OR active franchise_owner
 */

import { Router, Request, Response } from 'express';
import { db }     from '../db';
import { sql }    from 'drizzle-orm';
import { logger } from '../lib/logger';
import { auth as firebaseAuth } from '../lib/firebase-admin';
import { evaluatePolicies, loadActivePolicies, explainConditions, CaseContext } from '../lib/policy-engine';

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

const VALID_TYPES  = new Set(['approval_threshold', 'auto_routing', 'escalation_rule', 'playbook']);
const VALID_SCOPES = new Set(['global', 'franchise', 'station']);
const VALID_ACTIONS = new Set([
  'auto_approve', 'require_approval', 'add_note', 'escalate',
  'route_to_role', 'route_to_team',
]);

// ─── Deep Policy Validation ───────────────────────────────────────────────────

interface ValidationIssue {
  severity: 'error' | 'warning';
  message:  string;
}

function deepValidatePolicy(body: any): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Type + name basics
  if (!body.policy_type || !VALID_TYPES.has(body.policy_type))
    issues.push({ severity: 'error', message: `policy_type must be one of: ${[...VALID_TYPES].join(', ')}` });
  if (!body.name || typeof body.name !== 'string' || body.name.trim().length < 3)
    issues.push({ severity: 'error', message: 'name must be a non-empty string (≥3 chars)' });
  if (!Array.isArray(body.actions) || body.actions.length === 0)
    issues.push({ severity: 'error', message: 'actions must be a non-empty array' });
  if (body.scope_type && !VALID_SCOPES.has(body.scope_type))
    issues.push({ severity: 'error', message: `scope_type must be one of: ${[...VALID_SCOPES].join(', ')}` });

  // Stop here if fundamental errors exist
  if (issues.some(i => i.severity === 'error')) return issues;

  const conditions: Record<string, unknown> = body.conditions ?? {};
  const actions: Array<Record<string, unknown>> = body.actions ?? [];
  const conditionKeys = Object.keys(conditions);

  // Check action types
  for (const action of actions) {
    if (!action.type) {
      issues.push({ severity: 'error', message: 'Each action must have a "type" field' });
    } else if (!VALID_ACTIONS.has(String(action.type))) {
      issues.push({ severity: 'warning', message: `Unknown action type "${action.type}" — will execute as no-op` });
    }
  }

  // Dangerous rule: auto_approve with empty conditions (approves every case)
  const hasAutoApprove = actions.some(a => a.type === 'auto_approve');
  if (hasAutoApprove && conditionKeys.length === 0) {
    issues.push({
      severity: 'error',
      message:  'DANGEROUS: auto_approve with no conditions will auto-close ALL matching cases. Add at least one condition (e.g. amount_lt, closure_codes).',
    });
  }

  // Dangerous rule: amount_gte: 0 with auto_approve
  if (hasAutoApprove && conditionKeys.includes('amount_gte') && Number(conditions['amount_gte']) <= 0) {
    issues.push({
      severity: 'error',
      message:  'DANGEROUS: auto_approve with amount_gte:0 approves cases of any value.',
    });
  }

  // Conflicting actions in same policy
  const hasRequireApproval = actions.some(a => a.type === 'require_approval');
  if (hasAutoApprove && hasRequireApproval) {
    issues.push({
      severity: 'error',
      message:  'Conflicting actions: auto_approve and require_approval cannot coexist in the same policy.',
    });
  }

  // Priority warning
  if (body.priority != null && Number(body.priority) < 5) {
    issues.push({
      severity: 'warning',
      message:  `Very high priority (${body.priority}) — this policy will run before nearly all other policies of the same type.`,
    });
  }

  // require_approval level check
  for (const action of actions) {
    if (action.type === 'require_approval') {
      const lvl = Number(action.level);
      if (!lvl || ![1, 2].includes(lvl)) {
        issues.push({ severity: 'error', message: 'require_approval action must have level: 1 or level: 2' });
      }
    }
  }

  return issues;
}

// ─── Version Snapshotter ──────────────────────────────────────────────────────

async function snapshotPolicy(
  policyId: number,
  changeType: string,
  changedBy: string,
  changeNote?: string,
): Promise<void> {
  try {
    await db.execute(sql.raw(`
      INSERT INTO policy_versions (policy_id, version_number, snapshot, change_type, change_note, changed_by)
      SELECT
        id,
        COALESCE((SELECT MAX(version_number) FROM policy_versions WHERE policy_id = ${policyId}), 0) + 1,
        row_to_json(governance_policies.*)::jsonb,
        '${safe(changeType)}',
        ${changeNote ? `'${safe(changeNote)}'` : 'NULL'},
        '${safe(changedBy)}'
      FROM governance_policies WHERE id = ${policyId}
    `));
  } catch (snapErr: any) {
    logger.warn('[Governance] version snapshot failed', { policyId, error: snapErr.message });
  }
}

// ─── Row serialiser ───────────────────────────────────────────────────────────

function serialisePolicy(row: any) {
  return {
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
  };
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

    res.json({ policies: (r.rows as any[]).map(serialisePolicy), total: r.rows.length });
  } catch (err: any) {
    logger.error('[Governance] list policies error', { error: err.message });
    res.status(500).json({ error: 'policies_fetch_error' });
  }
});

// ─── POST /policies ────────────────────────────────────────────────────────────

router.post('/policies', requireGovernanceAdmin, async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};
    const issues = deepValidatePolicy(body);
    const errors = issues.filter(i => i.severity === 'error');
    if (errors.length > 0) {
      return res.status(400).json({ error: errors[0].message, issues });
    }

    const ctx      = (req as any).callerCtx;
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

    await db.execute(sql.raw(`
      INSERT INTO policy_audit_log (policy_id, action, actor_uid, changes)
      VALUES (${newId}, 'created', '${safe(actorUid)}', '${safe(JSON.stringify({ name: body.name, policyType: body.policy_type }))}')
    `));

    // Phase 12.14: snapshot version 1
    await snapshotPolicy(newId, 'created', actorUid);

    const warnings = issues.filter(i => i.severity === 'warning');
    logger.info('[Governance] policy created', { id: newId, type: body.policy_type, name: body.name });
    res.status(201).json({ id: newId, message: 'Policy created', warnings, policy: { id: newId } });
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

    const r = await db.execute(sql.raw(`SELECT * FROM governance_policies WHERE id = ${id} LIMIT 1`));
    if (!r.rows.length) return res.status(404).json({ error: 'not_found' });

    const execs = await db.execute(sql.raw(`
      SELECT case_type, case_ref_id, trigger_event, actions_taken, why_matched, created_at
      FROM policy_executions
      WHERE policy_id = ${id}
      ORDER BY created_at DESC
      LIMIT 20
    `));

    const row = r.rows[0] as any;
    res.json({
      ...serialisePolicy(row),
      recentExecutions: (execs.rows as any[]).map(e => ({
        caseType:     e.case_type,
        caseRefId:    e.case_ref_id,
        triggerEvent: e.trigger_event,
        actionsTaken: typeof e.actions_taken === 'string' ? JSON.parse(e.actions_taken) : (e.actions_taken ?? []),
        whyMatched:   typeof e.why_matched === 'string' ? JSON.parse(e.why_matched) : (e.why_matched ?? []),
        executedAt:   e.created_at,
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

    // Deep validate if conditions or actions are being updated
    if (body.conditions !== undefined || body.actions !== undefined || body.policy_type) {
      // Fetch current policy to merge for validation
      const cur = await db.execute(sql.raw(`SELECT * FROM governance_policies WHERE id = ${id} LIMIT 1`));
      if (!cur.rows.length) return res.status(404).json({ error: 'not_found' });
      const current = cur.rows[0] as any;

      const merged = {
        policy_type: body.policy_type ?? current.policy_type,
        name:        body.name ?? current.name,
        conditions:  body.conditions ?? (typeof current.conditions === 'string' ? JSON.parse(current.conditions) : current.conditions),
        actions:     body.actions ?? (typeof current.actions === 'string' ? JSON.parse(current.actions) : current.actions),
        priority:    body.priority ?? current.priority,
        scope_type:  body.scope_type ?? current.scope_type,
      };

      const issues = deepValidatePolicy(merged);
      const errors = issues.filter(i => i.severity === 'error');
      if (errors.length > 0) {
        return res.status(400).json({ error: errors[0].message, issues });
      }
    }

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

    // Phase 12.14: snapshot after update
    await snapshotPolicy(id, 'updated', actorUid);

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

    // Phase 12.14: snapshot after deactivation
    await snapshotPolicy(id, 'deactivated', actorUid);

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

    // Phase 12.14: snapshot after reactivation
    await snapshotPolicy(id, 'activated', actorUid);

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
        pe.case_type, pe.case_ref_id, pe.trigger_event,
        pe.actions_taken, pe.why_matched, pe.created_at
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
        whyMatched:   typeof e.why_matched === 'string' ? JSON.parse(e.why_matched) : (e.why_matched ?? null),
        executedAt:   e.created_at,
      })),
    });
  } catch (err: any) {
    logger.error('[Governance] executions fetch error', { error: err.message });
    res.status(500).json({ error: 'executions_fetch_error' });
  }
});

// ─── POST /evaluate — test without side-effects ────────────────────────────────

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
        whyMatched: m.whyMatched,
      })),
    });
  } catch (err: any) {
    logger.error('[Governance] evaluate error', { error: err.message });
    res.status(500).json({ error: 'evaluate_error' });
  }
});

// ─── Phase 12.14: POST /simulate ──────────────────────────────────────────────
/**
 * Dry-run simulation with per-policy, per-condition breakdown.
 * Shows ALL policies (matched AND unmatched) with the reason each condition passed/failed.
 * No side-effects — read-only.
 */

router.post('/simulate', requireGovernanceAdmin, async (req: Request, res: Response) => {
  try {
    const ctx: CaseContext = req.body?.context ?? {};
    if (!ctx.caseType || !ctx.caseRefId) {
      return res.status(400).json({ error: 'context.caseType and context.caseRefId required' });
    }
    const policyType = req.body?.policyType ?? undefined;

    // Load all active policies (not filtered yet for matching — we want to show non-matches too)
    const policies = await loadActivePolicies(policyType ?? null, ctx);

    const results = policies.map(policy => {
      const { matched, results: condResults } = explainConditions(policy.conditions, ctx);
      return {
        policyId:   policy.id,
        policyType: policy.policy_type,
        name:       policy.name,
        priority:   policy.priority,
        wouldMatch: matched,
        conditions: condResults,
        actions:    policy.actions,
        verdict:    matched
          ? (policy.actions.some((a: any) => a.type === 'auto_approve') ? 'AUTO_APPROVE' : 'MATCH')
          : 'NO_MATCH',
      };
    });

    const matched     = results.filter(r => r.wouldMatch);
    const notMatched  = results.filter(r => !r.wouldMatch);

    // Compute aggregate outcome
    const autoApprove = matched.some(r => r.verdict === 'AUTO_APPROVE');
    const level2      = matched.some(r =>
      r.actions.some((a: any) => a.type === 'require_approval' && Number(a.level) === 2)
    );
    const level1      = !level2 && matched.some(r =>
      r.actions.some((a: any) => a.type === 'require_approval' && Number(a.level) === 1)
    );

    res.json({
      context:      ctx,
      summary: {
        totalEvaluated: results.length,
        matched:        matched.length,
        notMatched:     notMatched.length,
        outcome:        autoApprove ? 'auto_approve' : level2 ? 'level_2_required' : level1 ? 'level_1_required' : matched.length ? 'actions_queued' : 'no_match',
      },
      matchedPolicies:   matched,
      unmatchedPolicies: notMatched,
    });
  } catch (err: any) {
    logger.error('[Governance] simulate error', { error: err.message });
    res.status(500).json({ error: 'simulate_error' });
  }
});

// ─── Phase 12.14: GET /trace/:caseType/:caseRefId ─────────────────────────────
/**
 * Full decision chain for a case: all policy executions in chronological order,
 * with why_matched breakdown for each.
 */

router.get('/trace/:caseType/:caseRefId', requireGovernanceAdmin, async (req: Request, res: Response) => {
  try {
    const caseType  = safe(req.params.caseType);
    const caseRefId = safe(req.params.caseRefId);

    const r = await db.execute(sql.raw(`
      SELECT
        pe.id, pe.policy_id, gp.name AS policy_name, gp.policy_type, gp.priority,
        pe.trigger_event, pe.actions_taken, pe.why_matched, pe.created_at
      FROM policy_executions pe
      LEFT JOIN governance_policies gp ON gp.id = pe.policy_id
      WHERE pe.case_type = '${caseType}' AND pe.case_ref_id = '${caseRefId}'
      ORDER BY pe.created_at ASC
    `));

    const steps = (r.rows as any[]).map((e, idx) => ({
      step:         idx + 1,
      executionId:  toNum(e.id),
      policyId:     toNum(e.policy_id),
      policyName:   e.policy_name ?? '(policy deleted)',
      policyType:   e.policy_type ?? 'unknown',
      priority:     toNum(e.priority),
      triggerEvent: e.trigger_event,
      actionsTaken: typeof e.actions_taken === 'string' ? JSON.parse(e.actions_taken) : (e.actions_taken ?? []),
      whyMatched:   typeof e.why_matched === 'string' ? JSON.parse(e.why_matched) : (e.why_matched ?? []),
      executedAt:   e.created_at,
    }));

    res.json({
      caseType,
      caseRefId,
      totalSteps: steps.length,
      trace:      steps,
    });
  } catch (err: any) {
    logger.error('[Governance] trace error', { error: err.message });
    res.status(500).json({ error: 'trace_error' });
  }
});

// ─── Phase 12.14: GET /policies/:id/versions ──────────────────────────────────

router.get('/policies/:id/versions', requireGovernanceAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'invalid_id' });

    const r = await db.execute(sql.raw(`
      SELECT id, version_number, change_type, change_note, changed_by, changed_at,
             snapshot
      FROM policy_versions
      WHERE policy_id = ${id}
      ORDER BY version_number DESC
    `));

    res.json({
      policyId: id,
      versions: (r.rows as any[]).map(v => ({
        versionId:     toNum(v.id),
        versionNumber: toNum(v.version_number),
        changeType:    v.change_type,
        changeNote:    v.change_note,
        changedBy:     v.changed_by,
        changedAt:     v.changed_at,
        snapshot:      typeof v.snapshot === 'string' ? JSON.parse(v.snapshot) : (v.snapshot ?? {}),
      })),
    });
  } catch (err: any) {
    logger.error('[Governance] versions fetch error', { error: err.message });
    res.status(500).json({ error: 'versions_fetch_error' });
  }
});

// ─── Phase 12.14: POST /policies/:id/rollback/:versionId ─────────────────────
/**
 * Restore a policy to a previous version snapshot.
 * Writes a new version entry with change_type = 'rolled_back'.
 */

router.post('/policies/:id/rollback/:versionId', requireGovernanceAdmin, async (req: Request, res: Response) => {
  try {
    const id        = parseInt(req.params.id, 10);
    const versionId = parseInt(req.params.versionId, 10);
    if (isNaN(id) || isNaN(versionId)) return res.status(400).json({ error: 'invalid_id' });

    const ctx      = (req as any).callerCtx;
    const actorUid = ctx?.uid ?? 'system';

    // Load the target version snapshot
    const vr = await db.execute(sql.raw(`
      SELECT snapshot, version_number FROM policy_versions
      WHERE id = ${versionId} AND policy_id = ${id}
      LIMIT 1
    `));
    if (!vr.rows.length) return res.status(404).json({ error: 'version_not_found' });

    const snap = vr.rows[0] as any;
    const snapshot: Record<string, unknown> = typeof snap.snapshot === 'string'
      ? JSON.parse(snap.snapshot)
      : snap.snapshot;

    const condStr = safe(JSON.stringify(snapshot.conditions ?? {}));
    const actStr  = safe(JSON.stringify(snapshot.actions   ?? []));
    const ctStr   = safe(JSON.stringify(snapshot.case_types ?? []));

    // Validate the rolled-back state before applying
    const mergedForValidation = {
      policy_type: snapshot.policy_type,
      name:        snapshot.name,
      conditions:  snapshot.conditions ?? {},
      actions:     snapshot.actions ?? [],
      scope_type:  snapshot.scope_type,
    };
    const issues = deepValidatePolicy(mergedForValidation);
    const errors = issues.filter(i => i.severity === 'error');
    if (errors.length > 0) {
      return res.status(400).json({
        error:  'rollback_validation_failed',
        reason: errors[0].message,
        issues,
      });
    }

    // Apply the snapshot
    await db.execute(sql.raw(`
      UPDATE governance_policies SET
        policy_type = '${safe(String(snapshot.policy_type ?? ''))}',
        name        = '${safe(String(snapshot.name ?? ''))}',
        description = ${snapshot.description ? `'${safe(String(snapshot.description))}'` : 'NULL'},
        case_types  = '${ctStr}'::jsonb::text::text[],
        conditions  = '${condStr}'::jsonb,
        actions     = '${actStr}'::jsonb,
        priority    = ${Math.min(Math.max(1, toNum(snapshot.priority ?? 100)), 999)},
        scope_type  = '${safe(String(snapshot.scope_type ?? 'global'))}',
        is_active   = ${Boolean(snapshot.is_active)},
        updated_at  = NOW()
      WHERE id = ${id}
    `));

    await db.execute(sql.raw(`
      INSERT INTO policy_audit_log (policy_id, action, actor_uid, changes)
      VALUES (${id}, 'rolled_back', '${safe(actorUid)}',
        '${safe(JSON.stringify({ fromVersion: snap.version_number }))}')
    `));

    // Snapshot the newly rolled-back state
    await snapshotPolicy(id, 'rolled_back', actorUid, `Rolled back to version ${toNum(snap.version_number)}`);

    logger.info('[Governance] policy rolled back', { id, versionId, toVersion: snap.version_number });
    res.json({ id, message: `Policy rolled back to version ${toNum(snap.version_number)}` });
  } catch (err: any) {
    logger.error('[Governance] rollback error', { error: err.message });
    res.status(500).json({ error: 'rollback_error' });
  }
});

// ─── Phase 12.14: POST /validate ──────────────────────────────────────────────
/**
 * Validate a policy definition without saving it.
 * Returns all errors + warnings.
 */

router.post('/validate', requireGovernanceAdmin, async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};
    const issues = deepValidatePolicy(body);
    const errors   = issues.filter(i => i.severity === 'error');
    const warnings = issues.filter(i => i.severity === 'warning');

    res.json({
      valid:    errors.length === 0,
      errors,
      warnings,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'validate_error' });
  }
});

export default router;

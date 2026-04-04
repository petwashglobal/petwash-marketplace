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
import { db }       from '../db';
import { sql, SQL } from 'drizzle-orm';
import { logger }   from '../lib/logger';
import { auth as firebaseAuth } from '../lib/firebase-admin';
import { evaluatePolicies, loadActivePolicies, explainConditions, CaseContext } from '../lib/policy-engine';
import { timingSafeAdminSecretMatch } from '../middleware/adminAuth';

const router = Router();

// ─── Auth middleware ───────────────────────────────────────────────────────────

async function requireGovernanceAdmin(req: Request, res: Response, next: Function) {
  try {
    if (timingSafeAdminSecretMatch(req)) return next();

    const token = (req.headers.authorization ?? '').replace('Bearer ', '').trim();
    if (!token) return res.status(401).json({ error: 'unauthorized' });

    const decoded = await firebaseAuth.verifyIdToken(token, true);
    if (decoded.admin) return next();

    const r = await db.execute(sql`
      SELECT role FROM user_profiles
      WHERE firebase_uid = ${decoded.uid ?? ''}
        AND is_active = true
      LIMIT 1
    `);
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

  if (!body.policy_type || !VALID_TYPES.has(body.policy_type))
    issues.push({ severity: 'error', message: `policy_type must be one of: ${[...VALID_TYPES].join(', ')}` });
  if (!body.name || typeof body.name !== 'string' || body.name.trim().length < 3)
    issues.push({ severity: 'error', message: 'name must be a non-empty string (≥3 chars)' });
  if (!Array.isArray(body.actions) || body.actions.length === 0)
    issues.push({ severity: 'error', message: 'actions must be a non-empty array' });
  if (body.scope_type && !VALID_SCOPES.has(body.scope_type))
    issues.push({ severity: 'error', message: `scope_type must be one of: ${[...VALID_SCOPES].join(', ')}` });

  if (issues.some(i => i.severity === 'error')) return issues;

  const conditions: Record<string, unknown> = body.conditions ?? {};
  const actions: Array<Record<string, unknown>> = body.actions ?? [];
  const conditionKeys = Object.keys(conditions);

  for (const action of actions) {
    if (!action.type) {
      issues.push({ severity: 'error', message: 'Each action must have a "type" field' });
    } else if (!VALID_ACTIONS.has(String(action.type))) {
      issues.push({ severity: 'warning', message: `Unknown action type "${action.type}" — will execute as no-op` });
    }
  }

  const hasAutoApprove = actions.some(a => a.type === 'auto_approve');
  if (hasAutoApprove && conditionKeys.length === 0) {
    issues.push({
      severity: 'error',
      message:  'DANGEROUS: auto_approve with no conditions will auto-close ALL matching cases. Add at least one condition (e.g. amount_lt, closure_codes).',
    });
  }

  if (hasAutoApprove && conditionKeys.includes('amount_gte') && Number(conditions['amount_gte']) <= 0) {
    issues.push({
      severity: 'error',
      message:  'DANGEROUS: auto_approve with amount_gte:0 approves cases of any value.',
    });
  }

  const hasRequireApproval = actions.some(a => a.type === 'require_approval');
  if (hasAutoApprove && hasRequireApproval) {
    issues.push({
      severity: 'error',
      message:  'Conflicting actions: auto_approve and require_approval cannot coexist in the same policy.',
    });
  }

  if (body.priority != null && Number(body.priority) < 5) {
    issues.push({
      severity: 'warning',
      message:  `Very high priority (${body.priority}) — this policy will run before nearly all other policies of the same type.`,
    });
  }

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
    await db.execute(sql`
      INSERT INTO policy_versions (policy_id, version_number, snapshot, change_type, change_note, changed_by)
      SELECT
        id,
        COALESCE((SELECT MAX(version_number) FROM policy_versions WHERE policy_id = ${policyId}), 0) + 1,
        row_to_json(governance_policies.*)::jsonb,
        ${changeType},
        ${changeNote ?? null},
        ${changedBy}
      FROM governance_policies WHERE id = ${policyId}
    `);
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

    const conditions: SQL[] = [sql`1=1`];
    if (type)            conditions.push(sql`policy_type = ${String(type)}`);
    if (active !== 'false') conditions.push(sql`is_active = true`);

    const r = await db.execute(sql`
      SELECT
        id, policy_type, name, description, case_types, conditions, actions,
        priority, is_active, scope_type, scope_id, created_by, created_at, updated_at
      FROM governance_policies
      WHERE ${sql.join(conditions, sql` AND `)}
      ORDER BY priority ASC, policy_type, id ASC
    `);

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

    const caseTypesJson  = JSON.stringify(Array.isArray(body.case_types) ? body.case_types : []);
    const conditionsJson = JSON.stringify(body.conditions ?? {});
    const actionsJson    = JSON.stringify(body.actions);
    const priority       = Math.min(Math.max(1, toNum(body.priority ?? 100)), 999);
    const scopeType      = VALID_SCOPES.has(body.scope_type) ? body.scope_type : 'global';
    const scopeId        = body.scope_id ? String(body.scope_id) : null;

    const r = await db.execute(sql`
      INSERT INTO governance_policies
        (policy_type, name, description, case_types, conditions, actions, priority, scope_type, scope_id, created_by)
      VALUES (
        ${body.policy_type},
        ${body.name.trim()},
        ${body.description ? String(body.description) : null},
        ${caseTypesJson}::jsonb::text::text[],
        ${conditionsJson}::jsonb,
        ${actionsJson}::jsonb,
        ${priority},
        ${scopeType},
        ${scopeId},
        ${actorUid}
      )
      RETURNING id
    `);

    const newId = toNum((r.rows[0] as any)?.id);

    await db.execute(sql`
      INSERT INTO policy_audit_log (policy_id, action, actor_uid, changes)
      VALUES (${newId}, 'created', ${actorUid}, ${JSON.stringify({ name: body.name, policyType: body.policy_type })})
    `);

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

    const r = await db.execute(sql`SELECT * FROM governance_policies WHERE id = ${id} LIMIT 1`);
    if (!r.rows.length) return res.status(404).json({ error: 'not_found' });

    const execs = await db.execute(sql`
      SELECT case_type, case_ref_id, trigger_event, actions_taken, why_matched, created_at
      FROM policy_executions
      WHERE policy_id = ${id}
      ORDER BY created_at DESC
      LIMIT 20
    `);

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

    if (body.conditions !== undefined || body.actions !== undefined || body.policy_type) {
      const cur = await db.execute(sql`SELECT * FROM governance_policies WHERE id = ${id} LIMIT 1`);
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

    const setParts: SQL[] = [sql`updated_at = NOW()`];

    if (body.name)
      setParts.push(sql`name = ${String(body.name).trim()}`);
    if (body.description !== undefined)
      setParts.push(body.description ? sql`description = ${String(body.description)}` : sql`description = NULL`);
    if (body.case_types)
      setParts.push(sql`case_types = ${JSON.stringify(body.case_types)}::jsonb::text::text[]`);
    if (body.conditions)
      setParts.push(sql`conditions = ${JSON.stringify(body.conditions)}::jsonb`);
    if (body.actions)
      setParts.push(sql`actions = ${JSON.stringify(body.actions)}::jsonb`);
    if (body.priority != null)
      setParts.push(sql`priority = ${Math.min(Math.max(1, toNum(body.priority)), 999)}`);
    if (body.scope_type && VALID_SCOPES.has(body.scope_type))
      setParts.push(sql`scope_type = ${body.scope_type}`);
    if (body.scope_id !== undefined)
      setParts.push(body.scope_id ? sql`scope_id = ${String(body.scope_id)}` : sql`scope_id = NULL`);
    if (body.is_active != null)
      setParts.push(sql`is_active = ${Boolean(body.is_active)}`);

    if (setParts.length === 1) return res.status(400).json({ error: 'no_fields_to_update' });

    const r = await db.execute(sql`
      UPDATE governance_policies SET ${sql.join(setParts, sql`, `)} WHERE id = ${id} RETURNING id
    `);
    if (!r.rows.length) return res.status(404).json({ error: 'not_found' });

    await db.execute(sql`
      INSERT INTO policy_audit_log (policy_id, action, actor_uid, changes)
      VALUES (${id}, 'updated', ${actorUid}, ${JSON.stringify(body)})
    `);

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

    const r = await db.execute(sql`
      UPDATE governance_policies SET is_active = false, updated_at = NOW()
      WHERE id = ${id} RETURNING id
    `);
    if (!r.rows.length) return res.status(404).json({ error: 'not_found' });

    await db.execute(sql`
      INSERT INTO policy_audit_log (policy_id, action, actor_uid)
      VALUES (${id}, 'deactivated', ${actorUid})
    `);

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

    const r = await db.execute(sql`
      UPDATE governance_policies SET is_active = true, updated_at = NOW()
      WHERE id = ${id} RETURNING id
    `);
    if (!r.rows.length) return res.status(404).json({ error: 'not_found' });

    await db.execute(sql`
      INSERT INTO policy_audit_log (policy_id, action, actor_uid)
      VALUES (${id}, 'activated', ${actorUid})
    `);

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

    const filters: SQL[] = [];
    if (case_type)     filters.push(sql`pe.case_type = ${String(case_type)}`);
    if (trigger_event) filters.push(sql`pe.trigger_event = ${String(trigger_event)}`);
    const whereClause = filters.length ? sql`WHERE ${sql.join(filters, sql` AND `)}` : sql``;

    const r = await db.execute(sql`
      SELECT
        pe.id, pe.policy_id, gp.name AS policy_name, gp.policy_type,
        pe.case_type, pe.case_ref_id, pe.trigger_event,
        pe.actions_taken, pe.why_matched, pe.created_at
      FROM policy_executions pe
      LEFT JOIN governance_policies gp ON gp.id = pe.policy_id
      ${whereClause}
      ORDER BY pe.created_at DESC
      LIMIT ${limitN}
    `);

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

router.post('/simulate', requireGovernanceAdmin, async (req: Request, res: Response) => {
  try {
    const ctx: CaseContext = req.body?.context ?? {};
    if (!ctx.caseType || !ctx.caseRefId) {
      return res.status(400).json({ error: 'context.caseType and context.caseRefId required' });
    }
    const policyType = req.body?.policyType ?? undefined;

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

    const matched    = results.filter(r => r.wouldMatch);
    const notMatched = results.filter(r => !r.wouldMatch);

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

router.get('/trace/:caseType/:caseRefId', requireGovernanceAdmin, async (req: Request, res: Response) => {
  try {
    const caseType  = String(req.params.caseType).slice(0, 64);
    const caseRefId = String(req.params.caseRefId).slice(0, 200);

    const r = await db.execute(sql`
      SELECT
        pe.id, pe.policy_id, gp.name AS policy_name, gp.policy_type, gp.priority,
        pe.trigger_event, pe.actions_taken, pe.why_matched, pe.created_at
      FROM policy_executions pe
      LEFT JOIN governance_policies gp ON gp.id = pe.policy_id
      WHERE pe.case_type = ${caseType} AND pe.case_ref_id = ${caseRefId}
      ORDER BY pe.created_at ASC
    `);

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

    const r = await db.execute(sql`
      SELECT id, version_number, change_type, change_note, changed_by, changed_at,
             snapshot
      FROM policy_versions
      WHERE policy_id = ${id}
      ORDER BY version_number DESC
    `);

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

router.post('/policies/:id/rollback/:versionId', requireGovernanceAdmin, async (req: Request, res: Response) => {
  try {
    const id        = parseInt(req.params.id, 10);
    const versionId = parseInt(req.params.versionId, 10);
    if (isNaN(id) || isNaN(versionId)) return res.status(400).json({ error: 'invalid_id' });

    const ctx      = (req as any).callerCtx;
    const actorUid = ctx?.uid ?? 'system';

    const vr = await db.execute(sql`
      SELECT snapshot, version_number FROM policy_versions
      WHERE id = ${versionId} AND policy_id = ${id}
      LIMIT 1
    `);
    if (!vr.rows.length) return res.status(404).json({ error: 'version_not_found' });

    const snap = vr.rows[0] as any;
    const snapshot: Record<string, unknown> = typeof snap.snapshot === 'string'
      ? JSON.parse(snap.snapshot)
      : snap.snapshot;

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

    const setParts: SQL[] = [
      sql`policy_type = ${String(snapshot.policy_type ?? '')}`,
      sql`name        = ${String(snapshot.name ?? '')}`,
      sql`description = ${snapshot.description ? String(snapshot.description) : null}`,
      sql`case_types  = ${JSON.stringify(snapshot.case_types ?? [])}::jsonb::text::text[]`,
      sql`conditions  = ${JSON.stringify(snapshot.conditions ?? {})}::jsonb`,
      sql`actions     = ${JSON.stringify(snapshot.actions ?? [])}::jsonb`,
      sql`priority    = ${Math.min(Math.max(1, toNum(snapshot.priority ?? 100)), 999)}`,
      sql`scope_type  = ${String(snapshot.scope_type ?? 'global')}`,
      sql`is_active   = ${Boolean(snapshot.is_active)}`,
      sql`updated_at  = NOW()`,
    ];

    await db.execute(sql`
      UPDATE governance_policies SET ${sql.join(setParts, sql`, `)}
      WHERE id = ${id}
    `);

    await db.execute(sql`
      INSERT INTO policy_audit_log (policy_id, action, actor_uid, changes)
      VALUES (${id}, 'rolled_back', ${actorUid}, ${JSON.stringify({ fromVersion: snap.version_number })})
    `);

    await snapshotPolicy(id, 'rolled_back', actorUid, `Rolled back to version ${toNum(snap.version_number)}`);

    logger.info('[Governance] policy rolled back', { id, versionId, toVersion: snap.version_number });
    res.json({ id, message: `Policy rolled back to version ${toNum(snap.version_number)}` });
  } catch (err: any) {
    logger.error('[Governance] rollback error', { error: err.message });
    res.status(500).json({ error: 'rollback_error' });
  }
});

// ─── Phase 12.14: POST /validate ──────────────────────────────────────────────

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

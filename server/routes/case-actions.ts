/**
 * server/routes/case-actions.ts
 * Phase 12.9 — Case Queue Action Orchestration
 * Phase 12.11 — Team Workflow & Resolution Discipline
 *
 * Mounted at /api/case-actions
 *
 * GET  /assignments                      — active assignments (scoped by caller)
 * POST /assign                           — assign single case (user OR team, with workload balancing)
 * POST /unassign                         — remove assignment
 * POST /note                             — add internal note
 * GET  /notes/:caseType/:caseRefId       — notes for a case
 * POST /bulk                             — bulk action across selected cases
 * POST /reopen                           — reopen closed dispute (requires reopenCode)
 * POST /closure-request                  — agent requests closure (requires closureReasonCode)
 * POST /closure-approve                  — manager approves pending closure
 * POST /closure-reject                   — manager rejects pending closure
 * GET  /resolution-codes                 — list seeded resolution codes
 * GET  /reopen-codes                     — list seeded reopen codes
 *
 * Assignment rules:
 *   - One active assignment per case at a time (unique partial index)
 *   - Reassigning deactivates previous, inserts new (logged)
 *   - If assignToTeamId supplied, workload-balance across active team members
 *   - If no active team member: assigned_to_uid = NULL, assigned_team_id = team
 *   - Every ownership change is audited in case_assignments history
 *   - Closure approval required for agents on disputes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { auth } from '../lib/firebase-admin';

const router = Router();
const ADMIN_SEC = process.env.ADMIN_SECRET || process.env.PETWASH_ADMIN_SECRET;

type CallerRole = 'admin' | 'franchise_owner' | 'station_operator';

interface CallerContext {
  role: CallerRole;
  uid: string | null;
  franchiseIds: number[];
  stationIds:   number[];
}

const toNum  = (v: unknown): number  => Number(v ?? 0);
const toStr  = (v: unknown): string  => v != null ? String(v) : '';
const toDate = (v: unknown): string | null => v ? (v as Date).toISOString() : null;
const safe   = (s: unknown): string  => String(s ?? '').replace(/'/g, "''");

// ─── Auth middleware ──────────────────────────────────────────────────────────

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.headers['x-admin-secret'] === ADMIN_SEC) {
      (req as any).callerCtx = { role: 'admin', uid: null, franchiseIds: [], stationIds: [] } as CallerContext;
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'authentication_required' });
    }

    const decoded = await auth.verifyIdToken(authHeader.slice(7), true);
    const uid     = decoded.uid;

    if (decoded.admin) {
      (req as any).callerCtx = { role: 'admin', uid, franchiseIds: [], stationIds: [] } as CallerContext;
      return next();
    }

    const foRows = await db.execute(sql`
      SELECT id FROM franchise_owners WHERE owner_user_id = ${uid} AND status = 'active'
    `);
    if (foRows.rows.length) {
      const ids = (foRows.rows as any[]).map(r => toNum(r.id));
      (req as any).callerCtx = { role: 'franchise_owner', uid, franchiseIds: ids, stationIds: [] } as CallerContext;
      return next();
    }

    const opRows = await db.execute(sql`
      SELECT station_id FROM station_operators WHERE user_id = ${uid} AND is_active = true
    `);
    if (opRows.rows.length) {
      const ids = (opRows.rows as any[]).map(r => toNum(r.station_id));
      (req as any).callerCtx = { role: 'station_operator', uid, franchiseIds: [], stationIds: ids } as CallerContext;
      return next();
    }

    return res.status(403).json({ error: 'access_denied' });
  } catch (err: any) {
    logger.error('[CaseActions] auth error', { error: err.message });
    return res.status(401).json({ error: 'authentication_failed' });
  }
}

// ─── Scope filter ─────────────────────────────────────────────────────────────

function stationScope(ctx: CallerContext, stAlias = 'st'): string {
  if (ctx.role === 'admin') return '';
  if (ctx.role === 'franchise_owner' && ctx.franchiseIds.length)
    return `AND ${stAlias}.franchise_id IN (${ctx.franchiseIds.join(',')})`;
  if (ctx.role === 'station_operator' && ctx.stationIds.length)
    return `AND ${stAlias}.id IN (${ctx.stationIds.join(',')})`;
  return 'AND 1=0';
}

// ─── Workload balancing ───────────────────────────────────────────────────────
// Given a teamId, find the active team member with the fewest active case assignments.
// Returns null if no team members exist.

async function pickTeamMember(teamId: number): Promise<string | null> {
  try {
    const r = await db.execute(sql.raw(`
      SELECT
        tm.user_uid,
        COUNT(ca.id)::int AS active_count
      FROM team_members tm
      LEFT JOIN case_assignments ca
        ON ca.assigned_to_uid = tm.user_uid AND ca.is_active = true
      WHERE tm.team_id = ${teamId}
      GROUP BY tm.user_uid
      ORDER BY active_count ASC
      LIMIT 1
    `));
    return (r.rows[0] as any)?.user_uid ?? null;
  } catch (err: any) {
    logger.error('[CaseActions] pickTeamMember error', { error: err.message });
    return null;
  }
}

// ─── Shared assign logic ──────────────────────────────────────────────────────

async function doAssign(
  caseType:       string,
  caseRefId:      string,
  assignToUid:    string | null,
  assignToTeamId: number | null,
  assignByUid:    string | null,
  note:           string | null,
  networkScope:   string | null,
): Promise<void> {
  // Deactivate existing active assignment
  await db.execute(sql.raw(`
    UPDATE case_assignments
    SET is_active = false
    WHERE case_type = '${safe(caseType)}'
      AND case_ref_id = '${safe(caseRefId)}'
      AND is_active = true
  `));

  const teamCol  = assignToTeamId != null ? `${assignToTeamId}` : 'NULL';
  const uidCol   = assignToUid    != null ? `'${safe(assignToUid)}'` : 'NULL';
  const byCol    = assignByUid    != null ? `'${safe(assignByUid)}'` : 'NULL';
  const noteCol  = note           != null ? `'${safe(note)}'` : 'NULL';
  const scopeCol = networkScope   != null ? `'${safe(networkScope)}'` : 'NULL';

  await db.execute(sql.raw(`
    INSERT INTO case_assignments
      (case_type, case_ref_id, assigned_to_uid, assigned_team_id, assigned_by_uid, note, network_scope, is_active)
    VALUES (
      '${safe(caseType)}',
      '${safe(caseRefId)}',
      ${uidCol},
      ${teamCol},
      ${byCol},
      ${noteCol},
      ${scopeCol},
      true
    )
  `));
}

// ─── GET /assignments ─────────────────────────────────────────────────────────

router.get('/assignments', requireAuth, async (req: Request, res: Response) => {
  try {
    const ctx   = (req as any).callerCtx as CallerContext;
    const scope = stationScope(ctx);

    const rows = await db.execute(sql.raw(`
      SELECT
        ca.id,
        ca.case_type,
        ca.case_ref_id,
        ca.assigned_to_uid,
        ca.assigned_team_id,
        ca.assigned_by_uid,
        ca.note,
        ca.network_scope,
        ca.assigned_at,
        t.name AS team_name
      FROM case_assignments ca
      LEFT JOIN teams t ON t.id = ca.assigned_team_id
      WHERE ca.is_active = true
        AND (
          (ca.case_type = 'dispute' AND EXISTS (
            SELECT 1 FROM booking_disputes bd
            JOIN bookings b ON b.id = bd.booking_id
            LEFT JOIN stations st ON st.id = b.station_id
            WHERE bd.id::text = ca.case_ref_id ${scope}
          ))
          OR
          (ca.case_type = 'mismatch' AND EXISTS (
            SELECT 1 FROM station_settlements ss
            LEFT JOIN stations st ON st.id = ss.station_id
            WHERE 'mismatch-' || ss.id::text = ca.case_ref_id ${scope}
          ))
          OR
          (ca.case_type = 'refund' AND EXISTS (
            SELECT 1 FROM bookings b
            LEFT JOIN stations st ON st.id = b.station_id
            WHERE 'refund-' || b.id = ca.case_ref_id ${scope}
          ))
        )
      ORDER BY ca.assigned_at DESC
    `));

    const assignments = (rows.rows as any[]).map(r => ({
      id:              toNum(r.id),
      caseType:        toStr(r.case_type),
      caseRefId:       toStr(r.case_ref_id),
      assignedToUid:   r.assigned_to_uid ? toStr(r.assigned_to_uid) : null,
      assignedTeamId:  r.assigned_team_id ? toNum(r.assigned_team_id) : null,
      teamName:        r.team_name ? toStr(r.team_name) : null,
      assignedByUid:   r.assigned_by_uid ? toStr(r.assigned_by_uid) : null,
      note:            r.note ? toStr(r.note) : null,
      networkScope:    r.network_scope ? toStr(r.network_scope) : null,
      assignedAt:      toDate(r.assigned_at),
    }));

    res.json({ assignments, total: assignments.length });
  } catch (err: any) {
    logger.error('[CaseActions] assignments error', { error: err.message });
    res.status(500).json({ error: 'assignments_error' });
  }
});

// ─── POST /assign ─────────────────────────────────────────────────────────────

router.post('/assign', requireAuth, async (req: Request, res: Response) => {
  try {
    const ctx = (req as any).callerCtx as CallerContext;
    const { caseType, caseRefId, assignToUid, assignToTeamId, note } = req.body ?? {};

    if (!caseType || !caseRefId) {
      return res.status(400).json({ error: 'caseType and caseRefId required' });
    }
    if (!assignToUid && !assignToTeamId) {
      return res.status(400).json({ error: 'assignToUid or assignToTeamId required' });
    }
    if (!['dispute', 'mismatch', 'refund'].includes(caseType)) {
      return res.status(400).json({ error: 'invalid caseType' });
    }

    const callerUid  = ctx.uid;
    const noteText   = note ? String(note).slice(0, 500) : null;

    let finalUid:    string | null = assignToUid ? String(assignToUid) : null;
    let finalTeamId: number | null = assignToTeamId ? Number(assignToTeamId) : null;

    // Workload balancing: if assigning to a team, pick best member
    if (finalTeamId != null && !finalUid) {
      finalUid = await pickTeamMember(finalTeamId);
      // If no member found, leave uid null (stays in team queue)
    }

    await doAssign(caseType, caseRefId, finalUid, finalTeamId, callerUid, noteText, null);
    await touchLastAction(caseType, caseRefId);

    res.json({
      success:        true,
      caseType,
      caseRefId,
      assignedToUid:  finalUid,
      assignedTeamId: finalTeamId,
      assignedBy:     callerUid,
    });
  } catch (err: any) {
    logger.error('[CaseActions] assign error', { error: err.message });
    res.status(500).json({ error: 'assign_error' });
  }
});

// ─── POST /unassign ───────────────────────────────────────────────────────────

router.post('/unassign', requireAuth, async (req: Request, res: Response) => {
  try {
    const { caseType, caseRefId } = req.body ?? {};
    if (!caseType || !caseRefId) {
      return res.status(400).json({ error: 'caseType, caseRefId required' });
    }

    await db.execute(sql.raw(`
      UPDATE case_assignments
      SET is_active = false
      WHERE case_type = '${safe(caseType)}'
        AND case_ref_id = '${safe(caseRefId)}'
        AND is_active = true
    `));
    await touchLastAction(String(caseType), String(caseRefId));

    res.json({ success: true, caseType, caseRefId });
  } catch (err: any) {
    logger.error('[CaseActions] unassign error', { error: err.message });
    res.status(500).json({ error: 'unassign_error' });
  }
});

// ─── POST /note ───────────────────────────────────────────────────────────────

router.post('/note', requireAuth, async (req: Request, res: Response) => {
  try {
    const ctx = (req as any).callerCtx as CallerContext;
    const { caseType, caseRefId, noteText } = req.body ?? {};

    if (!caseType || !caseRefId || !noteText?.trim()) {
      return res.status(400).json({ error: 'caseType, caseRefId, noteText required' });
    }

    const callerUid  = ctx.uid ?? 'admin';
    const callerRole = ctx.role;
    const text       = String(noteText).slice(0, 2000);

    const result = await db.execute(sql.raw(`
      INSERT INTO case_notes (case_type, case_ref_id, author_uid, author_role, note_text)
      VALUES (
        '${safe(caseType)}',
        '${safe(caseRefId)}',
        '${safe(callerUid)}',
        '${safe(callerRole)}',
        '${safe(text)}'
      )
      RETURNING id, created_at
    `));

    const row = result.rows[0] as any;
    await touchLastAction(String(caseType), String(caseRefId));
    res.json({
      success:    true,
      noteId:     toNum(row.id),
      authorUid:  callerUid,
      authorRole: callerRole,
      noteText:   text,
      createdAt:  toDate(row.created_at),
    });
  } catch (err: any) {
    logger.error('[CaseActions] note error', { error: err.message });
    res.status(500).json({ error: 'note_error' });
  }
});

// ─── GET /notes/:caseType/:caseRefId ─────────────────────────────────────────

router.get('/notes/:caseType/:caseRefId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { caseType, caseRefId } = req.params;

    const rows = await db.execute(sql.raw(`
      SELECT id, author_uid, author_role, note_text, created_at
      FROM case_notes
      WHERE case_type   = '${safe(caseType)}'
        AND case_ref_id = '${safe(caseRefId)}'
      ORDER BY created_at ASC
      LIMIT 200
    `));

    const notes = (rows.rows as any[]).map(r => ({
      id:         toNum(r.id),
      authorUid:  toStr(r.author_uid),
      authorRole: r.author_role ? toStr(r.author_role) : null,
      noteText:   toStr(r.note_text),
      createdAt:  toDate(r.created_at),
    }));

    res.json({ notes, total: notes.length });
  } catch (err: any) {
    logger.error('[CaseActions] notes error', { error: err.message });
    res.status(500).json({ error: 'notes_error' });
  }
});

// ─── lastActionAt helper ─────────────────────────────────────────────────────

async function touchLastAction(caseType: string, caseRefId: string): Promise<void> {
  try {
    await db.execute(sql.raw(`
      INSERT INTO case_sla_states (case_type, case_ref_id, last_action_at)
      VALUES ('${safe(caseType)}', '${safe(caseRefId)}', NOW())
      ON CONFLICT (case_type, case_ref_id) DO UPDATE SET last_action_at = NOW()
    `));
  } catch { /* non-fatal */ }
}

// ─── POST /closure-request ────────────────────────────────────────────────────
/**
 * Agent requests closure for a dispute.
 * Requires a resolution code. Does NOT close the case yet.
 * Managers see it as pending approval.
 */

router.post('/closure-request', requireAuth, async (req: Request, res: Response) => {
  try {
    const ctx = (req as any).callerCtx as CallerContext;
    const { bookingId, closureReasonCode, note } = req.body ?? {};

    if (!bookingId || !closureReasonCode) {
      return res.status(400).json({ error: 'bookingId and closureReasonCode required' });
    }

    // Validate resolution code exists
    const codeR = await db.execute(sql.raw(`
      SELECT code FROM resolution_codes WHERE code = '${safe(closureReasonCode)}' LIMIT 1
    `));
    if (!codeR.rows.length) {
      return res.status(400).json({ error: 'invalid_resolution_code' });
    }

    const disputeR = await db.execute(sql`
      SELECT id, status, closure_requested FROM booking_disputes
      WHERE booking_id = ${bookingId} ORDER BY created_at DESC LIMIT 1
    `);
    if (!disputeR.rows.length) return res.status(404).json({ error: 'no_dispute_found' });

    const dispute   = disputeR.rows[0] as any;
    const disputeId = String(dispute.id);

    if (!['open', 'under_review'].includes(String(dispute.status))) {
      return res.status(400).json({ error: 'dispute_not_active', status: dispute.status });
    }
    if (dispute.closure_requested) {
      return res.status(400).json({ error: 'closure_already_requested' });
    }

    await db.execute(sql.raw(`
      UPDATE booking_disputes
      SET closure_requested     = true,
          closure_reason_code   = '${safe(closureReasonCode)}',
          closure_requested_at  = NOW()
      WHERE id::text = '${disputeId}'
    `));

    // Audit note
    const noteText = note ? String(note).slice(0, 1000) : `Closure requested. Reason: ${closureReasonCode}`;
    await db.execute(sql.raw(`
      INSERT INTO case_notes (case_type, case_ref_id, author_uid, author_role, note_text)
      VALUES ('dispute', '${disputeId}',
        '${safe(ctx.uid ?? 'system')}',
        '${safe(ctx.role)}',
        '${safe(`CLOSURE REQUESTED [${closureReasonCode}]: ${noteText}`)}')
    `));

    await touchLastAction('dispute', disputeId);

    res.json({ success: true, disputeId, bookingId, closureReasonCode });
  } catch (err: any) {
    logger.error('[CaseActions] closure-request error', { error: err.message });
    res.status(500).json({ error: 'closure_request_error' });
  }
});

// ─── POST /closure-approve ────────────────────────────────────────────────────
/**
 * Manager (franchise_owner or admin) approves a pending closure request.
 * Sets status = 'closed' and closure_approved = true.
 */

router.post('/closure-approve', requireAuth, async (req: Request, res: Response) => {
  try {
    const ctx = (req as any).callerCtx as CallerContext;
    if (ctx.role === 'station_operator') {
      return res.status(403).json({ error: 'manager_required' });
    }

    const { bookingId, note } = req.body ?? {};
    if (!bookingId) return res.status(400).json({ error: 'bookingId required' });

    const disputeR = await db.execute(sql`
      SELECT id, status, closure_requested, closure_reason_code FROM booking_disputes
      WHERE booking_id = ${bookingId} ORDER BY created_at DESC LIMIT 1
    `);
    if (!disputeR.rows.length) return res.status(404).json({ error: 'no_dispute_found' });

    const dispute   = disputeR.rows[0] as any;
    const disputeId = String(dispute.id);

    if (!dispute.closure_requested) {
      return res.status(400).json({ error: 'closure_not_requested' });
    }
    if (dispute.closure_approved) {
      return res.status(400).json({ error: 'already_approved' });
    }

    await db.execute(sql.raw(`
      UPDATE booking_disputes
      SET status = 'closed',
          closure_approved = true,
          resolved_at      = NOW(),
          resolved_by      = '${safe(ctx.uid ?? 'admin')}'
      WHERE id::text = '${disputeId}'
    `));

    // Escalation log
    await db.execute(sql.raw(`
      INSERT INTO case_escalation_log (case_type, case_ref_id, event_type, from_uid, to_uid, note)
      VALUES ('dispute', '${disputeId}', 'auto_escalated',
        '${safe(ctx.uid ?? 'admin')}', NULL,
        'Closure approved by manager')
    `));

    // Audit note
    const noteText = note ? String(note).slice(0, 500) : 'Closure approved.';
    await db.execute(sql.raw(`
      INSERT INTO case_notes (case_type, case_ref_id, author_uid, author_role, note_text)
      VALUES ('dispute', '${disputeId}',
        '${safe(ctx.uid ?? 'system')}',
        '${safe(ctx.role)}',
        '${safe(`CLOSURE APPROVED: ${noteText}`)}')
    `));

    await touchLastAction('dispute', disputeId);

    res.json({ success: true, disputeId, bookingId, newStatus: 'closed' });
  } catch (err: any) {
    logger.error('[CaseActions] closure-approve error', { error: err.message });
    res.status(500).json({ error: 'closure_approve_error' });
  }
});

// ─── POST /closure-reject ─────────────────────────────────────────────────────
/**
 * Manager rejects a pending closure request.
 * Clears closure_requested. Case stays active.
 */

router.post('/closure-reject', requireAuth, async (req: Request, res: Response) => {
  try {
    const ctx = (req as any).callerCtx as CallerContext;
    if (ctx.role === 'station_operator') {
      return res.status(403).json({ error: 'manager_required' });
    }

    const { bookingId, note } = req.body ?? {};
    if (!bookingId) return res.status(400).json({ error: 'bookingId required' });

    const disputeR = await db.execute(sql`
      SELECT id, status, closure_requested FROM booking_disputes
      WHERE booking_id = ${bookingId} ORDER BY created_at DESC LIMIT 1
    `);
    if (!disputeR.rows.length) return res.status(404).json({ error: 'no_dispute_found' });

    const dispute   = disputeR.rows[0] as any;
    const disputeId = String(dispute.id);

    if (!dispute.closure_requested) {
      return res.status(400).json({ error: 'no_pending_closure' });
    }

    await db.execute(sql.raw(`
      UPDATE booking_disputes
      SET closure_requested   = false,
          closure_reason_code = NULL
      WHERE id::text = '${disputeId}'
    `));

    const noteText = note ? String(note).slice(0, 500) : 'Closure request rejected.';
    await db.execute(sql.raw(`
      INSERT INTO case_notes (case_type, case_ref_id, author_uid, author_role, note_text)
      VALUES ('dispute', '${disputeId}',
        '${safe(ctx.uid ?? 'system')}',
        '${safe(ctx.role)}',
        '${safe(`CLOSURE REJECTED: ${noteText}`)}')
    `));

    await touchLastAction('dispute', disputeId);

    res.json({ success: true, disputeId, bookingId });
  } catch (err: any) {
    logger.error('[CaseActions] closure-reject error', { error: err.message });
    res.status(500).json({ error: 'closure_reject_error' });
  }
});

// ─── GET /resolution-codes ────────────────────────────────────────────────────

router.get('/resolution-codes', requireAuth, async (_req: Request, res: Response) => {
  try {
    const rows = await db.execute(sql.raw(`
      SELECT code, label, applies_to FROM resolution_codes ORDER BY label
    `));
    const codes = (rows.rows as any[]).map(r => ({
      code:      toStr(r.code),
      label:     toStr(r.label),
      appliesTo: r.applies_to ? toStr(r.applies_to) : null,
    }));
    res.json({ codes });
  } catch (err: any) {
    logger.error('[CaseActions] resolution-codes error', { error: err.message });
    res.status(500).json({ error: 'resolution_codes_error' });
  }
});

// ─── GET /reopen-codes ────────────────────────────────────────────────────────

router.get('/reopen-codes', requireAuth, async (_req: Request, res: Response) => {
  try {
    const rows = await db.execute(sql.raw(`
      SELECT code, label FROM reopen_codes ORDER BY label
    `));
    const codes = (rows.rows as any[]).map(r => ({
      code:  toStr(r.code),
      label: toStr(r.label),
    }));
    res.json({ codes });
  } catch (err: any) {
    logger.error('[CaseActions] reopen-codes error', { error: err.message });
    res.status(500).json({ error: 'reopen_codes_error' });
  }
});

// ─── POST /reopen ─────────────────────────────────────────────────────────────

router.post('/reopen', requireAuth, async (req: Request, res: Response) => {
  try {
    const ctx = (req as any).callerCtx as CallerContext;
    const { bookingId, reopenCode, note } = req.body ?? {};

    if (!bookingId || !reopenCode) {
      return res.status(400).json({ error: 'bookingId and reopenCode required' });
    }

    // Validate reopen code
    const codeR = await db.execute(sql.raw(`
      SELECT code FROM reopen_codes WHERE code = '${safe(reopenCode)}' LIMIT 1
    `));
    if (!codeR.rows.length) {
      return res.status(400).json({ error: 'invalid_reopen_code' });
    }

    const disputeR = await db.execute(sql`
      SELECT id, status FROM booking_disputes WHERE booking_id = ${bookingId}
      ORDER BY created_at DESC LIMIT 1
    `);
    if (!disputeR.rows.length) return res.status(404).json({ error: 'no_dispute_found' });

    const dispute    = disputeR.rows[0] as any;
    const disputeId  = String(dispute.id);
    const prevStatus = String(dispute.status);

    if (['open', 'under_review'].includes(prevStatus)) {
      return res.status(400).json({ error: 'dispute_already_active', status: prevStatus });
    }

    // Reopen
    await db.execute(sql.raw(`
      UPDATE booking_disputes
      SET status = 'open',
          resolved_at = NULL,
          resolved_by = NULL,
          closure_requested   = false,
          closure_approved    = false,
          closure_reason_code = NULL
      WHERE id::text = '${disputeId}'
    `));

    // Reset SLA
    await db.execute(sql.raw(`
      INSERT INTO case_sla_states (case_type, case_ref_id, sla_status, breach_detected_at, escalated_at, escalated_to_uid, last_action_at)
      VALUES ('dispute', '${disputeId}', 'within_sla', NULL, NULL, NULL, NOW())
      ON CONFLICT (case_type, case_ref_id) DO UPDATE SET
        sla_status         = 'within_sla',
        breach_detected_at = NULL,
        escalated_at       = NULL,
        escalated_to_uid   = NULL,
        last_action_at     = NOW(),
        checked_at         = NOW()
    `));

    // Reassign to franchise owner
    const foR = await db.execute(sql.raw(`
      SELECT fo.owner_user_id
      FROM franchise_owners fo
      JOIN stations st ON st.franchise_id = fo.id
      JOIN bookings b ON b.station_id = st.id
      WHERE b.id = '${safe(bookingId)}' AND fo.status = 'active'
      LIMIT 1
    `));
    const assignTo = (foR.rows[0] as any)?.owner_user_id ?? null;

    if (assignTo) {
      await doAssign('dispute', disputeId, assignTo, null, ctx.uid, 'Reassigned on reopen', null);
    }

    // Escalation log
    const noteText = note ? String(note).slice(0, 1000) : null;
    await db.execute(sql.raw(`
      INSERT INTO case_escalation_log (case_type, case_ref_id, event_type, from_uid, to_uid, note)
      VALUES (
        'dispute', '${disputeId}', 'reopened',
        ${ctx.uid ? `'${safe(ctx.uid)}'` : 'NULL'},
        ${assignTo ? `'${safe(assignTo)}'` : 'NULL'},
        '${safe(`Reopened [${reopenCode}]${noteText ? ': ' + noteText : ''}`)}'
      )
    `));

    // Internal note
    const fullNote = `REOPENED [${reopenCode}]${noteText ? ': ' + noteText : ''}`;
    await db.execute(sql.raw(`
      INSERT INTO case_notes (case_type, case_ref_id, author_uid, author_role, note_text)
      VALUES ('dispute', '${disputeId}',
        '${safe(ctx.uid ?? 'system')}',
        '${safe(ctx.role)}',
        '${safe(fullNote)}')
    `));

    res.json({
      success:    true,
      disputeId,
      bookingId,
      prevStatus,
      newStatus:  'open',
      reopenCode,
      assignedTo: assignTo,
    });
  } catch (err: any) {
    logger.error('[CaseActions] reopen error', { error: err.message });
    res.status(500).json({ error: 'reopen_error' });
  }
});

// ─── POST /bulk ───────────────────────────────────────────────────────────────

const BULK_ACTIONS = ['assign_to_me', 'unassign', 'mark_under_review', 'close_cases'] as const;
type BulkAction = typeof BULK_ACTIONS[number];

router.post('/bulk', requireAuth, async (req: Request, res: Response) => {
  try {
    const ctx    = (req as any).callerCtx as CallerContext;
    const callerUid = ctx.uid;
    const { action, cases } = req.body ?? {};

    if (!action || !BULK_ACTIONS.includes(action as BulkAction)) {
      return res.status(400).json({ error: 'invalid_action', valid: BULK_ACTIONS });
    }
    if (!Array.isArray(cases) || cases.length === 0) {
      return res.status(400).json({ error: 'cases array required' });
    }
    if (cases.length > 200) {
      return res.status(400).json({ error: 'max 200 cases per bulk action' });
    }

    const results = { succeeded: 0, failed: 0, skipped: 0 };

    for (const c of cases) {
      const { caseType, caseRefId } = c;
      if (!caseType || !caseRefId) { results.skipped++; continue; }

      try {
        if (action === 'assign_to_me' && callerUid) {
          await doAssign(caseType, caseRefId, callerUid, null, callerUid, null, null);
          await touchLastAction(caseType, caseRefId);
          results.succeeded++;
        } else if (action === 'unassign') {
          await db.execute(sql.raw(`
            UPDATE case_assignments SET is_active = false
            WHERE case_type = '${safe(caseType)}' AND case_ref_id = '${safe(caseRefId)}' AND is_active = true
          `));
          await touchLastAction(caseType, caseRefId);
          results.succeeded++;
        } else if (action === 'mark_under_review' && caseType === 'dispute') {
          await db.execute(sql.raw(`
            UPDATE booking_disputes SET status = 'under_review'
            WHERE id::text = '${safe(caseRefId)}' AND status = 'open'
          `));
          await touchLastAction(caseType, caseRefId);
          results.succeeded++;
        } else if (action === 'close_cases' && caseType === 'dispute') {
          // Close only if not closure_approved required — here we respect the flow:
          // If the case has a pending closure request and caller is admin/FO, approve + close.
          // Otherwise, check if caller can close directly (admin/FO).
          if (ctx.role === 'admin' || ctx.role === 'franchise_owner') {
            await db.execute(sql.raw(`
              UPDATE booking_disputes
              SET status = 'closed', resolved_at = NOW(),
                  closure_approved = true,
                  resolved_by = '${safe(callerUid ?? 'admin')}'
              WHERE id::text = '${safe(caseRefId)}' AND status NOT IN ('resolved')
            `));
          } else {
            // Agents: set closure_requested if no code yet, skip if already pending
            await db.execute(sql.raw(`
              UPDATE booking_disputes
              SET closure_requested = true
              WHERE id::text = '${safe(caseRefId)}' AND status NOT IN ('closed','resolved')
                AND closure_requested = false
            `));
          }
          await touchLastAction(caseType, caseRefId);
          results.succeeded++;
        } else {
          results.skipped++;
        }
      } catch {
        results.failed++;
      }
    }

    res.json({ success: true, action, ...results });
  } catch (err: any) {
    logger.error('[CaseActions] bulk error', { error: err.message });
    res.status(500).json({ error: 'bulk_error' });
  }
});

export default router;

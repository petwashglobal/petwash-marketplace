/**
 * server/routes/case-actions.ts
 * Phase 12.9 — Case Queue Action Orchestration
 *
 * Mounted at /api/case-actions
 *
 * GET  /assignments                      — active assignments (scoped by caller)
 * POST /assign                           — assign single case
 * POST /unassign                         — remove assignment
 * POST /note                             — add internal note
 * GET  /notes/:caseType/:caseRefId       — notes for a case
 * POST /bulk                             — bulk action across selected cases
 *
 * Assignment rules:
 *   - One active assignment per case at a time (unique partial index)
 *   - Reassigning deactivates previous, inserts new (logged)
 *   - SLA "owner" in the case-queue becomes the assignee's UID
 *   - Notes are internal only — never sent to customers
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

// ─── Shared assign logic ──────────────────────────────────────────────────────

async function doAssign(
  caseType: string, caseRefId: string,
  assignToUid: string, assignByUid: string | null,
  note: string | null, networkScope: string | null,
): Promise<void> {
  // Deactivate existing active assignment
  await db.execute(sql.raw(`
    UPDATE case_assignments
    SET is_active = false
    WHERE case_type = '${caseType.replace(/'/g, "''")}'
      AND case_ref_id = '${caseRefId.replace(/'/g, "''")}'
      AND is_active = true
  `));

  // Insert new
  await db.execute(sql.raw(`
    INSERT INTO case_assignments
      (case_type, case_ref_id, assigned_to_uid, assigned_by_uid, note, network_scope, is_active)
    VALUES (
      '${caseType.replace(/'/g, "''")}',
      '${caseRefId.replace(/'/g, "''")}',
      '${assignToUid.replace(/'/g, "''")}',
      ${assignByUid ? `'${assignByUid.replace(/'/g, "''")}'` : 'NULL'},
      ${note ? `'${note.replace(/'/g, "''")}'` : 'NULL'},
      ${networkScope ? `'${networkScope.replace(/'/g, "''")}'` : 'NULL'},
      true
    )
  `));
}

// ─── GET /assignments ─────────────────────────────────────────────────────────

router.get('/assignments', requireAuth, async (req: Request, res: Response) => {
  try {
    const ctx   = (req as any).callerCtx as CallerContext;
    const scope = stationScope(ctx);

    // We need to verify the assignment belongs to a case in the caller's scope.
    // For disputes, join through bookings → stations.
    // For mismatches, same path through settlement → station.
    // For refunds, same path through bookings → stations.
    // Simplification: fetch all active assignments, then filter by scope via subquery.

    const rows = await db.execute(sql.raw(`
      SELECT
        ca.id,
        ca.case_type,
        ca.case_ref_id,
        ca.assigned_to_uid,
        ca.assigned_by_uid,
        ca.note,
        ca.network_scope,
        ca.assigned_at
      FROM case_assignments ca
      WHERE ca.is_active = true
        AND (
          -- Dispute scope
          (ca.case_type = 'dispute' AND EXISTS (
            SELECT 1 FROM booking_disputes bd
            JOIN bookings b ON b.id = bd.booking_id
            LEFT JOIN stations st ON st.id = b.station_id
            WHERE bd.id::text = ca.case_ref_id
              ${scope}
          ))
          OR
          -- Mismatch scope (case_ref_id = 'mismatch-{settlement_id}')
          (ca.case_type = 'mismatch' AND EXISTS (
            SELECT 1 FROM station_settlements ss
            LEFT JOIN stations st ON st.id = ss.station_id
            WHERE 'mismatch-' || ss.id::text = ca.case_ref_id
              ${scope}
          ))
          OR
          -- Refund scope (case_ref_id = 'refund-{booking_id}')
          (ca.case_type = 'refund' AND EXISTS (
            SELECT 1 FROM bookings b
            LEFT JOIN stations st ON st.id = b.station_id
            WHERE 'refund-' || b.id = ca.case_ref_id
              ${scope}
          ))
        )
      ORDER BY ca.assigned_at DESC
    `));

    const assignments = (rows.rows as any[]).map(r => ({
      id:            toNum(r.id),
      caseType:      toStr(r.case_type),
      caseRefId:     toStr(r.case_ref_id),
      assignedToUid: toStr(r.assigned_to_uid),
      assignedByUid: r.assigned_by_uid ? toStr(r.assigned_by_uid) : null,
      note:          r.note ? toStr(r.note) : null,
      networkScope:  r.network_scope ? toStr(r.network_scope) : null,
      assignedAt:    toDate(r.assigned_at),
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
    const { caseType, caseRefId, assignToUid, note } = req.body ?? {};

    if (!caseType || !caseRefId || !assignToUid) {
      return res.status(400).json({ error: 'caseType, caseRefId, assignToUid required' });
    }
    if (!['dispute', 'mismatch', 'refund'].includes(caseType)) {
      return res.status(400).json({ error: 'invalid caseType' });
    }

    const callerUid = ctx.uid;
    const noteText  = note ? String(note).slice(0, 500) : null;

    await doAssign(caseType, caseRefId, String(assignToUid), callerUid, noteText, null);
    await touchLastAction(caseType, caseRefId);

    res.json({ success: true, caseType, caseRefId, assignedTo: assignToUid, assignedBy: callerUid });
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
      WHERE case_type = '${String(caseType).replace(/'/g, "''")}'
        AND case_ref_id = '${String(caseRefId).replace(/'/g, "''")}'
        AND is_active = true
    `));

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
        '${String(caseType).replace(/'/g, "''")}',
        '${String(caseRefId).replace(/'/g, "''")}',
        '${callerUid.replace(/'/g, "''")}',
        '${callerRole.replace(/'/g, "''")}',
        '${text.replace(/'/g, "''")}'
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
      WHERE case_type  = '${String(caseType).replace(/'/g, "''")}'
        AND case_ref_id = '${String(caseRefId).replace(/'/g, "''")}'
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
// Upsert case_sla_states.last_action_at whenever any action touches a case.
// This resets the "dead ownership" clock used by the SLA monitor.

async function touchLastAction(caseType: string, caseRefId: string): Promise<void> {
  try {
    await db.execute(sql.raw(`
      INSERT INTO case_sla_states (case_type, case_ref_id, last_action_at)
      VALUES ('${String(caseType).replace(/'/g, "''")}', '${String(caseRefId).replace(/'/g, "''")}', NOW())
      ON CONFLICT (case_type, case_ref_id) DO UPDATE SET last_action_at = NOW()
    `));
  } catch { /* non-fatal */ }
}

// ─── POST /reopen ─────────────────────────────────────────────────────────────

/**
 * Reopen a closed/resolved dispute.
 *
 * POST /api/case-actions/reopen
 * body: { bookingId: string, note?: string }
 *
 * Effects:
 *  - Sets booking_disputes.status = 'open' (reopen = back to open queue)
 *  - Resets SLA state: within_sla, breach_detected_at = NULL, escalated_at = NULL
 *  - Assigns to franchise owner (or previous owner if still active)
 *  - Logs 'reopened' in case_escalation_log + case_notes
 */
router.post('/reopen', requireAuth, async (req: Request, res: Response) => {
  try {
    const ctx = (req as any).callerCtx as CallerContext;
    const { bookingId, note } = req.body ?? {};

    if (!bookingId) {
      return res.status(400).json({ error: 'bookingId required' });
    }

    // Find the dispute for this booking
    const disputeR = await db.execute(sql`
      SELECT id, status FROM booking_disputes WHERE booking_id = ${bookingId}
      ORDER BY created_at DESC LIMIT 1
    `);
    if (!disputeR.rows.length) {
      return res.status(404).json({ error: 'no_dispute_found' });
    }
    const dispute = disputeR.rows[0] as any;
    const disputeId = String(dispute.id);
    const prevStatus = String(dispute.status);

    if (['open', 'under_review'].includes(prevStatus)) {
      return res.status(400).json({ error: 'dispute_already_active', status: prevStatus });
    }

    // Reopen: set back to open
    await db.execute(sql.raw(`
      UPDATE booking_disputes SET status = 'open', resolved_at = NULL, resolved_by = NULL
      WHERE id::text = '${disputeId}'
    `));

    // Reset SLA state
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

    // Find franchise owner to assign
    const foR = await db.execute(sql.raw(`
      SELECT fo.owner_user_id
      FROM franchise_owners fo
      JOIN stations st ON st.franchise_id = fo.id
      JOIN bookings b ON b.station_id = st.id
      WHERE b.id = '${String(bookingId).replace(/'/g, "''")}'
        AND fo.status = 'active'
      LIMIT 1
    `));
    const assignTo = (foR.rows[0] as any)?.owner_user_id ?? null;

    if (assignTo) {
      // Deactivate current assignment
      await db.execute(sql.raw(`
        UPDATE case_assignments SET is_active = false
        WHERE case_type = 'dispute' AND case_ref_id = '${disputeId}' AND is_active = true
      `));
      // Assign to franchise owner
      await db.execute(sql.raw(`
        INSERT INTO case_assignments (case_type, case_ref_id, assigned_to_uid, assigned_by_uid, note, is_active)
        VALUES ('dispute', '${disputeId}', '${String(assignTo).replace(/'/g, "''")}',
          ${ctx.uid ? `'${String(ctx.uid).replace(/'/g, "''")}'` : 'NULL'},
          'Reassigned on reopen', true)
      `));
    }

    // Escalation log
    const noteText = note ? String(note).slice(0, 1000) : null;
    await db.execute(sql.raw(`
      INSERT INTO case_escalation_log (case_type, case_ref_id, event_type, from_uid, to_uid, note)
      VALUES (
        'dispute', '${disputeId}', 'reopened',
        ${ctx.uid ? `'${String(ctx.uid).replace(/'/g, "''")}'` : 'NULL'},
        ${assignTo ? `'${String(assignTo).replace(/'/g, "''")}'` : 'NULL'},
        ${noteText ? `'${noteText.replace(/'/g, "''")}'` : "'Dispute reopened'"}
      )
    `));

    // Internal note
    if (noteText) {
      await db.execute(sql.raw(`
        INSERT INTO case_notes (case_type, case_ref_id, author_uid, author_role, note_text)
        VALUES ('dispute', '${disputeId}',
          '${String(ctx.uid ?? 'system').replace(/'/g, "''")}',
          '${String(ctx.role).replace(/'/g, "''")}',
          'REOPENED: ${noteText.replace(/'/g, "''")}')
      `));
    }

    res.json({
      success:    true,
      disputeId,
      bookingId,
      prevStatus,
      newStatus:  'open',
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

/**
 * POST /api/case-actions/bulk
 *
 * body: {
 *   action: BulkAction,
 *   cases: { caseType: string, caseRefId: string, bookingId?: string }[]
 * }
 *
 * assign_to_me      → assigns every case to the caller
 * unassign          → removes assignment from every case
 * mark_under_review → disputes only: open → under_review
 * close_cases       → disputes only: → closed
 */
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
      const { caseType, caseRefId, bookingId } = c;
      if (!caseType || !caseRefId) { results.skipped++; continue; }

      try {
        if (action === 'assign_to_me' && callerUid) {
          await doAssign(caseType, caseRefId, callerUid, callerUid, null, null);
          results.succeeded++;
        } else if (action === 'unassign') {
          await db.execute(sql.raw(`
            UPDATE case_assignments SET is_active = false
            WHERE case_type = '${String(caseType).replace(/'/g, "''")}' AND case_ref_id = '${String(caseRefId).replace(/'/g, "''")}' AND is_active = true
          `));
          results.succeeded++;
        } else if (action === 'mark_under_review' && caseType === 'dispute') {
          // Update booking_disputes — case_ref_id IS the dispute UUID for disputes
          await db.execute(sql.raw(`
            UPDATE booking_disputes SET status = 'under_review'
            WHERE id::text = '${String(caseRefId).replace(/'/g, "''")}' AND status = 'open'
          `));
          results.succeeded++;
        } else if (action === 'close_cases' && caseType === 'dispute') {
          await db.execute(sql.raw(`
            UPDATE booking_disputes SET status = 'closed', resolved_at = NOW()
            WHERE id::text = '${String(caseRefId).replace(/'/g, "''")}' AND status NOT IN ('resolved')
          `));
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

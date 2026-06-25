/**
 * Admin BAY CONTROL Routes — K9000 bay operational admin panel.
 * Mounted at /api/admin/bay-control (under the /api/admin/ middleware stack).
 *
 *   GET   /api/admin/bay-control                  — list bays (optional ?stationId=)
 *   PATCH /api/admin/bay-control/:bayId/status    — admin-flag a bay maintenance|offline|ready
 *   POST  /api/admin/bay-control/:bayId/fault     — open a fault on a bay
 *   POST  /api/admin/bay-control/:bayId/clear-fault — clear a fault (→ maintenance)
 *   PATCH /api/admin/bay-control/:bayId/nayax     — link/unlink Nayax terminal + QR reader IDs
 *
 * ──────────────────────────────────────────────────────────────────────────
 * IMPORTANT — THIS IS AN ADMIN DB-STATE PANEL, NOT A HARDWARE CONTROLLER.
 *
 * Every mutation here writes ONLY the station_bays row (status / terminal IDs /
 * fault metadata). It does NOT send any physical command to the K9000 / Nayax
 * controller and is intentionally decoupled from MachineCommandService (which
 * owns the real START_PUMP/STOP_PUMP/EXTEND_TIME hardware lifecycle).
 *
 * Setting status='maintenance' / 'offline' / 'ready' here is an OPERATIONAL
 * ADMIN FLAG — it marks the bay's intended availability for staff/booking
 * purposes. It does not power-cycle, drain, or otherwise touch the machine.
 * The physical machine state and this flag are reconciled elsewhere.
 *
 * SAFETY: this panel NEVER sets a bay to 'busy' or 'cleanup' — those are
 * session-driven states owned by the wash session lifecycle. And it refuses to
 * change status while a wash is in progress (status='busy' → 409).
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Every mutation is audit-logged. requireAdmin guards the whole router.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { stationBays } from '../../shared/schema';
import { and, eq, asc } from 'drizzle-orm';
import { isSuperAdmin } from '../middleware/rbac';
import { logAuditEvent } from '../middleware/auditLog';
import { logger } from '../lib/logger';

const router = Router();

function requireAdmin(req: any, res: any, next: any) {
  const email = (req.firebaseUser?.email || '').toLowerCase();
  if (!isSuperAdmin(email)) {
    return res.status(403).json({ error: 'Full admin access required' });
  }
  next();
}
router.use(requireAdmin);

function actor(req: Request) {
  const fb = (req as any).firebaseUser || {};
  return {
    adminId: fb.uid || fb.email || 'unknown_admin',
    adminEmail: fb.email as string | undefined,
    ip: req.ip || (req.headers['x-forwarded-for'] as string)?.split(',')[0],
    userAgent: req.headers['user-agent'],
  };
}

// Only these statuses may ever be set by an admin from this panel.
// 'busy' and 'cleanup' are session-driven and intentionally NOT allowed.
// 'fault' is set via the dedicated /fault endpoint only.
const ADMIN_SETTABLE_STATUS = ['maintenance', 'offline', 'ready'] as const;

// ── GET /api/admin/bay-control?stationId= ───────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined;
  try {
    const rows = await db
      .select({
        id: stationBays.id,
        stationId: stationBays.stationId,
        stationCode: stationBays.stationCode,
        side: stationBays.side,
        bayLabel: stationBays.bayLabel,
        bayLabelHe: stationBays.bayLabelHe,
        status: stationBays.status,
        nayaxTerminalId: stationBays.nayaxTerminalId,
        nayaxQrReaderId: stationBays.nayaxQrReaderId,
        lastFaultCode: stationBays.lastFaultCode,
        lastFaultAt: stationBays.lastFaultAt,
        lastHeartbeat: stationBays.lastHeartbeat,
        currentSessionId: stationBays.currentSessionId,
      })
      .from(stationBays)
      .where(stationId ? eq(stationBays.stationId, stationId) : undefined)
      .orderBy(asc(stationBays.stationCode), asc(stationBays.side))
      .limit(500);

    return res.json({ ok: true, bays: rows });
  } catch (err: any) {
    logger.error('[AdminBayControl] list failed', { err: err?.message });
    return res.status(500).json({ error: 'bay_list_failed' });
  }
});

// Helper: load a bay by id or send 404.
async function loadBay(bayId: string) {
  const [bay] = await db
    .select()
    .from(stationBays)
    .where(eq(stationBays.id, bayId))
    .limit(1);
  return bay;
}

// ── PATCH /api/admin/bay-control/:bayId/status ──────────────────────────────
// Admin OPERATIONAL FLAG only (maintenance|offline|ready). No hardware command.
const statusSchema = z.object({
  status: z.enum(ADMIN_SETTABLE_STATUS),
  reason: z.string().min(1).max(2000),
});
router.patch('/:bayId/status', async (req: Request, res: Response) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  const { status, reason } = parsed.data;
  const { bayId } = req.params;
  const { adminId, adminEmail, ip, userAgent } = actor(req);

  try {
    const bay = await loadBay(bayId);
    if (!bay) return res.status(404).json({ error: 'bay_not_found' });

    // SAFETY: a wash is in progress — refuse to flip the operational flag.
    if (bay.status === 'busy') {
      return res.status(409).json({ error: 'bay_busy', message: 'Wash in progress — cannot change status' });
    }
    // SAFETY: never override the session-driven cleanup window from here.
    if (bay.status === 'cleanup') {
      return res.status(409).json({ error: 'bay_cleanup', message: 'Bay in post-wash cleanup — cannot change status' });
    }

    const [updated] = await db
      .update(stationBays)
      .set({ status, updatedAt: new Date() })
      .where(eq(stationBays.id, bayId))
      .returning({ id: stationBays.id, status: stationBays.status });

    await logAuditEvent({
      actorUserId: adminId,
      actorRole: 'admin',
      actionType: 'ADMIN_BAY_SET_STATUS',
      targetType: 'station_bay',
      targetId: bayId,
      ip, userAgent,
      metadata: {
        stationCode: bay.stationCode,
        side: bay.side,
        fromStatus: bay.status,
        toStatus: status,
        reason,
        adminEmail,
        note: 'operational_admin_flag_not_hardware_command',
      },
      severity: 'info',
    });

    return res.json({ ok: true, id: updated.id, status: updated.status });
  } catch (err: any) {
    logger.error('[AdminBayControl] set status failed', { bayId, err: err?.message });
    return res.status(500).json({ error: 'bay_status_write_failed' });
  }
});

// ── POST /api/admin/bay-control/:bayId/fault ────────────────────────────────
// Open a fault: records fault metadata + flags status='fault'. No hardware call.
const faultSchema = z.object({
  faultCode: z.string().min(1).max(100),
  note: z.string().max(2000).optional(),
});
router.post('/:bayId/fault', async (req: Request, res: Response) => {
  const parsed = faultSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  const { faultCode, note } = parsed.data;
  const { bayId } = req.params;
  const { adminId, adminEmail, ip, userAgent } = actor(req);

  try {
    const bay = await loadBay(bayId);
    if (!bay) return res.status(404).json({ error: 'bay_not_found' });

    // SAFETY: don't stomp a live wash; ops should let it finish or stop it
    // through the proper session path before flagging a fault here.
    if (bay.status === 'busy') {
      return res.status(409).json({ error: 'bay_busy', message: 'Wash in progress — cannot open fault' });
    }

    const now = new Date();
    const [updated] = await db
      .update(stationBays)
      .set({ status: 'fault', lastFaultCode: faultCode, lastFaultAt: now, updatedAt: now })
      .where(eq(stationBays.id, bayId))
      .returning({ id: stationBays.id });

    await logAuditEvent({
      actorUserId: adminId,
      actorRole: 'admin',
      actionType: 'ADMIN_BAY_OPEN_FAULT',
      targetType: 'station_bay',
      targetId: bayId,
      ip, userAgent,
      metadata: {
        stationCode: bay.stationCode,
        side: bay.side,
        fromStatus: bay.status,
        faultCode,
        note: note ?? null,
        adminEmail,
      },
      severity: 'warning',
    });

    return res.json({ ok: true, id: updated.id, status: 'fault', faultCode });
  } catch (err: any) {
    logger.error('[AdminBayControl] open fault failed', { bayId, err: err?.message });
    return res.status(500).json({ error: 'bay_fault_write_failed' });
  }
});

// ── POST /api/admin/bay-control/:bayId/clear-fault ──────────────────────────
// Clear a fault → set status='maintenance' (admin then re-enables to 'ready').
const clearFaultSchema = z.object({
  reason: z.string().min(1).max(2000),
});
router.post('/:bayId/clear-fault', async (req: Request, res: Response) => {
  const parsed = clearFaultSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  const { reason } = parsed.data;
  const { bayId } = req.params;
  const { adminId, adminEmail, ip, userAgent } = actor(req);

  try {
    const bay = await loadBay(bayId);
    if (!bay) return res.status(404).json({ error: 'bay_not_found' });

    if (bay.status !== 'fault') {
      return res.status(409).json({ error: 'bay_not_in_fault', message: 'Bay is not in a fault state' });
    }

    const now = new Date();
    const [updated] = await db
      .update(stationBays)
      // Land in maintenance (not ready) so an admin must deliberately re-enable.
      .set({ status: 'maintenance', lastFaultCode: null, updatedAt: now })
      .where(eq(stationBays.id, bayId))
      .returning({ id: stationBays.id });

    await logAuditEvent({
      actorUserId: adminId,
      actorRole: 'admin',
      actionType: 'ADMIN_BAY_CLEAR_FAULT',
      targetType: 'station_bay',
      targetId: bayId,
      ip, userAgent,
      metadata: {
        stationCode: bay.stationCode,
        side: bay.side,
        clearedFaultCode: bay.lastFaultCode,
        toStatus: 'maintenance',
        reason,
        adminEmail,
      },
      severity: 'info',
    });

    return res.json({ ok: true, id: updated.id, status: 'maintenance' });
  } catch (err: any) {
    logger.error('[AdminBayControl] clear fault failed', { bayId, err: err?.message });
    return res.status(500).json({ error: 'bay_clear_fault_failed' });
  }
});

// ── PATCH /api/admin/bay-control/:bayId/nayax ───────────────────────────────
// Link/unlink the Nayax terminal + QR reader IDs for this bay. Empty string
// is treated as an explicit unlink (→ null). Pure DB-config edit.
const nayaxSchema = z
  .object({
    nayaxTerminalId: z.string().max(255).nullable().optional(),
    nayaxQrReaderId: z.string().max(255).nullable().optional(),
  })
  .refine((d) => d.nayaxTerminalId !== undefined || d.nayaxQrReaderId !== undefined, {
    message: 'At least one of nayaxTerminalId / nayaxQrReaderId is required',
  });
router.patch('/:bayId/nayax', async (req: Request, res: Response) => {
  const parsed = nayaxSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  const { bayId } = req.params;
  const { adminId, adminEmail, ip, userAgent } = actor(req);

  // Normalise: "" → null (unlink); undefined → leave untouched.
  const norm = (v: string | null | undefined) =>
    v === undefined ? undefined : v === '' ? null : v.trim();
  const nextTerminal = norm(parsed.data.nayaxTerminalId);
  const nextQr = norm(parsed.data.nayaxQrReaderId);

  try {
    const bay = await loadBay(bayId);
    if (!bay) return res.status(404).json({ error: 'bay_not_found' });

    const set: Record<string, any> = { updatedAt: new Date() };
    if (nextTerminal !== undefined) set.nayaxTerminalId = nextTerminal;
    if (nextQr !== undefined) set.nayaxQrReaderId = nextQr;

    const [updated] = await db
      .update(stationBays)
      .set(set)
      .where(eq(stationBays.id, bayId))
      .returning({
        id: stationBays.id,
        nayaxTerminalId: stationBays.nayaxTerminalId,
        nayaxQrReaderId: stationBays.nayaxQrReaderId,
      });

    await logAuditEvent({
      actorUserId: adminId,
      actorRole: 'admin',
      actionType: 'ADMIN_BAY_LINK_NAYAX',
      targetType: 'station_bay',
      targetId: bayId,
      ip, userAgent,
      metadata: {
        stationCode: bay.stationCode,
        side: bay.side,
        before: { nayaxTerminalId: bay.nayaxTerminalId, nayaxQrReaderId: bay.nayaxQrReaderId },
        after: { nayaxTerminalId: updated.nayaxTerminalId, nayaxQrReaderId: updated.nayaxQrReaderId },
        adminEmail,
      },
      severity: 'info',
    });

    return res.json({ ok: true, id: updated.id, nayaxTerminalId: updated.nayaxTerminalId, nayaxQrReaderId: updated.nayaxQrReaderId });
  } catch (err: any) {
    logger.error('[AdminBayControl] link nayax failed', { bayId, err: err?.message });
    return res.status(500).json({ error: 'bay_nayax_write_failed' });
  }
});

// ── GET /api/admin/bay-control/reconciliation-breaks?status=open ─────────────
// Triage queue for the daily K9000 reconciliation (k9000_reconciliation_breaks,
// written by K9000ReconciliationService). Read-only.
router.get('/reconciliation-breaks', async (req: Request, res: Response) => {
  const status = typeof req.query.status === 'string' ? req.query.status : 'open';
  try {
    const { pool } = await import('../db');
    const rows = await pool.query(
      `SELECT id, recon_date, break_type, severity, station_id, bay_id, nayax_ref,
              petwash_session_id, sumit_doc_id, expected_json, observed_json,
              status, resolved_by, resolved_at, created_at
         FROM k9000_reconciliation_breaks
        WHERE ($1 = 'all' OR status = $1)
        ORDER BY (severity = 'critical') DESC, created_at DESC
        LIMIT 500`,
      [status],
    );
    return res.json({ ok: true, count: rows.rowCount, breaks: rows.rows });
  } catch (err: any) {
    logger.error('[AdminBayControl] list recon breaks failed', { err: err?.message });
    return res.status(500).json({ error: 'recon_breaks_read_failed' });
  }
});

// ── POST /api/admin/bay-control/reconciliation-breaks/:id/resolve ────────────
// Close a break (resolved | accepted). Audit-logged.
router.post('/reconciliation-breaks/:id/resolve', async (req: Request, res: Response) => {
  const id = req.params.id;
  const parsed = z.object({ status: z.enum(['resolved', 'accepted']), note: z.string().max(1000).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'status must be resolved|accepted' });
  const a = actor(req);
  try {
    const { pool } = await import('../db');
    const r = await pool.query(
      `UPDATE k9000_reconciliation_breaks
          SET status = $1, resolved_by = $2, resolved_at = NOW()
        WHERE id = $3 AND status = 'open'
        RETURNING id, break_type, severity`,
      [parsed.data.status, a.adminEmail || a.adminId, id],
    );
    if ((r.rowCount ?? 0) === 0) return res.status(404).json({ error: 'break_not_found_or_already_closed' });
    await logAuditEvent({
      actorUserId: a.adminId,
      actorRole: 'admin',
      actionType: 'K9000_RECON_BREAK_RESOLVE',
      targetType: 'k9000_reconciliation_break',
      targetId: id,
      ip: a.ip, userAgent: a.userAgent,
      metadata: { status: parsed.data.status, note: parsed.data.note, breakType: r.rows[0].break_type, severity: r.rows[0].severity, adminEmail: a.adminEmail },
      severity: 'info',
    }).catch(() => {});
    return res.json({ ok: true, id, status: parsed.data.status });
  } catch (err: any) {
    logger.error('[AdminBayControl] resolve recon break failed', { id, err: err?.message });
    return res.status(500).json({ error: 'recon_break_resolve_failed' });
  }
});

export default router;

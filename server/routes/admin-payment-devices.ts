/**
 * Admin payment-device stock management.
 *
 * CRUD + assignment history for physical Nayax VPOS Touch credit-card
 * readers. ADMIN INFRASTRUCTURE only — does NOT touch:
 *   - Nayax payment runtime (NayaxOnlinePaymentService, webhooks)
 *   - K9000 polling or machine commands
 *   - wallet credits or payment sessions
 *
 * Mounted at /api/admin/payment-devices, which inherits the full
 * /api/admin/ security stack from server/routes.ts:
 *   - adminLimiter (rate limit)
 *   - requireRole(...ADMIN_ROLES_ARRAY)
 *   - requireStaffApproved
 *   - requireMfaEnrolled
 *
 * Serial numbers are PRIVATE. They are never exposed to customers and
 * never logged in plaintext. List responses include serial in the JSON
 * because the caller is an authenticated admin — but the operator must
 * never copy these into a customer-facing surface.
 *
 * Assignment history is APPEND-ONLY at the DB level (trigger in
 * migration 0031 blocks UPDATE/DELETE). The PATCH /assign route always
 * INSERTs a new assignment row — never mutates an existing one.
 */
import { Router, type Request, type Response } from 'express';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { paymentDevices, paymentDeviceAssignments } from '@shared/schema';
import { logger } from '../lib/logger';

const router = Router();

// ── Validation schemas ──────────────────────────────────────────────────────
const STATUS_VALUES = [
  'in_stock',
  'installed',
  'active',
  'inactive',
  'faulty',
  'returned',
] as const;
const EVENT_TYPES = [
  'assigned',
  'reassigned',
  'unassigned',
  'marked_faulty',
  'activated',
  'deactivated',
  'returned',
] as const;

const CreateDeviceSchema = z.object({
  provider: z.string().min(1).max(40).default('nayax'),
  model: z.string().min(1).max(80),
  serialNumber: z.string().min(1).max(64).trim(),
  partNumber: z.string().max(64).optional().nullable(),
  nayaxTerminalId: z.string().max(64).optional().nullable(),
  simIccid: z.string().max(64).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

const UpdateDeviceSchema = z.object({
  model: z.string().min(1).max(80).optional(),
  serialNumber: z.string().min(1).max(64).trim().optional(),
  partNumber: z.string().max(64).nullable().optional(),
  nayaxTerminalId: z.string().max(64).nullable().optional(),
  simIccid: z.string().max(64).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

const AssignDeviceSchema = z.object({
  machineId: z.string().max(64).nullable(),
  locationId: z.string().max(64).nullable(),
  // Status to set on the device row alongside the new history entry.
  newStatus: z.enum(STATUS_VALUES),
  // Event-type that describes the operator's intent.
  eventType: z.enum(EVENT_TYPES),
  note: z.string().max(500).optional().nullable(),
});

// Pull the admin uid from the inherited auth chain. Never null inside
// /api/admin/* — adminLimiter + requireRole + requireMfaEnrolled all
// run upstream.
function adminUid(req: Request): string {
  const u = (req as any).user ?? (req as any).firebaseUser;
  return typeof u?.uid === 'string' && u.uid.length > 0 ? u.uid : 'unknown-admin';
}

// ── Routes ──────────────────────────────────────────────────────────────────

// GET /api/admin/payment-devices
// List all devices. Filters: ?status=... ?provider=...
router.get('/', async (req: Request, res: Response) => {
  try {
    const rows = await db
      .select()
      .from(paymentDevices)
      .orderBy(desc(paymentDevices.createdAt));
    const { status, provider } = req.query;
    const filtered = rows.filter((r) => {
      if (typeof status === 'string' && r.status !== status) return false;
      if (typeof provider === 'string' && r.provider !== provider) return false;
      return true;
    });
    return res.json({ ok: true, devices: filtered, count: filtered.length });
  } catch (err) {
    logger.error('[admin-payment-devices] list failed', { err });
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

// GET /api/admin/payment-devices/:id
router.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ ok: false, error: 'invalid_id' });
  }
  const [row] = await db.select().from(paymentDevices).where(eq(paymentDevices.id, id)).limit(1);
  if (!row) return res.status(404).json({ ok: false, error: 'not_found' });
  return res.json({ ok: true, device: row });
});

// GET /api/admin/payment-devices/:id/history
// Append-only assignment / status-change history for one device.
router.get('/:id/history', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ ok: false, error: 'invalid_id' });
  }
  const events = await db
    .select()
    .from(paymentDeviceAssignments)
    .where(eq(paymentDeviceAssignments.deviceId, id))
    .orderBy(desc(paymentDeviceAssignments.performedAt));
  return res.json({ ok: true, deviceId: id, events, count: events.length });
});

// POST /api/admin/payment-devices
// Add a new device to stock. Operator manually verifies the serial
// against the physical device label before posting.
router.post('/', async (req: Request, res: Response) => {
  const parsed = CreateDeviceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'invalid_body', details: parsed.error.flatten() });
  }
  try {
    const [created] = await db
      .insert(paymentDevices)
      .values({
        provider: parsed.data.provider,
        model: parsed.data.model,
        serialNumber: parsed.data.serialNumber,
        partNumber: parsed.data.partNumber ?? null,
        nayaxTerminalId: parsed.data.nayaxTerminalId ?? null,
        simIccid: parsed.data.simIccid ?? null,
        notes: parsed.data.notes ?? null,
        status: 'in_stock',
      })
      .returning();

    // First history row marks "registered in stock". Auditors can read
    // the device's whole life cycle from this table alone.
    await db.insert(paymentDeviceAssignments).values({
      deviceId: created.id,
      machineId: null,
      locationId: null,
      statusAtEvent: created.status,
      eventType: 'unassigned',
      performedBy: adminUid(req),
      note: 'Device registered in stock',
    });

    logger.info('[admin-payment-devices] device added', {
      id: created.id, provider: created.provider, serialLast4: created.serialNumber.slice(-4),
    });
    return res.status(201).json({ ok: true, device: created });
  } catch (err: any) {
    // Postgres unique violation on (provider, serial_number)
    if (err?.code === '23505') {
      return res.status(409).json({ ok: false, error: 'duplicate_serial' });
    }
    logger.error('[admin-payment-devices] create failed', { err });
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

// PATCH /api/admin/payment-devices/:id
// Edit non-assignment fields (notes, terminal id, sim, model, serial).
// Status + machine/location changes go through /assign instead — that
// path writes the append-only history.
router.patch('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ ok: false, error: 'invalid_id' });
  }
  const parsed = UpdateDeviceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'invalid_body', details: parsed.error.flatten() });
  }

  const [existing] = await db.select().from(paymentDevices).where(eq(paymentDevices.id, id)).limit(1);
  if (!existing) return res.status(404).json({ ok: false, error: 'not_found' });

  try {
    const [updated] = await db
      .update(paymentDevices)
      .set({
        ...(parsed.data.model !== undefined ? { model: parsed.data.model } : {}),
        ...(parsed.data.serialNumber !== undefined ? { serialNumber: parsed.data.serialNumber } : {}),
        ...(parsed.data.partNumber !== undefined ? { partNumber: parsed.data.partNumber } : {}),
        ...(parsed.data.nayaxTerminalId !== undefined ? { nayaxTerminalId: parsed.data.nayaxTerminalId } : {}),
        ...(parsed.data.simIccid !== undefined ? { simIccid: parsed.data.simIccid } : {}),
        ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
        updatedAt: new Date(),
      })
      .where(eq(paymentDevices.id, id))
      .returning();
    return res.json({ ok: true, device: updated });
  } catch (err: any) {
    if (err?.code === '23505') {
      return res.status(409).json({ ok: false, error: 'duplicate_serial' });
    }
    logger.error('[admin-payment-devices] update failed', { id, err });
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

// POST /api/admin/payment-devices/:id/assign
// Assign / reassign / unassign / activate / mark-faulty / return.
// Always INSERTs an append-only history row + updates the device's
// status + current assignment fields.
router.post('/:id/assign', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ ok: false, error: 'invalid_id' });
  }
  const parsed = AssignDeviceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'invalid_body', details: parsed.error.flatten() });
  }

  const [existing] = await db.select().from(paymentDevices).where(eq(paymentDevices.id, id)).limit(1);
  if (!existing) return res.status(404).json({ ok: false, error: 'not_found' });

  const { machineId, locationId, newStatus, eventType, note } = parsed.data;

  try {
    // 1. Append-only history row FIRST (so even if the device update
    //    fails, the intent is recorded).
    await db.insert(paymentDeviceAssignments).values({
      deviceId: id,
      machineId,
      locationId,
      statusAtEvent: newStatus,
      eventType,
      performedBy: adminUid(req),
      note: note ?? null,
    });

    // 2. Update the device's current pointer + status. installationDate
    //    set on first 'assigned' or 'installed' transition; subsequent
    //    reassigns keep the original installation date.
    const setInstallationDate =
      (newStatus === 'installed' || newStatus === 'active') &&
      existing.installationDate === null;

    const [updated] = await db
      .update(paymentDevices)
      .set({
        assignedMachineId: machineId,
        assignedLocationId: locationId,
        status: newStatus,
        updatedAt: new Date(),
        ...(setInstallationDate ? { installationDate: new Date() } : {}),
      })
      .where(eq(paymentDevices.id, id))
      .returning();

    logger.info('[admin-payment-devices] assignment recorded', {
      id, eventType, newStatus, machineId, locationId,
    });
    return res.json({ ok: true, device: updated });
  } catch (err) {
    logger.error('[admin-payment-devices] assign failed', { id, err });
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

export default router;

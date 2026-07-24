/**
 * HR / staff roster — admin CRUD (CEO 2026-07-24). Greenfield module backed by
 * the `staff` table (migration 0102). Super-admin only. Real records; no fakes.
 *
 *   GET    /api/admin/staff                 list (+ summary counts)
 *   POST   /api/admin/staff                 create
 *   PATCH  /api/admin/staff/:id             update (partial)
 *   DELETE /api/admin/staff/:id             soft delete (status = 'inactive')
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { requireSuperAdmin } from '../middleware/gates';
import { logger } from '../lib/logger';

const router = Router();

const ROLES = ['attendant', 'technician', 'manager', 'support', 'ops', 'other'] as const;
const EMPLOYMENT = ['full_time', 'part_time', 'contractor'] as const;
const PAY = ['hourly', 'monthly'] as const;
const STATUS = ['active', 'on_leave', 'inactive'] as const;

const upsertSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  role: z.enum(ROLES).default('attendant'),
  stationCode: z.string().trim().max(40).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email().max(254).optional().nullable().or(z.literal('')),
  employment: z.enum(EMPLOYMENT).default('part_time'),
  payType: z.enum(PAY).default('hourly'),
  payRateIls: z.number().int().min(0).max(100_000).default(0),
  status: z.enum(STATUS).default('active'),
  hiredAt: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal('')),
  notes: z.string().trim().max(2000).optional().nullable(),
});

router.get('/', requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = (await db.execute(sql`
      SELECT id, full_name, role, station_code, phone, email, employment,
             pay_type, pay_rate_ils, status, hired_at, notes
      FROM staff
      ORDER BY (status = 'active') DESC, full_name ASC
    `)).rows;
    const [sum] = (await db.execute(sql`
      SELECT COUNT(*) FILTER (WHERE status = 'active')::int   AS active,
             COUNT(*) FILTER (WHERE status = 'on_leave')::int AS on_leave,
             COUNT(*)::int                                    AS total
      FROM staff
    `)).rows as any[];
    return res.json({ ok: true, staff: rows, summary: { active: Number(sum?.active ?? 0), onLeave: Number(sum?.on_leave ?? 0), total: Number(sum?.total ?? 0) } });
  } catch (err: any) {
    logger.error('[Staff] list failed', { err: err?.message });
    return res.status(500).json({ ok: false, error: 'list_failed' });
  }
});

router.post('/', requireSuperAdmin, async (req: Request, res: Response) => {
  const p = upsertSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ ok: false, error: 'invalid', details: p.error.flatten() });
  const d = p.data;
  try {
    const [row] = (await db.execute(sql`
      INSERT INTO staff (full_name, role, station_code, phone, email, employment, pay_type, pay_rate_ils, status, hired_at, notes)
      VALUES (${d.fullName}, ${d.role}, ${d.stationCode || null}, ${d.phone || null}, ${d.email || null},
              ${d.employment}, ${d.payType}, ${d.payRateIls}, ${d.status}, ${d.hiredAt || null}, ${d.notes || null})
      RETURNING id
    `)).rows as any[];
    return res.json({ ok: true, id: row?.id });
  } catch (err: any) {
    logger.error('[Staff] create failed', { err: err?.message });
    return res.status(500).json({ ok: false, error: 'create_failed' });
  }
});

router.patch('/:id', requireSuperAdmin, async (req: Request, res: Response) => {
  const p = upsertSchema.partial().safeParse(req.body);
  if (!p.success) return res.status(400).json({ ok: false, error: 'invalid', details: p.error.flatten() });
  const d = p.data;
  // Build a COALESCE-style update so only provided fields change.
  try {
    const [row] = (await db.execute(sql`
      UPDATE staff SET
        full_name    = COALESCE(${d.fullName ?? null}, full_name),
        role         = COALESCE(${d.role ?? null}, role),
        station_code = COALESCE(${d.stationCode ?? null}, station_code),
        phone        = COALESCE(${d.phone ?? null}, phone),
        email        = COALESCE(${d.email ?? null}, email),
        employment   = COALESCE(${d.employment ?? null}, employment),
        pay_type     = COALESCE(${d.payType ?? null}, pay_type),
        pay_rate_ils = COALESCE(${d.payRateIls ?? null}, pay_rate_ils),
        status       = COALESCE(${d.status ?? null}, status),
        hired_at     = COALESCE(${d.hiredAt || null}, hired_at),
        notes        = COALESCE(${d.notes ?? null}, notes),
        updated_at   = NOW()
      WHERE id = ${req.params.id}
      RETURNING id
    `)).rows as any[];
    if (!row) return res.status(404).json({ ok: false, error: 'not_found' });
    return res.json({ ok: true });
  } catch (err: any) {
    logger.error('[Staff] update failed', { err: err?.message });
    return res.status(500).json({ ok: false, error: 'update_failed' });
  }
});

router.delete('/:id', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    await db.execute(sql`UPDATE staff SET status = 'inactive', updated_at = NOW() WHERE id = ${req.params.id}`);
    return res.json({ ok: true });
  } catch (err: any) {
    logger.error('[Staff] delete failed', { err: err?.message });
    return res.status(500).json({ ok: false, error: 'delete_failed' });
  }
});

export default router;

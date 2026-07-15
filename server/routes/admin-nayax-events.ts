/**
 * Admin Nayax / K9000 Events — Tower Control reconciliation surface.
 * Route mount: /api/admin/nayax-events (validateFirebaseToken + adminLimiter +
 * requireAdmin at the mount in routes.ts — same chain as /api/admin/live-ops).
 *
 * The token-FREE rail over `nayax_transaction_events` (webhook-ingested and/or
 * manually imported Nayax Core report rows). The token-gated pull rail lives
 * in admin-lynx.ts and stays dark until LYNX_USER_TOKEN lands.
 *
 *   GET  /            → filtered event list (station/bay labels resolved)
 *   GET  /summary     → month × machine × channel totals — the CPA MONTHLY
 *                       settlement view (bay money is booked into SUMIT once a
 *                       month per the 2026-07-12 CPA decision; deliberately NO
 *                       per-row SUMIT document column here)
 *   POST /import      → manual Nayax Core report import (JSON rows parsed
 *                       client-side from CSV). RECORD-ONLY: idempotent on
 *                       external_transaction_id, never awards loyalty points,
 *                       never touches wallets. Audit-logged.
 */
import { Router, type Request, type Response } from 'express';
import { sql, and, eq, gte, lte, desc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { nayaxTransactionEvents } from '@shared/schema';
import { NAYAX_TERMINALS, terminalForMachine } from '../services/nayaxTerminals';
import { mapImportRow } from '../services/nayaxEventImport';
import { logAuditEvent } from '../middleware/auditLog';
import { logger } from '../lib/logger';

const router = Router();

const MAX_PAGE_SIZE = 200;
const MAX_IMPORT_ROWS = 2000;

// ── GET / — filtered event list ──────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const q = z.object({
      machineId: z.string().max(32).optional(),
      channel: z.string().max(32).optional(),
      status: z.string().max(32).optional(),
      from: z.string().datetime({ offset: true }).optional().or(z.string().date().optional()),
      to: z.string().datetime({ offset: true }).optional().or(z.string().date().optional()),
      limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(50),
      offset: z.coerce.number().int().min(0).default(0),
    }).parse(req.query);

    const where = and(
      q.machineId ? eq(nayaxTransactionEvents.machineId, q.machineId) : undefined,
      q.channel ? eq(nayaxTransactionEvents.paymentChannel, q.channel) : undefined,
      q.status ? eq(nayaxTransactionEvents.approvalStatus, q.status) : undefined,
      q.from ? gte(nayaxTransactionEvents.transactionTime, new Date(q.from)) : undefined,
      q.to ? lte(nayaxTransactionEvents.transactionTime, new Date(q.to)) : undefined,
    );

    const [rows, [{ total }]] = await Promise.all([
      db.select().from(nayaxTransactionEvents).where(where)
        .orderBy(desc(nayaxTransactionEvents.transactionTime))
        .limit(q.limit).offset(q.offset),
      db.select({ total: sql<number>`count(*)::int` }).from(nayaxTransactionEvents).where(where),
    ]);

    res.json({
      total,
      events: rows.map((e) => {
        const t = terminalForMachine(e.machineId);
        return {
          id: e.id,
          externalTransactionId: e.externalTransactionId,
          machineId: e.machineId,
          terminalId: e.terminalId,
          stationId: e.stationId || t?.stationId || null,
          stationNameHe: t?.stationNameHe || null,
          bay: t?.bay || null,
          bayNameHe: t?.bayNameHe || null,
          paymentChannel: e.paymentChannel,
          eventType: e.eventType,
          approvalStatus: e.approvalStatus,
          amountGross: e.amountGross,
          currency: e.currency,
          transactionTime: e.transactionTime,
          processingStatus: e.processingStatus,
          loyaltyAwarded: e.loyaltyAwarded,
          loyaltyPointsAwarded: e.loyaltyPointsAwarded,
          refundReversed: e.refundReversed,
          linkedMember: !!e.linkedPetwashUserId,
        };
      }),
      terminals: Object.values(NAYAX_TERMINALS),
    });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid query', issues: err.issues });
    logger.error('[AdminNayaxEvents] list failed', { err: String(err) });
    res.status(500).json({ error: 'Failed to load events' });
  }
});

// ── GET /summary — CPA monthly settlement view ───────────────────────────────
router.get('/summary', async (_req: Request, res: Response) => {
  try {
    const rows = await db.select({
      month: sql<string>`to_char(date_trunc('month', ${nayaxTransactionEvents.transactionTime}), 'YYYY-MM')`,
      machineId: nayaxTransactionEvents.machineId,
      paymentChannel: nayaxTransactionEvents.paymentChannel,
      currency: nayaxTransactionEvents.currency,
      txCount: sql<number>`count(*)::int`,
      grossTotal: sql<string>`sum(${nayaxTransactionEvents.amountGross})::text`,
    }).from(nayaxTransactionEvents)
      .where(eq(nayaxTransactionEvents.approvalStatus, 'approved'))
      .groupBy(
        sql`date_trunc('month', ${nayaxTransactionEvents.transactionTime})`,
        nayaxTransactionEvents.machineId,
        nayaxTransactionEvents.paymentChannel,
        nayaxTransactionEvents.currency,
      )
      .orderBy(sql`date_trunc('month', ${nayaxTransactionEvents.transactionTime}) desc`);

    res.json({
      months: rows.map((r) => {
        const t = terminalForMachine(r.machineId);
        return { ...r, stationNameHe: t?.stationNameHe || null, bay: t?.bay || null, bayNameHe: t?.bayNameHe || null };
      }),
      note: 'Bay revenue is booked into SUMIT MONTHLY per the CPA settlement decision (2026-07-12) — no per-transaction tax documents.',
    });
  } catch (err) {
    logger.error('[AdminNayaxEvents] summary failed', { err: String(err) });
    res.status(500).json({ error: 'Failed to load summary' });
  }
});

// ── POST /import — manual Nayax Core report import (record-only) ─────────────
router.post('/import', async (req: Request, res: Response) => {
  try {
    const body = z.object({
      rows: z.array(z.record(z.string(), z.unknown())).min(1).max(MAX_IMPORT_ROWS),
    }).parse(req.body);

    const importedBy =
      (req as any).firebaseUser?.email || (req as any).firebaseUser?.uid || 'admin';

    let inserted = 0;
    let duplicates = 0;
    const skipped: Array<{ index: number; reason: string }> = [];
    const warnings: Array<{ index: number; warnings: string[] }> = [];

    for (let i = 0; i < body.rows.length; i++) {
      const mapped = mapImportRow(body.rows[i], importedBy);
      if (!mapped.ok) {
        skipped.push({ index: i, reason: mapped.reason });
        continue;
      }
      if (mapped.warnings.length) warnings.push({ index: i, warnings: mapped.warnings });

      // Idempotent on external_transaction_id: re-uploading the same report is
      // safe. RECORD-ONLY — loyaltyAwarded=false, no wallet writes anywhere.
      const result = await db.insert(nayaxTransactionEvents)
        .values(mapped.event)
        .onConflictDoNothing({ target: nayaxTransactionEvents.externalTransactionId })
        .returning({ id: nayaxTransactionEvents.id });
      if (result.length > 0) inserted++;
      else duplicates++;
    }

    await logAuditEvent({
      actorUserId: importedBy,
      actorRole: 'admin',
      actionType: 'nayax_events_manual_import',
      targetType: 'nayax_transaction_events',
      targetId: 'batch',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { rows: body.rows.length, inserted, duplicates, skippedCount: skipped.length },
    });

    logger.info('[AdminNayaxEvents] manual import', { importedBy, inserted, duplicates, skipped: skipped.length });
    res.json({ inserted, duplicates, skipped, warnings });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid import payload', issues: err.issues });
    logger.error('[AdminNayaxEvents] import failed', { err: String(err) });
    res.status(500).json({ error: 'Import failed' });
  }
});

export default router;

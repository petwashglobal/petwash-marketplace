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
 *   GET  /summary     → month × machine × channel totals.
 *                       CORRECTED 2026-09-06: this was documented as the CPA
 *                       MONTHLY settlement view on the assumption that bay money
 *                       is booked into SUMIT once a month (2026-07-12 decision).
 *                       That is no longer true of the Jun–Sep 2026 history — 481
 *                       per-transaction tax documents were issued on 05/09/2026.
 *                       The note on the response says so rather than asserting
 *                       the stale rule to whoever reads this screen.
 *   GET  /analytics   → station / city / bay / month roll-up over the canonical
 *                       k9000_wash_events log, ILS and non-ILS kept apart
 *   POST /import      → manual Nayax Core report import (JSON rows parsed
 *                       client-side from CSV). RECORD-ONLY: idempotent on
 *                       external_transaction_id, never awards loyalty points,
 *                       never touches wallets. Audit-logged.
 */
import { Router, type Request, type Response } from 'express';
import { sql, and, eq, gte, lte, desc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { nayaxTransactionEvents, k9000WashEvents } from '@shared/schema';
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
      note:
        'Jun–Sep 2026 history: 481 PER-TRANSACTION SUMIT tax documents were issued on ' +
        '05/09/2026 (#10002 onward), so the 2026-07-12 CPA monthly-settlement decision no ' +
        'longer describes this period. Each document carries the 05/09/2026 ISSUE date with ' +
        'the true service date printed on its face — the income therefore declares in the ' +
        'September VAT period, not the month it was earned. Totals below are ILS only; ' +
        'non-ILS rows are excluded and reported separately.',
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

// ── GET /analytics — station / city / bay / month roll-up ────────────────────
//
// Reads `k9000_wash_events`, which the schema declares to be "the ONLY unified
// K9000 usage log for analytics" — so this surface and loyalty/fraud read the
// same rows rather than a private copy.
//
// TWO RULES THIS ENDPOINT ENFORCES, both learned the hard way:
//
//  1. CURRENCY IS NEVER MIXED. Nayax's own report footer sums a stray AUD row
//     into the shekel total, which is where the phantom "2026-06 ₪10" line in
//     every earlier preview came from. `totals` is ILS-only; anything else is
//     returned under `nonIls` and is never added in.
//  2. ONLY SETTLED MONEY COUNTS. status='completed' only — declined/failed
//     authorisations carry a settlement value in the raw export but no money
//     ever moved.
router.get('/analytics', async (_req: Request, res: Response) => {
  try {
    const rows = await db.select({
      stationId: k9000WashEvents.stationId,
      terminalId: k9000WashEvents.nayaxTerminalId,
      baySide: k9000WashEvents.baySide,
      currency: k9000WashEvents.currency,
      month: sql<string>`to_char(date_trunc('month', ${k9000WashEvents.createdAt}), 'YYYY-MM')`,
      washes: sql<number>`count(*)::int`,
      grossAgorot: sql<number>`coalesce(sum(${k9000WashEvents.amountCents}), 0)::int`,
      withTaxDoc: sql<number>`count(${k9000WashEvents.sumitDocumentId})::int`,
    })
      .from(k9000WashEvents)
      .where(and(
        eq(k9000WashEvents.transactionSource, 'nayax'),
        eq(k9000WashEvents.status, 'completed'),
      ))
      .groupBy(
        k9000WashEvents.stationId, k9000WashEvents.nayaxTerminalId,
        k9000WashEvents.baySide, k9000WashEvents.currency,
        sql`date_trunc('month', ${k9000WashEvents.createdAt})`,
      );

    const ils = rows.filter((r) => r.currency === 'ILS');
    const nonIls = rows.filter((r) => r.currency !== 'ILS');

    const label = (terminalId: string | null) => {
      const t = terminalForMachine(terminalId);
      // An unregistered machine is surfaced as such — never silently blanked.
      return t
        ? { stationNameHe: t.stationNameHe, bayNameHe: t.bayNameHe, registered: true }
        : { stationNameHe: null, bayNameHe: null, registered: false };
    };

    const roll = (keyOf: (r: typeof ils[number]) => string) => {
      const m = new Map<string, { key: string; washes: number; grossAgorot: number; withTaxDoc: number }>();
      for (const r of ils) {
        const k = keyOf(r);
        const cur = m.get(k) ?? { key: k, washes: 0, grossAgorot: 0, withTaxDoc: 0 };
        cur.washes += r.washes; cur.grossAgorot += r.grossAgorot; cur.withTaxDoc += r.withTaxDoc;
        m.set(k, cur);
      }
      return [...m.values()].sort((a, b) => b.grossAgorot - a.grossAgorot);
    };

    const totalAgorot = ils.reduce((a, r) => a + r.grossAgorot, 0);

    res.json({
      currency: 'ILS',
      totals: {
        washes: ils.reduce((a, r) => a + r.washes, 0),
        grossAgorot: totalAgorot,
        grossIls: totalAgorot / 100,
        withTaxDocument: ils.reduce((a, r) => a + r.withTaxDoc, 0),
      },
      // Grouped by the REGISTRY's station identity (resolved from the machine id),
      // not by the raw station_id column. Rows written by different importers have
      // used different station keys for the same physical station; nayaxTerminals.ts
      // is the one declared mapping, so reading through it keeps this surface from
      // splitting one station into two. Normalising the column itself is follow-up.
      byStation: roll((r) => terminalForMachine(r.terminalId)?.stationId ?? 'unregistered'),
      byMonth: roll((r) => r.month).sort((a, b) => a.key.localeCompare(b.key)),
      byBay: ils.map((r) => ({
        stationId: r.stationId, terminalId: r.terminalId, baySide: r.baySide,
        month: r.month, washes: r.washes, grossIls: r.grossAgorot / 100,
        withTaxDocument: r.withTaxDoc, ...label(r.terminalId),
      })),
      // Reported, never summed into the shekel figures above.
      nonIls: nonIls.map((r) => ({
        currency: r.currency, terminalId: r.terminalId, month: r.month,
        washes: r.washes, gross: r.grossAgorot / 100, ...label(r.terminalId),
      })),
    });
  } catch (err) {
    logger.error('[AdminNayaxEvents] analytics failed', { err: String(err) });
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});

export default router;

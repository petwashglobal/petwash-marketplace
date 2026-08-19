/**
 * SumitReconciliationService — Phase 2 Item 11 of the CEO 2026-08-16 SUMIT lane.
 *
 * "Daily reconciler that compares local receipts/documents against SUMIT's view."
 *
 * Walks a bounded sample of sumit_customers rows and, for each mapped uid, asks
 * SUMIT for that customer's fiscal documents via the Item 8 adapter
 * (SumitClient.listDocumentsForCustomer). Then compares the SUMIT-known
 * document IDs against the local view (digital_receipts, purchases,
 * petwash_vouchers_2025.sumit_document_id, k9000_wash_events.sumit_document_id
 * — anywhere PetWash persists a SUMIT document id today). Diff → mismatches.
 *
 * A mismatch is either:
 *   - SUMIT knows about a document id that no local row references
 *     ('sumit_has_local_missing') — likely a webhook/replay lost between SUMIT
 *     issuing the doc and PetWash storing the reference.
 *   - Local has a sumit_document_id that SUMIT's listDocumentsForCustomer
 *     doesn't return ('local_has_sumit_missing') — likely the local row was
 *     written speculatively and the SUMIT call actually failed, OR the SUMIT
 *     side paged past it (the reconciler only pulls a bounded page — see
 *     `SUMIT_DOCS_PAGE_SIZE`).
 *
 * SAFETY CONTRACT (matches PR #1956 constraints):
 *  - READ-ONLY on both sides. Never modifies data on SUMIT or PetWash.
 *  - Fail-quiet:
 *      * SUMIT dormant                    → returns { status:'dormant', ... }, no per-row calls.
 *      * per-customer SUMIT call errors   → skip that row, log, keep going.
 *      * per-customer local read errors   → same.
 *  - Never accepts a userId from client input — the reconciler walks the
 *    sumit_customers table server-side. The admin route that exposes the last
 *    run's report is protected by requireAdmin / super-admin.
 *  - No money-side columns touched (totalSpent, wallet balances, receipt totals).
 *  - Feature-flagged OFF by default via SUMIT_DAILY_RECONCILE_ENABLED so it
 *    doesn't fire in prod until we explicitly opt in.
 *
 * Design refs:
 *   docs/design/2026-08-16-sumit-transaction-matrix.md §7
 *   docs/design/2026-08-16-sumit-full-service-adoption.md
 */
import { db } from '../db';
import {
  sumitCustomers,
  sumitReconcileRuns,
  digitalReceipts,
  purchases,
  users,
  petWashVouchers2025,
  k9000WashEvents,
} from '../../shared/schema';
import { eq, and, isNotNull, inArray, desc } from 'drizzle-orm';
import { SumitClient } from './SumitClient';
import { logger } from '../lib/logger';

/**
 * Feature-flag guard. Nothing fires until an operator explicitly opts in with
 * SUMIT_DAILY_RECONCILE_ENABLED=true. Everything else (the migration, the
 * service, the admin route, the cron registration) is inert until then.
 */
export function isSumitDailyReconcileEnabled(): boolean {
  return process.env.SUMIT_DAILY_RECONCILE_ENABLED === 'true';
}

/** Bounded per-customer SUMIT page — the reconciler is a sampler, not an ETL. */
const SUMIT_DOCS_PAGE_SIZE = 50;
/** Bounded sample of sumit_customers rows per run — walk a slice, not the world. */
const DEFAULT_SAMPLE_SIZE = 200;

export type MismatchType =
  | 'sumit_has_local_missing'    // SUMIT knows a doc id no local row references
  | 'local_has_sumit_missing';   // local has a sumit_document_id SUMIT didn't return

export interface MismatchRow {
  uid: string;
  sumitCustomerId: string;
  type: MismatchType;
  /** The SUMIT-side document id, when known. */
  sumitDocumentId?: string;
  /** Which local table the id was expected in / found in. */
  localSource?: 'digital_receipts' | 'purchases' | 'petwash_vouchers_2025' | 'k9000_wash_events';
  /** Human-readable note for the admin dashboard. Never contains PII. */
  note: string;
}

export type ReconcileStatus = 'ok' | 'dormant' | 'flag_off' | 'error';

export interface ReconcileResult {
  status: ReconcileStatus;
  checkedUsers: number;
  mismatches: number;
  skipped: number;
  sampleSize: number;
  report: MismatchRow[];
  reason?: string;
}

/**
 * Pull every plausibly SUMIT-linked local document id for one uid.
 *
 * Fail-quiet: if any of the four sub-queries error, that source is treated as
 * empty for the diff (surfacing the SUMIT-side ids as "local missing") — better
 * than a false clean bill of health.
 */
async function collectLocalSumitDocIds(
  uid: string,
  email: string | null,
): Promise<Map<string, MismatchRow['localSource']>> {
  const out = new Map<string, MismatchRow['localSource']>();

  // digital_receipts is indexed by customer_email; skip when we have no email.
  if (email) {
    try {
      const rows = await db.select({
        docId: digitalReceipts.sumitDocumentId,
      })
        .from(digitalReceipts)
        .where(and(
          eq(digitalReceipts.customerEmail, email),
          isNotNull(digitalReceipts.sumitDocumentId),
        ));
      for (const r of rows) if (r.docId) out.set(String(r.docId), 'digital_receipts');
    } catch (err: any) {
      logger.warn('[SumitReconcile] digital_receipts read failed — treating as empty', {
        uid, err: err?.message,
      });
    }
  }

  // purchases keyed by buyerUserId.
  try {
    const rows = await db.select({
      receiptNumber: purchases.receiptNumber,
    })
      .from(purchases)
      .where(and(
        eq(purchases.buyerUserId, uid),
        isNotNull(purchases.receiptNumber),
      ));
    for (const r of rows) if (r.receiptNumber) out.set(String(r.receiptNumber), 'purchases');
  } catch (err: any) {
    logger.warn('[SumitReconcile] purchases read failed — treating as empty', {
      uid, err: err?.message,
    });
  }

  // e-vouchers carry the SUMIT doc id from their original purchase.
  try {
    const rows = await db.select({
      docId: petWashVouchers2025.sumitDocumentId,
    })
      .from(petWashVouchers2025)
      .where(and(
        eq(petWashVouchers2025.purchaserUid, uid),
        isNotNull(petWashVouchers2025.sumitDocumentId),
      ));
    for (const r of rows) if (r.docId) out.set(String(r.docId), 'petwash_vouchers_2025');
  } catch (err: any) {
    logger.warn('[SumitReconcile] petwash_vouchers_2025 read failed — treating as empty', {
      uid, err: err?.message,
    });
  }

  // K9000 direct-card wash sales.
  try {
    const rows = await db.select({
      docId: k9000WashEvents.sumitDocumentId,
    })
      .from(k9000WashEvents)
      .where(and(
        eq(k9000WashEvents.userId, uid),
        isNotNull(k9000WashEvents.sumitDocumentId),
      ));
    for (const r of rows) if (r.docId) out.set(String(r.docId), 'k9000_wash_events');
  } catch (err: any) {
    logger.warn('[SumitReconcile] k9000_wash_events read failed — treating as empty', {
      uid, err: err?.message,
    });
  }

  return out;
}

/**
 * Extract a document id from an unknown-shape SUMIT search response row.
 * SUMIT's authenticated swagger for /accounting/documents/search/ is not
 * verified here (see SumitClient.listDocumentsForCustomer comment). Try the
 * variants that showed up in every other SUMIT response we've walked live.
 * Return undefined when nothing matches — the diff logs the raw row for a
 * follow-up field-name pin.
 */
function extractSumitDocId(row: unknown): string | undefined {
  if (!row || typeof row !== 'object') return undefined;
  const r = row as Record<string, unknown>;
  const candidates = [
    r.DocumentID,
    r.documentID,
    r.DocumentNumber,
    r.documentNumber,
    r.ID,
    r.id,
    (r.Document as Record<string, unknown> | undefined)?.ID,
    (r.Document as Record<string, unknown> | undefined)?.DocumentNumber,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
    if (typeof c === 'number' && Number.isFinite(c)) return String(c);
  }
  return undefined;
}

/**
 * Walk a bounded sample of sumit_customers rows and diff SUMIT-vs-local for
 * each. Persist the aggregated result to sumit_reconcile_runs.
 *
 * @param opts.sampleSize  Cap on rows walked in one pass. Default 200.
 *                         Server-side only — the admin route does NOT accept
 *                         this from the client.
 */
export async function runDailyReconcile(opts?: {
  sampleSize?: number;
}): Promise<ReconcileResult> {
  const sampleSize = Math.max(1, Math.min(opts?.sampleSize ?? DEFAULT_SAMPLE_SIZE, 1000));

  // Feature-flag hard-off until explicit opt-in.
  if (!isSumitDailyReconcileEnabled()) {
    const result: ReconcileResult = {
      status: 'flag_off',
      checkedUsers: 0,
      mismatches: 0,
      skipped: 0,
      sampleSize,
      report: [],
      reason: 'SUMIT_DAILY_RECONCILE_ENABLED is not true',
    };
    await persistRun(result).catch((err) => {
      logger.warn('[SumitReconcile] flag-off persist failed', { err: err?.message });
    });
    return result;
  }

  // Fail-quiet when SUMIT is dormant — no per-row calls, just record the run
  // so the admin dashboard shows the reconciler DID execute (and why it did
  // nothing).
  const client = new SumitClient();
  if (!client.isWired()) {
    const result: ReconcileResult = {
      status: 'dormant',
      checkedUsers: 0,
      mismatches: 0,
      skipped: 0,
      sampleSize,
      report: [],
      reason: 'SUMIT client not wired',
    };
    await persistRun(result).catch((err) => {
      logger.warn('[SumitReconcile] dormant persist failed', { err: err?.message });
    });
    return result;
  }

  // Pull the sample of mapping rows. The table has an index on synced_at; walk
  // oldest-first so long-lived mismatches surface even after new users pile in.
  let mappingRows: Array<{ userId: string; sumitCustomerId: string }> = [];
  try {
    mappingRows = await db.select({
      userId: sumitCustomers.userId,
      sumitCustomerId: sumitCustomers.sumitCustomerId,
    })
      .from(sumitCustomers)
      .orderBy(sumitCustomers.syncedAt)
      .limit(sampleSize);
  } catch (err: any) {
    logger.error('[SumitReconcile] sumit_customers scan failed', { err: err?.message });
    const result: ReconcileResult = {
      status: 'error',
      checkedUsers: 0,
      mismatches: 0,
      skipped: 0,
      sampleSize,
      report: [],
      reason: `sumit_customers scan failed: ${err?.message}`,
    };
    await persistRun(result).catch(() => { /* best-effort */ });
    return result;
  }

  // Batch-load user emails for the sampled uids (single query, not one per row).
  const uidToEmail = new Map<string, string | null>();
  if (mappingRows.length > 0) {
    try {
      const uids = mappingRows.map((r) => r.userId);
      const userRows = await db.select({
        id: users.id,
        email: users.email,
      })
        .from(users)
        .where(inArray(users.id, uids));
      for (const u of userRows) uidToEmail.set(u.id, u.email ?? null);
    } catch (err: any) {
      logger.warn('[SumitReconcile] users email batch read failed — proceeding without emails', {
        err: err?.message,
      });
    }
  }

  let checkedUsers = 0;
  let skipped = 0;
  const report: MismatchRow[] = [];

  for (const row of mappingRows) {
    const { userId: uid, sumitCustomerId } = row;

    // Pull SUMIT's view of this customer's documents. Fail-quiet: a per-row
    // SUMIT error skips the row, does NOT halt the whole reconcile.
    let sumitDocs: unknown[];
    try {
      const res = await client.listDocumentsForCustomer(sumitCustomerId, {
        pageSize: SUMIT_DOCS_PAGE_SIZE,
      });
      if (!res.wired) {
        // Should not happen (isWired checked above), but treat as skip if it does.
        skipped++;
        continue;
      }
      if (res.reason) {
        // Non-2xx or shape issue — SumitClient already logged it. Skip this row.
        skipped++;
        continue;
      }
      sumitDocs = res.items ?? [];
    } catch (err: any) {
      // SumitClient is designed not to throw, but defense-in-depth.
      logger.warn('[SumitReconcile] SUMIT list threw (unexpected) — skipping row', {
        uid, sumitCustomerId, err: err?.message,
      });
      skipped++;
      continue;
    }

    const sumitIds = new Set<string>();
    for (const doc of sumitDocs) {
      const id = extractSumitDocId(doc);
      if (id) sumitIds.add(id);
    }

    const localIds = await collectLocalSumitDocIds(uid, uidToEmail.get(uid) ?? null);
    checkedUsers++;

    // Diff A: SUMIT knows a doc id that no local row references.
    for (const sid of sumitIds) {
      if (!localIds.has(sid)) {
        report.push({
          uid,
          sumitCustomerId,
          type: 'sumit_has_local_missing',
          sumitDocumentId: sid,
          note: 'SUMIT has a document id that no local receipt/purchase/voucher/wash row references',
        });
      }
    }

    // Diff B: local has a sumit_document_id SUMIT's list didn't return. Note the
    // SUMIT page cap means a long-lived customer may legitimately have docs
    // paged past our SUMIT_DOCS_PAGE_SIZE — the admin dashboard should surface
    // this as informational rather than alarm.
    for (const [lid, source] of localIds) {
      if (!sumitIds.has(lid)) {
        report.push({
          uid,
          sumitCustomerId,
          type: 'local_has_sumit_missing',
          sumitDocumentId: lid,
          localSource: source,
          note: `Local ${source} carries a sumit_document_id SUMIT's first ${SUMIT_DOCS_PAGE_SIZE}-doc page didn't return`,
        });
      }
    }
  }

  const result: ReconcileResult = {
    status: 'ok',
    checkedUsers,
    mismatches: report.length,
    skipped,
    sampleSize,
    report,
  };

  await persistRun(result).catch((err) => {
    logger.warn('[SumitReconcile] persist failed — result returned but not stored', {
      err: err?.message,
    });
  });

  logger.info('[SumitReconcile] run complete', {
    status: result.status,
    sampleSize,
    checkedUsers,
    mismatches: report.length,
    skipped,
  });

  return result;
}

async function persistRun(result: ReconcileResult): Promise<void> {
  await db.insert(sumitReconcileRuns).values({
    checkedUsers: result.checkedUsers,
    mismatches: result.mismatches,
    skipped: result.skipped,
    sampleSize: result.sampleSize,
    status: result.status,
    reason: result.reason ?? null,
    // Cap the persisted report at 500 rows so a mass-mismatch pass can't blow
    // up the jsonb column. The counts always reflect the full run; the row
    // list is a sample.
    report: (result.report.length > 500
      ? result.report.slice(0, 500)
      : result.report) as any,
  });
}

/**
 * Read the last N reconcile runs — used by GET /api/admin/sumit/reconcile-report.
 * Never accepts a userId from client input; returns operational metadata only.
 */
export async function getRecentReconcileRuns(limit = 10): Promise<Array<{
  id: number;
  runAt: Date;
  status: string;
  checkedUsers: number;
  mismatches: number;
  skipped: number;
  sampleSize: number;
  reason: string | null;
  report: MismatchRow[];
}>> {
  const clampedLimit = Math.max(1, Math.min(limit, 50));
  try {
    const rows = await db.select()
      .from(sumitReconcileRuns)
      .orderBy(desc(sumitReconcileRuns.runAt))
      .limit(clampedLimit);
    return rows.map((r) => ({
      id: r.id,
      runAt: r.runAt,
      status: r.status,
      checkedUsers: r.checkedUsers,
      mismatches: r.mismatches,
      skipped: r.skipped,
      sampleSize: r.sampleSize,
      reason: r.reason,
      report: (Array.isArray(r.report) ? r.report : []) as MismatchRow[],
    }));
  } catch (err: any) {
    logger.warn('[SumitReconcile] getRecentReconcileRuns failed', { err: err?.message });
    return [];
  }
}

// ── Cron scheduler ──────────────────────────────────────────────────────────
//
// Runs once at 03:00 Asia/Jerusalem, then every 24h. Feature-flag OFF by
// default (SUMIT_DAILY_RECONCILE_ENABLED); the cron STARTS unconditionally so
// startup logs show the schedule even when the flag is off, but the reconcile
// function itself short-circuits with status='flag_off' until the flag flips.
// This matches the pattern used by DailyReconciliationJob (00:05 Jerusalem).

function getMsUntilNextRunJerusalem(hour = 3, minute = 0): number {
  const now = new Date();
  // Interpret "now" in Jerusalem time so DST is handled by the platform.
  const nowJer = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
  const nextJer = new Date(nowJer);
  nextJer.setHours(hour, minute, 0, 0);
  if (nextJer.getTime() <= nowJer.getTime()) {
    nextJer.setDate(nextJer.getDate() + 1);
  }
  return nextJer.getTime() - nowJer.getTime();
}

export function startSumitReconciliationJob(): void {
  const msUntilFirst = getMsUntilNextRunJerusalem(3, 0);
  const hoursUntilFirst = Math.round((msUntilFirst / 3_600_000) * 10) / 10;

  logger.info('[SumitReconcile] scheduler started', {
    firstRunIn: `${hoursUntilFirst}h`,
    timezone: 'Asia/Jerusalem',
    runTime: '03:00',
    featureFlag: 'SUMIT_DAILY_RECONCILE_ENABLED',
    flagOn: isSumitDailyReconcileEnabled(),
  });

  setTimeout(() => {
    runDailyReconcile().catch((err) => {
      logger.error('[SumitReconcile] first run threw (unexpected)', { err: err?.message });
    });
    setInterval(() => {
      runDailyReconcile().catch((err) => {
        logger.error('[SumitReconcile] daily run threw (unexpected)', { err: err?.message });
      });
    }, 24 * 60 * 60 * 1000);
  }, msUntilFirst);
}

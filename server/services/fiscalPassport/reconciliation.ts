/**
 * Fiscal reconciliation — CEO 2026-08-27 §54-58, §87, §94.25-26.
 *
 * READ-ONLY reconciliation checks over the existing money authorities.
 * Never issues documents. Never moves money. Never creates duplicate
 * events. §87 discipline: "Best-effort alerting must not create
 * duplicate money."
 *
 * Signal taxonomy mirrors §87:
 *   PAID_NO_FISCAL_DOCUMENT         — shop/booking/K9000 paid, no SUMIT doc.
 *   FISCAL_DOCUMENT_NO_PAYMENT      — SUMIT doc exists, no matching payment.
 *   SUMIT_AMOUNT_MISMATCH           — doc total ≠ commercial total.
 *   SUMIT_DUPLICATE_DOCUMENT        — two SUMIT docs for one fiscal event key.
 *   NAYAX_UNMATCHED_TRANSACTION     — Nayax tx has no PetWash object.
 *   WALLET_UNMATCHED_DEBIT          — wallet debit has no economic object.
 *   REFUND_NO_CREDIT_DOCUMENT       — refund exists, no CreditInvoice.
 *   PROVIDER_PAYOUT_UNMATCHED       — payout row not decomposable to jobs.
 *
 * Each check is a pure per-transaction question the composer or admin
 * explorer can call for a specific event. A batch sweep (a nightly
 * cron over the whole month) is a Phase-2 wiring task — this file
 * only exposes the per-record primitives so the tests can lock the
 * discipline BEFORE the sweep exists.
 */

import { and, eq } from 'drizzle-orm';
import { pool, db } from '../../db';
import { contractorEarnings } from '@shared/schema';
import { logger } from '../../lib/logger';

export type ReconciliationSignal =
  | 'PAID_NO_FISCAL_DOCUMENT'
  | 'FISCAL_DOCUMENT_NO_PAYMENT'
  | 'SUMIT_AMOUNT_MISMATCH'
  | 'SUMIT_DUPLICATE_DOCUMENT'
  | 'NAYAX_UNMATCHED_TRANSACTION'
  | 'WALLET_UNMATCHED_DEBIT'
  | 'REFUND_NO_CREDIT_DOCUMENT'
  | 'PROVIDER_PAYOUT_UNMATCHED';

export interface ReconciliationWarning {
  signal: ReconciliationSignal;
  message: string;
}

// ─── Shop / booking / K9000 : paid but no SUMIT doc? ────────────────

/**
 * Check whether an economic event that IS paid also has a SUMIT
 * document recorded. Reads the sumit_documents index — if the table
 * doesn't exist yet in this env, treats the answer as "no signal"
 * (we can't accuse of a missing doc when we can't verify).
 *
 * §54 SUMIT reconciliation core question: "paid + no document".
 */
export async function checkPaidHasFiscalDocument(input: {
  /** The stable fiscal event key — see eventRegistry.fiscalEventKey. */
  fiscalEventKey: string;
  /** Whether the composer already resolved paid=true for this event. */
  paid: boolean;
}): Promise<ReconciliationWarning | null> {
  if (!input.paid) return null;
  try {
    const { rows } = await pool.query(
      `SELECT id FROM sumit_documents WHERE fiscal_event_key = $1 LIMIT 1`,
      [input.fiscalEventKey],
    );
    if (rows.length === 0) {
      return {
        signal: 'PAID_NO_FISCAL_DOCUMENT',
        message: `Paid event ${input.fiscalEventKey} has no SUMIT document`,
      };
    }
    return null;
  } catch (err: any) {
    if (err?.code === '42P01') return null; // fresh env — can't reconcile
    logger.error('[FiscalRecon] paidHasDoc lookup failed', { keyTail: input.fiscalEventKey.slice(-24), error: err?.message });
    return null;
  }
}

/**
 * §54 second core question: SUMIT amount vs commercial amount. When
 * either side is missing we return null — we never accuse without a
 * comparison. When both are present but disagree, we flag.
 */
export async function checkSumitAmountMatches(input: {
  fiscalEventKey: string;
  commercialTotalCents: number;
}): Promise<ReconciliationWarning | null> {
  try {
    const { rows } = await pool.query(
      `SELECT total_cents FROM sumit_documents WHERE fiscal_event_key = $1 LIMIT 1`,
      [input.fiscalEventKey],
    );
    if (rows.length === 0) return null;
    const docCents = Number(rows[0].total_cents ?? 0);
    if (docCents !== input.commercialTotalCents) {
      return {
        signal: 'SUMIT_AMOUNT_MISMATCH',
        message: `Document total ${docCents}¢ ≠ commercial total ${input.commercialTotalCents}¢`,
      };
    }
    return null;
  } catch (err: any) {
    if (err?.code === '42P01') return null;
    logger.error('[FiscalRecon] amount match failed', { keyTail: input.fiscalEventKey.slice(-24), error: err?.message });
    return null;
  }
}

// ─── SUMIT duplicate document detector ──────────────────────────────

/**
 * §54 third core question + §25 idempotency guarantee: two SUMIT
 * documents for the same fiscal_event_key is a duplicate.
 */
export async function checkSumitDuplicate(fiscalEventKey: string): Promise<ReconciliationWarning | null> {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM sumit_documents WHERE fiscal_event_key = $1`,
      [fiscalEventKey],
    );
    const n = Number(rows[0]?.n ?? 0);
    if (n > 1) {
      return {
        signal: 'SUMIT_DUPLICATE_DOCUMENT',
        message: `${n} SUMIT documents share fiscal_event_key ${fiscalEventKey}`,
      };
    }
    return null;
  } catch (err: any) {
    if (err?.code === '42P01') return null;
    logger.error('[FiscalRecon] duplicate check failed', { keyTail: fiscalEventKey.slice(-24), error: err?.message });
    return null;
  }
}

// ─── Nayax unmatched transaction ────────────────────────────────────

/**
 * §55: a Nayax transaction must map back to a PetWash object.
 * Callable per transaction — a full nightly reconciliation is a
 * Phase-2 sweep.
 */
export async function checkNayaxMatched(nayaxTxId: string): Promise<ReconciliationWarning | null> {
  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM nayax_transactions WHERE nayax_tx_id = $1 LIMIT 1`,
      [nayaxTxId],
    );
    if (rows.length === 0) {
      return {
        signal: 'NAYAX_UNMATCHED_TRANSACTION',
        message: `Nayax transaction ${nayaxTxId} has no PetWash object`,
      };
    }
    return null;
  } catch (err: any) {
    if (err?.code === '42P01') return null;
    logger.error('[FiscalRecon] nayax match failed', { txIdTail: nayaxTxId.slice(-8), error: err?.message });
    return null;
  }
}

// ─── Wallet debit unmatched to commercial object ────────────────────

/**
 * §56: a wallet debit must correspond to a legitimate economic object
 * (the source_id column on credit_transactions points at the paying
 * event). This checks the simplest case: source_id is null AND
 * source_type is not a documented 'admin' correction.
 */
export async function checkWalletDebitMatched(ledgerTransactionId: string): Promise<ReconciliationWarning | null> {
  try {
    const { rows } = await pool.query(
      `SELECT source_type, source_id
         FROM credit_transactions
        WHERE transaction_id = $1 AND transaction_type = 'redeem' LIMIT 1`,
      [ledgerTransactionId],
    );
    if (rows.length === 0) return null;
    const { source_type, source_id } = rows[0];
    if (!source_id && String(source_type ?? '') !== 'admin_correction') {
      return {
        signal: 'WALLET_UNMATCHED_DEBIT',
        message: `Wallet debit ${ledgerTransactionId} has no source_id`,
      };
    }
    return null;
  } catch (err: any) {
    if (err?.code === '42P01') return null;
    logger.error('[FiscalRecon] wallet debit match failed', { txIdTail: ledgerTransactionId.slice(-8), error: err?.message });
    return null;
  }
}

// ─── Provider payout unmatched ──────────────────────────────────────

/**
 * §58: every provider payout must be decomposable to jobs. This
 * per-payout check verifies the contractor_earnings row references a
 * booking_id. A payout row without booking lineage means "we paid the
 * provider but can't say for which job" — surfaces as an admin alert,
 * NEVER auto-corrected.
 */
export async function checkProviderPayoutMatched(input: {
  contractorId: string;
  earningId: number;
}): Promise<ReconciliationWarning | null> {
  try {
    const [row] = await db
      .select({ bookingId: contractorEarnings.bookingId, status: contractorEarnings.payoutStatus })
      .from(contractorEarnings)
      .where(and(
        eq(contractorEarnings.id, input.earningId),
        eq(contractorEarnings.contractorId, input.contractorId),
      ))
      .limit(1);
    if (!row) return null;
    if (!row.bookingId && String(row.status ?? '') === 'paid_out') {
      return {
        signal: 'PROVIDER_PAYOUT_UNMATCHED',
        message: `contractor_earnings ${input.earningId} paid out but has no booking_id`,
      };
    }
    return null;
  } catch (err: any) {
    logger.error('[FiscalRecon] provider payout match failed', { earningId: input.earningId, error: err?.message });
    return null;
  }
}

// ─── Aggregator ─────────────────────────────────────────────────────

/**
 * Compose a bounded list of warnings for one fiscal event. The
 * composer or admin explorer calls this to enrich a passport's
 * reconciliation.warnings block. Never scans large tables — every
 * check is per-record.
 */
export async function collectWarnings(input: {
  fiscalEventKey?: string;
  commercialTotalCents?: number;
  paid?: boolean;
  nayaxTxId?: string;
  walletTransactionId?: string;
  payout?: { contractorId: string; earningId: number };
}): Promise<ReconciliationWarning[]> {
  const out: ReconciliationWarning[] = [];
  const push = (w: ReconciliationWarning | null) => { if (w) out.push(w); };

  if (input.fiscalEventKey) {
    push(await checkPaidHasFiscalDocument({ fiscalEventKey: input.fiscalEventKey, paid: !!input.paid }));
    if (input.commercialTotalCents !== undefined) {
      push(await checkSumitAmountMatches({ fiscalEventKey: input.fiscalEventKey, commercialTotalCents: input.commercialTotalCents }));
    }
    push(await checkSumitDuplicate(input.fiscalEventKey));
  }
  if (input.nayaxTxId) push(await checkNayaxMatched(input.nayaxTxId));
  if (input.walletTransactionId) push(await checkWalletDebitMatched(input.walletTransactionId));
  if (input.payout) push(await checkProviderPayoutMatched(input.payout));

  return out;
}

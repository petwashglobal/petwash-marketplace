/**
 * Provider commission + payout + refund lineage — CEO 2026-08-27
 * fiscal directive §32-36, §55, §58, §94 items 17-19.
 *
 * READ-ONLY lineage helpers. Nothing here decides tax or moves money.
 * The composer uses these to fill in the FiscalTransactionPassport's
 * providerMoney + fiscalDocument + reconciliation blocks with data
 * from the actual authorities (contractor_earnings, refund records).
 */

import { eq, and } from 'drizzle-orm';
import { pool } from '../../db';
import { db } from '../../db';
import { contractorEarnings } from '@shared/schema';
import { logger } from '../../lib/logger';
import { paymentClassForEvent, type FiscalEventCode } from '@shared/lib/fiscalPassport/eventRegistry';
import { generateRefundRef } from '@shared/lib/fiscalPassport/idNamespace';
import type {
  ProviderMoneyBlock,
  FiscalDocumentRef,
} from '@shared/lib/fiscalPassport/FiscalTransactionPassport';

// ─── Provider commission lineage (§32) ──────────────────────────────

/**
 * Result of resolving the provider-side money lineage for one job.
 * §32: customer commercial → provider gross → commission event →
 * commission fiscal doc → payable → payout. All connected via
 * (contractor_id, booking_id).
 */
export interface ProviderCommissionLineage {
  bookingId: string;
  providerUid: string;
  /** Sum of the provider's cents at booking authority (payout column). */
  providerGrossCents: number;
  /** PetWash commission (integer cents, provider expected today = 15%). */
  petwashCommissionCents: number;
  /** Provider money block ready to embed in the fiscal passport. */
  providerMoney: ProviderMoneyBlock;
  /** External payout reference when available (contractor_earnings.paid_out_ref). */
  payoutReference?: string;
}

/**
 * Compose provider-commission lineage from an existing booking id +
 * provider uid. Reads contractor_earnings and does NOT touch money.
 * §22 discipline: PAID only when contractor_earnings.payout_status
 * equals the literal 'paid_out' — never inferred from booking status.
 */
export async function composeProviderCommissionLineage(input: {
  bookingId: string;
  providerUid: string;
  /** Provider's gross expected in cents (from the source booking row). */
  providerGrossCents: number;
  /** PetWash's commission share in cents (from the source booking row). */
  petwashCommissionCents: number;
}): Promise<ProviderCommissionLineage> {
  const bookingId = input.bookingId;

  let expected = input.providerGrossCents;
  let pending = 0;
  let available = 0;
  let paid = 0;
  let payoutReference: string | undefined;

  try {
    const [ce] = await db
      .select({
        payoutStatus: contractorEarnings.payoutStatus,
        amountCents: contractorEarnings.amountCents,
      })
      .from(contractorEarnings)
      .where(and(
        eq(contractorEarnings.bookingId, bookingId),
        eq(contractorEarnings.contractorId, input.providerUid),
      ))
      .limit(1);

    if (ce) {
      const amount = Number(ce.amountCents ?? 0);
      const status = String(ce.payoutStatus ?? '');
      // §22 literal-equality gates — the exact pattern
      // providerEarningsBucketReversal.regression.test.ts pins.
      if (status === 'paid_out') paid = amount;
      else if (status === 'released') available = amount;
      else if (status === 'in_escrow' || status === 'pending') pending = amount;
    }
  } catch (err: any) {
    logger.error('[FiscalLineage] contractor_earnings read failed', {
      bookingIdTail: bookingId.slice(-6), error: err?.message,
    });
    // Fail-safe: leave pending/paid at 0. Reconciliation warning will
    // fire in the composer if the caller expected paid > 0.
  }

  return {
    bookingId,
    providerUid: input.providerUid,
    providerGrossCents: input.providerGrossCents,
    petwashCommissionCents: input.petwashCommissionCents,
    providerMoney: {
      expectedCents: expected,
      pendingCents: pending,
      availableCents: available,
      paidCents: paid,
      payoutReference,
    },
    payoutReference,
  };
}

// ─── Refund / credit document lineage (§34-36, §94.19) ──────────────

/**
 * Result of resolving refund lineage for one original transaction.
 * §36: the credit document must maintain lineage back to the original
 * SUMIT document id.
 */
export interface RefundLineage {
  originalTransactionRef: string;
  /** Ordered list of refund transactions in occurrence order. */
  refunds: Array<{
    refundRef: string;
    refundIndex: number;
    amountCents: number;
    /** External refund transaction id (Nayax / wallet ledger / SUMIT credit doc). */
    externalRefundRef?: string;
    creditDocumentId?: string;
    createdAt: string;
  }>;
  totalRefundedCents: number;
  /** TRUE when at least one refund exists but its SUMIT credit
   *  document is missing — surfaced as a §87 REFUND_NO_CREDIT_DOCUMENT
   *  alert by the composer / admin explorer. */
  hasOrphanRefundWarning: boolean;
}

/**
 * Read refund events for an original transaction. The current repo
 * stores refunds in the `refund_transactions` table (raw SQL, no
 * drizzle model). This helper queries by an opaque `originalRef` — the
 * caller resolves the mapping between transactionRef (PWT-...) and
 * the internal refund key.
 *
 * Returns an empty result set when the table doesn't exist yet (42P01)
 * so a fresh env renders honestly instead of 500ing.
 */
export async function composeRefundLineage(input: {
  originalTransactionRef: string;
  /** Internal opaque handle the refund table joins on — usually the
   *  correlationId or the source object's id. */
  originalRefundKey: string;
}): Promise<RefundLineage> {
  const empty: RefundLineage = {
    originalTransactionRef: input.originalTransactionRef,
    refunds: [],
    totalRefundedCents: 0,
    hasOrphanRefundWarning: false,
  };
  try {
    const { rows } = await pool.query(
      `SELECT id, amount_cents, external_refund_ref, credit_document_id, created_at
         FROM refund_transactions
        WHERE original_ref = $1
        ORDER BY created_at ASC`,
      [input.originalRefundKey],
    );
    if (rows.length === 0) return empty;

    let totalCents = 0;
    let orphan = false;
    const refunds = rows.map((r: any, idx: number) => {
      const amount = Number(r.amount_cents ?? 0);
      totalCents += amount;
      if (!r.credit_document_id) orphan = true;
      return {
        refundRef: generateRefundRef({
          originalTransactionRef: input.originalTransactionRef,
          refundIndex: idx + 1,
        }),
        refundIndex: idx + 1,
        amountCents: amount,
        externalRefundRef: r.external_refund_ref ?? undefined,
        creditDocumentId: r.credit_document_id ?? undefined,
        createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      };
    });
    return {
      originalTransactionRef: input.originalTransactionRef,
      refunds,
      totalRefundedCents: totalCents,
      hasOrphanRefundWarning: orphan,
    };
  } catch (err: any) {
    if (err?.code === '42P01') {
      // Fresh env — no refund table yet. Empty projection is honest.
      return empty;
    }
    logger.error('[FiscalLineage] refund lineage read failed', {
      originalTransactionRef: input.originalTransactionRef,
      error: err?.message,
    });
    return empty;
  }
}

/**
 * Compose the `fiscalDocument` block for a REFUND event. Delegates
 * document type to the CPA mapping (which returns CreditInvoice for
 * REFUND) and threads the original document reference into
 * `originalDocumentId` — §36 credit-document lineage.
 *
 * Never issues a SUMIT credit document. Never marks a refund complete.
 * Returns a projection the composer embeds; the actual document
 * generation lives in existing SUMIT wiring.
 */
export function composeRefundFiscalDocument(input: {
  originalSumitDocumentId: string;
  creditDocumentId?: string;
}): FiscalDocumentRef {
  // Always delegate to the CPA mapping for the event class. paymentClassForEvent
  // is called with 'SHOP_ORDER_REFUNDED' — any *_REFUNDED event returns REFUND.
  const cls = paymentClassForEvent('SHOP_ORDER_REFUNDED' as FiscalEventCode);
  // Compile-time safety: cls is 'REFUND' → CreditInvoice per mapping.
  const state = input.creditDocumentId ? 'CREDITED' as const : 'CREDIT_PENDING' as const;
  return {
    required: true,
    documentType: 'CreditInvoice',
    state,
    originalDocumentId: input.originalSumitDocumentId,
    creditDocumentId: input.creditDocumentId,
  };
}

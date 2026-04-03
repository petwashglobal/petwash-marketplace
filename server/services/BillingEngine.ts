/**
 * PetWash™ Billing Engine
 *
 * THE SINGLE ORCHESTRATOR for all payment / escrow / document events.
 * Every financial event in the system MUST flow through this engine.
 *
 * Architecture:
 *
 *   PaymentEvent
 *       │
 *       ▼
 *   BillingEngine
 *       │
 *       ├── BillingLedger       → immutable billing_records row
 *       ├── EscrowStateMachine  → state transitions + SHA-256 audit chain
 *       ├── DocumentResolver    → decides which docs are needed and from where
 *       └── AccountingService   → STUB — must be replaced with certified system
 *
 * CRITICAL LEGAL RULES:
 *   - Receipt (קבלה) and Tax Invoice (חשבונית מס) MUST come from a certified
 *     Israeli accounting system.  The accounting service below is a stub only.
 *     It must be wired to an approved SaaS (e.g. Priority, HashNet, Cheshbonit)
 *     or to the ITA API (api.taxes.gov.il) before production.
 *   - BillingEngine never generates fake document numbers.
 *   - Escrow is a DB state, not a PDF label.
 *   - All amounts are in AGOROT (ILS × 100, integer).
 */

import { logger } from "../lib/logger";
import {
  createBillingRecord,
  createFromGrossAgorot,
  getBillingRecordsByBooking,
  setReceiptNumber,
  setInvoiceNumber,
  setAllocationNumber,
  type CreateBillingRecordParams,
} from "./BillingLedger";
import { EscrowStateMachine, transitionEscrowState } from "./EscrowStateMachine";
import { resolveDocuments, summarizeDecisions, type ResolverContext } from "./DocumentResolver";
import { calcVatFromGrossAgorot, ISRAELI_VAT_RATE } from "./LegalThresholdConfig";
import type { BillingRecord, DocumentPurpose, PaymentFlowStatus } from "@shared/schema-billing";
import type { DocumentDecision } from "./DocumentResolver";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PaymentEvent {
  bookingId:        string;
  /** Total amount charged to customer, in AGOROT (ILS × 100) */
  grossAgorot:      number;
  currency:         "ILS";
  customerId:       string;
  providerId:       string;
  processor:        "stripe" | "nayax" | "manual";
  processorRef:     string;
  paymentMethod:    "card" | "bank_transfer" | "cash" | "wallet";

  /** If set, the customer is a registered business and will receive a tax invoice */
  customerTaxId?:   string;
  /** Commercial model — affects who issues the tax invoice */
  commercialModel?: "MARKETPLACE_COMMISSION" | "PRINCIPAL";
  /** Platform fee percentage (0–1). Default: 0.15 (15%) */
  platformFeeRate?: number;
  /** Idempotency key — prevents duplicate records on retry */
  idempotencyKey?:  string;
  /** Machine ID for K9000 station flows */
  machineId?:       string;
}

export interface BillingEngineResult {
  billingRecord: BillingRecord;
  documents: DocumentDecision[];
  /** Summary string for logging — e.g. "booking_confirmation(internal_pdf), receipt(accounting_system)" */
  documentSummary: string;
  /**
   * If any document requires the accounting system, this flag is true.
   * The caller must trigger the certified accounting integration separately.
   */
  requiresAccountingAction: boolean;
  /** True if allocation number must be obtained from ITA before tax invoice can be issued */
  requiresITAAllocationNumber: boolean;
}

export interface ServiceCompletedResult {
  status:        "released";
  bookingId:     string;
  recordId:      string;
  documents:     DocumentDecision[];
  documentSummary: string;
  requiresAccountingAction: boolean;
  requiresITAAllocationNumber: boolean;
}

export interface RefundResult {
  status:        "refunded" | "partially_refunded";
  bookingId:     string;
  recordId:      string;
  refundAgorot:  number;
  documents:     DocumentDecision[];
  documentSummary: string;
}

// ── AccountingService stub ────────────────────────────────────────────────────

/**
 * STUB — NOT a real accounting system.
 *
 * In production this MUST be replaced with a certified Israeli accounting
 * system integration.  Options:
 *   - ITA API (api.taxes.gov.il) — free government API, needs ITA_CLIENT_ID + ITA_CLIENT_SECRET
 *   - Priority Software
 *   - HashNet (חשבנט)
 *   - Cheshbonit (חשבונית ירוקה)
 *
 * Until then, every method here does nothing except log a warning.
 * Document numbers are NOT generated — the record stays without a receipt/invoice
 * number until the real system is wired in.
 */
export const AccountingServiceStub = {
  async issueReceipt(record: BillingRecord): Promise<{ receiptNumber: string | null }> {
    logger.warn("[AccountingService] STUB — receipt must be issued by certified accounting system", {
      recordId:   record.recordId,
      bookingId:  record.bookingId,
      totalNIS:   (record.totalAgorot / 100).toFixed(2),
    });
    // Return null — no fake number is generated
    return { receiptNumber: null };
  },

  async issueTaxInvoice(record: BillingRecord): Promise<{ invoiceNumber: string | null; allocationNumber: string | null }> {
    logger.warn("[AccountingService] STUB — tax invoice must be issued by certified accounting system", {
      recordId:          record.recordId,
      bookingId:         record.bookingId,
      subtotalNIS:       (record.subtotalAgorot / 100).toFixed(2),
      requiresAllocation: record.requiresAllocation,
    });
    if (record.requiresAllocation) {
      logger.warn("[AccountingService] STUB — ITA allocation number required but NOT obtained — cannot issue tax invoice", {
        recordId: record.recordId,
        subtotalNIS: (record.subtotalAgorot / 100).toFixed(2),
      });
    }
    return { invoiceNumber: null, allocationNumber: null };
  },
};

// ── Core platform fee calculation ─────────────────────────────────────────────

function calcPlatformFee(grossAgorot: number, feeRate: number): {
  platformFeeAgorot:    number;
  platformFeeVatAgorot: number;
  providerPayoutAgorot: number;
} {
  // Fee is taken from the pre-VAT portion
  const { subtotalAgorot } = calcVatFromGrossAgorot(grossAgorot);
  const platformFeeNet   = Math.floor(subtotalAgorot * feeRate);
  const platformFeeVat   = Math.round(platformFeeNet * ISRAELI_VAT_RATE);
  const providerPayout   = subtotalAgorot - platformFeeNet;
  return {
    platformFeeAgorot:    platformFeeNet,
    platformFeeVatAgorot: platformFeeVat,
    providerPayoutAgorot: providerPayout,
  };
}

// ── BillingEngine ─────────────────────────────────────────────────────────────

export const BillingEngine = {

  /**
   * handlePaymentCaptured
   *
   * Call this when the payment processor confirms the charge was captured.
   * Creates a billing record → captures → holds in escrow → resolves documents.
   *
   * Steps:
   *   1. Create immutable BillingRecord (captured → held_in_escrow)
   *   2. Transition state machine: authorized → captured → held_in_escrow
   *   3. Resolve documents required at this stage
   *   4. Call accounting stub for receipt (real integration pending)
   *   5. Return record + document decisions
   */
  async handlePaymentCaptured(payment: PaymentEvent): Promise<BillingEngineResult> {
    logger.info("[BillingEngine] Payment captured — starting flow", {
      bookingId:    payment.bookingId,
      grossNIS:     (payment.grossAgorot / 100).toFixed(2),
      processor:    payment.processor,
      processorRef: payment.processorRef,
    });

    const feeRate    = payment.platformFeeRate ?? 0.15;
    const isB2B      = !!payment.customerTaxId;
    const model      = payment.commercialModel ?? "MARKETPLACE_COMMISSION";
    const now        = new Date();

    const { subtotalAgorot, vatAgorot, totalAgorot } = calcVatFromGrossAgorot(payment.grossAgorot);
    const { platformFeeAgorot, platformFeeVatAgorot, providerPayoutAgorot } = calcPlatformFee(
      payment.grossAgorot,
      feeRate
    );

    // 1. Create billing record in "held_in_escrow" state
    const record = await createBillingRecord({
      idempotencyKey:       payment.idempotencyKey,
      bookingId:            payment.bookingId,
      customerId:           payment.customerId,
      providerId:           payment.providerId,
      machineId:            payment.machineId,

      documentPurpose:      "booking_confirmation",
      issuingEntity:        "platform",
      paymentFlowStatus:    "held_in_escrow",

      currency:             "ILS",
      subtotalAgorot,
      vatAgorot,
      totalAgorot,
      platformFeeAgorot,
      platformFeeVatAgorot,
      providerPayoutAgorot,

      paymentMethod:        payment.paymentMethod,
      processorName:        payment.processor,
      processorReference:   payment.processorRef,

      capturedAt:           now,
      // Default escrow hold: 48 hours after capture (ops can extend)
      escrowHeldUntil:      new Date(now.getTime() + 48 * 60 * 60 * 1000),

      isB2B,
      customerTaxId:        payment.customerTaxId,

      payload: {
        paymentEvent: payment,
        feeRate,
        commercialModel: model,
      },
    });

    // 2. Document decisions for "captured + held_in_escrow" state
    const resolverCtx: ResolverContext = {
      bookingId:            payment.bookingId,
      customerId:           payment.customerId,
      providerId:           payment.providerId,
      isB2B,
      customerTaxId:        payment.customerTaxId,
      subtotalAgorot,
      totalAgorot,
      platformFeeAgorot,
      providerPayoutAgorot,
      paymentFlowStatus:    "held_in_escrow",
      issueDate:            now,
      commercialModel:      model,
    };

    const decisions = resolveDocuments(resolverCtx);
    const documentSummary = summarizeDecisions(decisions);

    // 3. Call accounting stub for receipt — real integration TBD
    const receiptDecision = decisions.find(d => d.purpose === "receipt");
    if (receiptDecision) {
      const { receiptNumber } = await AccountingServiceStub.issueReceipt(record);
      if (receiptNumber) {
        await setReceiptNumber(record.recordId, receiptNumber);
      }
    }

    const requiresAccountingAction = decisions.some(d => d.system === "accounting_system");
    const requiresITAAllocationNumber = decisions.some(d => d.requiresAllocationNumber);

    logger.info("[BillingEngine] Payment captured — complete", {
      recordId:                 record.recordId,
      bookingId:                payment.bookingId,
      totalNIS:                 (totalAgorot / 100).toFixed(2),
      platformFeeNIS:           (platformFeeAgorot / 100).toFixed(2),
      providerPayoutNIS:        (providerPayoutAgorot / 100).toFixed(2),
      documentSummary,
      requiresAccountingAction,
      requiresITAAllocationNumber,
    });

    return {
      billingRecord:              record,
      documents:                  decisions,
      documentSummary,
      requiresAccountingAction,
      requiresITAAllocationNumber,
    };
  },

  /**
   * handleServiceCompleted
   *
   * Call this when the pet care service has been confirmed complete.
   * Transitions held_in_escrow → released.
   * Optionally triggers tax invoice via accounting stub (real integration pending).
   *
   * @param recordId  The BillingRecord.recordId (BLR-{year}-{nanoid})
   * @param options   Optional actor info and commercial model for doc resolution
   */
  async handleServiceCompleted(
    recordId: string,
    options: {
      bookingId:        string;
      customerId?:      string;
      providerId?:      string;
      isB2B?:           boolean;
      customerTaxId?:   string;
      subtotalAgorot:   number;
      totalAgorot:      number;
      platformFeeAgorot?: number;
      providerPayoutAgorot?: number;
      commercialModel?: "MARKETPLACE_COMMISSION" | "PRINCIPAL";
      releasedByAdminId?: string;
    }
  ): Promise<ServiceCompletedResult> {
    logger.info("[BillingEngine] Service completed — releasing escrow", {
      recordId,
      bookingId: options.bookingId,
    });

    // 1. Release escrow funds (state machine transition)
    await EscrowStateMachine.release(recordId, options.releasedByAdminId);

    // 2. Resolve documents for "released" state
    const resolverCtx: ResolverContext = {
      bookingId:         options.bookingId,
      customerId:        options.customerId,
      providerId:        options.providerId,
      isB2B:             options.isB2B ?? false,
      customerTaxId:     options.customerTaxId,
      subtotalAgorot:    options.subtotalAgorot,
      totalAgorot:       options.totalAgorot,
      platformFeeAgorot: options.platformFeeAgorot,
      providerPayoutAgorot: options.providerPayoutAgorot,
      paymentFlowStatus: "released",
      issueDate:         new Date(),
      commercialModel:   options.commercialModel ?? "MARKETPLACE_COMMISSION",
    };

    const decisions = resolveDocuments(resolverCtx);
    const documentSummary = summarizeDecisions(decisions);
    const requiresAccountingAction = decisions.some(d => d.system === "accounting_system");
    const requiresITAAllocationNumber = decisions.some(d => d.requiresAllocationNumber);

    // 3. Fetch record for accounting stub call
    const records = await getBillingRecordsByBooking(options.bookingId);
    const record   = records.find(r => r.recordId === recordId);

    // 4. Tax invoice stub — real integration TBD
    const invoiceDecision = decisions.find(d => d.purpose === "tax_invoice");
    if (invoiceDecision && record) {
      const { invoiceNumber, allocationNumber } =
        await AccountingServiceStub.issueTaxInvoice(record);
      if (invoiceNumber) await setInvoiceNumber(recordId, invoiceNumber);
      if (allocationNumber) await setAllocationNumber(recordId, allocationNumber);
    }

    logger.info("[BillingEngine] Escrow released", {
      recordId,
      bookingId:    options.bookingId,
      documentSummary,
      requiresAccountingAction,
      requiresITAAllocationNumber,
    });

    return {
      status:        "released",
      bookingId:     options.bookingId,
      recordId,
      documents:     decisions,
      documentSummary,
      requiresAccountingAction,
      requiresITAAllocationNumber,
    };
  },

  /**
   * handleRefund
   *
   * Call this when a full or partial refund is issued.
   * Transitions held_in_escrow → refunded or partially_refunded.
   * If a tax invoice was already issued, a credit note must also be issued.
   */
  async handleRefund(
    recordId:      string,
    bookingId:     string,
    refundAgorot:  number,
    isPartial:     boolean,
    adminId?:      string
  ): Promise<RefundResult> {
    logger.info("[BillingEngine] Refund requested", {
      recordId,
      bookingId,
      refundNIS: (refundAgorot / 100).toFixed(2),
      isPartial,
    });

    const toStatus: PaymentFlowStatus = isPartial ? "partially_refunded" : "refunded";

    await transitionEscrowState({
      recordId,
      toStatus,
      actorType:   "admin",
      actorId:     adminId,
      deltaAgorot: refundAgorot,
      notes:       `Refund of ₪${(refundAgorot / 100).toFixed(2)} by admin`,
    });

    // Document resolution for refund state
    const records = await getBillingRecordsByBooking(bookingId);
    const record  = records.find(r => r.recordId === recordId);

    const resolverCtx: ResolverContext = {
      bookingId,
      providerId:        record?.providerId ?? undefined,
      isB2B:             record?.isB2B ?? false,
      customerTaxId:     record?.customerTaxId ?? undefined,
      subtotalAgorot:    record?.subtotalAgorot ?? refundAgorot,
      totalAgorot:       record?.totalAgorot ?? refundAgorot,
      paymentFlowStatus: toStatus,
      issueDate:         new Date(),
      commercialModel:   "MARKETPLACE_COMMISSION",
    };

    const decisions = resolveDocuments(resolverCtx);
    const documentSummary = summarizeDecisions(decisions);

    logger.info("[BillingEngine] Refund complete", {
      recordId,
      bookingId,
      toStatus,
      refundNIS: (refundAgorot / 100).toFixed(2),
      documentSummary,
    });

    return {
      status:        toStatus,
      bookingId,
      recordId,
      refundAgorot,
      documents:     decisions,
      documentSummary,
    };
  },

  /**
   * handleDispute
   *
   * Call this when the payment processor raises a chargeback or dispute.
   * Transitions to "disputed" status — ops team must resolve.
   */
  async handleDispute(
    recordId: string,
    reason?:  string
  ): Promise<{ status: "disputed"; recordId: string }> {
    await EscrowStateMachine.dispute(recordId, reason);
    logger.warn("[BillingEngine] Dispute raised", { recordId, reason });
    return { status: "disputed", recordId };
  },
};

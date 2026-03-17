/**
 * PetWash™ TransactionEngine — Central Payment Orchestrator
 * ============================================================
 * Implements all 4 monetary flows defined in the Israeli payment spec:
 *
 *   Flow A — K9000 Direct Sale (MACHINE_DIRECT_SALE)
 *     Nayax charges full amount → PetWash owes VAT on full gross
 *
 *   Flow B — Wallet Top-Up (WALLET_TOPUP)
 *     Customer pre-funds wallet → VAT event is DEFERRED until redemption
 *     (deferred_liability mode — confirm with company VAT advisor before switching)
 *
 *   Flow C — Wallet Redemption at K9000 (WALLET_REDEEM_K9000)
 *     Prestige Pass / wallet credits consumed → VAT event triggered NOW
 *
 *   Flow D — Provider Booking (PROVIDER_BOOKING_CHARGE)
 *     Two commercial sub-modes per vertical config:
 *       D1: MARKETPLACE_COMMISSION — VAT only on platform commission
 *       D2: PRINCIPAL              — VAT on full gross; provider is sub-contractor
 *
 * ARCHITECTURE RULES:
 *   - VAT math is ALWAYS delegated to VATCalculatorService (never inline)
 *   - Wallet operations are ALWAYS delegated to WalletEngine (never inline)
 *   - Every call produces exactly ONE row in pw_payments
 *   - Every provider booking produces ONE row in pw_provider_payouts
 *   - Idempotency: duplicate calls with same idempotencyKey return the cached result
 *   - All amounts stored as INTEGER CENTS (ILS × 100)
 *
 * DO NOT import or re-implement VAT math here.
 * DO NOT import or re-implement wallet deduction here.
 * Both exist in dedicated services — call them.
 */

import { nanoid } from 'nanoid';
import { db } from '../db';
import { pwPayments, pwProviderPayouts } from '@shared/schema-payments';
import { eq, and, sql } from 'drizzle-orm';
import { TRANSACTION_TYPES } from '@shared/finance-flow-types';
import VATCalculator, { ISRAELI_VAT_RATE } from './VATCalculatorService';
import { applyDeduction, topUpCashWallet } from './WalletEngine';
import { logger } from '../lib/logger';
import { issueTaxDocument } from './TaxDocumentService';

// ── Per-Vertical Commercial Model Config ─────────────────────────────────────

export type CommercialModel = 'MARKETPLACE_COMMISSION' | 'PRINCIPAL';

export interface VerticalConfig {
  /** How the platform earns: keeps commission (marketplace) or buys+resells (principal) */
  commercialModel: CommercialModel;
  /** Commission rate — used only for MARKETPLACE_COMMISSION */
  commissionRate: number;
  /** VAT event timing for stored-value products on this vertical */
  vatMode: 'deferred_liability' | 'taxable_sale';
  /** Nayax processor fee rate */
  processorFeeRate: number;
}

/**
 * Authoritative per-vertical config.
 * Update commissionRate or commercialModel here — nowhere else.
 */
export const VERTICAL_CONFIG: Record<string, VerticalConfig> = {
  'k9000':          { commercialModel: 'PRINCIPAL',              commissionRate: 0,    vatMode: 'taxable_sale',       processorFeeRate: 0.015 },
  'sitter-suite':   { commercialModel: 'MARKETPLACE_COMMISSION', commissionRate: 0.15, vatMode: 'deferred_liability', processorFeeRate: 0.015 },
  'walk-my-pet':    { commercialModel: 'MARKETPLACE_COMMISSION', commissionRate: 0.15, vatMode: 'deferred_liability', processorFeeRate: 0.015 },
  'pettrek':        { commercialModel: 'MARKETPLACE_COMMISSION', commissionRate: 0.15, vatMode: 'deferred_liability', processorFeeRate: 0.015 },
  'pet-wash-hub':   { commercialModel: 'MARKETPLACE_COMMISSION', commissionRate: 0.15, vatMode: 'deferred_liability', processorFeeRate: 0.015 },
  'paw-finder':     { commercialModel: 'MARKETPLACE_COMMISSION', commissionRate: 0.15, vatMode: 'deferred_liability', processorFeeRate: 0.015 },
  'plush-lab':      { commercialModel: 'MARKETPLACE_COMMISSION', commissionRate: 0.15, vatMode: 'deferred_liability', processorFeeRate: 0.015 },
  'wallet':         { commercialModel: 'PRINCIPAL',              commissionRate: 0,    vatMode: 'deferred_liability', processorFeeRate: 0.015 },
  'egift':          { commercialModel: 'PRINCIPAL',              commissionRate: 0,    vatMode: 'deferred_liability', processorFeeRate: 0.015 },
};

function getVerticalConfig(vertical: string): VerticalConfig {
  return VERTICAL_CONFIG[vertical] ?? {
    commercialModel: 'MARKETPLACE_COMMISSION',
    commissionRate: 0.15,
    vatMode: 'deferred_liability',
    processorFeeRate: 0.015,
  };
}

// ── Document Requirements (Spec Sections 3–8) ────────────────────────────────
//
// These rules are the core legal logic of the Israeli spec.
// Every transaction type has a fixed set of required documents.
// NEVER deviate from this table without legal approval.
//
// Section 3: DIRECT_MACHINE_PAYMENT → vat_required=true,  invoice_required=true
// Section 4: WALLET_TOPUP           → vat_required=false, receipt_required=true
// Section 5: WALLET_USAGE           → vat_required=true,  invoice_required=true
// Section 6: GIFT_PURCHASE          → vat_required=false, receipt_required=true
// Section 7: GIFT_REDEEM            → vat_required=true,  invoice_required=true
// Section 8: PROVIDER_SERVICE       → vat_required=true,  dual invoices required

export interface DocumentRequirements {
  vatRequired: boolean;        // VAT event occurs now — issue חשבונית מס
  invoiceRequired: boolean;    // Tax invoice must be issued to customer
  receiptRequired: boolean;    // Simple receipt issued (no VAT event — stored value)
  commissionInvoiceRequired: boolean; // Pet Wash issues commission invoice TO provider
}

export function getDocumentRequirements(transactionType: string): DocumentRequirements {
  switch (transactionType) {

    // ── VAT NOW — tax invoice to customer ───────────────────────────────────
    case TRANSACTION_TYPES.MACHINE_DIRECT_SALE:
    case TRANSACTION_TYPES.WALLET_REDEEM_K9000:
    case TRANSACTION_TYPES.WALLET_REDEEM_ONLINE:
    case TRANSACTION_TYPES.WALLET_REDEMPTION:
    case TRANSACTION_TYPES.DIRECT_PLATFORM_SALE:
      return { vatRequired: true, invoiceRequired: true, receiptRequired: false, commissionInvoiceRequired: false };

    // ── VAT NOW + commission invoice (provider booking) ─────────────────────
    case TRANSACTION_TYPES.PROVIDER_BOOKING_CHARGE:
    case TRANSACTION_TYPES.MARKETPLACE_BOOKING:
      return { vatRequired: true, invoiceRequired: true, receiptRequired: false, commissionInvoiceRequired: true };

    // ── NO VAT NOW — stored value / deferred liability ───────────────────────
    // Receipt issued; VAT event fires at redemption
    case TRANSACTION_TYPES.WALLET_TOPUP:
    case TRANSACTION_TYPES.EGIFT_SALE:
      return { vatRequired: false, invoiceRequired: false, receiptRequired: true, commissionInvoiceRequired: false };

    // ── Other types — no customer-facing document ────────────────────────────
    default:
      return { vatRequired: false, invoiceRequired: false, receiptRequired: false, commissionInvoiceRequired: false };
  }
}

// ── Spec-compatible transaction type aliases ──────────────────────────────────
// The attached spec uses different names — map them for callers that follow the spec doc.
export const SPEC_TRANSACTION_TYPE = {
  DIRECT_MACHINE_PAYMENT: TRANSACTION_TYPES.MACHINE_DIRECT_SALE,
  WALLET_USAGE:           TRANSACTION_TYPES.WALLET_REDEEM_K9000,
  GIFT_PURCHASE:          TRANSACTION_TYPES.EGIFT_SALE,
  GIFT_REDEEM:            TRANSACTION_TYPES.WALLET_REDEEM_ONLINE,
  PROVIDER_SERVICE:       TRANSACTION_TYPES.PROVIDER_BOOKING_CHARGE,
  PROVIDER_COMMISSION:    TRANSACTION_TYPES.PROVIDER_COMMISSION,
  WALLET_TOPUP:           TRANSACTION_TYPES.WALLET_TOPUP,
} as const;

// ── Shared helpers ─────────────────────────────────────────────────────────────

/** Round to 2 decimal places (for display / storage pre-conversion) */
function ils(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Convert ILS to cents — always use this, never multiply directly */
function toCents(ils: number): number {
  return Math.round(ils * 100);
}

function genPaymentId(): string {
  return `PW-PAY-${new Date().getFullYear()}-${nanoid(8).toUpperCase()}`;
}

function genPayoutId(): string {
  return `PW-POUT-${new Date().getFullYear()}-${nanoid(8).toUpperCase()}`;
}

// ── Idempotency guard ──────────────────────────────────────────────────────────
//
// SECURITY (Architect finding — HIGH):
//   idempotency_key is now composite-scoped per (customer_id, key).
//   The old global-unique lookup allowed cross-user key collisions.
//   Authenticated flows MUST pass customerId; anonymous flows use key-only.
//
async function findByIdempotencyKey(
  key: string,
  customerId?: string | null,
): Promise<typeof pwPayments.$inferSelect | null> {
  const [existing] = await db
    .select()
    .from(pwPayments)
    .where(
      customerId
        ? and(eq(pwPayments.idempotencyKey, key), eq(pwPayments.customerId, customerId))
        : and(eq(pwPayments.idempotencyKey, key), sql`customer_id IS NULL`),
    )
    .limit(1);
  return existing ?? null;
}

// ── Result types ───────────────────────────────────────────────────────────────

export interface PaymentResult {
  paymentId: string;
  idempotent: boolean;           // true = was a duplicate request, returned cached row
  grossCents: number;
  vatCents: number;
  netRevenueCents: number;
  processorFeeCents: number;
  platformFeeCents: number;
  status: string;
}

export interface ProviderBookingResult extends PaymentResult {
  payoutId: string;
  providerGrossCents: number;
  providerPayoutCents: number;
  commissionCents: number;
  requiresProviderTaxInvoice: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FLOW A — K9000 Direct Sale (machine_direct_sale)
// ═══════════════════════════════════════════════════════════════════════════════

export interface FlowAParams {
  machineId: string;
  nayaxTransactionId: string;
  grossILS: number;             // VAT-inclusive amount Nayax collected
  idempotencyKey?: string;
  customerId?: string;          // null for anonymous
  metadata?: Record<string, unknown>;
}

/**
 * Flow A: K9000 machine direct sale.
 * PetWash is the sole seller. VAT owed on full gross.
 * Uses VATCalculatorService.calculateDirectSaleVAT — no duplication.
 */
export async function processK9000DirectSale(params: FlowAParams): Promise<PaymentResult> {
  if (params.idempotencyKey) {
    const cached = await findByIdempotencyKey(params.idempotencyKey, params.customerId);
    if (cached) {
      logger.info('[TransactionEngine] Flow A — idempotent hit', { key: params.idempotencyKey });
      return toPaymentResult(cached, true);
    }
  }

  const vat = VATCalculator.calculateDirectSaleVAT(params.grossILS);
  const config = getVerticalConfig('k9000');
  const processorFeeCents = toCents(ils(params.grossILS * config.processorFeeRate));
  const grossCents = toCents(params.grossILS);
  const vatCents = toCents(vat.vatOwed);
  const netRevenueCents = toCents(vat.netRevenue) - processorFeeCents;

  const paymentId = genPaymentId();

  const [row] = await db.insert(pwPayments).values({
    paymentId,
    idempotencyKey: params.idempotencyKey ?? null,
    transactionType: TRANSACTION_TYPES.MACHINE_DIRECT_SALE,
    vertical: 'k9000',
    commercialModel: 'PRINCIPAL',
    customerId: params.customerId ?? null,
    providerId: null,
    machineId: params.machineId,
    grossCents,
    vatCents,
    platformFeeCents: grossCents,              // PetWash keeps 100%
    processorFeeCents,
    providerGrossCents: 0,
    providerPayoutCents: 0,
    netRevenueCents,
    vatRate: String(ISRAELI_VAT_RATE),
    vatMode: null,
    requiresProviderTaxInvoice: false,
    paymentMethod: 'nayax_terminal',
    paymentProcessor: 'nayax',
    walletUsed: false,
    nayaxTransactionId: params.nayaxTransactionId,
    status: 'settled',
    settledAt: new Date(),
    metadata: params.metadata ?? null,
  }).returning();

  // Issue first-class receipt document (Spec §5.1 / §8)
  await issueTaxDocument({
    documentType: 'RECEIPT',
    relatedPaymentId: paymentId,
    customerId: params.customerId ?? undefined,
    machineId: params.machineId,
    grossCents,
    vatCents,
    netCents: netRevenueCents,
    payload: { transactionType: TRANSACTION_TYPES.MACHINE_DIRECT_SALE, nayaxTransactionId: params.nayaxTransactionId },
  });

  logger.info('[TransactionEngine] Flow A settled', {
    paymentId,
    machineId: params.machineId,
    grossILS: params.grossILS,
    vatOwed: vat.vatOwed,
    netRevenue: vat.netRevenue,
  });

  return toPaymentResult(row, false);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FLOW B — Wallet Top-Up (wallet_topup)
// ═══════════════════════════════════════════════════════════════════════════════

export interface FlowBParams {
  customerId: string;
  grossILS: number;
  nayaxTransactionId?: string;
  machineId?: string;           // K9000 terminal where top-up was initiated (optional)
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Flow B: Customer funds their wallet.
 * VAT event is DEFERRED — no VAT recorded at top-up time.
 * Balance is credited via WalletEngine.topUpCashWallet — no duplication.
 */
export async function processWalletTopUp(params: FlowBParams): Promise<PaymentResult> {
  if (params.idempotencyKey) {
    const cached = await findByIdempotencyKey(params.idempotencyKey, params.customerId);
    if (cached) {
      logger.info('[TransactionEngine] Flow B — idempotent hit', { key: params.idempotencyKey });
      return toPaymentResult(cached, true);
    }
  }

  const config = getVerticalConfig('wallet');
  const grossCents = toCents(params.grossILS);
  const processorFeeCents = toCents(ils(params.grossILS * config.processorFeeRate));

  // VAT is DEFERRED on wallet top-up (liability recognised at redemption)
  const vatCents = 0;
  const netRevenueCents = 0; // Platform has a LIABILITY equal to grossCents - processorFee

  // Credit wallet — uses WalletEngine, NOT re-implemented here
  const walletResult = await topUpCashWallet(
    params.customerId,
    grossCents,
    'nayax_payment',
    params.nayaxTransactionId,
    { idempotencyKey: params.idempotencyKey },
  );

  const paymentId = genPaymentId();

  const [row] = await db.insert(pwPayments).values({
    paymentId,
    idempotencyKey: params.idempotencyKey ?? null,
    transactionType: TRANSACTION_TYPES.WALLET_TOPUP,
    vertical: 'wallet',
    commercialModel: 'PRINCIPAL',
    customerId: params.customerId,
    providerId: null,
    machineId: null,
    grossCents,
    vatCents,
    platformFeeCents: 0,
    processorFeeCents,
    providerGrossCents: 0,
    providerPayoutCents: 0,
    netRevenueCents,
    vatRate: String(ISRAELI_VAT_RATE),
    vatMode: 'deferred_liability',
    requiresProviderTaxInvoice: false,
    paymentMethod: 'nayax_terminal',
    paymentProcessor: 'nayax',
    walletUsed: false,
    nayaxTransactionId: params.nayaxTransactionId ?? null,
    walletLedgerEntryId: walletResult.txnId,
    status: 'credited_to_wallet',
    settledAt: new Date(),
    metadata: params.metadata ?? null,
  }).returning();

  // Issue top-up receipt — no VAT event, stored-value liability (Spec §5.2 / §4.3)
  await issueTaxDocument({
    documentType: 'TOPUP_RECEIPT',
    relatedPaymentId: paymentId,
    customerId: params.customerId,
    machineId: params.machineId,
    grossCents,
    vatCents: 0,
    netCents: 0,
    payload: {
      transactionType: TRANSACTION_TYPES.WALLET_TOPUP,
      vatMode: 'deferred_liability',
      note: 'Stored value top-up. VAT event deferred to redemption.',
      nayaxTransactionId: params.nayaxTransactionId,
    },
  });

  logger.info('[TransactionEngine] Flow B — wallet topped up', {
    paymentId,
    customerId: params.customerId,
    grossCents,
    walletTxnId: walletResult.txnId,
  });

  return toPaymentResult(row, false);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FLOW C — Wallet Redemption at K9000 (wallet_redeem_k9000)
// ═══════════════════════════════════════════════════════════════════════════════

export interface FlowCParams {
  customerId: string;
  machineId: string;
  amountILS: number;         // 0 = package-wash (unit-based); >0 = cash-wallet deduction
  isKioskWash: boolean;
  bookingId?: string;
  jti?: string;
  idempotencyKey?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Flow C: Prestige Pass or wallet redeemed at a K9000 machine.
 * VAT event is triggered NOW (deferred liability becomes current).
 * Wallet deduction via WalletEngine.applyDeduction — no duplication.
 */
export async function processWalletRedeemK9000(params: FlowCParams): Promise<PaymentResult> {
  if (params.idempotencyKey) {
    const cached = await findByIdempotencyKey(params.idempotencyKey, params.customerId);
    if (cached) {
      logger.info('[TransactionEngine] Flow C — idempotent hit', { key: params.idempotencyKey });
      return toPaymentResult(cached, true);
    }
  }

  // Deduct via WalletEngine (anti-fraud, idempotency, ledger — already there)
  const deduction = await applyDeduction({
    userId:         params.customerId,
    amountCents:    toCents(params.amountILS),
    isKioskWash:    params.isKioskWash,
    serviceType:    'k9000',
    machineId:      params.machineId,
    bookingId:      params.bookingId,
    jti:            params.jti,
    idempotencyKey: params.idempotencyKey,
    ipAddress:      params.ipAddress,
    userAgent:      params.userAgent,
    description:    `K9000 wallet redemption — machine ${params.machineId}`,
  });

  // VAT event now triggered on the consumed amount
  const grossCents = deduction.deductedCents;
  const vatOnRedemptionILS = params.isKioskWash
    ? 0  // package-wash: no monetary value, VAT handled at top-up time
    : ils((grossCents / 100) * (ISRAELI_VAT_RATE / (1 + ISRAELI_VAT_RATE)));
  const vatCents = toCents(vatOnRedemptionILS);
  const netRevenueCents = grossCents - vatCents;

  const paymentId = genPaymentId();

  const [row] = await db.insert(pwPayments).values({
    paymentId,
    idempotencyKey: params.idempotencyKey ?? null,
    transactionType: TRANSACTION_TYPES.WALLET_REDEEM_K9000,
    vertical: 'k9000',
    commercialModel: 'PRINCIPAL',
    customerId: params.customerId,
    machineId: params.machineId,
    providerId: null,
    grossCents,
    vatCents,
    platformFeeCents: grossCents,
    processorFeeCents: 0,
    providerGrossCents: 0,
    providerPayoutCents: 0,
    netRevenueCents,
    vatRate: String(ISRAELI_VAT_RATE),
    vatMode: 'deferred_liability',
    requiresProviderTaxInvoice: false,
    paymentMethod: 'wallet',
    paymentProcessor: 'internal',
    walletUsed: true,
    bookingId: params.bookingId ?? null,
    walletLedgerEntryId: deduction.txnId,
    status: 'consumed',
    settledAt: new Date(),
    metadata: params.metadata ?? null,
  }).returning();

  // Issue חשבונית מס — VAT event now triggered on redemption (Spec §5.3 / §2.3)
  await issueTaxDocument({
    documentType: 'TAX_INVOICE',
    relatedPaymentId: paymentId,
    customerId: params.customerId,
    machineId: params.machineId,
    bookingId: params.bookingId,
    grossCents,
    vatCents,
    netCents: netRevenueCents,
    payload: {
      transactionType: TRANSACTION_TYPES.WALLET_REDEEM_K9000,
      vatMode: 'deferred_liability_now_triggered',
      isKioskWash: params.isKioskWash,
      walletLedgerEntryId: deduction.txnId,
    },
  });

  logger.info('[TransactionEngine] Flow C — wallet redeemed at K9000', {
    paymentId,
    customerId: params.customerId,
    machineId: params.machineId,
    grossCents,
    vatCents,
    source: deduction.source,
    idempotent: deduction.idempotent,
  });

  return toPaymentResult(row, deduction.idempotent);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FLOW D — Provider Booking (provider_booking_charge)
// ═══════════════════════════════════════════════════════════════════════════════

export interface FlowDParams {
  vertical: string;
  customerId: string;
  providerId: string;
  bookingId: string;
  grossILS: number;
  nayaxTransactionId?: string;
  providerIsExempt?: boolean;    // עוסק פטור — cannot issue tax invoice
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Flow D: Customer pays for a provider service (booking).
 *
 * D1 — MARKETPLACE_COMMISSION:
 *   PetWash keeps commission; provider receives gross minus commission.
 *   VAT owed = VAT on commission only (Wolt / Uber model — סוכן בלתי מגולה).
 *
 * D2 — PRINCIPAL:
 *   PetWash is the seller; provider is sub-contractor.
 *   VAT owed = VAT on full gross. Provider invoices PetWash separately.
 *
 * VAT math delegated to VATCalculatorService — no re-implementation.
 * Creates ONE pw_payments row + ONE pw_provider_payouts row.
 */
export async function processProviderBooking(params: FlowDParams): Promise<ProviderBookingResult> {
  if (params.idempotencyKey) {
    const cached = await findByIdempotencyKey(params.idempotencyKey, params.customerId);
    if (cached) {
      logger.info('[TransactionEngine] Flow D — idempotent hit', { key: params.idempotencyKey });
      // Find associated payout
      const [payout] = await db
        .select()
        .from(pwProviderPayouts)
        .where(eq(pwProviderPayouts.paymentId, cached.paymentId))
        .limit(1);
      return toProviderBookingResult(cached, payout, true);
    }
  }

  const config = getVerticalConfig(params.vertical);
  const processorFeeCents = toCents(ils(params.grossILS * config.processorFeeRate));
  const paymentId = genPaymentId();
  const payoutId = genPayoutId();

  let grossCents: number;
  let vatCents: number;
  let platformFeeCents: number;
  let providerGrossCents: number;
  let providerPayoutCents: number;
  let commissionCents: number;
  let requiresProviderTaxInvoice: boolean;

  if (config.commercialModel === 'MARKETPLACE_COMMISSION') {
    // D1 — Marketplace (סוכן בלתי מגולה)
    const vat = VATCalculator.calculateMarketplaceVAT(params.grossILS, config.commissionRate);
    grossCents          = toCents(vat.grossCollectedILS);
    vatCents            = toCents(vat.vatOnPlatformFee);
    platformFeeCents    = toCents(vat.platformFeeGross);
    providerGrossCents  = toCents(vat.providerGross);
    providerPayoutCents = toCents(vat.providerNet);
    commissionCents     = toCents(vat.platformFeeGross);
    requiresProviderTaxInvoice = !params.providerIsExempt;
  } else {
    // D2 — Principal
    const vat = VATCalculator.calculateDirectSaleVAT(params.grossILS);
    grossCents          = toCents(vat.grossCollectedILS);
    vatCents            = toCents(vat.vatOwed);
    platformFeeCents    = grossCents;
    providerGrossCents  = 0;
    providerPayoutCents = 0;
    commissionCents     = 0;
    requiresProviderTaxInvoice = false;
  }

  const netRevenueCents = config.commercialModel === 'MARKETPLACE_COMMISSION'
    ? toCents(ils(params.grossILS * config.commissionRate * (1 - ISRAELI_VAT_RATE / (1 + ISRAELI_VAT_RATE)))) - processorFeeCents
    : grossCents - vatCents - processorFeeCents;

  // ── Atomic: inserts + tax documents in a single DB transaction ───────────────
  // CRITICAL (Architect finding): pw_payments and pw_provider_payouts must
  // rollback atomically if either required tax document cannot be issued.
  // issueTaxDocument uses the global db connection, so if it fails (returns null)
  // we throw inside the transaction, which rolls back both insert rows.
  return await db.transaction(async (tx) => {
    const escrowReleaseAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // +72h

    // ── Insert pw_payments ─────────────────────────────────────────────────────
    const [payRow] = await tx.insert(pwPayments).values({
      paymentId,
      idempotencyKey: params.idempotencyKey ?? null,
      transactionType: TRANSACTION_TYPES.PROVIDER_BOOKING_CHARGE,
      vertical: params.vertical,
      commercialModel: config.commercialModel,
      customerId: params.customerId,
      providerId: params.providerId,
      machineId: null,
      grossCents,
      vatCents,
      platformFeeCents,
      processorFeeCents,
      providerGrossCents,
      providerPayoutCents,
      netRevenueCents,
      vatRate: String(ISRAELI_VAT_RATE),
      vatMode: config.vatMode,
      requiresProviderTaxInvoice,
      paymentMethod: 'nayax_terminal',
      paymentProcessor: 'nayax',
      walletUsed: false,
      bookingId: params.bookingId,
      nayaxTransactionId: params.nayaxTransactionId ?? null,
      status: 'captured',
      metadata: params.metadata ?? null,
    }).returning();

    // ── Insert pw_provider_payouts ─────────────────────────────────────────────
    const [payoutRow] = await tx.insert(pwProviderPayouts).values({
      payoutId,
      paymentId,
      providerId: params.providerId,
      vertical: params.vertical,
      commercialModel: config.commercialModel,
      grossCents: providerGrossCents,
      vatInShareCents: toCents(ils((providerGrossCents / 100) * (ISRAELI_VAT_RATE / (1 + ISRAELI_VAT_RATE)))),
      netCents: providerPayoutCents,
      commissionCents,
      commissionRate: String(config.commissionRate),
      requiresTaxInvoice: requiresProviderTaxInvoice,
      providerIsExempt: params.providerIsExempt ?? false,
      status: 'held_in_escrow',
      escrowReleaseAt,
      metadata: params.metadata ?? null,
    }).returning();

    // Issue customer tax invoice (Spec §5.4)
    const customerTaxDocId = await issueTaxDocument({
      documentType: 'TAX_INVOICE',
      relatedPaymentId: paymentId,
      bookingId: params.bookingId,
      customerId: params.customerId,
      providerId: params.providerId,
      grossCents,
      vatCents,
      netCents: netRevenueCents,
      payload: {
        transactionType: TRANSACTION_TYPES.PROVIDER_BOOKING_CHARGE,
        commercialModel: config.commercialModel,
        vertical: params.vertical,
      },
    });
    if (!customerTaxDocId) {
      throw new Error(
        `[TransactionEngine] Flow D aborted: customer TAX_INVOICE could not be issued for payment ${paymentId}. ` +
        'DB transaction rolled back — no off-books financial event recorded.',
      );
    }

    // Issue commission invoice to provider (marketplace only — Spec §5.4 / §12)
    if (config.commercialModel === 'MARKETPLACE_COMMISSION' && commissionCents > 0) {
      const commissionVatCents = Math.round(commissionCents * (ISRAELI_VAT_RATE / (1 + ISRAELI_VAT_RATE)));
      const commissionTaxDocId = await issueTaxDocument({
        documentType: 'COMMISSION_INVOICE',
        relatedPaymentId: paymentId,
        relatedPayoutId: payoutId,
        bookingId: params.bookingId,
        providerId: params.providerId,
        grossCents: commissionCents,
        vatCents: commissionVatCents,
        netCents: commissionCents - commissionVatCents,
        payload: {
          transactionType: TRANSACTION_TYPES.PROVIDER_COMMISSION,
          commissionRate: String(config.commissionRate),
          providerPayoutCents,
          providerIsExempt: params.providerIsExempt ?? false,
        },
      });
      if (!commissionTaxDocId) {
        throw new Error(
          `[TransactionEngine] Flow D aborted: COMMISSION_INVOICE could not be issued for payout ${payoutId}. ` +
          'DB transaction rolled back — no off-books financial event recorded.',
        );
      }
    }

    logger.info('[TransactionEngine] Flow D — provider booking captured', {
      paymentId,
      payoutId,
      vertical: params.vertical,
      commercialModel: config.commercialModel,
      grossCents,
      vatCents,
      commissionCents,
      providerPayoutCents,
      escrowReleaseAt,
    });

    return toProviderBookingResult(payRow, payoutRow, false);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Mutation helpers — Reversal / Cancellation / Expiry Breakage
// ═══════════════════════════════════════════════════════════════════════════════

/** Mark a payment as reversed and write a mirror reversal entry */
export async function processReversal(params: {
  originalPaymentId: string;
  reason: string;
  initiatedBy: string;
  idempotencyKey?: string;
}): Promise<{ reversalPaymentId: string }> {
  // Idempotency check is intentionally inside the transaction so it can be
  // scoped by original.customerId — the composite index requires (customer_id, key).
  return await db.transaction(async (tx) => {
    const [original] = await tx
      .select()
      .from(pwPayments)
      .where(eq(pwPayments.paymentId, params.originalPaymentId))
      .for('update')
      .limit(1);

    if (params.idempotencyKey && original) {
      const [cached] = await tx
        .select()
        .from(pwPayments)
        .where(
          and(
            eq(pwPayments.idempotencyKey, params.idempotencyKey),
            original.customerId
              ? eq(pwPayments.customerId, original.customerId)
              : sql`customer_id IS NULL`,
          ),
        )
        .limit(1);
      if (cached) {
        logger.info('[TransactionEngine] Reversal — idempotent hit', { key: params.idempotencyKey });
        return { reversalPaymentId: cached.paymentId };
      }
    }

    if (!original) throw new Error(`[TransactionEngine] Reversal: payment not found — ${params.originalPaymentId}`);
    if (original.status === 'reversed') throw new Error(`[TransactionEngine] Already reversed — ${params.originalPaymentId}`);
    if (original.status === 'chargeback') throw new Error(`[TransactionEngine] Cannot reverse: payment already chargebacked — ${params.originalPaymentId}`);

    // Negate original amounts for the reversal entry
    const paymentId = genPaymentId();

    const [reversalRow] = await tx.insert(pwPayments).values({
      paymentId,
      idempotencyKey: params.idempotencyKey ?? null,
      transactionType: TRANSACTION_TYPES.REVERSAL,
      vertical: original.vertical,
      commercialModel: original.commercialModel,
      customerId: original.customerId,
      providerId: original.providerId,
      machineId: original.machineId,
      grossCents:          -(original.grossCents ?? 0),
      vatCents:            -(original.vatCents ?? 0),
      platformFeeCents:    -(original.platformFeeCents ?? 0),
      processorFeeCents:   -(original.processorFeeCents ?? 0),
      providerGrossCents:  -(original.providerGrossCents ?? 0),
      providerPayoutCents: -(original.providerPayoutCents ?? 0),
      netRevenueCents:     -(original.netRevenueCents ?? 0),
      vatRate: original.vatRate ?? String(ISRAELI_VAT_RATE),
      requiresProviderTaxInvoice: false,
      bookingId: original.bookingId,
      status: 'reversed',
      reversedAt: new Date(),
      metadata: { originalPaymentId: params.originalPaymentId, reason: params.reason, initiatedBy: params.initiatedBy },
    }).returning();

    // Mark original as reversed
    await tx.update(pwPayments)
      .set({ status: 'reversed', reversedAt: new Date() })
      .where(eq(pwPayments.paymentId, params.originalPaymentId));

    // Issue credit note (Spec §13 — reversals create a credit note).
    // CRITICAL (Architect finding): if the tax document cannot be issued, the
    // entire DB transaction must rollback — the reversal row and the original-
    // payment status update must not survive without an audit trail.
    const reversalTaxDocId = await issueTaxDocument({
      documentType: 'CREDIT_NOTE',
      relatedPaymentId: paymentId,
      customerId: original.customerId ?? undefined,
      providerId: original.providerId ?? undefined,
      grossCents: Math.abs(original.grossCents ?? 0),
      vatCents:   Math.abs(original.vatCents ?? 0),
      netCents:   Math.abs(original.netRevenueCents ?? 0),
      payload: {
        transactionType: TRANSACTION_TYPES.REVERSAL,
        originalPaymentId: params.originalPaymentId,
        reason: params.reason,
        initiatedBy: params.initiatedBy,
      },
    });
    if (!reversalTaxDocId) {
      throw new Error(
        `[TransactionEngine] Reversal aborted: tax document (CREDIT_NOTE) could not be issued for payment ${paymentId}. ` +
        'DB transaction rolled back — no off-books financial event recorded.',
      );
    }

    logger.info('[TransactionEngine] Reversal processed', {
      originalPaymentId: params.originalPaymentId,
      reversalPaymentId: paymentId,
      reason: params.reason,
    });

    return { reversalPaymentId: paymentId };
  });
}

/** Record expiry of unredeemed wallet / voucher balance as platform revenue */
export async function processExpiryBreakage(params: {
  customerId: string;
  expiredCents: number;
  expirySource: 'wallet' | 'voucher' | 'promo';
  metadata?: Record<string, unknown>;
}): Promise<PaymentResult> {
  const paymentId = genPaymentId();

  // Breakage = platform revenue; VAT is debatable (consult VAT advisor)
  // Conservatively: apply VAT on breakage (same as taxable_sale)
  const vatCents = toCents(ils((params.expiredCents / 100) * (ISRAELI_VAT_RATE / (1 + ISRAELI_VAT_RATE))));

  const [row] = await db.insert(pwPayments).values({
    paymentId,
    transactionType: TRANSACTION_TYPES.EXPIRY_BREAKAGE,
    vertical: params.expirySource,
    commercialModel: 'PRINCIPAL',
    customerId: params.customerId,
    grossCents: params.expiredCents,
    vatCents,
    platformFeeCents: params.expiredCents,
    processorFeeCents: 0,
    providerGrossCents: 0,
    providerPayoutCents: 0,
    netRevenueCents: params.expiredCents - vatCents,
    vatRate: String(ISRAELI_VAT_RATE),
    requiresProviderTaxInvoice: false,
    status: 'settled',
    settledAt: new Date(),
    metadata: params.metadata ?? null,
  }).returning();

  // Issue tax invoice for breakage recognised as revenue (Spec §4.4 note — deferred VAT now due)
  await issueTaxDocument({
    documentType: 'TAX_INVOICE',
    relatedPaymentId: paymentId,
    customerId: params.customerId,
    grossCents: params.expiredCents,
    vatCents,
    netCents: params.expiredCents - vatCents,
    payload: {
      transactionType: TRANSACTION_TYPES.EXPIRY_BREAKAGE,
      expirySource: params.expirySource,
      note: 'Expired wallet/voucher balance recognised as revenue',
    },
  });

  logger.info('[TransactionEngine] Expiry breakage recognised', {
    paymentId,
    customerId: params.customerId,
    expiredCents: params.expiredCents,
  });

  return toPaymentResult(row, false);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHARGEBACK — Spec Section 6 (CHARGEBACK type) + Section 13
// ═══════════════════════════════════════════════════════════════════════════════

export interface ChargebackParams {
  originalPaymentId: string;
  chargebackTransactionId: string;
  reason: string;
  reportedBy?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Record a chargeback from the card network.
 * - Negates the original payment amounts in pw_payments
 * - Updates original payment status to 'chargeback'
 * - Issues a CHARGEBACK_NOTICE tax document
 */
export async function processChargeback(params: ChargebackParams & { idempotencyKey?: string }): Promise<{ chargebackPaymentId: string; taxDocId: string | null }> {
  // Idempotency check is intentionally inside the transaction so it can be
  // scoped by original.customerId — the composite index requires (customer_id, key).
  return await db.transaction(async (tx) => {
    const [original] = await tx
      .select()
      .from(pwPayments)
      .where(eq(pwPayments.paymentId, params.originalPaymentId))
      .for('update')
      .limit(1);

    if (params.idempotencyKey && original) {
      const [cached] = await tx
        .select()
        .from(pwPayments)
        .where(
          and(
            eq(pwPayments.idempotencyKey, params.idempotencyKey),
            original.customerId
              ? eq(pwPayments.customerId, original.customerId)
              : sql`customer_id IS NULL`,
          ),
        )
        .limit(1);
      if (cached) {
        logger.info('[TransactionEngine] Chargeback — idempotent hit', { key: params.idempotencyKey });
        const taxDoc = await getTaxDocByPaymentId(cached.paymentId);
        return { chargebackPaymentId: cached.paymentId, taxDocId: taxDoc?.taxDocId ?? null };
      }
    }

    if (!original) throw new Error(`[TransactionEngine] Chargeback: payment not found — ${params.originalPaymentId}`);
    if (original.status === 'chargeback') throw new Error(`[TransactionEngine] Already chargebacked — ${params.originalPaymentId}`);
    if (original.status === 'reversed') throw new Error(`[TransactionEngine] Cannot chargeback: payment already reversed — ${params.originalPaymentId}`);

    const paymentId = genPaymentId();

    const [chargebackRow] = await tx.insert(pwPayments).values({
      paymentId,
      idempotencyKey: params.idempotencyKey ?? null,
      transactionType: TRANSACTION_TYPES.CHARGEBACK,
      vertical: original.vertical,
      commercialModel: original.commercialModel,
      customerId: original.customerId,
      providerId: original.providerId,
      machineId: original.machineId,
      grossCents:          -(original.grossCents ?? 0),
      vatCents:            -(original.vatCents ?? 0),
      platformFeeCents:    -(original.platformFeeCents ?? 0),
      processorFeeCents:   -(original.processorFeeCents ?? 0),
      providerGrossCents:  -(original.providerGrossCents ?? 0),
      providerPayoutCents: -(original.providerPayoutCents ?? 0),
      netRevenueCents:     -(original.netRevenueCents ?? 0),
      vatRate: original.vatRate ?? String(ISRAELI_VAT_RATE),
      requiresProviderTaxInvoice: false,
      bookingId: original.bookingId,
      nayaxTransactionId: params.chargebackTransactionId,
      status: 'chargeback',
      metadata: {
        originalPaymentId: params.originalPaymentId,
        chargebackTransactionId: params.chargebackTransactionId,
        reason: params.reason,
        reportedBy: params.reportedBy,
        ...(params.metadata ?? {}),
      },
    }).returning();

    await tx.update(pwPayments)
      .set({ status: 'chargeback' })
      .where(eq(pwPayments.paymentId, params.originalPaymentId));

    // CRITICAL (Architect finding): if the tax document cannot be issued, the
    // entire DB transaction must rollback — no off-books chargeback allowed.
    const taxDocId = await issueTaxDocument({
      documentType: 'CHARGEBACK_NOTICE',
      relatedPaymentId: paymentId,
      customerId: original.customerId ?? undefined,
      providerId: original.providerId ?? undefined,
      grossCents: Math.abs(original.grossCents ?? 0),
      vatCents:   Math.abs(original.vatCents ?? 0),
      netCents:   Math.abs(original.netRevenueCents ?? 0),
      payload: {
        transactionType: TRANSACTION_TYPES.CHARGEBACK,
        originalPaymentId: params.originalPaymentId,
        chargebackTransactionId: params.chargebackTransactionId,
        reason: params.reason,
      },
    });
    if (!taxDocId) {
      throw new Error(
        `[TransactionEngine] Chargeback aborted: tax document (CHARGEBACK_NOTICE) could not be issued for payment ${paymentId}. ` +
        'DB transaction rolled back — no off-books financial event recorded.',
      );
    }

    logger.warn('[TransactionEngine] Chargeback recorded', {
      originalPaymentId: params.originalPaymentId,
      chargebackPaymentId: paymentId,
      grossCents: original.grossCents,
      reason: params.reason,
    });

    return { chargebackPaymentId: paymentId, taxDocId };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MANUAL_ADJUSTMENT — Spec Section 6 (ADJUSTMENT type) + Section 14
// ═══════════════════════════════════════════════════════════════════════════════

export interface ManualAdjustmentParams {
  adjustmentCents: number;   // positive = credit to platform, negative = debit
  reason: string;
  adjustedBy: string;         // admin UID
  customerId?: string;
  providerId?: string;
  relatedPaymentId?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Record a manual financial adjustment authorised by an admin.
 * Every adjustment is permanently audited.
 */
export async function processManualAdjustment(params: ManualAdjustmentParams): Promise<{ adjustmentPaymentId: string; taxDocId: string | null }> {
  return await db.transaction(async (tx) => {
    const paymentId = genPaymentId();
    const vatCents = params.adjustmentCents > 0
      ? Math.round(params.adjustmentCents * (ISRAELI_VAT_RATE / (1 + ISRAELI_VAT_RATE)))
      : 0;

    const [row] = await tx.insert(pwPayments).values({
      paymentId,
      transactionType: TRANSACTION_TYPES.ADJUSTMENT,
      vertical: 'manual',
      commercialModel: 'PRINCIPAL',
      customerId: params.customerId ?? null,
      providerId: params.providerId ?? null,
      grossCents: params.adjustmentCents,
      vatCents,
      platformFeeCents: params.adjustmentCents,
      processorFeeCents: 0,
      providerGrossCents: 0,
      providerPayoutCents: 0,
      netRevenueCents: params.adjustmentCents - vatCents,
      vatRate: String(ISRAELI_VAT_RATE),
      requiresProviderTaxInvoice: false,
      status: 'settled',
      settledAt: new Date(),
      metadata: {
        adjustedBy: params.adjustedBy,
        reason: params.reason,
        notes: params.notes,
        relatedPaymentId: params.relatedPaymentId,
        ...(params.metadata ?? {}),
      },
    }).returning();

    const taxDocId = await issueTaxDocument({
      documentType: 'ADJUSTMENT_NOTE',
      relatedPaymentId: paymentId,
      customerId: params.customerId,
      providerId: params.providerId,
      grossCents: Math.abs(params.adjustmentCents),
      vatCents: Math.abs(vatCents),
      netCents: Math.abs(params.adjustmentCents - vatCents),
      payload: {
        transactionType: TRANSACTION_TYPES.ADJUSTMENT,
        adjustedBy: params.adjustedBy,
        reason: params.reason,
        notes: params.notes,
        relatedPaymentId: params.relatedPaymentId,
      },
    });

    if (!taxDocId) {
      throw new Error('[TransactionEngine] Manual adjustment failed: could not issue required tax document (ADJUSTMENT_NOTE)');
    }

    logger.info('[TransactionEngine] Manual adjustment recorded', {
      paymentId,
      adjustmentCents: params.adjustmentCents,
      adjustedBy: params.adjustedBy,
      reason: params.reason,
    });

    return { adjustmentPaymentId: paymentId, taxDocId };
  });
}

// ── Shape converters ─────────────────────────────────────────────────────────

function toPaymentResult(row: typeof pwPayments.$inferSelect, idempotent: boolean): PaymentResult {
  return {
    paymentId:        row.paymentId,
    idempotent,
    grossCents:       row.grossCents ?? 0,
    vatCents:         row.vatCents ?? 0,
    netRevenueCents:  row.netRevenueCents ?? 0,
    processorFeeCents: row.processorFeeCents ?? 0,
    platformFeeCents: row.platformFeeCents ?? 0,
    status:           row.status ?? 'created',
  };
}

function toProviderBookingResult(
  pay: typeof pwPayments.$inferSelect,
  payout: typeof pwProviderPayouts.$inferSelect | undefined,
  idempotent: boolean,
): ProviderBookingResult {
  return {
    ...toPaymentResult(pay, idempotent),
    payoutId:                    payout?.payoutId ?? '',
    providerGrossCents:          pay.providerGrossCents ?? 0,
    providerPayoutCents:         pay.providerPayoutCents ?? 0,
    commissionCents:             payout?.commissionCents ?? 0,
    requiresProviderTaxInvoice:  pay.requiresProviderTaxInvoice ?? false,
  };
}

// ── Convenience re-export for callers ─────────────────────────────────────────

export { TRANSACTION_TYPES };

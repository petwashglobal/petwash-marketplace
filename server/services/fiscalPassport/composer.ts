/**
 * FiscalTransactionPassport composer — CEO 2026-08-27 fiscal directive
 * §94 items 8-14 (Shop/K9000/eGift/wallet/sitter/walk adapters).
 *
 * READ-ONLY. Delegates every tax decision to the CPA-approved
 * `getSumitDocumentMapping()`. Never mutates. Never invents money.
 *
 * §33-parallel: does NOT create a new table. Adapts existing
 * authorities (shop_orders, k9000_wash_events, egift_guest_orders,
 * credit_transactions/walletAccounts, sitter_bookings, walk_bookings,
 * trainer_bookings). Refund/credit lineage will land in a follow-up
 * once we have a durable refund_transactions read of the SUMIT
 * document id — for now the fiscalDocument.state is derived from the
 * paid-vs-refunded flags on the source row.
 */

import { eq } from 'drizzle-orm';
import { db, pool } from '../../db';
import {
  sitterBookings,
  sitterProfiles,
  walkBookings,
  walkerProfiles,
  trainerBookings,
  k9000WashEvents,
  egiftGuestOrders,
  users,
  pettrekTrips,
  pettrekProviders,
} from '@shared/schema';
import { logger } from '../../lib/logger';
import { getSumitDocumentMapping } from '../sumitDocumentMapping';
import { composeProviderCommissionLineage, composeRefundLineage } from './lineage';
import { collectWarnings, type ReconciliationSignal } from './reconciliation';
import { guardFiscalDocument } from '../marketplace/NayaxFiscalDocumentGuard';
import { resolveMachineId } from '@shared/nayax/merchantConfigSpec';
import {
  fiscalEventKey,
  paymentClassForEvent,
  type FiscalEventCode,
} from '@shared/lib/fiscalPassport/eventRegistry';
import { generateTransactionRef } from '@shared/lib/fiscalPassport/idNamespace';
import {
  getLineItem,
  type TransactionLineItem,
  type LineItemCode,
} from '@shared/lib/fiscalPassport/lineItemCatalog';
import type {
  FiscalPassportEnvelope,
  FiscalTransactionPassport,
  FiscalActor,
  FiscalMoney,
  FundingLeg,
  FiscalPaymentBlock,
  FiscalDocumentRef,
  CommercialState,
  PaymentState,
  FiscalDocumentState,
  FulfilmentState,
  PayoutState,
  ReconciliationBlock,
} from '@shared/lib/fiscalPassport/FiscalTransactionPassport';

// ─── Public entry ────────────────────────────────────────────────────

export type FiscalSourceHint =
  | 'shop_orders'
  | 'k9000_wash_events'
  | 'egift_guest_orders_purchase'
  | 'egift_guest_orders_redemption'
  | 'wallet_topup'
  | 'sitter_bookings'
  | 'walk_bookings'
  | 'trainer_bookings'
  | 'pettrek_trips';

export interface ComposeFiscalInput {
  sourceHint: FiscalSourceHint;
  /** The primary business object id — order id / event id / booking id / topup id. */
  sourceId: string;
  viewer: FiscalActor;
}

export async function composeFiscalPassport(input: ComposeFiscalInput): Promise<FiscalPassportEnvelope | null> {
  try {
    switch (input.sourceHint) {
      case 'shop_orders':
        return await composeShopFiscal(input.sourceId, input.viewer);
      case 'k9000_wash_events':
        return await composeK9000Fiscal(input.sourceId, input.viewer);
      case 'egift_guest_orders_purchase':
        return await composeEgiftPurchaseFiscal(input.sourceId, input.viewer);
      case 'egift_guest_orders_redemption':
        return await composeEgiftRedemptionFiscal(input.sourceId, input.viewer);
      case 'wallet_topup':
        return await composeWalletTopupFiscal(input.sourceId, input.viewer);
      case 'sitter_bookings':
        return await composeSitterFiscal(input.sourceId, input.viewer);
      case 'walk_bookings':
        return await composeWalkFiscal(input.sourceId, input.viewer);
      case 'trainer_bookings':
        return await composeAcademyFiscal(input.sourceId, input.viewer);
      case 'pettrek_trips':
        return await composePettrekFiscal(input.sourceId, input.viewer);
    }
  } catch (err: any) {
    logger.error('[FiscalPassport] compose failed', {
      sourceHint: input.sourceHint,
      sourceIdTail: input.sourceId?.slice(-8),
      viewerUidTail: input.viewer.uid?.slice(-6),
      error: err?.message,
    });
    return null;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Build the fiscalDocument block by delegating to the CPA mapping.
 * NEVER decides doc type at the route level — passes the event's
 * paymentClass into getSumitDocumentMapping().
 */
function fiscalDocumentFromCPA(event: FiscalEventCode, state: FiscalDocumentState): FiscalDocumentRef {
  const cls = paymentClassForEvent(event);
  const mapping = getSumitDocumentMapping(cls);
  const required =
    mapping.documentType === 'InvoiceAndReceipt' ||
    mapping.documentType === 'Receipt' ||
    mapping.documentType === 'Invoice' ||
    mapping.documentType === 'CreditInvoice';
  return {
    required,
    documentType: mapping.documentType,
    state: required ? state : 'NOT_REQUIRED',
  };
}

/** Convert a decimal-string amount ("120.00") to integer cents. */
function decToCents(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined) return 0;
  const n = typeof raw === 'number' ? raw : parseFloat(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** Build a single-line list from a catalog code + concrete amount. */
function line(
  code: LineItemCode,
  quantity: number,
  unitCents: number,
  vatTreatment: TransactionLineItem['vatTreatment'],
  sourceType?: TransactionLineItem['sourceType'],
  sourceId?: string,
): TransactionLineItem {
  const def = getLineItem(code)!;
  return {
    code,
    descriptionHe: def.descriptionHe,
    descriptionEn: def.descriptionEn,
    unit: def.unit,
    quantity,
    unitAmountCents: unitCents,
    lineAmountCents: unitCents * quantity,
    vatTreatment,
    sourceType,
    sourceId,
  };
}

function baseCustomerActor(uid: string | null, first?: string | null, last?: string | null): FiscalActor {
  return {
    kind: 'CUSTOMER',
    uid: uid ?? undefined,
    displayName: [first, last].filter(Boolean).join(' ') || undefined,
  };
}

function baseMoney(sub: number, vat: number | undefined, total: number, paid: number, refunded = 0): FiscalMoney {
  return {
    currency: 'ILS',
    subtotalCents: sub,
    vatAmountCents: vat,
    totalCents: total,
    amountPaidCents: paid,
    amountRefundedCents: refunded,
    amountOutstandingCents: Math.max(0, total - paid),
  };
}

function baseReconciliation(paid: boolean, docIssued: boolean): ReconciliationBlock {
  return {
    paymentMatched: paid,
    documentMatched: docIssued,
    ledgerMatched: paid,
    warnings: paid && !docIssued ? ['PAID_NO_FISCAL_DOCUMENT'] : [],
  };
}

/**
 * Compose the refund lineage AND live reconciliation warnings for one
 * event. The composer branches use this helper INSTEAD of the raw
 * baseReconciliation() so real §87 signals (Nayax/wallet/SUMIT/refund)
 * surface without invention.
 *
 * §15 discipline: only pass hints the branch actually has evidence for
 * — never guess Nayax IDs for wallet-only shop orders, never invent a
 * wallet transaction id for K9000 machine-authorised events.
 */
async function enrichReconciliation(input: {
  event: FiscalEventCode;
  businessObjectId: string;
  correlationId: string;
  transactionRef: string;
  paid: boolean;
  commercialTotalCents: number;
  nayaxTxId?: string | null;
  walletTransactionId?: string | null;
  payout?: { contractorId: string; earningId: number };
}): Promise<{ reconciliation: ReconciliationBlock; refundLineage?: import('@shared/lib/fiscalPassport/FiscalTransactionPassport').RefundLineage }> {
  const eventKey = fiscalEventKey({ event: input.event, businessObjectId: input.businessObjectId });
  const [warnings, refundLineage] = await Promise.all([
    collectWarnings({
      fiscalEventKey: eventKey,
      commercialTotalCents: input.commercialTotalCents,
      paid: input.paid,
      nayaxTxId: input.nayaxTxId ?? undefined,
      walletTransactionId: input.walletTransactionId ?? undefined,
      payout: input.payout,
    }),
    composeRefundLineage({
      originalTransactionRef: input.transactionRef,
      originalRefundKey: input.correlationId,
    }),
  ]);

  const signals: ReconciliationSignal[] = warnings.map((w) => w.signal);
  // If the refund side has an orphan (money moved, credit doc not yet
  // issued), surface REFUND_NO_CREDIT_DOCUMENT on the same signal axis
  // so admin explorer + customer detail render one honest list.
  if (refundLineage.hasOrphanRefundWarning && !signals.includes('REFUND_NO_CREDIT_DOCUMENT')) {
    signals.push('REFUND_NO_CREDIT_DOCUMENT');
  }

  return {
    reconciliation: {
      paymentMatched: input.paid,
      documentMatched: false, // filled once sumit_documents is queried by collectWarnings
      ledgerMatched: input.paid,
      warnings: signals,
    },
    refundLineage: refundLineage.refunds.length > 0 || refundLineage.hasOrphanRefundWarning
      ? refundLineage
      : undefined,
  };
}

// ─── SHOP (§94.8) ────────────────────────────────────────────────────

async function composeShopFiscal(orderId: string, viewer: FiscalActor): Promise<FiscalPassportEnvelope | null> {
  const { rows } = await pool.query(
    `SELECT id, order_number, user_id, status,
            subtotal_cents, vat_cents, total_cents,
            payment_ref, payment_method, delivery_cents,
            created_at
       FROM shop_orders WHERE id = $1 LIMIT 1`,
    [orderId],
  );
  const order = rows[0];
  if (!order) return null;

  const isOwner = viewer.kind === 'CUSTOMER' && viewer.uid === order.user_id;
  const isStaff = viewer.kind === 'PETWASH_STAFF';
  if (!isOwner && !isStaff) return null;

  const total = Number(order.total_cents ?? 0);
  const subtotal = Number(order.subtotal_cents ?? total);
  const vat = order.vat_cents !== null && order.vat_cents !== undefined ? Number(order.vat_cents) : undefined;
  const paid = ['paid', 'shipped', 'fulfilled', 'completed', 'delivered'].includes(String(order.status ?? ''));
  const refunded = String(order.status ?? '') === 'refunded';

  const event: FiscalEventCode = refunded ? 'SHOP_ORDER_REFUNDED' : 'SHOP_ORDER_PAID';
  const correlationId = `shop:${order.id}`;
  const transactionRef = generateTransactionRef({ stableId: correlationId, stableIsoDate: order.created_at ?? null });

  const [ownerRow] = await db.select({ first: users.firstName, last: users.lastName })
    .from(users).where(eq(users.id, order.user_id)).limit(1);

  const items = [line('SHOP_ITEM_GENERIC', 1, subtotal, 'FULL_VAT', 'shop_orders', String(order.id))];

  const { reconciliation, refundLineage } = await enrichReconciliation({
    event, businessObjectId: String(order.id), correlationId, transactionRef,
    paid, commercialTotalCents: total,
    // Shop is card-only via SUMIT — no Nayax rail, no wallet ledger entry.
  });

  const passport: FiscalTransactionPassport = {
    correlationId,
    transactionRef,
    orderRef: String(order.order_number ?? order.id),
    eventType: event,
    paymentClass: paymentClassForEvent(event),
    platform: 'SHOP',
    serviceType: 'product_order',
    customer: baseCustomerActor(order.user_id, ownerRow?.first, ownerRow?.last),
    supplierOrFulfiller: { kind: 'PETWASH_MERCHANT', displayName: 'PetWash Shop' },
    items,
    money: baseMoney(subtotal, vat, total, paid ? total : 0, refunded ? total : 0),
    fundingLegs: paid ? [{ rail: 'CARD', amountCents: total, currency: 'ILS', label: 'Card', externalRef: order.payment_ref ?? undefined }] : [],
    payment: buildPaymentBlock(paid, refunded, 'CARD', order.payment_ref),
    fiscalDocument: fiscalDocumentFromCPA(event, paid ? 'PENDING' : 'NOT_REQUIRED'),
    commercialState: shopCommercialState(order.status),
    fulfilmentState: shopFulfilmentState(order.status),
    payoutState: 'NOT_APPLICABLE',
    reconciliation,
    refundLineage,
    composedAt: new Date().toISOString(),
  };

  return { passport, viewFor: { actor: viewer, showsProviderMoney: false, showsExternalIds: isStaff } };
}

function shopCommercialState(status: unknown): CommercialState {
  const s = String(status ?? '');
  if (s === 'completed' || s === 'delivered' || s === 'fulfilled') return 'FULFILLED';
  if (s === 'cancelled' || s === 'refunded') return 'CANCELLED';
  if (['paid', 'shipped'].includes(s)) return 'BOOKED';
  return 'DRAFT';
}
function shopFulfilmentState(status: unknown): FulfilmentState {
  const s = String(status ?? '');
  if (s === 'delivered' || s === 'completed') return 'CUSTOMER_CONFIRMED';
  if (s === 'shipped' || s === 'fulfilled') return 'PROVIDER_COMPLETED';
  if (s === 'cancelled') return 'CANCELLED';
  return 'NOT_STARTED';
}

function buildPaymentBlock(paid: boolean, refunded: boolean, rail: FundingLeg['rail'], external?: string | null): FiscalPaymentBlock {
  const state: PaymentState = refunded ? 'REFUNDED' : paid ? 'PAID' : 'PAYMENT_REQUIRED';
  return {
    state,
    rail: paid ? rail : undefined,
    providerTransactionId: external ?? undefined,
  };
}

// ─── K9000 (§94.9) ───────────────────────────────────────────────────

async function composeK9000Fiscal(eventId: string, viewer: FiscalActor): Promise<FiscalPassportEnvelope | null> {
  const [event] = await db.select().from(k9000WashEvents).where(eq(k9000WashEvents.id, eventId));
  if (!event) return null;
  const isOwner = viewer.kind === 'CUSTOMER' && viewer.uid === event.userId;
  const isStaff = viewer.kind === 'PETWASH_STAFF';
  if (!isOwner && !isStaff) return null;

  const total = Number(event.amountCents ?? 0);
  const paid = String(event.status ?? '') === 'completed';

  // K9000_WASH for redeemed / PetWash-side; K9000_PUBLIC_CARD for
  // walk-up Nayax card.
  const isPublicCard = event.transactionSource === 'nayax' || event.redemptionSource === 'nayax';
  const evt: FiscalEventCode = isPublicCard ? 'K9000_PUBLIC_CARD_COMPLETED' : 'K9000_WASH_COMPLETED';
  const correlationId = `k9000:${event.id}`;
  const transactionRef = generateTransactionRef({ stableId: correlationId, stableIsoDate: event.createdAt?.toISOString() ?? null });

  const [ownerRow] = event.userId
    ? await db.select({ first: users.firstName, last: users.lastName }).from(users).where(eq(users.id, event.userId)).limit(1)
    : [];

  const rail: FundingLeg['rail'] = isPublicCard ? 'MACHINE_NAYAX' : (event.redemptionSource === 'egift' ? 'EGIFT' : 'WALLET');
  const items = [line(isPublicCard ? 'K9000_PUBLIC_CARD_WASH' : 'K9000_SELF_SERVICE_WASH', 1, total, 'FULL_VAT', 'k9000_wash_events', event.id)];

  // §55 K9000: Nayax rail exists ONLY when this is a public-card event.
  // A wallet/eGift-authorised wash has no Nayax transaction to reconcile.
  const { reconciliation, refundLineage } = await enrichReconciliation({
    event: evt, businessObjectId: String(event.id), correlationId, transactionRef,
    paid, commercialTotalCents: total,
    nayaxTxId: isPublicCard ? event.nayaxTransactionId ?? undefined : undefined,
  });

  const passport: FiscalTransactionPassport = {
    correlationId,
    transactionRef,
    eventType: evt,
    paymentClass: paymentClassForEvent(evt),
    platform: 'K9000',
    serviceType: 'self_service_wash',
    customer: baseCustomerActor(event.userId, ownerRow?.first, ownerRow?.last),
    supplierOrFulfiller: {
      kind: 'MACHINE',
      publicId: `${event.stationId ?? '?'}/${event.baySide ?? '?'}`,
      displayName: `K9000 · ${event.stationId ?? 'unknown'}`,
    },
    items,
    money: baseMoney(total, undefined, total, paid ? total : 0),
    fundingLegs: paid ? [{ rail, amountCents: total, currency: 'ILS', label: rail === 'MACHINE_NAYAX' ? 'Card (Nayax)' : rail === 'EGIFT' ? 'eGift' : 'Wallet', externalRef: event.nayaxTransactionId ?? undefined }] : [],
    payment: buildPaymentBlock(paid, false, rail, event.nayaxTransactionId),
    // §55 K9000 fiscal doctrine (CEO auditor 2026-08-30, task #168).
    // For a paid Nayax public-card wash, we may NOT silently claim a
    // fiscal document was auto-issued: the eReceipt module is OFF and
    // the fiscal engine is UNDECIDED in the BusinessDecisionRegistry.
    // Route the state through NayaxFiscalDocumentGuard — REFUSE means
    // RECONCILIATION_REQUIRED (a human must confirm what SUMIT/Nayax
    // did), ASSUME_ISSUED means PENDING as before. Non-Nayax rails
    // (wallet, eGift) keep the original CPA-mapped state.
    fiscalDocument: fiscalDocumentFromCPA(
      evt,
      paid
        ? (isPublicCard
            ? (guardFiscalDocument({ machineId: resolveMachineId(event.nayaxTerminalId) ?? '' }).code === 'ASSUME_ISSUED'
                ? 'PENDING'
                : 'RECONCILIATION_REQUIRED')
            : 'PENDING')
        : 'NOT_REQUIRED',
    ),
    commercialState: paid ? 'FULFILLED' : 'DRAFT',
    fulfilmentState: paid ? 'CUSTOMER_CONFIRMED' : 'NOT_STARTED',
    payoutState: 'NOT_APPLICABLE',
    reconciliation,
    refundLineage,
    composedAt: new Date().toISOString(),
  };
  return { passport, viewFor: { actor: viewer, showsProviderMoney: false, showsExternalIds: isStaff } };
}

// ─── EGIFT PURCHASE (§94.10) ─────────────────────────────────────────

async function composeEgiftPurchaseFiscal(externalId: string, viewer: FiscalActor): Promise<FiscalPassportEnvelope | null> {
  const [order] = await db.select().from(egiftGuestOrders).where(eq(egiftGuestOrders.externalId, externalId));
  if (!order) return null;

  const viewerEmail = (viewer as any).email ?? '';
  const isSender = viewer.kind === 'CUSTOMER' && typeof viewerEmail === 'string' && viewerEmail.toLowerCase() === (order.senderEmail ?? '').toLowerCase();
  const isStaff = viewer.kind === 'PETWASH_STAFF';
  if (!isSender && !isStaff) return null;

  const total = Number(order.amountIlsCents ?? 0);
  const paid = String(order.status ?? '') === 'issued';
  const refunded = String(order.status ?? '') === 'refunded';
  const event: FiscalEventCode = refunded ? 'EGIFT_PURCHASE_REFUNDED' : 'EGIFT_PURCHASE_PAID';
  const correlationId = `egift-purchase:${order.externalId}`;
  const transactionRef = generateTransactionRef({ stableId: correlationId, stableIsoDate: order.createdAt?.toISOString() ?? null });

  const { reconciliation, refundLineage } = await enrichReconciliation({
    event, businessObjectId: String(order.externalId), correlationId, transactionRef,
    paid, commercialTotalCents: total,
  });

  const passport: FiscalTransactionPassport = {
    correlationId, transactionRef,
    eventType: event,
    paymentClass: paymentClassForEvent(event),
    platform: 'EGIFT',
    serviceType: 'egift_purchase',
    // eGift guest orders have no Firebase UID — customer is the sender email.
    customer: { kind: 'CUSTOMER', displayName: order.senderName || order.senderEmail },
    supplierOrFulfiller: { kind: 'PETWASH_MERCHANT', displayName: 'PetWash eGift' },
    items: [line('EGIFT_PURCHASE', 1, total, 'NO_VAT_STORED_VALUE', 'egift_guest_orders', order.externalId)],
    // NO_VAT_STORED_VALUE — vatAmount omitted, total == subtotal.
    money: baseMoney(total, undefined, total, paid ? total : 0, refunded ? total : 0),
    fundingLegs: paid ? [{ rail: 'CARD', amountCents: total, currency: 'ILS', label: 'Card', externalRef: order.sumitTransactionId ?? undefined }] : [],
    payment: buildPaymentBlock(paid, refunded, 'CARD', order.sumitTransactionId),
    fiscalDocument: fiscalDocumentFromCPA(event, paid ? 'PENDING' : 'NOT_REQUIRED'),
    commercialState: refunded ? 'CANCELLED' : paid ? 'FULFILLED' : 'DRAFT',
    fulfilmentState: paid ? 'CUSTOMER_CONFIRMED' : 'NOT_STARTED',
    payoutState: 'NOT_APPLICABLE',
    reconciliation,
    refundLineage,
    composedAt: new Date().toISOString(),
  };
  return { passport, viewFor: { actor: viewer, showsProviderMoney: false, showsExternalIds: isStaff } };
}

// ─── EGIFT REDEMPTION (§94.11) ───────────────────────────────────────
// Redemption is per-slice — one PetWash service consumption per event
// per §2.6 of the transaction matrix. This adapter reads the redemption
// row via the credit_transactions ledger when the ledger id is passed.

async function composeEgiftRedemptionFiscal(ledgerId: string, viewer: FiscalActor): Promise<FiscalPassportEnvelope | null> {
  const { rows } = await pool.query(
    `SELECT id, transaction_id, wallet_id, credit_type, transaction_type,
            amount_cents, source_type, source_id, created_at
       FROM credit_transactions
      WHERE transaction_id = $1 AND credit_type = 'egift' AND transaction_type = 'redeem'
      LIMIT 1`,
    [ledgerId],
  );
  const row = rows[0];
  if (!row) return null;

  // wallet_id maps back to a walletAccounts.userId — use it to check ownership.
  const walletOwnerRows = await pool.query(`SELECT user_id FROM wallet_accounts WHERE wallet_id = $1 LIMIT 1`, [row.wallet_id]);
  const ownerUid = walletOwnerRows.rows[0]?.user_id ?? null;
  const isOwner = viewer.kind === 'CUSTOMER' && ownerUid && viewer.uid === ownerUid;
  const isStaff = viewer.kind === 'PETWASH_STAFF';
  if (!isOwner && !isStaff) return null;

  const total = Math.abs(Number(row.amount_cents ?? 0));
  const event: FiscalEventCode = 'EGIFT_REDEEMED_FOR_SERVICE';
  const correlationId = `egift-redemption:${row.transaction_id}`;
  const transactionRef = generateTransactionRef({ stableId: correlationId, stableIsoDate: row.created_at ?? null });

  const { reconciliation } = await enrichReconciliation({
    event, businessObjectId: String(row.transaction_id), correlationId, transactionRef,
    paid: true, commercialTotalCents: total,
    walletTransactionId: String(row.transaction_id),
  });

  const passport: FiscalTransactionPassport = {
    correlationId, transactionRef,
    eventType: event,
    paymentClass: paymentClassForEvent(event),
    platform: 'EGIFT',
    serviceType: 'egift_redemption',
    customer: baseCustomerActor(ownerUid),
    supplierOrFulfiller: { kind: 'PETWASH_MERCHANT', displayName: 'PetWash' },
    // VAT_AT_REDEMPTION — the redeemed portion IS the taxable sale.
    items: [line('EGIFT_REDEMPTION_SERVICE', 1, total, 'VAT_AT_REDEMPTION', undefined, row.transaction_id)],
    money: baseMoney(total, undefined, total, total),
    fundingLegs: [{ rail: 'EGIFT', amountCents: total, currency: 'ILS', label: 'eGift' }],
    payment: { state: 'PAID', rail: 'EGIFT' },
    fiscalDocument: fiscalDocumentFromCPA(event, 'PENDING'),
    commercialState: 'FULFILLED',
    fulfilmentState: 'CUSTOMER_CONFIRMED',
    payoutState: 'NOT_APPLICABLE',
    reconciliation,
    composedAt: new Date().toISOString(),
  };
  return { passport, viewFor: { actor: viewer, showsProviderMoney: false, showsExternalIds: isStaff } };
}

// ─── WALLET TOPUP (§94.12) ───────────────────────────────────────────

async function composeWalletTopupFiscal(ledgerId: string, viewer: FiscalActor): Promise<FiscalPassportEnvelope | null> {
  const { rows } = await pool.query(
    `SELECT id, transaction_id, wallet_id, amount_cents, source_type, source_id, created_at
       FROM credit_transactions
      WHERE transaction_id = $1 AND transaction_type = 'issue'
      LIMIT 1`,
    [ledgerId],
  );
  const row = rows[0];
  if (!row) return null;

  const walletOwnerRows = await pool.query(`SELECT user_id FROM wallet_accounts WHERE wallet_id = $1 LIMIT 1`, [row.wallet_id]);
  const ownerUid = walletOwnerRows.rows[0]?.user_id ?? null;
  const isOwner = viewer.kind === 'CUSTOMER' && ownerUid && viewer.uid === ownerUid;
  const isStaff = viewer.kind === 'PETWASH_STAFF';
  if (!isOwner && !isStaff) return null;

  const total = Number(row.amount_cents ?? 0);
  const event: FiscalEventCode = 'WALLET_TOPUP_PAID';
  const correlationId = `wallet-topup:${row.transaction_id}`;
  const transactionRef = generateTransactionRef({ stableId: correlationId, stableIsoDate: row.created_at ?? null });

  // Wallet topup: source_id is the Nayax/SUMIT external tx id;
  // transaction_id is the ledger id.
  const { reconciliation, refundLineage } = await enrichReconciliation({
    event, businessObjectId: String(row.transaction_id), correlationId, transactionRef,
    paid: true, commercialTotalCents: total,
    nayaxTxId: row.source_type === 'nayax' ? row.source_id ?? undefined : undefined,
    walletTransactionId: String(row.transaction_id),
  });

  const passport: FiscalTransactionPassport = {
    correlationId, transactionRef,
    eventType: event,
    paymentClass: paymentClassForEvent(event),
    platform: 'UNIFIED_REQUEST', // wallet has no distinct PlatformCode today
    serviceType: 'wallet_topup',
    customer: baseCustomerActor(ownerUid),
    supplierOrFulfiller: { kind: 'PETWASH_MERCHANT', displayName: 'PetWash Wallet' },
    items: [line('WALLET_TOPUP', 1, total, 'NO_VAT_STORED_VALUE', undefined, row.transaction_id)],
    // NO_VAT_STORED_VALUE — vatAmount omitted.
    money: baseMoney(total, undefined, total, total),
    fundingLegs: [{ rail: 'CARD', amountCents: total, currency: 'ILS', label: 'Card', externalRef: row.source_id }],
    payment: { state: 'PAID', rail: 'CARD', providerTransactionId: row.source_id },
    fiscalDocument: fiscalDocumentFromCPA(event, 'PENDING'),
    commercialState: 'FULFILLED',
    fulfilmentState: 'CUSTOMER_CONFIRMED',
    payoutState: 'NOT_APPLICABLE',
    reconciliation,
    refundLineage,
    composedAt: new Date().toISOString(),
  };
  return { passport, viewFor: { actor: viewer, showsProviderMoney: false, showsExternalIds: isStaff } };
}

// ─── SITTER (§94.13) ─────────────────────────────────────────────────

async function composeSitterFiscal(bookingId: string, viewer: FiscalActor): Promise<FiscalPassportEnvelope | null> {
  const [b] = await db.select().from(sitterBookings).where(eq(sitterBookings.bookingId, bookingId));
  if (!b) return null;
  const [sitter] = await db.select().from(sitterProfiles).where(eq(sitterProfiles.id, b.sitterId));
  const isOwner = viewer.kind === 'CUSTOMER' && viewer.uid === b.ownerId;
  const isProvider = viewer.kind === 'PROVIDER' && sitter && viewer.uid === sitter.userId;
  const isStaff = viewer.kind === 'PETWASH_STAFF';
  if (!isOwner && !isProvider && !isStaff) return null;

  const total = Number(b.totalChargeCents ?? 0);
  const providerExpected = Number(b.sitterPayoutCents ?? 0);
  const paid = String(b.paymentStatus ?? '') === 'captured' || !!b.nayaxTransactionId;
  const event: FiscalEventCode = 'SITTER_BOOKING_PAID';
  const correlationId = `sitter:${b.bookingId}`;
  const transactionRef = generateTransactionRef({ stableId: correlationId, stableIsoDate: (b.confirmedAt ?? b.createdAt)?.toISOString() ?? null });

  return buildBookingFiscal({
    b, correlationId, transactionRef, event,
    platform: 'SITTER_SUITE',
    serviceType: 'pet_sitting',
    itemCode: 'SITTER_DAY',
    itemQuantity: Number(b.totalDays ?? 1),
    itemUnitCents: total > 0 && b.totalDays ? Math.round(total / Number(b.totalDays)) : total,
    fulfillerActor: sitter ? {
      kind: 'PROVIDER',
      uid: sitter.userId,
      publicId: String(sitter.id),
      displayName: `${sitter.firstName} ${sitter.lastName}`.trim(),
    } : { kind: 'PROVIDER' },
    total, providerExpected, paid,
    viewer, isProvider: !!isProvider, isStaff,
    sourceType: 'sitter_bookings',
    sourceId: b.bookingId,
    payDate: (b.confirmedAt ?? b.createdAt)?.toISOString() ?? null,
    externalTxn: b.nayaxTransactionId ?? null,
    nayaxTxId: b.nayaxTransactionId ?? null,
  });
}

// ─── WALK (§94.14) ───────────────────────────────────────────────────

async function composeWalkFiscal(bookingId: string, viewer: FiscalActor): Promise<FiscalPassportEnvelope | null> {
  const [b] = await db.select().from(walkBookings).where(eq(walkBookings.bookingId, bookingId));
  if (!b) return null;
  const [walker] = await db.select().from(walkerProfiles).where(eq(walkerProfiles.walkerId, b.walkerId));
  const isOwner = viewer.kind === 'CUSTOMER' && viewer.uid === b.ownerId;
  const isProvider = viewer.kind === 'PROVIDER' && walker && viewer.uid === walker.userId;
  const isStaff = viewer.kind === 'PETWASH_STAFF';
  if (!isOwner && !isProvider && !isStaff) return null;

  const total = Math.round(parseFloat(b.totalCost ?? '0') * 100);
  const providerExpected = Math.round(parseFloat(b.walkerPayout ?? '0') * 100);
  // §24 walk today has NO real payment rail — the composer reports the
  // honest state (unpaid). NO fiscal document required until money truly moves.
  const paid = false;
  const event: FiscalEventCode = 'WALK_BOOKING_PAID';
  const correlationId = `walk:${b.bookingId}`;
  const transactionRef = generateTransactionRef({ stableId: correlationId, stableIsoDate: b.scheduledDate?.toISOString() ?? null });

  return buildBookingFiscal({
    b, correlationId, transactionRef, event,
    platform: 'WALK_MY_PET',
    serviceType: 'dog_walk',
    itemCode: b.durationMinutes && b.durationMinutes >= 90 ? 'WALK_90_MIN' : b.durationMinutes && b.durationMinutes >= 60 ? 'WALK_60_MIN' : 'WALK_30_MIN',
    itemQuantity: 1,
    itemUnitCents: total,
    fulfillerActor: walker ? {
      kind: 'PROVIDER',
      uid: walker.userId,
      publicId: walker.walkerId,
      displayName: `${walker.firstName} ${walker.lastName}`.trim(),
    } : { kind: 'PROVIDER' },
    total, providerExpected, paid,
    viewer, isProvider: !!isProvider, isStaff,
    sourceType: 'walk_bookings',
    sourceId: b.bookingId,
    payDate: b.scheduledDate?.toISOString() ?? null,
    externalTxn: null,
  });
}

// ─── ACADEMY (§94.15) ────────────────────────────────────────────────

async function composeAcademyFiscal(bookingId: string, viewer: FiscalActor): Promise<FiscalPassportEnvelope | null> {
  const [b] = await db.select().from(trainerBookings).where(eq(trainerBookings.bookingId, bookingId));
  if (!b) return null;
  const isOwner = viewer.kind === 'CUSTOMER' && viewer.uid === b.userId;
  const isTrainer = viewer.kind === 'PROVIDER' && viewer.uid === b.trainerUserId;
  const isStaff = viewer.kind === 'PETWASH_STAFF';
  if (!isOwner && !isTrainer && !isStaff) return null;

  const total = Math.round(Number(b.totalAmount ?? 0) * 100);
  const providerExpected = Math.round(Number(b.trainerPayout ?? 0) * 100);
  const paid = String(b.paymentStatus ?? '') === 'completed' || !!b.paidAt;
  const event: FiscalEventCode = 'ACADEMY_BOOKING_PAID';
  const correlationId = `academy:${b.bookingId}`;
  const transactionRef = generateTransactionRef({ stableId: correlationId, stableIsoDate: (b.paidAt ?? b.sessionDate)?.toISOString() ?? null });

  return buildBookingFiscal({
    b, correlationId, transactionRef, event,
    platform: 'ACADEMY',
    serviceType: 'training_session',
    itemCode: 'ACADEMY_SESSION',
    itemQuantity: 1,
    itemUnitCents: total,
    fulfillerActor: {
      kind: 'PROVIDER',
      uid: b.trainerUserId,
      publicId: String(b.trainerId),
    },
    total, providerExpected, paid,
    viewer, isProvider: !!isTrainer, isStaff,
    sourceType: 'trainer_bookings',
    sourceId: b.bookingId,
    payDate: (b.paidAt ?? b.sessionDate)?.toISOString() ?? null,
    externalTxn: b.paymentIntentId ?? null,
  });
}

// ─── PETTREK (§94.16 — marketplace transport) ────────────────────────
//
// PetTrek trips are disclosed-agent marketplace bookings, same fiscal
// treatment as SITTER / WALK / ACADEMY: PROVIDER_BOOKING_COMMISSION,
// VAT_ON_COMMISSION_ONLY, provider = the driver. The 15/85 split lives
// on the row itself (`platformCommission` + `driverPayout`), so provider
// money lineage runs the same shape as the other marketplaces.

async function composePettrekFiscal(tripId: string, viewer: FiscalActor): Promise<FiscalPassportEnvelope | null> {
  const [t] = await db.select().from(pettrekTrips).where(eq(pettrekTrips.tripId, tripId));
  if (!t) return null;

  // Provider row for display name + FirebaseUID owner check.
  const providerId = t.providerId;
  const [driver] = providerId
    ? await db.select().from(pettrekProviders).where(eq(pettrekProviders.id, providerId))
    : [];

  const isOwner = viewer.kind === 'CUSTOMER' && viewer.uid === t.customerId;
  const isDriver = viewer.kind === 'PROVIDER' && driver && viewer.uid === driver.userId;
  const isStaff = viewer.kind === 'PETWASH_STAFF';
  if (!isOwner && !isDriver && !isStaff) return null;

  // Final fare wins over estimated when the trip has completed.
  const rawTotal = Number(t.finalFare ?? t.estimatedFare ?? 0);
  const total = Math.round(rawTotal * 100);
  const providerExpected = Math.round(Number(t.driverPayout ?? 0) * 100);
  const paid = String(t.paymentStatus ?? '') === 'paid' || !!t.nayaxTransactionId;

  const event: FiscalEventCode = 'PETTREK_BOOKING_PAID';
  const correlationId = `pettrek:${t.tripId}`;
  const transactionRef = generateTransactionRef({
    stableId: correlationId,
    stableIsoDate: (t.actualDropoffTime ?? t.actualPickupTime ?? t.scheduledPickupTime)?.toISOString() ?? null,
  });

  return buildBookingFiscal({
    b: t,
    correlationId,
    transactionRef,
    event,
    platform: 'PETTREK',
    serviceType: t.serviceType ?? 'transport',
    itemCode: 'PETTREK_TRIP',
    itemQuantity: 1,
    itemUnitCents: total,
    fulfillerActor: driver
      ? {
          kind: 'PROVIDER',
          uid: driver.userId,
          publicId: String(driver.id),
          displayName: `${driver.firstName ?? ''} ${driver.lastName ?? ''}`.trim() || undefined,
        }
      : { kind: 'PROVIDER' },
    total,
    providerExpected,
    paid,
    viewer,
    isProvider: !!isDriver,
    isStaff,
    sourceType: 'pettrek_trips',
    sourceId: t.tripId,
    payDate: (t.actualDropoffTime ?? t.actualPickupTime ?? t.scheduledPickupTime)?.toISOString() ?? null,
    externalTxn: t.nayaxTransactionId ?? null,
    nayaxTxId: t.nayaxTransactionId ?? null,
  });
}

// ─── Booking-fiscal shared builder ──────────────────────────────────

interface BookingFiscalArgs {
  b: any;
  correlationId: string;
  transactionRef: string;
  event: FiscalEventCode;
  platform: FiscalTransactionPassport['platform'];
  serviceType: string;
  itemCode: LineItemCode;
  itemQuantity: number;
  itemUnitCents: number;
  fulfillerActor: FiscalActor;
  total: number;
  providerExpected: number;
  paid: boolean;
  viewer: FiscalActor;
  isProvider: boolean;
  isStaff: boolean;
  sourceType: TransactionLineItem['sourceType'];
  sourceId: string;
  payDate: string | null;
  externalTxn: string | null;
  /** Real Nayax transaction id (when this booking rail was a Nayax card). */
  nayaxTxId?: string | null;
  /** Wallet ledger transaction id backing the booking, if any. */
  walletTransactionId?: string | null;
}

async function buildBookingFiscal(a: BookingFiscalArgs): Promise<FiscalPassportEnvelope> {
  // §20 disclosed-agent VAT — commission line only carries VAT.
  const items: TransactionLineItem[] = [
    { ...(getLineItem(a.itemCode)!),
      code: a.itemCode,
      quantity: a.itemQuantity,
      unitAmountCents: a.itemUnitCents,
      lineAmountCents: a.itemUnitCents * a.itemQuantity,
      vatTreatment: 'VAT_ON_COMMISSION_ONLY',
      sourceType: a.sourceType,
      sourceId: a.sourceId,
    },
  ];

  // §22 provider money — resolve the real per-booking lineage from
  // contractor_earnings when the viewer is entitled to see it. Before
  // 2026-08-27 this block hard-coded pendingCents/availableCents/paidCents
  // to zero, which lied to every provider passport.
  const providerUid = a.fulfillerActor.uid;
  let providerMoney: FiscalTransactionPassport['providerMoney'];
  let payoutState: PayoutState = a.paid ? 'PENDING' : 'NOT_APPLICABLE';
  if ((a.isProvider || a.isStaff) && providerUid) {
    const lineage = await composeProviderCommissionLineage({
      bookingId: a.sourceId,
      providerUid,
      providerGrossCents: a.providerExpected,
      petwashCommissionCents: Math.max(0, a.total - a.providerExpected),
    });
    providerMoney = lineage.providerMoney;
    if (providerMoney.paidCents > 0) payoutState = 'PAID';
    else if (providerMoney.availableCents > 0) payoutState = 'AVAILABLE';
  } else if (a.isProvider || a.isStaff) {
    providerMoney = {
      expectedCents: a.providerExpected,
      pendingCents: 0,
      availableCents: 0,
      paidCents: 0,
    };
  }

  // Live reconciliation + refund lineage. Booking events use the same
  // signal aggregator as shop/k9000 — hints are the real Nayax/wallet
  // txn ids the branch passed in, never guessed.
  const { reconciliation, refundLineage } = await enrichReconciliation({
    event: a.event, businessObjectId: a.sourceId,
    correlationId: a.correlationId, transactionRef: a.transactionRef,
    paid: a.paid, commercialTotalCents: a.total,
    nayaxTxId: a.nayaxTxId ?? undefined,
    walletTransactionId: a.walletTransactionId ?? undefined,
  });

  const passport: FiscalTransactionPassport = {
    correlationId: a.correlationId,
    transactionRef: a.transactionRef,
    bookingRef: a.sourceId,
    eventType: a.event,
    paymentClass: paymentClassForEvent(a.event),
    platform: a.platform,
    serviceType: a.serviceType,
    customer: baseCustomerActor(a.b.ownerId ?? a.b.userId ?? null),
    supplierOrFulfiller: a.fulfillerActor,
    items,
    money: baseMoney(a.total, undefined, a.total, a.paid ? a.total : 0),
    fundingLegs: a.paid ? [{ rail: 'CARD', amountCents: a.total, currency: 'ILS', label: 'Card', externalRef: a.externalTxn ?? undefined }] : [],
    payment: buildPaymentBlock(a.paid, false, 'CARD', a.externalTxn),
    fiscalDocument: fiscalDocumentFromCPA(a.event, a.paid ? 'PENDING' : 'NOT_REQUIRED'),
    providerMoney,
    commercialState: a.paid ? 'BOOKED' : 'DRAFT',
    fulfilmentState: 'NOT_STARTED',
    payoutState,
    reconciliation,
    refundLineage,
    composedAt: new Date().toISOString(),
  };

  return {
    passport,
    viewFor: {
      actor: a.viewer,
      showsProviderMoney: a.isProvider || a.isStaff,
      showsExternalIds: a.isStaff,
    },
  };
}

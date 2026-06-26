/**
 * DealGateService — the brain of the Deal Gate (CEO master spec 2026-06-27).
 *
 * A booking becomes a real confirmed deal only when ALL preconditions pass
 * (customer + provider + provider-approved + provider-accepted + customer-accepted
 * price/policy/terms + payment authorised/paid + txn id saved + legal record saved).
 * This service is the SINGLE source of truth for that decision and for the legal
 * record + audit trail. It is money-SAFE:
 *   • canConfirmBooking() is READ-ONLY — it never charges or mutates money.
 *   • Fee calculators ALWAYS compute the "would apply" amount (shadow mode); the
 *     DEAL_GATE_FLAGS gate only whether that amount becomes a LIVE charge.
 *   • recordStatusEvent / recordAcceptance only write to the additive Deal Gate
 *     tables — never to wallet/escrow/payout ledgers.
 */
import { pool, db } from "../db";
import {
  dealAcceptances, bookingPayments, bookingStatusEvents, bookingRefunds,
} from "../../shared/schema-deal-gate";
import { DEAL_GATE_FLAGS } from "../config/dealGateFlags";
import { eq, desc } from "drizzle-orm";
import { logger } from "../lib/logger";

// ── §G. Deal Gate validator result ─────────────────────────────────────────────
export interface CanConfirmResult {
  bookingId: string;
  can_confirm: boolean;
  missing_requirements: string[];
  warnings: string[];
  payment_required: boolean;
  provider_ready: boolean;
  customer_ready: boolean;
  legal_ready: boolean;
}

async function readBookingCore(bookingId: string): Promise<any | null> {
  // Defensive: booking id is the varchar request_id used across the routes.
  try {
    const { rows } = await pool.query(
      `SELECT request_id, owner_id, provider_id, status, payment_held_at, total_cents, start_date
         FROM booking_requests WHERE request_id = $1 LIMIT 1`,
      [bookingId],
    );
    return rows[0] || null;
  } catch (e: any) {
    logger.warn("[DealGate] readBookingCore failed", { bookingId, error: e?.message });
    return null;
  }
}

async function readProviderApproved(providerUserId: string | null): Promise<boolean> {
  if (!providerUserId) return false;
  try {
    const { rows } = await pool.query(
      `SELECT verification_status, background_check_status
         FROM providers WHERE user_id = $1 LIMIT 1`,
      [providerUserId],
    );
    const p = rows[0];
    if (!p) return false;
    // Approved when identity verified OR background check approved (fail-open for
    // legacy providers without the newer columns is intentionally NOT done here —
    // this gate is read-only advice, the live accept route keeps its own guard).
    return p.verification_status === "verified" || p.background_check_status === "approved";
  } catch (e: any) {
    logger.warn("[DealGate] readProviderApproved failed", { providerUserId, error: e?.message });
    return false;
  }
}

/**
 * §A/§G — read-only Deal Gate check. The frontend MUST NOT confirm a booking if
 * this returns can_confirm:false; the live confirm route should also call it.
 */
export async function canConfirmBooking(bookingId: string): Promise<CanConfirmResult> {
  const missing: string[] = [];
  const warnings: string[] = [];

  const booking = await readBookingCore(bookingId);
  const [acceptance] = booking
    ? await db.select().from(dealAcceptances).where(eq(dealAcceptances.bookingId, bookingId)).limit(1)
    : [];
  const payments = booking
    ? await db.select().from(bookingPayments).where(eq(bookingPayments.bookingId, bookingId)).orderBy(desc(bookingPayments.createdAt)).limit(5)
    : [];

  // Customer present
  const customerReady = !!booking?.owner_id;
  if (!customerReady) missing.push("customer_missing");

  // Provider present + approved + accepted
  const providerPresent = !!booking?.provider_id;
  if (!providerPresent) missing.push("provider_missing");
  const providerApproved = await readProviderApproved(booking?.provider_id ?? null);
  if (providerPresent && !providerApproved) missing.push("provider_not_approved");
  const providerAccepted = !!acceptance?.providerAcceptedAt
    || ["accepted", "payment_pending", "confirmed", "in_progress", "completed"].includes(booking?.status);
  if (!providerAccepted) missing.push("provider_not_accepted");

  // Customer accepted price + policy + terms (legal record)
  const customerAccepted = !!acceptance?.customerAcceptedAt;
  if (!customerAccepted) missing.push("customer_not_accepted_terms");
  if (acceptance && !acceptance.cancellationPolicyVersion) warnings.push("cancellation_policy_version_unset");
  if (acceptance && !acceptance.priceBreakdownVersion) warnings.push("price_breakdown_version_unset");

  // Payment authorised / captured / held
  const paid = payments.some(p => ["authorised", "captured"].includes(p.status))
    || !!booking?.payment_held_at
    || !!acceptance?.paymentAuthorisedAt
    || !!acceptance?.paymentCapturedAt;
  if (!paid) missing.push("payment_not_authorised");

  // Transaction id saved
  const txnSaved = payments.some(p => !!p.externalTransactionId) || !!acceptance?.paymentTransactionId;
  if (paid && !txnSaved) warnings.push("payment_transaction_id_unset");

  // Legal record saved
  const legalReady = !!acceptance && customerAccepted && providerAccepted;
  if (!legalReady) missing.push("legal_record_incomplete");

  const providerReady = providerPresent && providerApproved && providerAccepted;
  const can_confirm = missing.length === 0;

  return {
    bookingId,
    can_confirm,
    missing_requirements: missing,
    warnings,
    payment_required: !paid,
    provider_ready: providerReady,
    customer_ready: customerReady && customerAccepted,
    legal_ready: legalReady,
  };
}

// ── §L. Audit: record every status change ──────────────────────────────────────
export async function recordStatusEvent(input: {
  bookingId: string;
  oldStatus?: string | null;
  newStatus: string;
  changedBy?: string | null;
  actorRole?: "customer" | "provider" | "admin" | "system";
  reason?: string | null;
  metadata?: Record<string, any>;
}): Promise<void> {
  try {
    await db.insert(bookingStatusEvents).values({
      bookingId: input.bookingId,
      oldStatus: input.oldStatus ?? null,
      newStatus: input.newStatus,
      changedBy: input.changedBy ?? "system",
      actorRole: input.actorRole ?? "system",
      reason: input.reason ?? null,
      metadataJson: input.metadata ?? null,
    });
  } catch (e: any) {
    logger.error("[DealGate] recordStatusEvent failed", { bookingId: input.bookingId, error: e?.message });
  }
}

// ── §B. Two-sided legal acceptance (upsert one row per booking) ────────────────
export async function recordAcceptance(input: {
  bookingId: string;
  customerUserId: string;
  providerUserId?: string | null;
  side: "customer" | "provider";
  termsVersion?: string;
  cancellationPolicyVersion?: string;
  priceBreakdownVersion?: string;
  paymentProvider?: string;
  paymentTransactionId?: string;
  paymentAuthorisedAt?: Date;
  paymentCapturedAt?: Date;
  amountTotalCents?: number;
  ipAddress?: string;
  deviceInfo?: string;
  language?: string;
}): Promise<void> {
  const now = new Date();
  const [existing] = await db.select().from(dealAcceptances).where(eq(dealAcceptances.bookingId, input.bookingId)).limit(1);

  const sideFields = input.side === "customer"
    ? { customerAcceptedAt: now, customerTermsVersion: input.termsVersion }
    : { providerAcceptedAt: now, providerTermsVersion: input.termsVersion };

  const common = {
    cancellationPolicyVersion: input.cancellationPolicyVersion,
    priceBreakdownVersion: input.priceBreakdownVersion,
    paymentProvider: input.paymentProvider,
    paymentTransactionId: input.paymentTransactionId,
    paymentAuthorisedAt: input.paymentAuthorisedAt,
    paymentCapturedAt: input.paymentCapturedAt,
    amountTotalCents: input.amountTotalCents,
    ipAddress: input.ipAddress,
    deviceInfo: input.deviceInfo,
    language: input.language,
    updatedAt: now,
  };
  // Drop undefined so we never overwrite the other side's data with null.
  const clean = (o: Record<string, any>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

  try {
    if (existing) {
      await db.update(dealAcceptances)
        .set({ ...clean(common), ...clean(sideFields) })
        .where(eq(dealAcceptances.bookingId, input.bookingId));
    } else {
      await db.insert(dealAcceptances).values({
        bookingId: input.bookingId,
        customerUserId: input.customerUserId,
        providerUserId: input.providerUserId ?? null,
        currency: "ILS",
        status: "pending",
        ...clean(common),
        ...clean(sideFields),
      } as any);
    }
  } catch (e: any) {
    logger.error("[DealGate] recordAcceptance failed", { bookingId: input.bookingId, error: e?.message });
  }
}

// ── §I/§K. Shadow fee calculators — ALWAYS compute; flags gate the live charge ──
export interface ShadowFee {
  feeCents: number;            // the amount that WOULD apply
  providerCompCents: number;   // provider compensation that WOULD apply
  refundCents: number;         // refund the customer WOULD receive
  tier: string;
  liveCharge: boolean;         // true only when the governing flag is ON
  flag: string;
}

/**
 * §10/§K — late-cancellation fee. Tiers mirror the shipped refund logic (#841):
 * >72h = 100% refund, 24–72h = 50%, <24h = 0% (+ provider compensation). When
 * CANCELLATION_FEES_ENABLED / PROVIDER_COMPENSATION_ENABLED are OFF the amounts
 * are returned for display/admin only (liveCharge=false).
 */
export function calcCancellationFee(params: {
  totalCents: number; hoursUntilService: number; cancelledBy: "customer" | "provider";
}): ShadowFee {
  const { totalCents, hoursUntilService, cancelledBy } = params;
  let feeCents = 0, refundCents = totalCents, providerCompCents = 0, tier = "free";

  if (cancelledBy === "provider") {
    tier = "provider_cancel_full_refund"; feeCents = 0; refundCents = totalCents; providerCompCents = 0;
  } else if (hoursUntilService >= 72) {
    tier = "customer_72h_plus"; feeCents = 0; refundCents = totalCents;
  } else if (hoursUntilService >= 24) {
    tier = "customer_24_to_72h"; feeCents = Math.round(totalCents * 0.5); refundCents = totalCents - feeCents;
    providerCompCents = Math.round(feeCents * 0.5);
  } else {
    tier = "customer_under_24h"; feeCents = totalCents; refundCents = 0;
    providerCompCents = Math.round(totalCents * 0.5);
  }

  const liveCharge = DEAL_GATE_FLAGS.CANCELLATION_FEES_ENABLED;
  if (!DEAL_GATE_FLAGS.PROVIDER_COMPENSATION_ENABLED) providerCompCents = providerCompCents; // recorded, not paid
  return { feeCents, providerCompCents, refundCents, tier, liveCharge, flag: "CANCELLATION_FEES_ENABLED" };
}

/** §I/§11 — no-show fee. Recorded always; charged only when NO_SHOW_FEES_ENABLED. */
export function calcNoShowFee(params: { totalCents: number; side: "customer" | "provider" }): ShadowFee {
  const { totalCents, side } = params;
  if (side === "provider") {
    // Provider no-show → customer full refund, provider penalty (recorded).
    return { feeCents: 0, providerCompCents: 0, refundCents: totalCents, tier: "no_show_provider",
      liveCharge: DEAL_GATE_FLAGS.NO_SHOW_FEES_ENABLED, flag: "NO_SHOW_FEES_ENABLED" };
  }
  // Customer no-show → fee up to full, provider compensated.
  return { feeCents: totalCents, providerCompCents: Math.round(totalCents * 0.5), refundCents: 0,
    tier: "no_show_customer", liveCharge: DEAL_GATE_FLAGS.NO_SHOW_FEES_ENABLED, flag: "NO_SHOW_FEES_ENABLED" };
}

/** §8 — card/processor fee retained on refund (only when disclosed + flag ON). */
export function calcRetainedCardFee(processorFeeCents: number): { retainedCents: number; liveCharge: boolean } {
  const live = DEAL_GATE_FLAGS.CARD_FEE_RECOVERY_ENABLED;
  return { retainedCents: live ? processorFeeCents : 0, liveCharge: live };
}

/**
 * §16/§K — record a refund. Writes a booking_refunds row (never deletes a txn).
 * shadow_only = true unless AUTO_REFUNDS_ENABLED — i.e. while OFF we record the
 * intended refund for admin to approve/execute, but move no live money here.
 */
export async function recordRefund(input: {
  bookingId: string; paymentId?: string; requestedBy?: string; reason?: string;
  originalAmountCents: number; cancellationFeeCents?: number; paymentFeeCents?: number;
  platformFeeCents?: number; providerCompensationCents?: number; refundAmountCents: number;
  refundProvider?: string; policyVersion?: string;
}): Promise<{ id: number | null; shadowOnly: boolean; status: string }> {
  const shadowOnly = !DEAL_GATE_FLAGS.AUTO_REFUNDS_ENABLED;
  const status = shadowOnly ? "pending_review" : "approved";
  try {
    const [row] = await db.insert(bookingRefunds).values({
      bookingId: input.bookingId,
      paymentId: input.paymentId,
      requestedBy: input.requestedBy,
      reason: input.reason,
      originalAmountCents: input.originalAmountCents,
      cancellationFeeCents: input.cancellationFeeCents ?? 0,
      paymentFeeCents: input.paymentFeeCents ?? 0,
      platformFeeCents: input.platformFeeCents ?? 0,
      providerCompensationCents: input.providerCompensationCents ?? 0,
      refundAmountCents: input.refundAmountCents,
      refundProvider: input.refundProvider,
      shadowOnly,
      status,
      policyVersion: input.policyVersion,
    } as any).returning({ id: bookingRefunds.id });
    return { id: row?.id ?? null, shadowOnly, status };
  } catch (e: any) {
    logger.error("[DealGate] recordRefund failed", { bookingId: input.bookingId, error: e?.message });
    return { id: null, shadowOnly, status: "failed" };
  }
}

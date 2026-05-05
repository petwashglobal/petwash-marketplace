/**
 * Booking Ledger Writer
 *
 * Writes the canonical pw_payments + pw_provider_payouts rows for every
 * marketplace booking that reaches the "completed" state (either manual
 * customer approval or system auto-approval after 24 h).
 *
 * Rules:
 *   - One pw_payments row per booking (idempotent — skips if already exists).
 *   - One pw_provider_payouts row per booking (idempotent — skips if already exists).
 *   - pw_provider_payouts.status = 'held_in_escrow' immediately after completion.
 *     It transitions to 'ready_for_payout' only after escrowReleaseAt passes.
 *     It is NEVER marked 'paid' by this code — that requires a real bank transfer.
 *   - VAT rate hard-coded to 18 % (Israeli standard, 2024 law).
 *   - Platform commission = 15 % of subtotal (serviceFeeCents / subtotalCents).
 */

import { db } from '../db';
import { pwPayments, pwProviderPayouts } from '@shared/schema-payments';
import { TRANSACTION_TYPES } from '@shared/finance-flow-types';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { logger } from '../lib/logger';
import { ISRAEL_VAT_RATE } from "@shared/israel-compliance-config";

const VAT_RATE = ISRAEL_VAT_RATE; // PR-W13: shared/israel-compliance-config.ts
const COMMISSION_RATE = '0.15';
const PLATFORM_FEE_PERCENT = 0.15;

function verticalFromProviderType(providerType: string | null | undefined): string {
  switch (providerType) {
    case 'sitter':  return 'sitter-suite';
    case 'walker':  return 'walk-my-pet';
    case 'trainer': return 'walk-my-pet';
    default:        return 'sitter-suite';
  }
}

export interface BookingForLedger {
  requestId: string;
  ownerId: string;
  providerId: string;
  providerType?: string | null;
  totalCents: number;
  subtotalCents: number;
  serviceFeeCents: number;
  paymentTransactionId?: string | null;
  paymentMethod?: string | null;
}

/**
 * Write pw_payments + pw_provider_payouts for a completed booking.
 * Idempotent: if rows already exist for this bookingId they are not duplicated.
 *
 * @returns paymentId of the pw_payments row (new or existing)
 */
export async function writeBookingLedgerEntries(booking: BookingForLedger): Promise<string> {
  const vertical = verticalFromProviderType(booking.providerType);

  // ── Check idempotency: if a pw_payments row already exists for this booking, skip. ──
  const existing = await db
    .select({ paymentId: pwPayments.paymentId })
    .from(pwPayments)
    .where(eq(pwPayments.bookingId, booking.requestId))
    .limit(1);

  if (existing.length > 0) {
    logger.info('[BookingLedger] pw_payments row already exists — skipping', {
      bookingId: booking.requestId,
      paymentId: existing[0].paymentId,
    });
    return existing[0].paymentId;
  }

  const year = new Date().getFullYear();
  const paymentId  = `PW-PAY-${year}-${nanoid(8).toUpperCase()}`;
  const payoutId   = `PW-POUT-${year}-${nanoid(8).toUpperCase()}`;

  const grossCents        = booking.totalCents;
  // VAT embedded in the gross (18/118 back-calc per Israeli law).
  const vatCents          = Math.round(grossCents * (VAT_RATE / (1 + VAT_RATE)));
  const platformFeeCents  = booking.serviceFeeCents;
  const providerGrossCents = booking.subtotalCents;
  // Provider net = their gross minus the VAT embedded in their share.
  const providerVatCents  = Math.round(providerGrossCents * (VAT_RATE / (1 + VAT_RATE)));
  const providerPayoutCents = providerGrossCents - providerVatCents;
  const netRevenueCents   = platformFeeCents; // PetWash revenue = commission
  const commissionCents   = platformFeeCents;

  // Escrow release date = now + 72 h (matches EscrowService holdUntil)
  const escrowReleaseAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

  try {
    // ── pw_payments ────────────────────────────────────────────────────────────
    await db.insert(pwPayments).values({
      paymentId,
      transactionType: TRANSACTION_TYPES.PROVIDER_BOOKING_CHARGE,
      vertical,
      commercialModel: 'MARKETPLACE_COMMISSION',
      customerId: booking.ownerId,
      providerId: booking.providerId,
      grossCents,
      vatCents,
      platformFeeCents,
      processorFeeCents: 0,
      providerGrossCents,
      providerPayoutCents,
      netRevenueCents,
      vatRate: String(VAT_RATE),
      paymentMethod: booking.paymentMethod || 'nayax',
      paymentProcessor: 'nayax',
      walletUsed: false,
      nayaxTransactionId: booking.paymentTransactionId || null,
      bookingId: booking.requestId,
      status: 'settled',
    });

    // ── pw_provider_payouts ────────────────────────────────────────────────────
    await db.insert(pwProviderPayouts).values({
      payoutId,
      paymentId,
      providerId: booking.providerId,
      vertical,
      commercialModel: 'MARKETPLACE_COMMISSION',
      grossCents: providerGrossCents,
      vatInShareCents: providerVatCents,
      netCents: providerPayoutCents,
      commissionCents,
      commissionRate: COMMISSION_RATE,
      requiresTaxInvoice: true,
      providerIsExempt: false,
      // 'held_in_escrow' → transitions to 'ready_for_payout' after escrowReleaseAt
      // NEVER set to 'paid' without a real bank transfer confirmation.
      status: 'held_in_escrow',
      escrowReleaseAt,
    });

    logger.info('[BookingLedger] pw_payments + pw_provider_payouts written', {
      bookingId: booking.requestId,
      paymentId,
      payoutId,
      grossCents,
      providerPayoutCents,
      commissionCents,
    });

    return paymentId;
  } catch (err: any) {
    logger.error('[BookingLedger] Failed to write ledger entries', {
      bookingId: booking.requestId,
      error: err.message,
    });
    throw err;
  }
}

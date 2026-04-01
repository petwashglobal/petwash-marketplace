/**
 * UnifiedPricingService — PetWash™ Single Pricing Authority
 *
 * ALL payable flows — booking, kiosk, sitter, walker, trainer, marketplace —
 * run through this service to get one authoritative pricing decision.
 *
 * SEQUENCE (backend-only, never delegated to frontend):
 *   gross total
 *   → coupon discount          (validate + reserve, NOT yet consumed)
 *   → loyalty / special disc   (checked against stackability matrix)
 *   → promo wallet credit
 *   → e-gift / gift balance
 *   → wash package credit      (kiosk only)
 *   → cash wallet balance
 *   → remaining payable        (sent to payment provider)
 *
 * Coupon lifecycle:
 *   quote()      → validates coupon, returns authoritative quote (no DB write)
 *   reserve()    → creates coupon_reservations row, 15-min TTL
 *   confirm()    → atomically consumes coupon + wallet (called after booking confirmed)
 *   abandon()    → marks reservation abandoned (booking failed → no burn)
 *
 * The WalletEngine handles the actual wallet deduction; this service ONLY
 * determines the amounts and wires the coupon layer on top.
 */

import { pool } from '../db';
import { couponService } from './CouponService';
import { computeDeductionOrder } from './WalletEngine';
import { logger } from '../lib/logger';
import { nanoid } from 'nanoid';
import type { OrderType, ActiveBenefits } from './CouponService';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface PricingInput {
  userId:         string;
  orderType:      OrderType;
  grossCents:     number;         // order amount before any discounts
  couponCode?:    string;         // optional coupon code to apply
  activeBenefits?: ActiveBenefits;
  // Loyalty / special discounts already applied by booking engine
  loyaltyDiscountCents?:  number;
  specialDiscountCents?:  number;
  // Kiosk-specific
  isKioskWash?:   boolean;
  stationId?:     string;
  city?:          string;
  country?:       string;
  // Anti-fraud / audit
  idempotencyKey?: string;
  ipAddress?:      string;
  deviceFingerprint?: string;
}

export interface PricingBreakdown {
  grossCents:              number;
  couponDiscountCents:     number;
  loyaltyDiscountCents:    number;
  specialDiscountCents:    number;
  totalDiscountCents:      number;
  afterDiscountCents:      number;
  promoWalletCents:        number;
  egiftCents:              number;
  washPackageUnits:        number;
  cashWalletCents:         number;
  totalWalletCoveredCents: number;
  remainingPayableCents:   number;
  fullyCovedByWallet:      boolean;
  vatCents:                number;
  vatRate:                 number;
  currency:                'ILS';
}

export interface PricingQuote {
  quoteId:            string;
  userId:             string;
  orderType:          OrderType;
  breakdown:          PricingBreakdown;
  couponApplied:      boolean;
  couponId?:          number;
  issuanceId?:        number;
  couponCode?:        string;
  campaignName?:      string;
  stackabilityConflicts: string[];
  walletBalances: {
    promo:   number;
    egift:   number;
    package: number;
    cash:    number;
  };
  quotedAt:   Date;
  expiresAt:  Date; // 15 min
}

export interface ReservationResult {
  reservationId: string;
  expiresAt: Date;
}

export interface ConfirmResult {
  redemptionId:   number;
  walletTxnId:    string | null;
  ledgerEntryIds: string[];
}

// VAT 18% applies to platform service fees only
const VAT_RATE = 0.18;

// ─────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────

export class UnifiedPricingService {

  // ───────────────────────────────────────────
  // STEP 1: QUOTE (no DB writes)
  // ───────────────────────────────────────────

  /**
   * Build an authoritative pricing quote.
   * Validates the coupon (including abuse gate + stackability) but does NOT
   * consume it yet. Returns the full breakdown including wallet coverage.
   */
  async quote(input: PricingInput): Promise<PricingQuote> {
    const {
      userId, orderType, grossCents,
      couponCode, activeBenefits,
      loyaltyDiscountCents = 0, specialDiscountCents = 0,
      isKioskWash = false, stationId, city, country,
      idempotencyKey, ipAddress, deviceFingerprint,
    } = input;

    // ── 1. Coupon validation ──────────────────────────────────
    let couponDiscountCents = 0;
    let couponId: number | undefined;
    let issuanceId: number | undefined;
    let couponCode_: string | undefined;
    let campaignName: string | undefined;
    let stackabilityConflicts: string[] = [];

    if (couponCode) {
      const val = await couponService.validateCoupon({
        code: couponCode,
        userId,
        orderType,
        amountCents: grossCents,
        activeBenefits,
        idempotencyKey,
        ipAddress,
        deviceFingerprint,
        stationId,
        city,
        country,
      });
      if (val.valid) {
        couponDiscountCents = val.discountAmountCents ?? 0;
        couponId            = val.couponId;
        issuanceId          = val.issuanceId;
        couponCode_         = couponCode.toUpperCase();
        campaignName        = val.campaignName;
        stackabilityConflicts = val.stackabilityConflicts ?? [];
      } else {
        logger.warn('[Pricing] Coupon invalid', { code: couponCode, errorCode: val.errorCode, userId });
        // Quote proceeds without coupon — caller receives the error separately
      }
    }

    // ── 2. Loyalty & special discounts ───────────────────────
    // These are already pre-computed by the booking engine.
    // Only apply if stackability allows.
    let effectiveLoyaltyDisc  = loyaltyDiscountCents;
    let effectiveSpecialDisc  = specialDiscountCents;
    if (couponId && stackabilityConflicts.includes('loyalty_5_pct')) effectiveLoyaltyDisc = 0;
    if (couponId && stackabilityConflicts.includes('special_10_pct')) effectiveSpecialDisc = 0;

    const totalDiscountCents = couponDiscountCents + effectiveLoyaltyDisc + effectiveSpecialDisc;
    const afterDiscountCents = Math.max(0, grossCents - totalDiscountCents);

    // ── 3. Wallet coverage ────────────────────────────────────
    const walletRow = await pool.query(
      `SELECT promo_balance_cents, egift_balance_cents, wash_package_credits,
              package_service_units_remaining, cash_wallet_balance_cents
       FROM wallet_accounts WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    const balances = walletRow.rows[0] ?? {
      promo_balance_cents: 0,
      egift_balance_cents: 0,
      wash_package_credits: 0,
      package_service_units_remaining: 0,
      cash_wallet_balance_cents: 0,
    };

    const deduction = computeDeductionOrder(
      {
        promoBalanceCents:            balances.promo_balance_cents ?? 0,
        egiftBalanceCents:            balances.egift_balance_cents ?? 0,
        washPackageCredits:           balances.wash_package_credits ?? 0,
        cashWalletBalanceCents:       balances.cash_wallet_balance_cents ?? 0,
        packageServiceUnitsRemaining: balances.package_service_units_remaining ?? 0,
      },
      afterDiscountCents,
      isKioskWash,
    );

    // ── 4. VAT on platform fee (18%) ──────────────────────────
    // VAT is embedded in the gross; we surface it for transparency.
    const vatCents = Math.round(afterDiscountCents - afterDiscountCents / (1 + VAT_RATE));

    const quoteId   = `Q-${nanoid(12)}`;
    const quotedAt  = new Date();
    const expiresAt = new Date(quotedAt.getTime() + 15 * 60 * 1000);

    const breakdown: PricingBreakdown = {
      grossCents,
      couponDiscountCents,
      loyaltyDiscountCents:    effectiveLoyaltyDisc,
      specialDiscountCents:    effectiveSpecialDisc,
      totalDiscountCents,
      afterDiscountCents,
      promoWalletCents:        deduction.promo,
      egiftCents:              deduction.gift,
      washPackageUnits:        deduction.package,
      cashWalletCents:         deduction.wallet,
      totalWalletCoveredCents: deduction.totalCovered,
      remainingPayableCents:   deduction.shortfall,
      fullyCovedByWallet:      deduction.ok,
      vatCents,
      vatRate:                 VAT_RATE,
      currency:                'ILS',
    };

    logger.info('[Pricing] Quote computed', {
      quoteId, userId, orderType, grossCents,
      couponDiscountCents, remainingPayableCents: deduction.shortfall,
    });

    return {
      quoteId,
      userId,
      orderType,
      breakdown,
      couponApplied:         couponDiscountCents > 0,
      couponId,
      issuanceId,
      couponCode:            couponCode_,
      campaignName,
      stackabilityConflicts,
      walletBalances: {
        promo:   balances.promo_balance_cents ?? 0,
        egift:   balances.egift_balance_cents ?? 0,
        package: balances.wash_package_credits ?? 0,
        cash:    balances.cash_wallet_balance_cents ?? 0,
      },
      quotedAt,
      expiresAt,
    };
  }

  // ───────────────────────────────────────────
  // STEP 2: RESERVE (write reservation row, DO NOT consume coupon)
  // ───────────────────────────────────────────

  /**
   * Reserve a coupon for 15 minutes. The coupon is NOT yet consumed.
   * Must be called after quote() and before checkout starts payment.
   * If multiple reservations exist for the same user+coupon, the previous one
   * is abandoned (only one active reservation per user+coupon).
   */
  async reserve(quote: PricingQuote, idempotencyKey?: string): Promise<ReservationResult> {
    if (!quote.couponId) {
      throw Object.assign(new Error('No coupon in quote'), { code: 'NO_COUPON' });
    }

    // Abandon any previous active reservation for this user+coupon
    await pool.query(
      `UPDATE coupon_reservations SET status = 'abandoned', abandoned_at = NOW()
       WHERE user_id = $1 AND coupon_id = $2 AND status = 'reserved' AND expires_at > NOW()`,
      [quote.userId, quote.couponId]
    );

    const reservationId = `R-${nanoid(16)}`;
    const expiresAt     = quote.expiresAt;

    await pool.query(
      `INSERT INTO coupon_reservations
         (reservation_id, coupon_id, issuance_id, user_id, order_type,
          gross_amount_cents, discount_amount_cents, expires_at, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [reservationId, quote.couponId, quote.issuanceId ?? null, quote.userId,
       quote.orderType, quote.breakdown.grossCents, quote.breakdown.couponDiscountCents,
       expiresAt, idempotencyKey ?? null]
    );

    logger.info('[Pricing] Coupon reserved', { reservationId, couponId: quote.couponId, userId: quote.userId });
    return { reservationId, expiresAt };
  }

  // ───────────────────────────────────────────
  // STEP 3: CONFIRM (atomically consume coupon after booking/wash confirmed)
  // ───────────────────────────────────────────

  /**
   * Called once the booking or kiosk session is confirmed.
   * Atomically:
   *  1. Verifies reservation is still valid (not expired/abandoned)
   *  2. Calls redeemAtomic() on CouponService (row-locks coupon, idempotency)
   *  3. Marks reservation as confirmed
   * The wallet deduction is handled separately by WalletEngine (caller's responsibility).
   */
  async confirmReservation(
    reservationId: string,
    orderId: string,
    ledgerEntryId?: string,
  ): Promise<{ redemptionId: number; alreadyRedeemed: boolean }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Lock + fetch reservation
      const resRow = await client.query(
        `SELECT * FROM coupon_reservations WHERE reservation_id = $1 FOR UPDATE`,
        [reservationId]
      );
      if (!resRow.rows.length) {
        await client.query('ROLLBACK');
        throw Object.assign(new Error('RESERVATION_NOT_FOUND'), { code: 'RESERVATION_NOT_FOUND' });
      }
      const res = resRow.rows[0];

      if (res.status === 'confirmed') {
        // Idempotent — already confirmed
        await client.query('ROLLBACK');
        const existing = await pool.query(
          `SELECT id FROM coupon_redemptions WHERE coupon_id = $1 AND user_id = $2 AND order_id = $3 LIMIT 1`,
          [res.coupon_id, res.user_id, orderId]
        );
        return { redemptionId: existing.rows[0]?.id ?? 0, alreadyRedeemed: true };
      }

      if (res.status !== 'reserved') {
        await client.query('ROLLBACK');
        throw Object.assign(new Error(`RESERVATION_STATUS_${res.status.toUpperCase()}`), { code: 'RESERVATION_INVALID' });
      }

      if (new Date(res.expires_at) < new Date()) {
        await client.query('UPDATE coupon_reservations SET status = $1 WHERE reservation_id = $2', ['expired', reservationId]);
        await client.query('COMMIT');
        throw Object.assign(new Error('RESERVATION_EXPIRED'), { code: 'RESERVATION_EXPIRED' });
      }

      // Mark confirmed before coupon redemption (inside same TX)
      await client.query(
        `UPDATE coupon_reservations SET status = 'confirmed', confirmed_at = NOW(), order_id = $1 WHERE reservation_id = $2`,
        [orderId, reservationId]
      );

      await client.query('COMMIT');

      // Now atomically consume the coupon (its own TX with row-lock)
      const result = await couponService.redeemAtomic({
        couponId:            res.coupon_id,
        userId:              res.user_id,
        orderType:           res.order_type,
        orderId,
        issuanceId:          res.issuance_id ?? undefined,
        amountBeforeCents:   res.gross_amount_cents,
        discountAmountCents: res.discount_amount_cents,
        idempotencyKey:      res.idempotency_key ?? `confirm-${reservationId}-${orderId}`,
        ledgerEntryId,
      });

      logger.info('[Pricing] ✅ Reservation confirmed + coupon consumed', {
        reservationId, redemptionId: result.redemptionId, orderId,
      });

      return { redemptionId: result.redemptionId, alreadyRedeemed: result.alreadyRedeemed ?? false };
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch {}
      throw err;
    } finally {
      client.release();
    }
  }

  // ───────────────────────────────────────────
  // STEP 3b: ABANDON (booking/kiosk failed — coupon is NOT burned)
  // ───────────────────────────────────────────

  /**
   * Called when a booking or kiosk session fails after reserve().
   * Marks the reservation abandoned — coupon is freed immediately.
   * No coupon_redemptions row is ever written, so nothing needs to be restored.
   */
  async abandonReservation(reservationId: string, reason: string): Promise<void> {
    await pool.query(
      `UPDATE coupon_reservations SET status = 'abandoned', abandoned_at = NOW()
       WHERE reservation_id = $1 AND status = 'reserved'`,
      [reservationId]
    );
    logger.info('[Pricing] Reservation abandoned', { reservationId, reason });
  }

  // ───────────────────────────────────────────
  // RESTORE after confirmed booking is cancelled
  // ───────────────────────────────────────────

  /**
   * Restore a coupon that was consumed (booking was confirmed, then cancelled).
   * Wraps CouponService.restoreRedemption() with proper logging.
   */
  async restoreAfterCancellation(
    redemptionId: number,
    reason: 'user_cancel' | 'provider_cancel' | 'no_show' | 'kiosk_failure' | 'admin_refund' | 'system_error',
    note?: string,
  ): Promise<{ restored: boolean }> {
    const result = await couponService.restoreRedemption(redemptionId, reason, note);
    logger.info('[Pricing] Coupon restored after cancellation', { redemptionId, reason, restored: result.restored });
    return result;
  }

  // ───────────────────────────────────────────
  // EXPIRY SWEEP (run periodically or on-demand)
  // ───────────────────────────────────────────

  async expireStaleReservations(): Promise<number> {
    const res = await pool.query(
      `UPDATE coupon_reservations SET status = 'expired'
       WHERE status = 'reserved' AND expires_at < NOW()
       RETURNING id`
    );
    if (res.rowCount && res.rowCount > 0) {
      logger.info('[Pricing] Expired stale reservations', { count: res.rowCount });
    }
    return res.rowCount ?? 0;
  }
}

export const pricingService = new UnifiedPricingService();

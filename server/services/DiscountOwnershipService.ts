/**
 * DiscountOwnershipService — Priority 4
 * Configurable discount absorption rules for provider bookings.
 *
 * When a user uses a coupon on a sitter/walker/trainer/marketplace booking,
 * the discount cost must be absorbed by someone:
 *   - platform   → provider paid in full; platform eats the loss
 *   - provider   → provider receives post-discount amount
 *   - split      → each absorbs their configured percentage
 *
 * Rules are stored in coupon_discount_ownership table:
 *   - coupon_id = NULL  → default rule for that order_type
 *   - coupon_id = X     → override for specific coupon
 * Most specific rule wins: specific coupon > order_type default > global default.
 *
 * Provider payout calculation:
 *   If platform absorbs:  payout = pre-discount booking amount × (1 - commission_rate)
 *   If provider absorbs:  payout = post-discount booking amount × (1 - commission_rate)
 *   If split:             payout = (pre_discount × platform_pct/100 + post_discount × provider_pct/100) × (1 - commission_rate)
 */

import { pool } from '../db';
import { logger } from '../lib/logger';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type AbsorbedBy = 'platform' | 'provider' | 'split';

export interface OwnershipRule {
  absorbBy:    AbsorbedBy;
  platformPct: number;   // 0–100
  providerPct: number;   // 0–100
}

export interface PayoutResult {
  grossBookingCents:   number;
  couponDiscountCents: number;
  netBookingCents:     number;
  commissionRate:      number;
  commissionCents:     number;
  platformAbsorbsCents: number;
  providerAbsorbsCents: number;
  providerPayoutCents: number;
  rule: OwnershipRule;
}

// ─────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────

export class DiscountOwnershipService {

  /**
   * Resolve the ownership rule for a given coupon + order type.
   * Priority: specific coupon rule > order_type default > global default.
   */
  async resolveRule(couponId: number | null, orderType: string): Promise<OwnershipRule> {
    // 1. Try specific coupon + order_type
    if (couponId) {
      const specific = await pool.query(
        `SELECT absorb_by, platform_pct, provider_pct FROM coupon_discount_ownership
         WHERE coupon_id = $1 AND order_type = $2 LIMIT 1`,
        [couponId, orderType]
      );
      if (specific.rows.length) return this.toRule(specific.rows[0]);

      // 2. Try specific coupon, any order_type
      const couponDefault = await pool.query(
        `SELECT absorb_by, platform_pct, provider_pct FROM coupon_discount_ownership
         WHERE coupon_id = $1 AND order_type IS NULL LIMIT 1`,
        [couponId]
      );
      if (couponDefault.rows.length) return this.toRule(couponDefault.rows[0]);
    }

    // 3. Order-type default (coupon_id IS NULL)
    const typeDefault = await pool.query(
      `SELECT absorb_by, platform_pct, provider_pct FROM coupon_discount_ownership
       WHERE coupon_id IS NULL AND order_type = $1 LIMIT 1`,
      [orderType]
    );
    if (typeDefault.rows.length) return this.toRule(typeDefault.rows[0]);

    // 4. Global default — platform absorbs everything
    return { absorbBy: 'platform', platformPct: 100, providerPct: 0 };
  }

  /**
   * Compute the provider payout after applying the discount ownership rule.
   *
   * commissionRate: platform commission (0.0–1.0), e.g. 0.18 = 18%
   */
  async computeProviderPayout(params: {
    grossBookingCents:   number;
    couponDiscountCents: number;
    couponId:            number | null;
    orderType:           string;
    commissionRate:      number;
  }): Promise<PayoutResult> {
    const { grossBookingCents, couponDiscountCents, couponId, orderType, commissionRate } = params;
    const netBookingCents = Math.max(0, grossBookingCents - couponDiscountCents);

    const rule = await this.resolveRule(couponId, orderType);

    // Economic split:
    //   platformAbsorbs = discountCents × platformPct / 100
    //   providerAbsorbs = discountCents × providerPct / 100
    const platformAbsorbsCents = Math.round(couponDiscountCents * rule.platformPct / 100);
    const providerAbsorbsCents = Math.round(couponDiscountCents * rule.providerPct / 100);

    // Provider earns their share of the post-their-absorption amount
    // If provider absorbs some discount, their effective booking base is reduced.
    const providerBase = grossBookingCents - platformAbsorbsCents;  // platform already absorbs its share
    const commissionCents = Math.round(providerBase * commissionRate);
    const providerPayoutCents = Math.max(0, providerBase - commissionCents);

    logger.debug('[DiscountOwnership] Payout computed', {
      couponId, orderType, grossBookingCents, couponDiscountCents,
      rule, platformAbsorbsCents, providerAbsorbsCents,
      commissionCents, providerPayoutCents,
    });

    return {
      grossBookingCents,
      couponDiscountCents,
      netBookingCents,
      commissionRate,
      commissionCents,
      platformAbsorbsCents,
      providerAbsorbsCents,
      providerPayoutCents,
      rule,
    };
  }

  /**
   * Set a custom ownership rule. coupon_id = null = default for order_type.
   */
  async setRule(params: {
    couponId?:   number;
    orderType?:  string;
    absorbBy:    AbsorbedBy;
    platformPct: number;
    providerPct: number;
    notes?:      string;
  }): Promise<void> {
    const { couponId, orderType, absorbBy, platformPct, providerPct, notes } = params;
    if (Math.round(platformPct + providerPct) !== 100) {
      throw new Error('platform_pct + provider_pct must equal 100');
    }

    await pool.query(
      `INSERT INTO coupon_discount_ownership (coupon_id, order_type, absorb_by, platform_pct, provider_pct, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (coupon_id, order_type)
       DO UPDATE SET absorb_by = EXCLUDED.absorb_by,
                     platform_pct = EXCLUDED.platform_pct,
                     provider_pct = EXCLUDED.provider_pct,
                     notes = EXCLUDED.notes`,
      [couponId ?? null, orderType ?? null, absorbBy, platformPct, providerPct, notes ?? null]
    );
    logger.info('[DiscountOwnership] Rule set', { couponId, orderType, absorbBy, platformPct, providerPct });
  }

  async listRules(): Promise<any[]> {
    const rows = await pool.query(
      `SELECT cdo.*, c.code AS coupon_code FROM coupon_discount_ownership cdo
       LEFT JOIN coupons c ON c.id = cdo.coupon_id
       ORDER BY cdo.coupon_id NULLS LAST, cdo.order_type`
    );
    return rows.rows;
  }

  private toRule(row: any): OwnershipRule {
    return {
      absorbBy:    row.absorb_by as AbsorbedBy,
      platformPct: parseFloat(row.platform_pct),
      providerPct: parseFloat(row.provider_pct),
    };
  }
}

export const discountOwnershipService = new DiscountOwnershipService();

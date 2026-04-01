/**
 * CouponService — Backend-only coupon validation and redemption engine.
 *
 * All validation runs server-side. No discount logic lives on the frontend.
 * Discount amounts are written into the authoritative ledger at redemption time.
 */
import { db } from '../db';
import { eq, and, sql, lt, gt, gte } from 'drizzle-orm';
import { coupons, couponEligibilityRules, couponRedemptions, couponDeliveryEvents, users } from '../../shared/schema';
import { notificationPreferences } from '../../shared/schema-unified-platform';
import { logger } from '../lib/logger';
import { pool } from '../db';

export type OrderType =
  | 'kiosk_wash'
  | 'sitter_booking'
  | 'walker_booking'
  | 'wallet_topup'
  | 'loyalty_reward'
  | 'package_purchase';

export interface ValidateCouponInput {
  code: string;
  userId: string;
  orderType: OrderType;
  amountCents: number;
  providerId?: string;
  stationId?: string;
}

export interface ValidateCouponResult {
  valid: boolean;
  couponId?: number;
  discountType?: string;
  discountAmountCents?: number;
  amountAfterCents?: number;
  campaignName?: string;
  errorCode?: string;
  error?: string;
}

export interface RedeemCouponInput {
  couponId: number;
  userId: string;
  orderType: OrderType;
  orderId?: string;
  amountBeforeCents: number;
  discountAmountCents: number;
}

export interface SendCouponInput {
  couponId: number;
  userIds: string[];
  channel: 'sms' | 'push' | 'email' | 'in_app';
  messageId?: string;
}

export class CouponService {
  /**
   * Validate a coupon code at checkout. Returns the discount amount if valid.
   * All rules are enforced here — expiry, scope, eligibility, per-user limit, campaign cap.
   */
  async validateCoupon(input: ValidateCouponInput): Promise<ValidateCouponResult> {
    const { code, userId, orderType, amountCents } = input;

    const [coupon] = await db
      .select()
      .from(coupons)
      .where(eq(coupons.code, code.trim().toUpperCase()))
      .limit(1);

    if (!coupon) {
      return { valid: false, errorCode: 'COUPON_NOT_FOUND', error: 'קוד קופון לא קיים' };
    }

    if (!coupon.isActive) {
      return { valid: false, errorCode: 'COUPON_INACTIVE', error: 'קוד קופון אינו פעיל' };
    }

    const now = new Date();
    if (coupon.validFrom && now < new Date(coupon.validFrom)) {
      return { valid: false, errorCode: 'COUPON_NOT_STARTED', error: 'קוד קופון טרם פעיל' };
    }
    if (coupon.validUntil && now > new Date(coupon.validUntil)) {
      return { valid: false, errorCode: 'COUPON_EXPIRED', error: 'קוד קופון פג תוקף' };
    }

    const minSpend = coupon.minSpendCents ?? 0;
    if (amountCents < minSpend) {
      return {
        valid: false,
        errorCode: 'BELOW_MIN_SPEND',
        error: `מינימום רכישה: ₪${(minSpend / 100).toFixed(2)}`,
      };
    }

    const campaignCap = coupon.maxTotalRedemptions;
    if (campaignCap != null) {
      const total = coupon.totalRedemptions ?? 0;
      if (total >= campaignCap) {
        return { valid: false, errorCode: 'CAMPAIGN_CAP_REACHED', error: 'מכסת הקופון מוצתה' };
      }
    }

    const perUserLimit = coupon.maxRedemptionsPerUser ?? 1;
    const userUsageResult = await pool.query(
      `SELECT COUNT(*) AS cnt FROM coupon_redemptions WHERE coupon_id = $1 AND user_id = $2`,
      [coupon.id, userId]
    );
    const userUsage = parseInt(userUsageResult.rows[0]?.cnt ?? '0', 10);
    if (userUsage >= perUserLimit) {
      return { valid: false, errorCode: 'PER_USER_LIMIT_REACHED', error: 'כבר מימשת קופון זה' };
    }

    const scopeType = coupon.scopeType ?? 'global';
    if (scopeType !== 'global') {
      const allowed = this.isScopeAllowed(scopeType, orderType, coupon.scopeValue ?? undefined);
      if (!allowed) {
        return {
          valid: false,
          errorCode: 'SCOPE_MISMATCH',
          error: `קופון זה אינו תקף עבור ${this.orderTypeLabel(orderType)}`,
        };
      }
    }

    const eligibilityRules = await db
      .select()
      .from(couponEligibilityRules)
      .where(eq(couponEligibilityRules.couponId, coupon.id));

    if (eligibilityRules.length > 0) {
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      for (const rule of eligibilityRules) {
        const eligible = await this.checkEligibilityRule(rule.ruleType, rule.ruleValue ?? '', user);
        if (!eligible) {
          return {
            valid: false,
            errorCode: 'ELIGIBILITY_RULE_FAILED',
            error: `לא עומד בתנאי הקופון (${rule.ruleType})`,
          };
        }
      }
    }

    const discountAmountCents = this.computeDiscount(coupon, amountCents);
    const amountAfterCents = Math.max(0, amountCents - discountAmountCents);

    return {
      valid: true,
      couponId: coupon.id,
      discountType: coupon.discountType ?? 'fixed',
      discountAmountCents,
      amountAfterCents,
      campaignName: coupon.campaignName ?? coupon.description ?? code,
    };
  }

  /**
   * Write a coupon redemption to the authoritative ledger.
   * Must be called only after validateCoupon returns valid=true.
   * Atomically increments total_redemptions to prevent race-condition over-redemption.
   */
  async redeemCoupon(input: RedeemCouponInput): Promise<{ redemptionId: number }> {
    const { couponId, userId, orderType, orderId, amountBeforeCents, discountAmountCents } = input;
    const amountAfterCents = Math.max(0, amountBeforeCents - discountAmountCents);

    await pool.query(
      `UPDATE coupons
          SET total_redemptions = COALESCE(total_redemptions, 0) + 1,
              updated_at = NOW()
        WHERE id = $1
          AND (max_total_redemptions IS NULL OR total_redemptions < max_total_redemptions)`,
      [couponId]
    );

    const [redemption] = await db
      .insert(couponRedemptions)
      .values({
        couponId,
        userId,
        orderType,
        orderId: orderId ?? null,
        amountBeforeCents,
        discountAmountCents,
        amountAfterCents,
        currency: 'ILS',
      })
      .returning();

    logger.info('[CouponService] ✅ Coupon redeemed', {
      couponId,
      userId,
      orderType,
      discountAmountCents,
      redemptionId: redemption.id,
    });

    return { redemptionId: redemption.id };
  }

  /** Get all redemptions for a user */
  async getUserRedemptions(userId: string) {
    const rows = await pool.query(
      `SELECT cr.id, cr.coupon_id, c.code, c.campaign_name, cr.order_type, cr.order_id,
              cr.amount_before_cents, cr.discount_amount_cents, cr.amount_after_cents,
              cr.currency, cr.redeemed_at
         FROM coupon_redemptions cr
         JOIN coupons c ON c.id = cr.coupon_id
        WHERE cr.user_id = $1
        ORDER BY cr.redeemed_at DESC
        LIMIT 50`,
      [userId]
    );
    return rows.rows;
  }

  /**
   * Gate: check whether a user is allowed to receive a marketing coupon
   * on the given channel (SMS/push/email).
   * Returns { allowed, reason }.
   */
  async checkMarketingConsentGate(
    userId: string,
    channel: 'sms' | 'push' | 'email' | 'in_app'
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (channel === 'in_app') return { allowed: true };

    const [pref] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    if (!pref) {
      return { allowed: false, reason: 'NO_PREFERENCES_RECORD' };
    }

    if (channel === 'sms') {
      if (!pref.marketingSmsConsentAt) return { allowed: false, reason: 'NO_SMS_MARKETING_CONSENT' };
    } else if (channel === 'push') {
      if (!pref.marketingPushConsentAt) return { allowed: false, reason: 'NO_PUSH_MARKETING_CONSENT' };
      const status = pref.pushDevicePermissionStatus ?? 'not_determined';
      if (status !== 'granted') return { allowed: false, reason: `PUSH_DEVICE_PERMISSION_${status.toUpperCase()}` };
    } else if (channel === 'email') {
      if (!pref.marketingEmailConsentAt) return { allowed: false, reason: 'NO_EMAIL_MARKETING_CONSENT' };
    }

    return { allowed: true };
  }

  /** Record a delivery event for a coupon */
  async recordDeliveryEvent(input: {
    couponId: number;
    userId: string;
    channel: string;
    messageId?: string;
  }): Promise<void> {
    await db.insert(couponDeliveryEvents).values({
      couponId: input.couponId,
      userId: input.userId,
      channel: input.channel,
      messageId: input.messageId ?? null,
    });
  }

  /** Update a delivery event timestamp (delivered / opened / clicked / redeemed) */
  async trackDeliveryEvent(
    messageId: string,
    field: 'delivered_at' | 'opened_at' | 'clicked_at' | 'redeemed_at'
  ): Promise<void> {
    await pool.query(
      `UPDATE coupon_delivery_events SET ${field} = NOW() WHERE message_id = $1`,
      [messageId]
    );
  }

  private computeDiscount(coupon: typeof coupons.$inferSelect, amountCents: number): number {
    const dtype = coupon.discountType ?? 'fixed';
    if (dtype === 'percent') {
      const pct = parseFloat(String(coupon.discountPercent ?? 0));
      return Math.round((amountCents * pct) / 100);
    }
    if (dtype === 'free_service' || dtype === 'free_wash' || dtype === 'package_credit') {
      return amountCents;
    }
    return Math.round(parseFloat(String(coupon.discountAmount ?? 0)) * 100);
  }

  private isScopeAllowed(scopeType: string, orderType: string, scopeValue?: string): boolean {
    const map: Record<string, string[]> = {
      kiosk:        ['kiosk_wash'],
      booking:      ['sitter_booking', 'walker_booking'],
      sitter:       ['sitter_booking'],
      walker:       ['walker_booking'],
      wallet_topup: ['wallet_topup'],
      loyalty:      ['loyalty_reward'],
      first_order:  ['kiosk_wash', 'sitter_booking', 'walker_booking'],
    };
    const allowed = map[scopeType];
    if (!allowed) return false;
    return allowed.includes(orderType);
  }

  private orderTypeLabel(orderType: string): string {
    const labels: Record<string, string> = {
      kiosk_wash:      'שטיפת קיוסק',
      sitter_booking:  'הזמנת סיטר',
      walker_booking:  'הזמנת מטייל',
      wallet_topup:    'טעינת ארנק',
      loyalty_reward:  'תגמול נאמנות',
      package_purchase:'רכישת חבילה',
    };
    return labels[orderType] ?? orderType;
  }

  private async checkEligibilityRule(ruleType: string, ruleValue: string, user: any): Promise<boolean> {
    if (ruleType === 'first_order') {
      const res = await pool.query(
        `SELECT COUNT(*) AS cnt FROM coupon_redemptions WHERE user_id = $1`,
        [user?.id]
      );
      return parseInt(res.rows[0]?.cnt ?? '0', 10) === 0;
    }
    if (ruleType === 'birthday') {
      if (!user?.dateOfBirth) return false;
      const dob = new Date(user.dateOfBirth);
      const now = new Date();
      const birthMonth = dob.getMonth();
      const birthDay = dob.getDate();
      const thisYearBirthday = new Date(now.getFullYear(), birthMonth, birthDay);
      const daysDiff = Math.abs((now.getTime() - thisYearBirthday.getTime()) / (1000 * 60 * 60 * 24));
      const window = parseInt(ruleValue || '30', 10);
      return daysDiff <= window;
    }
    if (ruleType === 'loyalty_tier') {
      return (user?.loyaltyTier ?? 'bronze') === ruleValue;
    }
    if (ruleType === 'country') {
      return (user?.country ?? 'IL') === ruleValue;
    }
    if (ruleType === 'city') {
      return (user?.city ?? '') === ruleValue;
    }
    return true;
  }
}

export const couponService = new CouponService();

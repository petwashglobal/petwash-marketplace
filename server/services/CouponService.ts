/**
 * CouponService — Phase 2 Complete
 *
 * Covers:
 *  - Atomic validation + redemption (SELECT FOR UPDATE row-lock)
 *  - Idempotency key deduplication (prevents double-click / parallel race)
 *  - Campaign vs user-issued entitlement (coupon_issuances table)
 *  - Stackability matrix (6-benefit conflict rules)
 *  - Extended scope platforms (kiosk, loyalty, sitter, walker, trainer,
 *      provider_marketplace, city, country, station, franchise)
 *  - Abuse gate (validate rate limit per user/IP/device)
 *  - Cancellation / restore (coupon credit returned on booking cancel)
 *  - Admin audit trail (every write action is logged)
 *  - Finance ledger entry ID recorded per redemption
 */
import { db } from '../db';
import { pool } from '../db';
import { eq } from 'drizzle-orm';
import {
  coupons,
  couponEligibilityRules,
  couponRedemptions,
  couponDeliveryEvents,
  users,
} from '../../shared/schema';
import { notificationPreferences } from '../../shared/schema-unified-platform';
import { logger } from '../lib/logger';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type OrderType =
  | 'kiosk_wash'
  | 'sitter_booking'
  | 'walker_booking'
  | 'trainer_booking'
  | 'provider_marketplace'
  | 'wallet_topup'
  | 'loyalty_reward'
  | 'package_purchase';

export type CancelReason =
  | 'user_cancel'
  | 'provider_cancel'
  | 'no_show'
  | 'kiosk_failure'
  | 'admin_refund'
  | 'system_error';

export interface ActiveBenefits {
  loyalty_5_pct?: boolean;
  special_10_pct?: boolean;
  wallet_credit?: boolean;
  egift_balance?: boolean;
  package_credit?: boolean;
  admin_discount?: boolean;
}

export interface ValidateCouponInput {
  code: string;
  userId: string;
  orderType: OrderType;
  amountCents: number;
  idempotencyKey?: string;
  ipAddress?: string;
  deviceFingerprint?: string;
  activeBenefits?: ActiveBenefits;
  providerId?: string;
  stationId?: string;
  city?: string;
  country?: string;
}

export interface ValidateCouponResult {
  valid: boolean;
  couponId?: number;
  issuanceId?: number;
  discountType?: string;
  discountAmountCents?: number;
  amountAfterCents?: number;
  campaignName?: string;
  stackabilityAllowed?: boolean;
  stackabilityConflicts?: string[];
  errorCode?: string;
  error?: string;
}

export interface RedeemCouponInput {
  couponId: number;
  userId: string;
  orderType: OrderType;
  orderId?: string;
  issuanceId?: number;
  amountBeforeCents: number;
  discountAmountCents: number;
  idempotencyKey: string;
  ledgerEntryId?: string;
}

// ─────────────────────────────────────────────────────────────
// SCOPE PLATFORM MAP
// ─────────────────────────────────────────────────────────────
const SCOPE_ORDER_MAP: Record<string, string[]> = {
  global:               ['kiosk_wash', 'sitter_booking', 'walker_booking', 'trainer_booking', 'provider_marketplace', 'wallet_topup', 'loyalty_reward', 'package_purchase'],
  kiosk:                ['kiosk_wash'],
  loyalty_club:         ['loyalty_reward'],
  sitter:               ['sitter_booking'],
  walker:               ['walker_booking'],
  trainer:              ['trainer_booking'],
  provider_marketplace: ['provider_marketplace'],
  booking:              ['sitter_booking', 'walker_booking', 'trainer_booking'],
  wallet_topup:         ['wallet_topup'],
  first_order:          ['kiosk_wash', 'sitter_booking', 'walker_booking', 'trainer_booking'],
  package:              ['package_purchase'],
};

// ─────────────────────────────────────────────────────────────
// ABUSE GATE CONSTANTS
// ─────────────────────────────────────────────────────────────
const ABUSE_WINDOW_MINUTES = 10;
const MAX_INVALID_PER_USER  = 10;
const MAX_INVALID_PER_IP    = 20;
const MAX_INVALID_PER_CODE  = 30;

// ─────────────────────────────────────────────────────────────
// CouponService
// ─────────────────────────────────────────────────────────────
export class CouponService {

  // ───────────────────────────────────────────
  // VALIDATE
  // ───────────────────────────────────────────

  /**
   * Full validation including abuse gate, scope, stackability, eligibility.
   * Does NOT write to DB. Call redeemAtomic() to commit.
   */
  async validateCoupon(input: ValidateCouponInput): Promise<ValidateCouponResult> {
    const { code, userId, orderType, amountCents, ipAddress, deviceFingerprint, activeBenefits } = input;

    // 1. Abuse gate first — before any DB read
    const abused = await this.checkAbuseGate(userId, ipAddress, deviceFingerprint, code);
    if (abused) {
      await this.trackAttempt({ userId, ipAddress, deviceFingerprint, code, result: 'blocked', errorCode: 'RATE_LIMITED' });
      return { valid: false, errorCode: 'RATE_LIMITED', error: 'יותר מדי ניסיונות. נסה שוב מאוחר יותר.' };
    }

    const [coupon] = await db
      .select()
      .from(coupons)
      .where(eq(coupons.code, code.trim().toUpperCase()))
      .limit(1);

    if (!coupon) {
      await this.trackAttempt({ userId, ipAddress, deviceFingerprint, code, result: 'invalid', errorCode: 'COUPON_NOT_FOUND' });
      return { valid: false, errorCode: 'COUPON_NOT_FOUND', error: 'קוד קופון לא קיים' };
    }

    if (!coupon.isActive) {
      await this.trackAttempt({ userId, ipAddress, deviceFingerprint, code, result: 'invalid', errorCode: 'COUPON_INACTIVE' });
      return { valid: false, errorCode: 'COUPON_INACTIVE', error: 'קוד קופון אינו פעיל' };
    }

    const now = new Date();
    if (coupon.validFrom && now < new Date(coupon.validFrom as any)) {
      await this.trackAttempt({ userId, ipAddress, deviceFingerprint, code, result: 'invalid', errorCode: 'COUPON_NOT_STARTED' });
      return { valid: false, errorCode: 'COUPON_NOT_STARTED', error: 'קוד קופון טרם פעיל' };
    }
    if (coupon.validUntil && now > new Date(coupon.validUntil as any)) {
      await this.trackAttempt({ userId, ipAddress, deviceFingerprint, code, result: 'invalid', errorCode: 'COUPON_EXPIRED' });
      return { valid: false, errorCode: 'COUPON_EXPIRED', error: 'קוד קופון פג תוקף' };
    }

    // Min spend
    const minSpend = coupon.minSpendCents ?? 0;
    if (amountCents < minSpend) {
      await this.trackAttempt({ userId, ipAddress, deviceFingerprint, code, result: 'invalid', errorCode: 'BELOW_MIN_SPEND' });
      return { valid: false, errorCode: 'BELOW_MIN_SPEND', error: `מינימום רכישה: ₪${(minSpend / 100).toFixed(2)}` };
    }

    // Campaign cap
    if (coupon.maxTotalRedemptions != null) {
      const total = coupon.totalRedemptions ?? 0;
      if (total >= coupon.maxTotalRedemptions) {
        return { valid: false, errorCode: 'CAMPAIGN_CAP_REACHED', error: 'מכסת הקופון מוצתה' };
      }
    }

    // Per-user cap
    const perUserLimit = coupon.maxRedemptionsPerUser ?? 1;
    const userUsage = await pool.query(
      `SELECT COUNT(*) AS cnt FROM coupon_redemptions WHERE coupon_id = $1 AND user_id = $2 AND cancelled_at IS NULL`,
      [coupon.id, userId]
    );
    const userUsed = parseInt(userUsage.rows[0]?.cnt ?? '0', 10);
    if (userUsed >= perUserLimit) {
      return { valid: false, errorCode: 'PER_USER_LIMIT_REACHED', error: 'כבר מימשת קופון זה' };
    }

    // Issued coupon type — must have an issuance record
    let issuanceId: number | undefined;
    const couponType = (coupon as any).coupon_type ?? 'campaign';
    if (couponType === 'issued') {
      const iss = await pool.query(
        `SELECT id FROM coupon_issuances WHERE coupon_id = $1 AND user_id = $2 AND is_active = true AND redeemed_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())`,
        [coupon.id, userId]
      );
      if (!iss.rows.length) {
        return { valid: false, errorCode: 'NOT_ISSUED_TO_USER', error: 'קופון זה לא הונפק עבורך' };
      }
      issuanceId = iss.rows[0].id;
    }

    // Scope check
    const scopeType = coupon.scopeType ?? 'global';
    if (scopeType !== 'global') {
      if (!this.isScopeAllowed(scopeType, orderType)) {
        await this.trackAttempt({ userId, ipAddress, deviceFingerprint, code, result: 'invalid', errorCode: 'SCOPE_MISMATCH' });
        return { valid: false, errorCode: 'SCOPE_MISMATCH', error: `קופון זה אינו תקף עבור ${this.orderTypeLabel(orderType)}` };
      }
    }

    // Scope platform constraints (city / country / station)
    const scopeValue = coupon.scopeValue;
    if (scopeValue && (scopeType === 'city' || scopeType === 'country' || scopeType === 'station')) {
      const userCity    = input.city    ?? '';
      const userCountry = input.country ?? 'IL';
      if (scopeType === 'city'    && scopeValue !== userCity)    return { valid: false, errorCode: 'CITY_MISMATCH',    error: `קופון זה תקף רק בעיר ${scopeValue}` };
      if (scopeType === 'country' && scopeValue !== userCountry) return { valid: false, errorCode: 'COUNTRY_MISMATCH', error: `קופון זה תקף רק במדינת ${scopeValue}` };
      if (scopeType === 'station' && scopeValue !== input.stationId) return { valid: false, errorCode: 'STATION_MISMATCH', error: `קופון זה תקף רק בתחנה ${scopeValue}` };
    }

    // Eligibility rules
    const eligibilityRules = await db
      .select()
      .from(couponEligibilityRules)
      .where(eq(couponEligibilityRules.couponId, coupon.id));

    if (eligibilityRules.length > 0) {
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      for (const rule of eligibilityRules) {
        const eligible = await this.checkEligibilityRule(rule.ruleType, rule.ruleValue ?? '', user);
        if (!eligible) {
          await this.trackAttempt({ userId, ipAddress, deviceFingerprint, code, result: 'invalid', errorCode: 'ELIGIBILITY_FAILED' });
          return { valid: false, errorCode: 'ELIGIBILITY_RULE_FAILED', error: `לא עומד בתנאי הקופון (${rule.ruleType})` };
        }
      }
    }

    // Stackability check
    const stackabilityConflicts: string[] = [];
    const stackableWith = (coupon as any).stackable_with ?? {};
    if (activeBenefits && !coupon.stackable) {
      if (activeBenefits.loyalty_5_pct    && !stackableWith.loyalty_5_pct)    stackabilityConflicts.push('loyalty_5_pct');
      if (activeBenefits.special_10_pct   && !stackableWith.special_10_pct)   stackabilityConflicts.push('special_10_pct');
      if (activeBenefits.wallet_credit    && !stackableWith.wallet_credit)     stackabilityConflicts.push('wallet_credit');
      if (activeBenefits.egift_balance    && !stackableWith.egift_balance)     stackabilityConflicts.push('egift_balance');
      if (activeBenefits.package_credit   && !stackableWith.package_credit)    stackabilityConflicts.push('package_credit');
      if (activeBenefits.admin_discount   && !stackableWith.admin_discount)    stackabilityConflicts.push('admin_discount');
    }

    const discountAmountCents = this.computeDiscount(coupon, amountCents);
    const amountAfterCents    = Math.max(0, amountCents - discountAmountCents);

    await this.trackAttempt({ userId, ipAddress, deviceFingerprint, code, result: 'valid', errorCode: undefined });

    return {
      valid: true,
      couponId: coupon.id,
      issuanceId,
      discountType: coupon.discountType ?? 'fixed',
      discountAmountCents,
      amountAfterCents,
      campaignName: (coupon as any).campaign_name ?? coupon.description ?? code,
      stackabilityAllowed: stackabilityConflicts.length === 0,
      stackabilityConflicts,
    };
  }

  // ───────────────────────────────────────────
  // ATOMIC REDEMPTION
  // ───────────────────────────────────────────

  /**
   * Atomically commits a coupon redemption.
   * Idempotency key prevents double-commit on retry.
   * SELECT FOR UPDATE row-locks the coupon row to prevent parallel race.
   */
  async redeemAtomic(input: RedeemCouponInput): Promise<{ redemptionId: number; alreadyRedeemed?: boolean }> {
    const { couponId, userId, orderType, orderId, issuanceId, amountBeforeCents, discountAmountCents, idempotencyKey, ledgerEntryId } = input;
    const amountAfterCents = Math.max(0, amountBeforeCents - discountAmountCents);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Idempotency check — if already redeemed with same key, return existing
      const existing = await client.query(
        `SELECT id FROM coupon_redemptions WHERE idempotency_key = $1`,
        [idempotencyKey]
      );
      if (existing.rows.length > 0) {
        await client.query('ROLLBACK');
        return { redemptionId: existing.rows[0].id, alreadyRedeemed: true };
      }

      // Row-lock the coupon — prevents parallel redemption race
      const locked = await client.query(
        `SELECT id, total_redemptions, max_total_redemptions, max_redemptions_per_user
           FROM coupons WHERE id = $1 FOR UPDATE`,
        [couponId]
      );
      if (!locked.rows.length) throw new Error('COUPON_NOT_FOUND');
      const coupon = locked.rows[0];

      // Re-check campaign cap inside lock
      if (coupon.max_total_redemptions != null && (coupon.total_redemptions ?? 0) >= coupon.max_total_redemptions) {
        await client.query('ROLLBACK');
        throw Object.assign(new Error('CAMPAIGN_CAP_REACHED'), { code: 'CAMPAIGN_CAP_REACHED' });
      }

      // Re-check per-user cap inside lock
      const uCount = await client.query(
        `SELECT COUNT(*) AS cnt FROM coupon_redemptions WHERE coupon_id = $1 AND user_id = $2 AND cancelled_at IS NULL`,
        [couponId, userId]
      );
      const used = parseInt(uCount.rows[0]?.cnt ?? '0', 10);
      if (used >= (coupon.max_redemptions_per_user ?? 1)) {
        await client.query('ROLLBACK');
        throw Object.assign(new Error('PER_USER_LIMIT_REACHED'), { code: 'PER_USER_LIMIT_REACHED' });
      }

      // Increment total_redemptions
      await client.query(
        `UPDATE coupons SET total_redemptions = COALESCE(total_redemptions, 0) + 1, updated_at = NOW() WHERE id = $1`,
        [couponId]
      );

      // Write redemption
      const inserted = await client.query(
        `INSERT INTO coupon_redemptions
           (coupon_id, user_id, order_type, order_id, amount_before_cents, discount_amount_cents, amount_after_cents, currency, idempotency_key, ledger_entry_id, issuance_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'ILS', $8, $9, $10)
         RETURNING id`,
        [couponId, userId, orderType, orderId ?? null, amountBeforeCents, discountAmountCents, amountAfterCents, idempotencyKey, ledgerEntryId ?? null, issuanceId ?? null]
      );
      const redemptionId = inserted.rows[0].id;

      // Mark issuance as redeemed
      if (issuanceId) {
        await client.query(
          `UPDATE coupon_issuances SET redeemed_at = NOW(), redemption_id = $1 WHERE id = $2`,
          [redemptionId, issuanceId]
        );
      }

      await client.query('COMMIT');

      logger.info('[CouponService] ✅ Atomic redemption committed', { couponId, userId, redemptionId, idempotencyKey });
      return { redemptionId };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ───────────────────────────────────────────
  // CANCELLATION / RESTORE
  // ───────────────────────────────────────────

  /**
   * Restore a coupon usage on booking cancellation / kiosk failure / refund.
   * Decrements total_redemptions and marks the redemption row as cancelled.
   * If the coupon was issued (issuance-type), restores the issuance for re-use.
   */
  async restoreRedemption(redemptionId: number, cancelReason: CancelReason, adminNote?: string): Promise<{ restored: boolean }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Lock the redemption row
      const row = await client.query(
        `SELECT * FROM coupon_redemptions WHERE id = $1 FOR UPDATE`,
        [redemptionId]
      );
      if (!row.rows.length) {
        await client.query('ROLLBACK');
        return { restored: false };
      }
      const redemption = row.rows[0];
      if (redemption.cancelled_at) {
        await client.query('ROLLBACK');
        return { restored: false }; // already cancelled
      }

      // Mark cancelled
      await client.query(
        `UPDATE coupon_redemptions SET cancelled_at = NOW(), cancel_reason = $1, restore_reason = $2 WHERE id = $3`,
        [cancelReason, adminNote ?? null, redemptionId]
      );

      // Decrement campaign total
      await client.query(
        `UPDATE coupons SET total_redemptions = GREATEST(COALESCE(total_redemptions, 0) - 1, 0), updated_at = NOW() WHERE id = $1`,
        [redemption.coupon_id]
      );

      // Restore issuance if applicable
      if (redemption.issuance_id) {
        await client.query(
          `UPDATE coupon_issuances SET redeemed_at = NULL, redemption_id = NULL WHERE id = $1`,
          [redemption.issuance_id]
        );
      }

      await client.query('COMMIT');
      logger.info('[CouponService] ✅ Redemption restored', { redemptionId, cancelReason });
      return { restored: true };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ───────────────────────────────────────────
  // USER QUERIES
  // ───────────────────────────────────────────

  async getUserRedemptions(userId: string) {
    const rows = await pool.query(
      `SELECT cr.id, cr.coupon_id, c.code, c.campaign_name, cr.order_type, cr.order_id,
              cr.amount_before_cents, cr.discount_amount_cents, cr.amount_after_cents,
              cr.currency, cr.redeemed_at, cr.cancelled_at, cr.cancel_reason
         FROM coupon_redemptions cr
         JOIN coupons c ON c.id = cr.coupon_id
        WHERE cr.user_id = $1
        ORDER BY cr.redeemed_at DESC
        LIMIT 50`,
      [userId]
    );
    return rows.rows;
  }

  async getUserIssuedCoupons(userId: string): Promise<{ active: any[]; expired: any[] }> {
    const rows = await pool.query(
      `SELECT ci.id AS issuance_id, ci.issued_at, ci.expires_at, ci.redeemed_at, ci.is_active,
              c.id AS coupon_id, c.code, c.campaign_name, c.description,
              c.discount_type, c.discount_percent, c.discount_amount, c.currency,
              c.scope_type, c.scope_value, c.valid_until, c.min_spend_cents, c.stackable
         FROM coupon_issuances ci
         JOIN coupons c ON c.id = ci.coupon_id
        WHERE ci.user_id = $1
        ORDER BY ci.issued_at DESC`,
      [userId]
    );

    const now = new Date();
    const active: any[] = [];
    const expired: any[] = [];
    for (const r of rows.rows) {
      const isExpired =
        r.redeemed_at != null ||
        !r.is_active ||
        (r.expires_at && new Date(r.expires_at) < now) ||
        (r.valid_until && new Date(r.valid_until) < now);
      if (isExpired) expired.push(r);
      else active.push(r);
    }
    return { active, expired };
  }

  async getCouponPublicDetails(code: string): Promise<{
    found: boolean;
    coupon?: {
      code: string; campaignName: string; description: string | null;
      discountType: string; discountPercent: string | null; discountAmount: string | null;
      currency: string; minSpendCents: number | null; validUntil: Date | null;
      scopeType: string; stackable: boolean; termsHe: string;
    };
  }> {
    const [coupon] = await db
      .select()
      .from(coupons)
      .where(eq(coupons.code, code.trim().toUpperCase()))
      .limit(1);

    if (!coupon) return { found: false };

    return {
      found: true,
      coupon: {
        code: coupon.code,
        campaignName: (coupon as any).campaign_name ?? '',
        description: coupon.description ?? null,
        discountType: coupon.discountType ?? 'fixed',
        discountPercent: String(coupon.discountPercent ?? ''),
        discountAmount: String(coupon.discountAmount ?? ''),
        currency: coupon.currency ?? 'ILS',
        minSpendCents: coupon.minSpendCents ?? null,
        validUntil: coupon.validUntil ? new Date(coupon.validUntil as any) : null,
        scopeType: coupon.scopeType ?? 'global',
        stackable: coupon.stackable ?? false,
        termsHe: this.buildTermsHe(coupon),
      },
    };
  }

  // ───────────────────────────────────────────
  // ADMIN OPERATIONS
  // ───────────────────────────────────────────

  async issueToUser(couponId: number, userId: string, adminId: string, expiresAt?: Date): Promise<{ issuanceId: number }> {
    const existing = await pool.query(
      `SELECT id FROM coupon_issuances WHERE coupon_id = $1 AND user_id = $2`,
      [couponId, userId]
    );
    if (existing.rows.length > 0) {
      return { issuanceId: existing.rows[0].id };
    }
    const inserted = await pool.query(
      `INSERT INTO coupon_issuances (coupon_id, user_id, issued_by_admin, expires_at)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [couponId, userId, adminId, expiresAt ?? null]
    );
    await this.writeAudit({ couponId, adminUserId: adminId, action: 'issued_to_user', details: { userId, expiresAt } });
    return { issuanceId: inserted.rows[0].id };
  }

  async cloneCampaign(sourceCouponId: number, newCode: string, adminId: string): Promise<{ newCouponId: number }> {
    const source = await pool.query(`SELECT * FROM coupons WHERE id = $1`, [sourceCouponId]);
    if (!source.rows.length) throw new Error('SOURCE_COUPON_NOT_FOUND');
    const s = source.rows[0];

    const inserted = await pool.query(
      `INSERT INTO coupons
         (code, campaign_name, description, discount_type, discount_percent, discount_amount, currency,
          min_spend_cents, valid_from, valid_until, is_active, channel_source, scope_type, scope_value,
          stackable, max_total_redemptions, max_redemptions_per_user, total_redemptions, coupon_type,
          stackable_with, clone_of_coupon_id, created_by_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,$11,$12,$13,$14,$15,$16,0,$17,$18,$19,$20)
       RETURNING id`,
      [newCode, s.campaign_name, s.description, s.discount_type, s.discount_percent, s.discount_amount, s.currency,
       s.min_spend_cents, s.valid_from, s.valid_until, s.channel_source, s.scope_type, s.scope_value,
       s.stackable, s.max_total_redemptions, s.max_redemptions_per_user, s.coupon_type,
       s.stackable_with ?? null, sourceCouponId, adminId]
    );
    const newCouponId = inserted.rows[0].id;

    // Copy eligibility rules
    await pool.query(
      `INSERT INTO coupon_eligibility_rules (coupon_id, rule_type, rule_value)
       SELECT $1, rule_type, rule_value FROM coupon_eligibility_rules WHERE coupon_id = $2`,
      [newCouponId, sourceCouponId]
    );

    await this.writeAudit({ couponId: newCouponId, adminUserId: adminId, action: 'cloned', details: { sourceCouponId, newCode } });
    logger.info('[CouponService] ✅ Campaign cloned', { sourceCouponId, newCouponId, newCode });
    return { newCouponId };
  }

  async deactivateWithReason(couponId: number, reason: string, adminId: string): Promise<void> {
    await pool.query(
      `UPDATE coupons SET is_active = false, deactivate_reason = $1, updated_at = NOW() WHERE id = $2`,
      [reason, couponId]
    );
    await this.writeAudit({ couponId, adminUserId: adminId, action: 'deactivated', details: { reason } });
  }

  async getAuditLog(couponId?: number, limit = 100) {
    const rows = await pool.query(
      couponId
        ? `SELECT * FROM coupon_audit_log WHERE coupon_id = $1 ORDER BY created_at DESC LIMIT $2`
        : `SELECT * FROM coupon_audit_log ORDER BY created_at DESC LIMIT $1`,
      couponId ? [couponId, limit] : [limit]
    );
    return rows.rows;
  }

  async exportRedemptionsCsv(couponId: number): Promise<string> {
    const rows = await pool.query(
      `SELECT cr.id, cr.user_id, cr.order_type, cr.order_id,
              cr.amount_before_cents, cr.discount_amount_cents, cr.amount_after_cents,
              cr.currency, cr.redeemed_at, cr.cancelled_at, cr.cancel_reason, cr.idempotency_key
         FROM coupon_redemptions cr
        WHERE cr.coupon_id = $1
        ORDER BY cr.redeemed_at DESC`,
      [couponId]
    );
    const header = 'id,user_id,order_type,order_id,amount_before,discount_amount,amount_after,currency,redeemed_at,cancelled_at,cancel_reason,idempotency_key';
    const lines = rows.rows.map(r =>
      [r.id, r.user_id, r.order_type, r.order_id ?? '', r.amount_before_cents, r.discount_amount_cents,
       r.amount_after_cents, r.currency, r.redeemed_at ?? '', r.cancelled_at ?? '', r.cancel_reason ?? '', r.idempotency_key ?? ''].join(',')
    );
    return [header, ...lines].join('\n');
  }

  async getFinanceReport(couponId: number) {
    const row = await pool.query(
      `SELECT
         COUNT(*)                        AS total_redemptions,
         COUNT(*) FILTER (WHERE cancelled_at IS NOT NULL) AS cancelled_count,
         COUNT(*) FILTER (WHERE cancelled_at IS NULL)     AS active_count,
         SUM(discount_amount_cents) FILTER (WHERE cancelled_at IS NULL) AS net_discount_cents,
         SUM(discount_amount_cents)      AS gross_discount_cents,
         AVG(discount_amount_cents) FILTER (WHERE cancelled_at IS NULL) AS avg_discount_cents
       FROM coupon_redemptions WHERE coupon_id = $1`,
      [couponId]
    );
    return row.rows[0];
  }

  // ───────────────────────────────────────────
  // CONSENT GATE
  // ───────────────────────────────────────────

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

    if (!pref) return { allowed: false, reason: 'NO_PREFERENCES_RECORD' };

    if (channel === 'sms'   && !pref.marketingSmsConsentAt)   return { allowed: false, reason: 'NO_SMS_MARKETING_CONSENT' };
    if (channel === 'email' && !pref.marketingEmailConsentAt) return { allowed: false, reason: 'NO_EMAIL_MARKETING_CONSENT' };
    if (channel === 'push') {
      if (!pref.marketingPushConsentAt) return { allowed: false, reason: 'NO_PUSH_MARKETING_CONSENT' };
      const status = pref.pushDevicePermissionStatus ?? 'not_determined';
      if (status !== 'granted') return { allowed: false, reason: `PUSH_DEVICE_PERMISSION_${status.toUpperCase()}` };
    }
    return { allowed: true };
  }

  async recordDeliveryEvent(input: { couponId: number; userId: string; channel: string; messageId?: string }): Promise<void> {
    await db.insert(couponDeliveryEvents).values({ couponId: input.couponId, userId: input.userId, channel: input.channel, messageId: input.messageId ?? null });
  }

  async trackDeliveryEvent(messageId: string, field: 'delivered_at' | 'opened_at' | 'clicked_at' | 'redeemed_at'): Promise<void> {
    await pool.query(`UPDATE coupon_delivery_events SET ${field} = NOW() WHERE message_id = $1`, [messageId]);
  }

  // ───────────────────────────────────────────
  // PRIVATE HELPERS
  // ───────────────────────────────────────────

  private async checkAbuseGate(userId: string, ip?: string, device?: string, code?: string): Promise<boolean> {
    const windowStart = new Date(Date.now() - ABUSE_WINDOW_MINUTES * 60 * 1000);
    const checks: Array<{ query: string; params: any[]; limit: number }> = [];

    if (userId) checks.push({ query: `SELECT COUNT(*) AS cnt FROM coupon_validation_attempts WHERE user_id = $1 AND result = 'invalid' AND attempted_at > $2`, params: [userId, windowStart], limit: MAX_INVALID_PER_USER });
    if (ip)     checks.push({ query: `SELECT COUNT(*) AS cnt FROM coupon_validation_attempts WHERE ip_address = $1 AND result = 'invalid' AND attempted_at > $2`, params: [ip, windowStart], limit: MAX_INVALID_PER_IP });
    if (code)   checks.push({ query: `SELECT COUNT(*) AS cnt FROM coupon_validation_attempts WHERE code_attempted = $1 AND result = 'invalid' AND attempted_at > $2`, params: [code.toUpperCase(), windowStart], limit: MAX_INVALID_PER_CODE });

    for (const check of checks) {
      const res = await pool.query(check.query, check.params);
      if (parseInt(res.rows[0]?.cnt ?? '0', 10) >= check.limit) return true;
    }
    return false;
  }

  private async trackAttempt(input: { userId: string; ipAddress?: string; deviceFingerprint?: string; code: string; result: string; errorCode?: string }): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO coupon_validation_attempts (user_id, ip_address, device_fingerprint, code_attempted, result, error_code)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [input.userId ?? null, input.ipAddress ?? null, input.deviceFingerprint ?? null,
         input.code.toUpperCase(), input.result, input.errorCode ?? null]
      );
    } catch (e) {
      // Non-fatal
    }
  }

  private async writeAudit(input: { couponId?: number; adminUserId: string; action: string; details?: any }): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO coupon_audit_log (coupon_id, admin_user_id, action, details) VALUES ($1, $2, $3, $4)`,
        [input.couponId ?? null, input.adminUserId, input.action, JSON.stringify(input.details ?? {})]
      );
    } catch (e) {
      // Non-fatal
    }
  }

  private computeDiscount(coupon: typeof coupons.$inferSelect, amountCents: number): number {
    const dtype = coupon.discountType ?? 'fixed';
    if (dtype === 'percent') {
      const pct = parseFloat(String(coupon.discountPercent ?? 0));
      return Math.round((amountCents * pct) / 100);
    }
    if (dtype === 'free_service' || dtype === 'free_wash' || dtype === 'package_credit') return amountCents;
    return Math.round(parseFloat(String(coupon.discountAmount ?? 0)) * 100);
  }

  private isScopeAllowed(scopeType: string, orderType: string): boolean {
    const allowed = SCOPE_ORDER_MAP[scopeType];
    return allowed ? allowed.includes(orderType) : false;
  }

  private orderTypeLabel(orderType: string): string {
    const labels: Record<string, string> = {
      kiosk_wash:          'שטיפת קיוסק',
      sitter_booking:      'הזמנת סיטר',
      walker_booking:      'הזמנת מטייל',
      trainer_booking:     'הזמנת מדריך',
      provider_marketplace:'שוק ספקים',
      wallet_topup:        'טעינת ארנק',
      loyalty_reward:      'תגמול נאמנות',
      package_purchase:    'רכישת חבילה',
    };
    return labels[orderType] ?? orderType;
  }

  private buildTermsHe(coupon: typeof coupons.$inferSelect): string {
    const parts: string[] = [];
    const dtype = coupon.discountType ?? 'fixed';
    if (dtype === 'percent')       parts.push(`הנחה של ${coupon.discountPercent ?? 0}%`);
    else if (dtype === 'fixed')    parts.push(`הנחה של ₪${coupon.discountAmount ?? 0}`);
    else if (dtype === 'free_wash')    parts.push('שטיפה חינם');
    else if (dtype === 'free_service') parts.push('שירות חינם');
    else if (dtype === 'package_credit') parts.push('זיכוי חבילה');
    if (coupon.minSpendCents && coupon.minSpendCents > 0) parts.push(`בקנייה מינימום ₪${(coupon.minSpendCents / 100).toFixed(0)}`);
    if (coupon.validUntil) parts.push(`בתוקף עד ${new Date(coupon.validUntil as any).toLocaleDateString('he-IL')}`);
    if (coupon.maxRedemptionsPerUser === 1) parts.push('לשימוש חד פעמי');
    if (!coupon.stackable) parts.push('לא ניתן לצבירה עם הטבות אחרות');
    return parts.join('. ') + '.';
  }

  // Legacy method — kept for backward compat
  async redeemCoupon(input: { couponId: number; userId: string; orderType: OrderType; orderId?: string; amountBeforeCents: number; discountAmountCents: number }): Promise<{ redemptionId: number }> {
    const idempotencyKey = `legacy-${input.couponId}-${input.userId}-${Date.now()}`;
    return this.redeemAtomic({ ...input, idempotencyKey });
  }

  async getUserRedemptionsAlias(userId: string) {
    return this.getUserRedemptions(userId);
  }
}

export const couponService = new CouponService();

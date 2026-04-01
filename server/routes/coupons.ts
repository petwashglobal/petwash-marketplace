/**
 * Coupon Engine API Routes
 *
 * All coupon validation is backend-only. No discount logic lives on the frontend.
 *
 * Public (authenticated):
 *   POST /api/coupons/validate        — validate a code at checkout
 *   POST /api/coupons/redeem          — record redemption + write to ledger
 *   GET  /api/coupons/my-redemptions  — user's own redemption history
 *   GET  /api/coupons/my-preferences  — user's notification preferences
 *   POST /api/coupons/consent         — record marketing consent for a channel
 *
 * Admin:
 *   GET    /api/admin/coupons              — list all coupons
 *   POST   /api/admin/coupons              — create coupon + eligibility rules
 *   PATCH  /api/admin/coupons/:id          — update coupon
 *   DELETE /api/admin/coupons/:id          — deactivate coupon
 *   GET    /api/admin/coupons/:id/stats    — redemption stats
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { couponService } from '../services/CouponService';
import { db } from '../db';
import { pool } from '../db';
import { coupons, couponEligibilityRules } from '../../shared/schema';
import { notificationPreferences } from '../../shared/schema-unified-platform';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';
import type { AuthenticatedRequest } from '../middleware/rbac';
import { requireAdmin } from '../middleware/rbac';

const router = Router();

// ─────────────────────────────────────────────────────────────
// SCHEMA VALIDATORS
// ─────────────────────────────────────────────────────────────
const validateSchema = z.object({
  code: z.string().min(1).max(64),
  orderType: z.enum(['kiosk_wash', 'sitter_booking', 'walker_booking', 'wallet_topup', 'loyalty_reward', 'package_purchase']),
  amountCents: z.number().int().min(0),
  providerId: z.string().optional(),
  stationId: z.string().optional(),
});

const redeemSchema = z.object({
  couponId: z.number().int().positive(),
  orderType: z.enum(['kiosk_wash', 'sitter_booking', 'walker_booking', 'wallet_topup', 'loyalty_reward', 'package_purchase']),
  orderId: z.string().optional(),
  amountBeforeCents: z.number().int().min(0),
  discountAmountCents: z.number().int().min(0),
});

const createCouponSchema = z.object({
  code: z.string().min(1).max(64).transform(s => s.trim().toUpperCase()),
  campaignName: z.string().min(1).max(120),
  description: z.string().optional(),
  discountType: z.enum(['fixed', 'percent', 'free_service', 'free_wash', 'package_credit']),
  discountValue: z.number().min(0),
  currency: z.string().length(3).default('ILS'),
  minSpendCents: z.number().int().min(0).default(0),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  channelSource: z.enum(['sms', 'push', 'email', 'admin', 'app_banner', 'qr', 'referral']).optional(),
  scopeType: z.enum(['global', 'kiosk', 'booking', 'sitter', 'walker', 'loyalty', 'wallet_topup', 'first_order']).default('global'),
  scopeValue: z.string().optional(),
  stackable: z.boolean().default(false),
  maxTotalRedemptions: z.number().int().positive().optional(),
  maxRedemptionsPerUser: z.number().int().positive().default(1),
  eligibilityRules: z.array(z.object({
    ruleType: z.enum(['birthday', 'loyalty_tier', 'first_order', 'holiday', 'city', 'country', 'user_segment']),
    ruleValue: z.string().optional(),
  })).default([]),
});

const consentSchema = z.object({
  channel: z.enum(['sms', 'push', 'email']),
  granted: z.boolean(),
  pushDevicePermissionStatus: z.enum(['granted', 'denied', 'not_determined', 'provisional', 'ephemeral']).optional(),
});

// ─────────────────────────────────────────────────────────────
// USER ROUTES
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/coupons/validate
 * Backend-only validation. Returns discount amount. Does NOT write to DB.
 */
router.post('/validate', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.firebaseUser?.uid;
  if (!userId) return res.status(401).json({ error: 'AUTH_REQUIRED' });

  const parsed = validateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ valid: false, error: 'בקשה לא תקינה', details: parsed.error.flatten() });
  }

  try {
    const result = await couponService.validateCoupon({ ...parsed.data, userId });
    return res.json(result);
  } catch (err: any) {
    logger.error('[Coupons] validateCoupon error', { err: err.message, userId });
    return res.status(500).json({ valid: false, errorCode: 'INTERNAL_ERROR', error: 'שגיאה פנימית בבדיקת הקופון' });
  }
});

/**
 * POST /api/coupons/redeem
 * Write redemption to ledger. Atomically increments total_redemptions counter.
 * Call this only after validate returned valid=true AND the order is confirmed.
 */
router.post('/redeem', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.firebaseUser?.uid;
  if (!userId) return res.status(401).json({ error: 'AUTH_REQUIRED' });

  const parsed = redeemSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'בקשה לא תקינה', details: parsed.error.flatten() });
  }

  try {
    const reValidation = await couponService.validateCoupon({
      code: '',
      userId,
      orderType: parsed.data.orderType,
      amountCents: parsed.data.amountBeforeCents,
    });

    const couponId = parsed.data.couponId;
    const userUsage = await pool.query(
      `SELECT COUNT(*) AS cnt FROM coupon_redemptions WHERE coupon_id = $1 AND user_id = $2`,
      [couponId, userId]
    );
    const used = parseInt(userUsage.rows[0]?.cnt ?? '0', 10);
    const [coupon] = await db.select({ maxPerUser: coupons.maxRedemptionsPerUser }).from(coupons).where(eq(coupons.id, couponId)).limit(1);
    if (used >= (coupon?.maxPerUser ?? 1)) {
      return res.status(409).json({ error: 'כבר מימשת קופון זה', errorCode: 'PER_USER_LIMIT_REACHED' });
    }

    const result = await couponService.redeemCoupon({ ...parsed.data, userId });
    return res.json({ success: true, ...result });
  } catch (err: any) {
    logger.error('[Coupons] redeemCoupon error', { err: err.message, userId });
    return res.status(500).json({ error: 'שגיאה פנימית במימוש הקופון' });
  }
});

/**
 * GET /api/coupons/my-redemptions
 * Returns the authenticated user's redemption history.
 */
router.get('/my-redemptions', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.firebaseUser?.uid;
  if (!userId) return res.status(401).json({ error: 'AUTH_REQUIRED' });

  try {
    const redemptions = await couponService.getUserRedemptions(userId);
    return res.json({ redemptions });
  } catch (err: any) {
    logger.error('[Coupons] getUserRedemptions error', { err: err.message, userId });
    return res.status(500).json({ error: 'שגיאה בטעינת היסטוריית קופונים' });
  }
});

/**
 * GET /api/coupons/my-preferences
 * Returns the user's notification consent preferences.
 */
router.get('/my-preferences', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.firebaseUser?.uid;
  if (!userId) return res.status(401).json({ error: 'AUTH_REQUIRED' });

  try {
    const [pref] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    return res.json({ preferences: pref ?? null });
  } catch (err: any) {
    logger.error('[Coupons] getPreferences error', { err: err.message, userId });
    return res.status(500).json({ error: 'שגיאה בטעינת הגדרות' });
  }
});

/**
 * POST /api/coupons/consent
 * Record or revoke marketing consent for a channel.
 * This is the authoritative consent endpoint — stores timestamp when granted.
 */
router.post('/consent', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.firebaseUser?.uid;
  if (!userId) return res.status(401).json({ error: 'AUTH_REQUIRED' });

  const parsed = consentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'בקשה לא תקינה', details: parsed.error.flatten() });
  }

  const { channel, granted, pushDevicePermissionStatus } = parsed.data;
  const now = new Date();

  const consentField: Record<string, string> = {
    sms:   'marketing_sms_consent_at',
    push:  'marketing_push_consent_at',
    email: 'marketing_email_consent_at',
  };

  try {
    const colName = consentField[channel];
    const consentValue = granted ? now.toISOString() : null;

    let query = `
      INSERT INTO notification_preferences (user_id, ${colName}, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id) DO UPDATE SET ${colName} = $2, updated_at = NOW()
    `;
    const params: any[] = [userId, consentValue];

    if (channel === 'push' && pushDevicePermissionStatus) {
      query = `
        INSERT INTO notification_preferences (user_id, ${colName}, push_device_permission_status, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id) DO UPDATE SET ${colName} = $2, push_device_permission_status = $3, updated_at = NOW()
      `;
      params.push(pushDevicePermissionStatus);
    }

    await pool.query(query, params);

    logger.info('[Coupons/Consent] ✅ Marketing consent updated', { userId, channel, granted });
    return res.json({ success: true, channel, granted });
  } catch (err: any) {
    logger.error('[Coupons/Consent] Error saving consent', { err: err.message, userId, channel });
    return res.status(500).json({ error: 'שגיאה בשמירת הסכמה' });
  }
});

export default router;

// ─────────────────────────────────────────────────────────────
// ADMIN ROUTER — mounted at /api/admin/coupons
// ─────────────────────────────────────────────────────────────
export const adminCouponRouter = Router();

/**
 * GET /api/admin/coupons
 * List all coupons with stats.
 */
adminCouponRouter.get('/', async (req: Request, res: Response) => {
  try {
    const rows = await pool.query(`
      SELECT
        c.*,
        (SELECT COUNT(*) FROM coupon_redemptions cr WHERE cr.coupon_id = c.id) AS redemption_count,
        (SELECT COUNT(*) FROM coupon_eligibility_rules cer WHERE cer.coupon_id = c.id) AS rule_count
      FROM coupons c
      ORDER BY c.created_at DESC
      LIMIT 200
    `);
    return res.json({ coupons: rows.rows });
  } catch (err: any) {
    logger.error('[Coupons/Admin] list error', { err: err.message });
    return res.status(500).json({ error: 'שגיאה בטעינת קופונים' });
  }
});

/**
 * POST /api/admin/coupons
 * Create a new coupon with optional eligibility rules.
 */
adminCouponRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  const parsed = createCouponSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'בקשה לא תקינה', details: parsed.error.flatten() });
  }

  const d = parsed.data;
  const adminId = (req as any).userId || req.firebaseUser?.uid || null;

  try {
    const discountPercent = d.discountType === 'percent' ? String(d.discountValue) : null;
    const discountAmount  = d.discountType === 'fixed'   ? String(d.discountValue) : null;

    const [coupon] = await db.insert(coupons).values({
      code:                  d.code,
      campaignName:          d.campaignName,
      description:           d.description ?? null,
      discountType:          d.discountType,
      discountPercent:       discountPercent as any,
      discountAmount:        discountAmount as any,
      currency:              d.currency,
      minSpendCents:         d.minSpendCents,
      validFrom:             d.startsAt ? new Date(d.startsAt) : new Date(),
      validUntil:            d.endsAt ? new Date(d.endsAt) : null,
      isActive:              true,
      channelSource:         d.channelSource ?? null,
      scopeType:             d.scopeType,
      scopeValue:            d.scopeValue ?? null,
      stackable:             d.stackable,
      maxTotalRedemptions:   d.maxTotalRedemptions ?? null,
      maxRedemptionsPerUser: d.maxRedemptionsPerUser,
      totalRedemptions:      0,
      createdByUserId:       adminId,
    }).returning();

    if (d.eligibilityRules.length > 0) {
      await db.insert(couponEligibilityRules).values(
        d.eligibilityRules.map(r => ({
          couponId:  coupon.id,
          ruleType:  r.ruleType,
          ruleValue: r.ruleValue ?? null,
        }))
      );
    }

    logger.info('[Coupons/Admin] ✅ Coupon created', { couponId: coupon.id, code: coupon.code, adminId });
    return res.status(201).json({ success: true, coupon });
  } catch (err: any) {
    if (err?.code === '23505') {
      return res.status(409).json({ error: `קוד קופון '${d.code}' כבר קיים`, errorCode: 'DUPLICATE_CODE' });
    }
    logger.error('[Coupons/Admin] create error', { err: err.message });
    return res.status(500).json({ error: 'שגיאה ביצירת קופון' });
  }
});

/**
 * PATCH /api/admin/coupons/:id
 * Update coupon fields (active status, dates, limits, etc.)
 */
adminCouponRouter.patch('/:id', async (req: Request, res: Response) => {
  const couponId = parseInt(req.params.id, 10);
  if (isNaN(couponId)) return res.status(400).json({ error: 'מזהה קופון לא תקין' });

  const allowed = ['campaign_name', 'description', 'is_active', 'valid_from', 'valid_until',
    'min_spend_cents', 'max_total_redemptions', 'max_redemptions_per_user',
    'scope_type', 'scope_value', 'stackable', 'channel_source'];

  const updates: Record<string, any> = {};
  for (const key of allowed) {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    if (req.body[camel] !== undefined) updates[key] = req.body[camel];
    else if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'אין שדות לעדכון' });
  }

  try {
    const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ');
    const values = [couponId, ...Object.values(updates)];
    await pool.query(
      `UPDATE coupons SET ${setClauses}, updated_at = NOW() WHERE id = $1`,
      values
    );
    return res.json({ success: true });
  } catch (err: any) {
    logger.error('[Coupons/Admin] update error', { err: err.message, couponId });
    return res.status(500).json({ error: 'שגיאה בעדכון קופון' });
  }
});

/**
 * DELETE /api/admin/coupons/:id
 * Deactivates a coupon (soft delete — sets is_active=false).
 */
adminCouponRouter.delete('/:id', async (req: Request, res: Response) => {
  const couponId = parseInt(req.params.id, 10);
  if (isNaN(couponId)) return res.status(400).json({ error: 'מזהה קופון לא תקין' });

  try {
    await pool.query(`UPDATE coupons SET is_active = false, updated_at = NOW() WHERE id = $1`, [couponId]);
    return res.json({ success: true });
  } catch (err: any) {
    logger.error('[Coupons/Admin] deactivate error', { err: err.message, couponId });
    return res.status(500).json({ error: 'שגיאה בביטול קופון' });
  }
});

/**
 * GET /api/admin/coupons/:id/stats
 * Redemption stats for a single coupon.
 */
adminCouponRouter.get('/:id/stats', async (req: Request, res: Response) => {
  const couponId = parseInt(req.params.id, 10);
  if (isNaN(couponId)) return res.status(400).json({ error: 'מזהה קופון לא תקין' });

  try {
    const couponRow = await pool.query(`SELECT * FROM coupons WHERE id = $1`, [couponId]);
    if (!couponRow.rows.length) return res.status(404).json({ error: 'קופון לא נמצא' });

    const stats = await pool.query(`
      SELECT
        COUNT(*)                                     AS total_redemptions,
        COUNT(DISTINCT user_id)                      AS unique_users,
        SUM(discount_amount_cents)                   AS total_discount_cents,
        AVG(discount_amount_cents)                   AS avg_discount_cents,
        MIN(redeemed_at)                             AS first_redeemed_at,
        MAX(redeemed_at)                             AS last_redeemed_at
      FROM coupon_redemptions
      WHERE coupon_id = $1
    `, [couponId]);

    const delivery = await pool.query(`
      SELECT
        channel,
        COUNT(*)                       AS sent,
        COUNT(delivered_at)            AS delivered,
        COUNT(opened_at)               AS opened,
        COUNT(clicked_at)              AS clicked,
        COUNT(redeemed_at)             AS redeemed
      FROM coupon_delivery_events
      WHERE coupon_id = $1
      GROUP BY channel
    `, [couponId]);

    const rules = await pool.query(
      `SELECT rule_type, rule_value FROM coupon_eligibility_rules WHERE coupon_id = $1`, [couponId]
    );

    return res.json({
      coupon:   couponRow.rows[0],
      stats:    stats.rows[0],
      delivery: delivery.rows,
      rules:    rules.rows,
    });
  } catch (err: any) {
    logger.error('[Coupons/Admin] stats error', { err: err.message, couponId });
    return res.status(500).json({ error: 'שגיאה בטעינת סטטיסטיקות' });
  }
});

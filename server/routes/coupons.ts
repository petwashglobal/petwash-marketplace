/**
 * Coupon Engine API Routes — Phase 2
 *
 * User routes (authenticated, /api/coupons):
 *   POST /validate            — validate code at checkout (abuse-gated)
 *   POST /redeem              — atomic redemption with idempotency key
 *   POST /restore/:id         — restore redemption on cancellation
 *   GET  /my-redemptions      — user's redemption history
 *   GET  /my-coupons          — user's issued coupons (active + expired)
 *   GET  /details/:code       — public coupon details (where usable, terms)
 *   GET  /my-preferences      — notification preferences
 *   POST /consent             — record marketing consent
 *
 * Admin routes (admin, /api/admin/coupons):
 *   GET    /                    — list all coupons
 *   POST   /                    — create coupon
 *   PATCH  /:id                 — update fields
 *   POST   /:id/deactivate      — deactivate with reason + audit
 *   POST   /:id/clone           — clone campaign
 *   POST   /:id/issue-to-user   — issue personal coupon to a user
 *   GET    /:id/stats           — full stats
 *   GET    /:id/export          — CSV export
 *   GET    /:id/finance         — finance / ledger summary
 *   GET    /audit-log           — full audit trail
 *   GET    /:id/audit-log       — per-coupon audit trail
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
import { logAuditEvent } from '../middleware/auditLog';
import type { AuthenticatedRequest } from '../middleware/rbac';

/**
 * PR-W34b: every admin coupon mutation now writes a hash-chained
 * audit_events row in addition to the existing coupon_audit_log entry.
 * coupon_audit_log is operational (queryable per-coupon); audit_events
 * is the legal forensic log and the canonical record of admin actions.
 *
 * Fire-and-forget so a slow Postgres write never blocks the admin's
 * response (matches the pattern from PR-W34a escrow).
 */
function emitCouponAudit(params: {
  actionType: string;
  actorUserId: string | null | undefined;
  couponId: number | string | null | undefined;
  couponCode?: string | null;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}): void {
  setImmediate(() => {
    logAuditEvent({
      actorUserId: params.actorUserId ?? undefined,
      actorRole: 'admin',
      actionType: params.actionType,
      targetType: 'coupon',
      targetId: params.couponId != null ? String(params.couponId) : undefined,
      ip: params.ip,
      userAgent: params.userAgent,
      metadata: {
        couponCode: params.couponCode,
        ...params.metadata,
      },
    }).catch((e) =>
      logger.warn('[Coupons/Admin] audit_events write failed (non-blocking)', { error: e?.message }),
    );
  });
}
import { requireAdmin } from '../middleware/rbac';

const router = Router();

// ─────────────────────────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────────────────────────

const ORDER_TYPES = ['kiosk_wash', 'sitter_booking', 'walker_booking', 'trainer_booking', 'provider_marketplace', 'wallet_topup', 'loyalty_reward', 'package_purchase'] as const;

const validateSchema = z.object({
  code:              z.string().min(1).max(64),
  orderType:         z.enum(ORDER_TYPES),
  amountCents:       z.number().int().min(0),
  idempotencyKey:    z.string().optional(),
  deviceFingerprint: z.string().optional(),
  stationId:         z.string().optional(),
  city:              z.string().optional(),
  country:           z.string().optional(),
  activeBenefits: z.object({
    loyalty_5_pct:  z.boolean().optional(),
    special_10_pct: z.boolean().optional(),
    wallet_credit:  z.boolean().optional(),
    egift_balance:  z.boolean().optional(),
    package_credit: z.boolean().optional(),
    admin_discount: z.boolean().optional(),
  }).optional(),
});

const redeemSchema = z.object({
  couponId:            z.number().int().positive(),
  orderType:           z.enum(ORDER_TYPES),
  orderId:             z.string().optional(),
  issuanceId:          z.number().int().positive().optional(),
  amountBeforeCents:   z.number().int().min(0),
  discountAmountCents: z.number().int().min(0),
  idempotencyKey:      z.string().min(1).max(128),
  ledgerEntryId:       z.string().optional(),
});

const restoreSchema = z.object({
  cancelReason: z.enum(['user_cancel', 'provider_cancel', 'no_show', 'kiosk_failure', 'admin_refund', 'system_error']),
  adminNote:    z.string().optional(),
});

const consentSchema = z.object({
  channel:                    z.enum(['sms', 'push', 'email']),
  granted:                    z.boolean(),
  pushDevicePermissionStatus: z.enum(['granted', 'denied', 'not_determined', 'provisional', 'ephemeral']).optional(),
});

const SCOPE_OPTIONS = ['global', 'kiosk', 'loyalty_club', 'sitter', 'walker', 'trainer', 'provider_marketplace', 'booking', 'wallet_topup', 'first_order', 'package', 'city', 'country', 'station', 'franchise'] as const;
const CHANNEL_OPTIONS = ['sms', 'push', 'email', 'admin', 'app_banner', 'qr', 'referral'] as const;

const createCouponSchema = z.object({
  code:                  z.string().min(1).max(64).transform(s => s.trim().toUpperCase()),
  campaignName:          z.string().min(1).max(120),
  description:           z.string().optional(),
  couponType:            z.enum(['campaign', 'issued']).default('campaign'),
  discountType:          z.enum(['fixed', 'percent', 'free_service', 'free_wash', 'package_credit']),
  discountValue:         z.number().min(0),
  currency:              z.string().length(3).default('ILS'),
  minSpendCents:         z.number().int().min(0).default(0),
  startsAt:              z.string().optional(),
  endsAt:                z.string().optional(),
  channelSource:         z.enum(CHANNEL_OPTIONS).optional(),
  scopeType:             z.enum(SCOPE_OPTIONS).default('global'),
  scopeValue:            z.string().optional(),
  stackable:             z.boolean().default(false),
  stackableWith:         z.object({
    loyalty_5_pct:  z.boolean().default(false),
    special_10_pct: z.boolean().default(false),
    wallet_credit:  z.boolean().default(true),
    egift_balance:  z.boolean().default(true),
    package_credit: z.boolean().default(false),
    admin_discount: z.boolean().default(false),
  }).optional(),
  maxTotalRedemptions:   z.number().int().positive().optional(),
  maxRedemptionsPerUser: z.number().int().positive().default(1),
  perDeviceLimit:        z.number().int().positive().optional(),
  perPhoneLimit:         z.number().int().positive().optional(),
  perEmailLimit:         z.number().int().positive().optional(),
  audienceEstimate:      z.number().int().positive().optional(),
  eligibilityRules:      z.array(z.object({
    ruleType:  z.enum(['birthday', 'loyalty_tier', 'first_order', 'holiday', 'city', 'country', 'user_segment']),
    ruleValue: z.string().optional(),
  })).default([]),
});

// ─────────────────────────────────────────────────────────────
// USER ROUTES
// ─────────────────────────────────────────────────────────────

router.post('/validate', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.firebaseUser?.uid;
  if (!userId) return res.status(401).json({ error: 'AUTH_REQUIRED' });

  const parsed = validateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ valid: false, error: 'בקשה לא תקינה', details: parsed.error.flatten() });

  try {
    const ipAddress = req.headers['x-forwarded-for']?.toString().split(',')[0] ?? req.socket.remoteAddress;
    const result = await couponService.validateCoupon({
      ...parsed.data,
      userId,
      ipAddress,
    });
    return res.json(result);
  } catch (err: any) {
    logger.error('[Coupons] validateCoupon error', { err: err.message, userId });
    return res.status(500).json({ valid: false, errorCode: 'INTERNAL_ERROR', error: 'שגיאה פנימית' });
  }
});

router.post('/redeem', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.firebaseUser?.uid;
  if (!userId) return res.status(401).json({ error: 'AUTH_REQUIRED' });

  const parsed = redeemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'בקשה לא תקינה', details: parsed.error.flatten() });

  try {
    const result = await couponService.redeemAtomic({ ...parsed.data, userId });
    if (result.alreadyRedeemed) {
      return res.json({ success: true, idempotent: true, redemptionId: result.redemptionId });
    }
    return res.json({ success: true, redemptionId: result.redemptionId });
  } catch (err: any) {
    const code = err?.code ?? '';
    if (code === 'CAMPAIGN_CAP_REACHED')  return res.status(409).json({ error: 'מכסת הקופון מוצתה', errorCode: code });
    if (code === 'PER_USER_LIMIT_REACHED') return res.status(409).json({ error: 'כבר מימשת קופון זה', errorCode: code });
    logger.error('[Coupons] redeemAtomic error', { err: err.message, userId });
    return res.status(500).json({ error: 'שגיאה פנימית במימוש הקופון' });
  }
});

router.post('/restore/:id', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.firebaseUser?.uid;
  if (!userId) return res.status(401).json({ error: 'AUTH_REQUIRED' });

  const redemptionId = parseInt(req.params.id, 10);
  if (isNaN(redemptionId)) return res.status(400).json({ error: 'מזהה לא תקין' });

  // Only allow restore by the owning user or admin
  const check = await pool.query(`SELECT user_id FROM coupon_redemptions WHERE id = $1`, [redemptionId]);
  if (!check.rows.length) return res.status(404).json({ error: 'מימוש לא נמצא' });
  if (check.rows[0].user_id !== userId) return res.status(403).json({ error: 'גישה נדחתה' });

  const parsed = restoreSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'בקשה לא תקינה' });

  try {
    const result = await couponService.restoreRedemption(redemptionId, parsed.data.cancelReason, parsed.data.adminNote);
    return res.json(result);
  } catch (err: any) {
    logger.error('[Coupons] restoreRedemption error', { err: err.message });
    return res.status(500).json({ error: 'שגיאה בשחזור קופון' });
  }
});

router.get('/my-redemptions', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.firebaseUser?.uid;
  if (!userId) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  try {
    const redemptions = await couponService.getUserRedemptions(userId);
    return res.json({ redemptions });
  } catch (err: any) {
    logger.error('[Coupons] getUserRedemptions error', { err: err.message });
    return res.status(500).json({ error: 'שגיאה בטעינת היסטוריה' });
  }
});

router.get('/my-coupons', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.firebaseUser?.uid;
  if (!userId) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  try {
    const result = await couponService.getUserIssuedCoupons(userId);
    return res.json(result);
  } catch (err: any) {
    logger.error('[Coupons] getUserIssuedCoupons error', { err: err.message });
    return res.status(500).json({ error: 'שגיאה בטעינת קופונים' });
  }
});

router.get('/details/:code', async (req: AuthenticatedRequest, res: Response) => {
  const code = req.params.code;
  if (!code) return res.status(400).json({ error: 'קוד חסר' });
  try {
    const result = await couponService.getCouponPublicDetails(code);
    if (!result.found) return res.status(404).json({ error: 'קופון לא נמצא' });
    return res.json(result.coupon);
  } catch (err: any) {
    logger.error('[Coupons] getCouponPublicDetails error', { err: err.message });
    return res.status(500).json({ error: 'שגיאה פנימית' });
  }
});

router.get('/my-preferences', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.firebaseUser?.uid;
  if (!userId) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  try {
    const [pref] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId)).limit(1);
    return res.json({ preferences: pref ?? null });
  } catch (err: any) {
    return res.status(500).json({ error: 'שגיאה בטעינת הגדרות' });
  }
});

router.post('/consent', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.firebaseUser?.uid;
  if (!userId) return res.status(401).json({ error: 'AUTH_REQUIRED' });

  const parsed = consentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'בקשה לא תקינה', details: parsed.error.flatten() });

  const { channel, granted, pushDevicePermissionStatus } = parsed.data;
  const consentField: Record<string, string> = { sms: 'marketing_sms_consent_at', push: 'marketing_push_consent_at', email: 'marketing_email_consent_at' };
  const now = granted ? new Date().toISOString() : null;
  const colName = consentField[channel];

  try {
    if (channel === 'push' && pushDevicePermissionStatus) {
      await pool.query(
        `INSERT INTO notification_preferences (user_id, ${colName}, push_device_permission_status, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id) DO UPDATE SET ${colName} = $2, push_device_permission_status = $3, updated_at = NOW()`,
        [userId, now, pushDevicePermissionStatus]
      );
    } else {
      await pool.query(
        `INSERT INTO notification_preferences (user_id, ${colName}, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id) DO UPDATE SET ${colName} = $2, updated_at = NOW()`,
        [userId, now]
      );
    }
    return res.json({ success: true, channel, granted });
  } catch (err: any) {
    logger.error('[Coupons/Consent] error', { err: err.message });
    return res.status(500).json({ error: 'שגיאה בשמירת הסכמה' });
  }
});

// ─────────────────────────────────────────────────────────────
// ADMIN ROUTER
// ─────────────────────────────────────────────────────────────
export default router;

export const adminCouponRouter = Router();

adminCouponRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const rows = await pool.query(`
      SELECT c.*,
        (SELECT COUNT(*) FROM coupon_redemptions cr WHERE cr.coupon_id = c.id AND cr.cancelled_at IS NULL) AS redemption_count,
        (SELECT COUNT(*) FROM coupon_eligibility_rules cer WHERE cer.coupon_id = c.id)                     AS rule_count,
        (SELECT COUNT(*) FROM coupon_issuances ci WHERE ci.coupon_id = c.id)                               AS issuance_count
      FROM coupons c ORDER BY c.created_at DESC LIMIT 200
    `);
    return res.json({ coupons: rows.rows });
  } catch (err: any) {
    logger.error('[Coupons/Admin] list error', { err: err.message });
    return res.status(500).json({ error: 'שגיאה בטעינת קופונים' });
  }
});

adminCouponRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  const parsed = createCouponSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'בקשה לא תקינה', details: parsed.error.flatten() });

  const d = parsed.data;
  const adminId = req.firebaseUser?.uid ?? null;

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

    // Write extended columns via raw SQL
    const extra: Record<string, any> = {};
    if (d.stackableWith)    extra.stackable_with      = JSON.stringify(d.stackableWith);
    if (d.audienceEstimate) extra.audience_estimate   = d.audienceEstimate;
    if (d.perDeviceLimit)   extra.per_device_limit    = d.perDeviceLimit;
    if (d.perPhoneLimit)    extra.per_phone_limit     = d.perPhoneLimit;
    if (d.perEmailLimit)    extra.per_email_limit     = d.perEmailLimit;
    extra.coupon_type = d.couponType;

    if (Object.keys(extra).length > 0) {
      const setClauses = Object.keys(extra).map((k, i) => `${k} = $${i + 2}`).join(', ');
      await pool.query(`UPDATE coupons SET ${setClauses} WHERE id = $1`, [coupon.id, ...Object.values(extra)]);
    }

    if (d.eligibilityRules.length > 0) {
      await db.insert(couponEligibilityRules).values(
        d.eligibilityRules.map(r => ({ couponId: coupon.id, ruleType: r.ruleType, ruleValue: r.ruleValue ?? null }))
      );
    }

    // Write audit
    await pool.query(
      `INSERT INTO coupon_audit_log (coupon_id, admin_user_id, action, details) VALUES ($1, $2, 'created', $3)`,
      [coupon.id, adminId, JSON.stringify({ code: coupon.code, discountType: d.discountType, campaignName: d.campaignName })]
    );

    emitCouponAudit({
      actionType: 'COUPON_CREATE',
      actorUserId: adminId,
      couponId: coupon.id,
      couponCode: coupon.code,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: {
        discountType: d.discountType,
        discountValue: d.discountValue,
        campaignName: d.campaignName,
        scopeType: d.scopeType,
        maxTotalRedemptions: d.maxTotalRedemptions ?? null,
      },
    });

    logger.info('[Coupons/Admin] ✅ Coupon created', { couponId: coupon.id, code: coupon.code });
    return res.status(201).json({ success: true, coupon });
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ error: `קוד קופון '${d.code}' כבר קיים`, errorCode: 'DUPLICATE_CODE' });
    logger.error('[Coupons/Admin] create error', { err: err.message });
    return res.status(500).json({ error: 'שגיאה ביצירת קופון' });
  }
});

adminCouponRouter.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const couponId = parseInt(req.params.id, 10);
  if (isNaN(couponId)) return res.status(400).json({ error: 'מזהה לא תקין' });

  const allowed = ['campaign_name', 'description', 'valid_from', 'valid_until',
    'min_spend_cents', 'max_total_redemptions', 'max_redemptions_per_user',
    'scope_type', 'scope_value', 'stackable', 'channel_source',
    'audience_estimate', 'per_device_limit', 'per_phone_limit', 'per_email_limit'];

  const updates: Record<string, any> = {};
  const allowedSet = new Set(allowed);
  for (const key of allowed) {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    if (Object.prototype.hasOwnProperty.call(req.body, camel)) updates[key] = req.body[camel];
    else if (Object.prototype.hasOwnProperty.call(req.body, key)) updates[key] = req.body[key];
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'stackableWith')) {
    updates.stackable_with = JSON.stringify(req.body.stackableWith);
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'אין שדות לעדכון' });

  try {
    // Build parameterized query only from whitelisted column names
    const safeKeys = Object.keys(updates).filter(k => allowedSet.has(k) || k === 'stackable_with');
    const safeValues = safeKeys.map(k => updates[k]);
    const setClauses = safeKeys.map((k, i) => `${k} = $${i + 2}`).join(', ');
    await pool.query(`UPDATE coupons SET ${setClauses}, updated_at = NOW() WHERE id = $1`, [couponId, ...safeValues]);

    const adminId = req.firebaseUser?.uid ?? null;
    await pool.query(
      `INSERT INTO coupon_audit_log (coupon_id, admin_user_id, action, details) VALUES ($1, $2, 'updated', $3)`,
      [couponId, adminId, JSON.stringify(updates)]
    );
    emitCouponAudit({
      actionType: 'COUPON_UPDATE',
      actorUserId: adminId,
      couponId,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: { fields: Object.keys(updates) },
    });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'שגיאה בעדכון קופון' });
  }
});

adminCouponRouter.post('/:id/deactivate', async (req: AuthenticatedRequest, res: Response) => {
  const couponId = parseInt(req.params.id, 10);
  if (isNaN(couponId)) return res.status(400).json({ error: 'מזהה לא תקין' });

  const reason = req.body?.reason;
  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    return res.status(400).json({ error: 'סיבה לביטול חובה' });
  }
  const adminId = req.firebaseUser?.uid ?? 'unknown';
  try {
    await couponService.deactivateWithReason(couponId, reason.trim(), adminId);
    emitCouponAudit({
      actionType: 'COUPON_DEACTIVATE',
      actorUserId: adminId,
      couponId,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: { reason: reason.trim() },
    });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'שגיאה בביטול קופון' });
  }
});

adminCouponRouter.post('/:id/clone', async (req: AuthenticatedRequest, res: Response) => {
  const couponId = parseInt(req.params.id, 10);
  if (isNaN(couponId)) return res.status(400).json({ error: 'מזהה לא תקין' });

  const newCode = req.body?.newCode?.trim().toUpperCase();
  if (!newCode) return res.status(400).json({ error: 'קוד קופון חדש חובה' });

  const adminId = req.firebaseUser?.uid ?? 'unknown';
  try {
    const result = await couponService.cloneCampaign(couponId, newCode, adminId);
    emitCouponAudit({
      actionType: 'COUPON_CLONE',
      actorUserId: adminId,
      couponId: result.newCouponId,
      couponCode: newCode,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: { sourceCouponId: couponId },
    });
    return res.status(201).json({ success: true, newCouponId: result.newCouponId });
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ error: `קוד '${newCode}' כבר קיים`, errorCode: 'DUPLICATE_CODE' });
    return res.status(500).json({ error: 'שגיאה בשכפול קמפיין' });
  }
});

adminCouponRouter.post('/:id/issue-to-user', async (req: AuthenticatedRequest, res: Response) => {
  const couponId = parseInt(req.params.id, 10);
  if (isNaN(couponId)) return res.status(400).json({ error: 'מזהה לא תקין' });

  const userId   = req.body?.userId;
  const expiresAt = req.body?.expiresAt ? new Date(req.body.expiresAt) : undefined;
  if (!userId) return res.status(400).json({ error: 'מזהה משתמש חובה' });

  const adminId = req.firebaseUser?.uid ?? 'unknown';
  try {
    const result = await couponService.issueToUser(couponId, userId, adminId, expiresAt);
    emitCouponAudit({
      actionType: 'COUPON_ISSUE_TO_USER',
      actorUserId: adminId,
      couponId,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: { targetUserId: userId, issuanceId: result.issuanceId, expiresAt: expiresAt?.toISOString() ?? null },
    });
    return res.status(201).json({ success: true, issuanceId: result.issuanceId });
  } catch (err: any) {
    return res.status(500).json({ error: 'שגיאה בהנפקה' });
  }
});

adminCouponRouter.post('/restore/:id', async (req: AuthenticatedRequest, res: Response) => {
  const redemptionId = parseInt(req.params.id, 10);
  if (isNaN(redemptionId)) return res.status(400).json({ error: 'מזהה לא תקין' });

  const parsed = restoreSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'בקשה לא תקינה' });

  const adminId = req.firebaseUser?.uid ?? null;
  try {
    const result = await couponService.restoreRedemption(redemptionId, parsed.data.cancelReason, parsed.data.adminNote);
    emitCouponAudit({
      actionType: 'COUPON_RESTORE_REDEMPTION',
      actorUserId: adminId,
      couponId: redemptionId, // we audit by redemption id; not the coupon id
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: {
        redemptionId,
        cancelReason: parsed.data.cancelReason,
        adminNote: parsed.data.adminNote,
      },
    });
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: 'שגיאה בשחזור קופון' });
  }
});

adminCouponRouter.get('/audit-log', async (_req: Request, res: Response) => {
  try {
    const log = await couponService.getAuditLog();
    return res.json({ auditLog: log });
  } catch (err: any) {
    return res.status(500).json({ error: 'שגיאה בטעינת לוג' });
  }
});

adminCouponRouter.get('/:id/stats', async (req: Request, res: Response) => {
  const couponId = parseInt(req.params.id, 10);
  if (isNaN(couponId)) return res.status(400).json({ error: 'מזהה לא תקין' });
  try {
    const couponRow = await pool.query(`SELECT * FROM coupons WHERE id = $1`, [couponId]);
    if (!couponRow.rows.length) return res.status(404).json({ error: 'קופון לא נמצא' });

    const stats    = await pool.query(`
      SELECT COUNT(*)                                                        AS total_redemptions,
             COUNT(*) FILTER (WHERE cancelled_at IS NOT NULL)               AS cancelled_count,
             COUNT(*) FILTER (WHERE cancelled_at IS NULL)                   AS active_count,
             COUNT(DISTINCT user_id)                                         AS unique_users,
             SUM(discount_amount_cents)                                      AS total_discount_cents,
             AVG(discount_amount_cents) FILTER (WHERE cancelled_at IS NULL)  AS avg_discount_cents,
             MIN(redeemed_at)                                                AS first_redeemed_at,
             MAX(redeemed_at)                                                AS last_redeemed_at
      FROM coupon_redemptions WHERE coupon_id = $1`, [couponId]);

    const delivery = await pool.query(`
      SELECT channel, COUNT(*) AS sent, COUNT(delivered_at) AS delivered,
             COUNT(opened_at) AS opened, COUNT(clicked_at) AS clicked, COUNT(redeemed_at) AS redeemed
      FROM coupon_delivery_events WHERE coupon_id = $1 GROUP BY channel`, [couponId]);

    const rules = await pool.query(
      `SELECT rule_type, rule_value FROM coupon_eligibility_rules WHERE coupon_id = $1`, [couponId]);

    const issuances = await pool.query(`
      SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE redeemed_at IS NOT NULL) AS redeemed, COUNT(*) FILTER (WHERE is_active = true AND redeemed_at IS NULL) AS available
      FROM coupon_issuances WHERE coupon_id = $1`, [couponId]);

    return res.json({ coupon: couponRow.rows[0], stats: stats.rows[0], delivery: delivery.rows, rules: rules.rows, issuances: issuances.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: 'שגיאה בטעינת סטטיסטיקות' });
  }
});

adminCouponRouter.get('/:id/audit-log', async (req: Request, res: Response) => {
  const couponId = parseInt(req.params.id, 10);
  if (isNaN(couponId)) return res.status(400).json({ error: 'מזהה לא תקין' });
  try {
    const log = await couponService.getAuditLog(couponId);
    return res.json({ auditLog: log });
  } catch (err: any) {
    return res.status(500).json({ error: 'שגיאה בטעינת לוג' });
  }
});

adminCouponRouter.get('/:id/export', async (req: Request, res: Response) => {
  const couponId = parseInt(req.params.id, 10);
  if (isNaN(couponId)) return res.status(400).json({ error: 'מזהה לא תקין' });
  try {
    const csv = await couponService.exportRedemptionsCsv(couponId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="coupon-${couponId}-redemptions.csv"`);
    return res.send('\uFEFF' + csv); // BOM for Excel
  } catch (err: any) {
    return res.status(500).json({ error: 'שגיאה בייצוא' });
  }
});

adminCouponRouter.get('/:id/finance', async (req: Request, res: Response) => {
  const couponId = parseInt(req.params.id, 10);
  if (isNaN(couponId)) return res.status(400).json({ error: 'מזהה לא תקין' });
  try {
    const report = await couponService.getFinanceReport(couponId);
    return res.json({ finance: report });
  } catch (err: any) {
    return res.status(500).json({ error: 'שגיאה בדו"ח פיננסי' });
  }
});


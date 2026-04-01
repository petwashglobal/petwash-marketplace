/**
 * Pricing Routes — Unified pricing authority + legacy tier endpoints
 *
 * Tier endpoints (legacy):
 *   GET /api/pricing/tiers
 *   GET /api/pricing/recommend
 *   GET /api/pricing/retry-schedule/:attempt
 *
 * Unified coupon pricing lifecycle:
 *   POST /api/pricing/quote           — authoritative price breakdown
 *   POST /api/pricing/reserve         — reserve coupon from quote
 *   POST /api/pricing/confirm         — confirm after booking confirmed
 *   POST /api/pricing/abandon         — abandon if booking fails
 *   POST /api/pricing/restore/:id     — restore consumed coupon on cancellation
 *
 * Kiosk coupon tokens:
 *   POST /api/pricing/kiosk-token/create
 *   POST /api/pricing/kiosk-token/confirm
 *   POST /api/pricing/kiosk-token/cancel
 *   GET  /api/pricing/kiosk-token/:token
 *
 * Campaign admin:
 *   POST /api/pricing/admin/campaigns/trigger
 *   POST /api/pricing/admin/campaigns/birthday
 *   POST /api/pricing/campaigns/track/:event
 *
 * Discount ownership:
 *   GET  /api/pricing/admin/discount-ownership
 *   POST /api/pricing/admin/discount-ownership
 *   POST /api/pricing/admin/discount-ownership/compute
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  PRICING_TIERS,
  recommendPricingTier,
  getPaymentRetrySchedule,
} from '../utils/pricingStrategies';
import { pricingService } from '../services/UnifiedPricingService';
import { kioskCouponService } from '../services/KioskCouponService';
import { campaignDeliveryService } from '../services/CampaignDeliveryService';
import { discountOwnershipService } from '../services/DiscountOwnershipService';
import { logger } from '../lib/logger';
import type { AuthenticatedRequest } from '../middleware/rbac';

const router = Router();

// ─────────────────────────────────────────────────────────────
// LEGACY TIER ENDPOINTS
// ─────────────────────────────────────────────────────────────

router.get('/tiers', (req: Request, res: Response) => {
  res.json(PRICING_TIERS);
});

router.get('/recommend', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const monthlyUsage = parseInt(req.query.monthlyUsage as string) || 0;
    res.json(recommendPricingTier(monthlyUsage));
  } catch {
    res.status(500).json({ error: 'Failed to get recommendation' });
  }
});

router.get('/retry-schedule/:attempt', (req: Request, res: Response) => {
  res.json(getPaymentRetrySchedule(parseInt(req.params.attempt)));
});

// ─────────────────────────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────────────────────────

const ORDER_TYPES = ['kiosk_wash', 'sitter_booking', 'walker_booking', 'trainer_booking',
  'provider_marketplace', 'wallet_topup', 'loyalty_reward', 'package_purchase'] as const;

const quoteSchema = z.object({
  orderType:            z.enum(ORDER_TYPES),
  grossCents:           z.number().int().min(0),
  couponCode:           z.string().max(64).optional(),
  loyaltyDiscountCents: z.number().int().min(0).default(0),
  specialDiscountCents: z.number().int().min(0).default(0),
  isKioskWash:          z.boolean().default(false),
  stationId:            z.string().optional(),
  city:                 z.string().optional(),
  country:              z.string().optional(),
  idempotencyKey:       z.string().optional(),
  activeBenefits:       z.object({
    loyalty_5_pct:  z.boolean().optional(),
    special_10_pct: z.boolean().optional(),
    wallet_credit:  z.boolean().optional(),
    egift_balance:  z.boolean().optional(),
    package_credit: z.boolean().optional(),
    admin_discount: z.boolean().optional(),
  }).optional(),
});

const reserveSchema = z.object({
  quoteId:        z.string(),
  couponId:       z.number().int().positive(),
  issuanceId:     z.number().int().positive().optional(),
  couponCode:     z.string().optional(),
  orderType:      z.enum(ORDER_TYPES),
  grossCents:     z.number().int().min(0),
  discountCents:  z.number().int().min(0),
  idempotencyKey: z.string().optional(),
});

const confirmSchema = z.object({
  reservationId: z.string().min(1),
  orderId:       z.string().min(1),
  ledgerEntryId: z.string().optional(),
});

const kioskTokenSchema = z.object({
  couponCode:       z.string().min(1).max(64),
  stationId:        z.string().optional(),
  bayId:            z.string().optional(),
  grossAmountCents: z.number().int().min(0).optional(),
  idempotencyKey:   z.string().optional(),
});

const campaignTriggerSchema = z.object({
  campaignType:  z.enum(['birthday', 'black_friday', 'valentine', 'dog_day',
    'loyalty_upgrade', 'first_order', 'reactivation', 'custom']),
  couponId:      z.number().int().positive(),
  userIds:       z.array(z.string()).optional(),
  issuePersonal: z.boolean().default(false),
  loyaltyTier:   z.string().optional(),
});

const ownershipRuleSchema = z.object({
  couponId:    z.number().int().positive().optional(),
  orderType:   z.enum(ORDER_TYPES).optional(),
  absorbBy:    z.enum(['platform', 'provider', 'split']),
  platformPct: z.number().min(0).max(100),
  providerPct: z.number().min(0).max(100),
  notes:       z.string().optional(),
});

const payoutComputeSchema = z.object({
  grossBookingCents:   z.number().int().min(0),
  couponDiscountCents: z.number().int().min(0),
  couponId:            z.number().int().positive().nullable(),
  orderType:           z.enum(ORDER_TYPES),
  commissionRate:      z.number().min(0).max(1),
});

// ─────────────────────────────────────────────────────────────
// UNIFIED PRICING
// ─────────────────────────────────────────────────────────────

router.post('/quote', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.firebaseUser?.uid;
  if (!userId) return res.status(401).json({ error: 'AUTH_REQUIRED' });

  const parsed = quoteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'בקשה לא תקינה', details: parsed.error.flatten() });

  try {
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.socket.remoteAddress;
    const quote = await pricingService.quote({ ...parsed.data, userId, ipAddress });
    return res.json(quote);
  } catch (err: any) {
    logger.error('[Pricing] quote error', { err: err.message, userId });
    return res.status(500).json({ error: 'שגיאה בחישוב מחיר' });
  }
});

router.post('/reserve', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.firebaseUser?.uid;
  if (!userId) return res.status(401).json({ error: 'AUTH_REQUIRED' });

  const parsed = reserveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'בקשה לא תקינה', details: parsed.error.flatten() });

  const d = parsed.data;
  const minimalQuote: any = {
    quoteId:    d.quoteId,
    userId,
    orderType:  d.orderType,
    couponId:   d.couponId,
    issuanceId: d.issuanceId,
    couponCode: d.couponCode,
    expiresAt:  new Date(Date.now() + 15 * 60 * 1000),
    breakdown:  { grossCents: d.grossCents, couponDiscountCents: d.discountCents },
  };

  try {
    const result = await pricingService.reserve(minimalQuote, d.idempotencyKey);
    return res.json(result);
  } catch (err: any) {
    if (err?.code === 'NO_COUPON') return res.status(400).json({ error: 'אין קופון בבקשה' });
    return res.status(500).json({ error: 'שגיאה בשמירת הזמנה' });
  }
});

router.post('/confirm', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.firebaseUser?.uid;
  if (!userId) return res.status(401).json({ error: 'AUTH_REQUIRED' });

  const parsed = confirmSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'בקשה לא תקינה' });

  try {
    const result = await pricingService.confirmReservation(
      parsed.data.reservationId,
      parsed.data.orderId,
      parsed.data.ledgerEntryId,
    );
    return res.json({ success: true, ...result });
  } catch (err: any) {
    const code = err?.code ?? '';
    const msgs: Record<string, string> = {
      RESERVATION_NOT_FOUND: 'הזמנה לא נמצאה',
      RESERVATION_EXPIRED:   'הזמנת הקופון פגה תוקף',
      RESERVATION_INVALID:   'מצב הזמנה לא תקין',
    };
    if (msgs[code]) return res.status(409).json({ error: msgs[code], errorCode: code });
    return res.status(500).json({ error: 'שגיאה באישור הזמנה' });
  }
});

router.post('/abandon', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.firebaseUser?.uid;
  if (!userId) return res.status(401).json({ error: 'AUTH_REQUIRED' });

  const reservationId = req.body?.reservationId;
  const reason        = req.body?.reason ?? 'booking_failed';
  if (!reservationId) return res.status(400).json({ error: 'reservationId חסר' });

  try {
    await pricingService.abandonReservation(reservationId, reason);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'שגיאה בביטול הזמנה' });
  }
});

router.post('/restore/:id', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.firebaseUser?.uid;
  if (!userId) return res.status(401).json({ error: 'AUTH_REQUIRED' });

  const redemptionId = parseInt(req.params.id, 10);
  if (isNaN(redemptionId)) return res.status(400).json({ error: 'מזהה לא תקין' });

  const VALID = ['user_cancel', 'provider_cancel', 'no_show', 'kiosk_failure', 'admin_refund', 'system_error'] as const;
  const reason = req.body?.reason;
  if (!reason || !VALID.includes(reason)) return res.status(400).json({ error: 'סיבה לא תקינה', valid: VALID });

  try {
    const result = await pricingService.restoreAfterCancellation(redemptionId, reason, req.body?.note);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: 'שגיאה בשחזור קופון' });
  }
});

// ─────────────────────────────────────────────────────────────
// KIOSK COUPON TOKENS
// ─────────────────────────────────────────────────────────────

router.post('/kiosk-token/create', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.firebaseUser?.uid;
  if (!userId) return res.status(401).json({ error: 'AUTH_REQUIRED' });

  const parsed = kioskTokenSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'בקשה לא תקינה', details: parsed.error.flatten() });

  try {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0];
    const result = await kioskCouponService.createToken({ ...parsed.data, userId, ipAddress: ip });
    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(err?.httpStatus ?? 500).json({ error: err.message, errorCode: err?.code });
  }
});

router.post('/kiosk-token/confirm', async (req: Request, res: Response) => {
  const token     = req.body?.token;
  const sessionId = req.body?.sessionId;
  if (!token || !sessionId) return res.status(400).json({ error: 'token ו-sessionId חובה' });
  try {
    const result = await kioskCouponService.confirmToken(token, sessionId);
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(err?.httpStatus ?? 500).json({ error: err.message, errorCode: err?.code });
  }
});

router.post('/kiosk-token/cancel', async (req: Request, res: Response) => {
  const { token, reason } = req.body ?? {};
  if (!token) return res.status(400).json({ error: 'token חסר' });
  try {
    await kioskCouponService.cancelToken(token, reason ?? 'cancelled');
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'שגיאה בביטול טוקן' });
  }
});

router.get('/kiosk-token/:token', async (req: Request, res: Response) => {
  const status = await kioskCouponService.getTokenStatus(req.params.token);
  if (!status) return res.status(404).json({ error: 'טוקן לא נמצא' });
  return res.json(status);
});

// ─────────────────────────────────────────────────────────────
// CAMPAIGN ADMIN
// ─────────────────────────────────────────────────────────────

router.post('/admin/campaigns/trigger', async (req: AuthenticatedRequest, res: Response) => {
  const parsed = campaignTriggerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'בקשה לא תקינה', details: parsed.error.flatten() });

  const { campaignType, couponId, userIds, issuePersonal, loyaltyTier } = parsed.data;
  const adminId = req.firebaseUser?.uid;

  try {
    let result;
    if (campaignType === 'birthday') {
      result = await campaignDeliveryService.triggerBirthdayCampaign(couponId, adminId);
    } else if (campaignType === 'loyalty_upgrade' && loyaltyTier) {
      result = await campaignDeliveryService.triggerLoyaltyUpgradeCampaign(couponId, loyaltyTier, adminId);
    } else if (userIds?.length) {
      result = await campaignDeliveryService.deliverCampaign({
        campaignType, couponId, userIds,
        channels: ['in_app', 'push', 'email', 'sms'],
        issuePersonal, adminId,
      });
    } else {
      result = await campaignDeliveryService.triggerFlashCampaign(campaignType, couponId, issuePersonal, adminId);
    }
    return res.json({ success: true, result });
  } catch (err: any) {
    logger.error('[Campaign] trigger error', { err: err.message });
    return res.status(500).json({ error: 'שגיאה בהפעלת קמפיין' });
  }
});

router.post('/admin/campaigns/birthday', async (req: AuthenticatedRequest, res: Response) => {
  const couponId = parseInt(req.body?.couponId, 10);
  if (isNaN(couponId)) return res.status(400).json({ error: 'couponId חסר' });
  try {
    const result = await campaignDeliveryService.triggerBirthdayCampaign(couponId, req.firebaseUser?.uid);
    return res.json({ success: true, result });
  } catch (err: any) {
    return res.status(500).json({ error: 'שגיאה ב-birthday קמפיין' });
  }
});

router.post('/campaigns/track/:event', async (req: Request, res: Response) => {
  const { event } = req.params;
  const messageId = req.body?.messageId;
  if (!messageId) return res.status(400).json({ error: 'messageId חסר' });
  try {
    if (event === 'opened')        await campaignDeliveryService.trackOpened(messageId);
    else if (event === 'clicked')  await campaignDeliveryService.trackClicked(messageId);
    else if (event === 'redeemed') await campaignDeliveryService.trackRedeemed(messageId);
    else return res.status(400).json({ error: 'אירוע לא מוכר' });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'שגיאה בעדכון אירוע' });
  }
});

// ─────────────────────────────────────────────────────────────
// DISCOUNT OWNERSHIP ADMIN
// ─────────────────────────────────────────────────────────────

router.get('/admin/discount-ownership', async (_req: Request, res: Response) => {
  try {
    const rules = await discountOwnershipService.listRules();
    return res.json({ rules });
  } catch (err: any) {
    return res.status(500).json({ error: 'שגיאה בטעינת כללים' });
  }
});

router.post('/admin/discount-ownership', async (req: AuthenticatedRequest, res: Response) => {
  const parsed = ownershipRuleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'בקשה לא תקינה', details: parsed.error.flatten() });
  try {
    await discountOwnershipService.setRule(parsed.data);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

router.post('/admin/discount-ownership/compute', async (req: Request, res: Response) => {
  const parsed = payoutComputeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'בקשה לא תקינה', details: parsed.error.flatten() });
  try {
    const result = await discountOwnershipService.computeProviderPayout(parsed.data);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: 'שגיאה בחישוב תשלום' });
  }
});

export default router;

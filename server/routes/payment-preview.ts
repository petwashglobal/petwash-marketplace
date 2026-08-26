/**
 * POST /api/payment-preview — the ONE customer-facing endpoint that
 * answers "what does this customer owe RIGHT NOW?" for every surface.
 *
 * READ-ONLY. Never captures, reserves, or mutates.
 *
 * Auth: optional. Anonymous callers get the surface base price
 * without wallet / eGift / loyalty (server treats userId=null through
 * the composer). Authed callers get the full breakdown.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { composePaymentPreview } from '../services/paymentPreview';
import { PAYMENT_SURFACES } from '@shared/lib/paymentPreview';
import { logger } from '../lib/logger';

const router = Router();

const petInput = z.object({
  clientRef: z.string(),
  petId: z.string().nullish(),
  petName: z.string().min(1),
  petType: z.enum(['dog', 'cat', 'other']),
  breed: z.string().nullish(),
  sizeCategory: z.enum(['small', 'medium', 'large', 'giant']).nullish(),
  ageYears: z.number().nullish(),
  weightKg: z.number().nullish(),
  gender: z.string().nullish(),
  requiresMedication: z.boolean().optional(),
  hasBehaviorFlag: z.boolean().optional(),
  hasSpecialNeeds: z.boolean().optional(),
  quantity: z.number().int().min(1).optional(),
});
const addonInput = z.object({
  addonCode: z.string(),
  scope: z.enum(['booking', 'pet']),
  petRef: z.string().nullish(),
  quantity: z.number().int().min(1).optional(),
});
const quoteInput = z.object({
  providerId: z.string().min(1),
  serviceType: z.string().min(1),
  bookingWindow: z.object({
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
  }),
  pets: z.array(petInput).min(1),
  addons: z.array(addonInput).optional(),
  promoCode: z.string().nullish(),
  giftCardCode: z.string().nullish(),
  useWalletCredit: z.boolean().optional(),
  applyLoyaltyCredits: z.boolean().optional(),
});
const shopInput = z.object({
  cartId: z.number().int(),
  deliveryMethod: z.enum(['delivery', 'pickup']),
  deliveryAddressId: z.number().int().nullish(),
  giftWrap: z.boolean().optional(),
});
const bodySchema = z.object({
  surface: z.enum(PAYMENT_SURFACES),
  quoteInput: quoteInput.optional(),
  shopInput: shopInput.optional(),
});

router.post('/', async (req: Request, res: Response) => {
  const parsed = bodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'invalid_input', details: parsed.error.flatten() });
  }
  const userId: string | null =
    (req as any).firebaseUser?.uid || (req as any).user?.uid || null;

  try {
    const preview = await composePaymentPreview({
      surface: parsed.data.surface,
      userId,
      quoteInput: parsed.data.quoteInput,
      shopInput: parsed.data.shopInput,
    });
    return res.json({ ok: true, preview });
  } catch (err: any) {
    logger.error('[PaymentPreview] compose error', { surface: parsed.data.surface, err: String(err?.message ?? err) });
    return res.status(500).json({ ok: false, error: 'preview_error' });
  }
});

export default router;

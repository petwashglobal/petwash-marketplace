/**
 * PetWash Quote Engine API
 *
 * POST /api/quotes/preview  — preview quote before booking is created
 *
 * Frontend MUST call this every time:
 *   - a pet is added or removed
 *   - a pet size / type changes
 *   - an add-on is toggled
 *   - a promo code is entered or cleared
 *   - wallet credit toggle changes
 *
 * Frontend MUST NOT perform final price arithmetic. Only render backend response.
 */

import { Router } from 'express';
import { z } from 'zod';
import { calculateQuote } from '../services/quoteEngine';

const router = Router();

const petInputSchema = z.object({
  clientRef: z.string(),
  petId: z.string().nullish(),
  petName: z.string().min(1),
  petType: z.enum(['dog', 'cat', 'other']),
  breed: z.string().nullish(),
  sizeCategory: z.enum(['small', 'medium', 'large', 'giant']).nullish(),
  ageYears: z.number().nullish(),
  weightKg: z.number().nullish(),
  gender: z.string().nullish(),
  requiresMedication: z.boolean().optional().default(false),
  hasBehaviorFlag: z.boolean().optional().default(false),
  hasSpecialNeeds: z.boolean().optional().default(false),
  quantity: z.number().int().min(1).optional().default(1),
});

const addonInputSchema = z.object({
  addonCode: z.string(),
  scope: z.enum(['booking', 'pet']),
  petRef: z.string().nullish(),
  quantity: z.number().int().min(1).optional().default(1),
});

const quotePreviewSchema = z.object({
  providerId: z.string().min(1),
  serviceType: z.string().min(1),
  currency: z.string().optional().default('ILS'),
  bookingWindow: z.object({
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
  }),
  pets: z.array(petInputSchema).min(1, 'At least one pet is required'),
  addons: z.array(addonInputSchema).optional().default([]),
  promoCode: z.string().nullish(),
  giftCardCode: z.string().nullish(),
  useWalletCredit: z.boolean().optional().default(false),
  applyLoyaltyCredits: z.boolean().optional().default(false),
});

/**
 * POST /api/quotes/preview
 * Returns a full deterministic quote. No auth required for preview — userId is optional.
 * With userId, wallet/gift-card balances are applied.
 */
router.post('/preview', async (req, res) => {
  try {
    const parsed = quotePreviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: parsed.error.flatten(),
      });
    }

    const userId: string | null = (req as any).userId || req.user?.uid || null;

    const quote = await calculateQuote({
      ...parsed.data,
      userId,
      bookingRequestId: null,
    });

    return res.json(quote);
  } catch (err) {
    console.error('[QuoteEngine] preview error:', err);
    return res.status(500).json({ success: false, error: 'Quote engine error' });
  }
});

export default router;

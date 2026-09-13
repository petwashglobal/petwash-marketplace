/**
 * Provider OS — rate card.
 *
 *   GET /api/provider-os/rate-card   → which platform profiles this provider has
 *                                      and their current rate / availability
 *   PUT /api/provider-os/rate-card   → set rates; a positive rate + "available"
 *                                      makes the profile bookable, anything else
 *                                      takes it off the shelf
 *
 * WHY (platforms audit 2026-09-12): the application never asks for a rate, so
 * an approved provider had no rate anywhere, and there was no screen to set
 * one. providerProfileSeed.ts seeds the profile at ₪0 / unavailable; this is
 * the one place the provider turns it on. Amounts are whole shekels in the
 * API (the tables store decimal strings / cents).
 */
import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { walkerProfiles, sitterProfiles, trainers } from '@shared/schema';
import { requireAuth } from '../customAuth';
import { logger } from '../lib/logger';
import { validateProviderRates, getProviderMinPriceCents, getProviderMaxPriceCents } from '@shared/providerMinPrices';

const router = Router();

export const rateCardSchema = z.object({
  walkerHourlyIls: z.number().int().min(0).max(1000).optional(),
  sitterDayIls: z.number().int().min(0).max(5000).optional(),
  sitterHourIls: z.number().int().min(0).max(1000).optional(),
  trainerHourlyIls: z.number().int().min(0).max(2000).optional(),
  available: z.boolean().optional().default(true),
});
export type RateCardInput = z.infer<typeof rateCardSchema>;

/**
 * The platform price floor / ceiling (shared/providerMinPrices.ts — the CEO's
 * Rover/MadPaws rule: each provider sets their own rate, never below the
 * per-service minimum). This screen is the one that makes a profile BOOKABLE,
 * and until 2026-09-13 it accepted any positive number: a ₪1 walk went live.
 * A 0 still means "not offering this" and is allowed.
 *
 * The sitter HOURLY rate has no floor in the price table (the ₪99 floor is per
 * visit / night), so only its ceiling applies here.
 */
export function rateCardPriceViolations(input: RateCardInput): Array<{
  field: 'walkerHourlyIls' | 'sitterDayIls' | 'trainerHourlyIls';
  platform: string;
  reason: 'too_low' | 'too_high';
  minIls: number;
  maxIls: number;
}> {
  const checks: Array<[ 'walkerHourlyIls' | 'sitterDayIls' | 'trainerHourlyIls', string, number | undefined ]> = [
    ['walkerHourlyIls', 'walk_my_pet', input.walkerHourlyIls],
    ['sitterDayIls', 'sitter_suite', input.sitterDayIls],
    ['trainerHourlyIls', 'academy', input.trainerHourlyIls],
  ];
  const out: ReturnType<typeof rateCardPriceViolations> = [];
  for (const [field, platform, ils] of checks) {
    if (ils === undefined || ils <= 0) continue;
    const verdict = validateProviderRates(platform, [ils * 100]);
    if (!verdict.ok) {
      out.push({
        field, platform, reason: verdict.reason,
        minIls: Math.round(getProviderMinPriceCents(platform) / 100),
        maxIls: Math.round(getProviderMaxPriceCents(platform) / 100),
      });
    }
  }
  return out;
}

/** Pure: what each table gets. Exported for tests. */
export function rateCardUpdates(input: RateCardInput) {
  const out: { walker?: Record<string, unknown>; sitter?: Record<string, unknown>; trainer?: Record<string, unknown> } = {};
  if (input.walkerHourlyIls !== undefined) {
    const live = input.available && input.walkerHourlyIls > 0;
    out.walker = { baseHourlyRate: input.walkerHourlyIls.toFixed(2), isAvailable: live, updatedAt: new Date() };
  }
  if (input.sitterDayIls !== undefined || input.sitterHourIls !== undefined) {
    // Sitter search requires price_per_day_cents > 0; "unavailable" is expressed as 0.
    // Only TOUCH the day rate when the caller actually sent one (2026-09-13).
    // Before, a PUT carrying only sitterHourIls entered this branch, `day`
    // fell back to 0, and price_per_day_cents was overwritten with 0 — which
    // silently deleted the sitter's published day rate AND removed them from
    // the marketplace, with nothing to show it had ever been set.
    out.sitter = { updatedAt: new Date() };
    if (input.sitterDayIls !== undefined) {
      out.sitter.pricePerDayCents = input.available ? input.sitterDayIls * 100 : 0;
    } else if (!input.available) {
      // An explicit "I am unavailable" still delists, even without a day rate.
      out.sitter.pricePerDayCents = 0;
    }
    if (input.sitterHourIls !== undefined) {
      out.sitter.pricePerHourCents = input.sitterHourIls * 100;
    }
  }
  if (input.trainerHourlyIls !== undefined) {
    const live = input.available && input.trainerHourlyIls > 0;
    out.trainer = { hourlyRate: input.trainerHourlyIls.toFixed(2), isAcceptingBookings: live, isActive: true, updatedAt: new Date() };
  }
  return out;
}

router.get('/rate-card', requireAuth, async (req: Request, res: Response) => {
  const uid = (req as any).user?.uid;
  if (!uid) return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
  try {
    const [w] = await db.select({ rate: walkerProfiles.baseHourlyRate, available: walkerProfiles.isAvailable }).from(walkerProfiles).where(eq(walkerProfiles.userId, uid)).limit(1);
    const [s] = await db.select({ day: sitterProfiles.pricePerDayCents, hour: sitterProfiles.pricePerHourCents }).from(sitterProfiles).where(eq(sitterProfiles.userId, uid)).limit(1);
    const [t] = await db.select({ rate: trainers.hourlyRate, accepting: trainers.isAcceptingBookings }).from(trainers).where(eq(trainers.userId, uid)).limit(1);
    return res.json({
      ok: true,
      platforms: {
        walk_my_pet: w ? { hourlyIls: Math.round(Number(w.rate || 0)), available: !!w.available } : null,
        sitter_suite: s ? { dayIls: Math.round((s.day || 0) / 100), hourIls: s.hour ? Math.round(s.hour / 100) : null, available: (s.day || 0) > 0 } : null,
        academy: t ? { hourlyIls: Math.round(Number(t.rate || 0)), available: !!t.accepting } : null,
      },
    });
  } catch (err: any) {
    logger.error('[RateCard] read failed', { uid, error: err?.message });
    return res.status(500).json({ ok: false, error: 'READ_FAILED' });
  }
});

router.put('/rate-card', requireAuth, async (req: Request, res: Response) => {
  const uid = (req as any).user?.uid;
  if (!uid) return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
  const parsed = rateCardSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: 'INVALID_INPUT', details: parsed.error.flatten() });
  const violations = rateCardPriceViolations(parsed.data);
  if (violations.length > 0) {
    const v = violations[0];
    return res.status(400).json({
      ok: false,
      error: 'PRICE_OUT_OF_RANGE',
      violations,
      message: v.reason === 'too_low'
        ? `Price is too low. Minimum allowed price for this service is ₪${v.minIls}.`
        : `Price is too high. Maximum allowed price for this service is ₪${v.maxIls}.`,
    });
  }
  const updates = rateCardUpdates(parsed.data);
  const applied: string[] = [];
  try {
    if (updates.walker) {
      const r = await db.update(walkerProfiles).set(updates.walker as any).where(eq(walkerProfiles.userId, uid)).returning({ id: walkerProfiles.id });
      if (r.length) applied.push('walk_my_pet');
    }
    if (updates.sitter) {
      const set = Object.fromEntries(Object.entries(updates.sitter).filter(([, v]) => v !== undefined));
      const r = await db.update(sitterProfiles).set(set as any).where(eq(sitterProfiles.userId, uid)).returning({ id: sitterProfiles.id });
      if (r.length) applied.push('sitter_suite');
    }
    if (updates.trainer) {
      const r = await db.update(trainers).set(updates.trainer as any).where(eq(trainers.userId, uid)).returning({ id: trainers.id });
      if (r.length) applied.push('academy');
    }
    logger.info('[RateCard] updated', { uid, applied, available: parsed.data.available });
    return res.json({ ok: true, applied });
  } catch (err: any) {
    logger.error('[RateCard] update failed', { uid, error: err?.message });
    return res.status(500).json({ ok: false, error: 'UPDATE_FAILED' });
  }
});

export default router;

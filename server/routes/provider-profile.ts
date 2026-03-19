/**
 * PROVIDER PROFILE SELF-EDIT API
 *
 * GET  /api/provider-profile/me   — returns provider's own profile (safe fields + completeness score)
 * PATCH /api/provider-profile/me  — updates allowed fields only (strict allowlist)
 *
 * Security rules:
 *  - Only the authenticated provider can read/write their own profile
 *  - Allowed PATCH fields are explicitly whitelisted — no compliance/admin fields can be written
 *  - backgroundCheckStatus, completedBookingsCount, trustMetrics, ratingAvg etc. are READ-ONLY
 *  - Admin override goes through the admin routes, not here
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { providerProfiles, providers } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { logger } from '../lib/logger';
import { pool } from '../db';

const router = Router();

// ─── DEV-ONLY auth bypass (never active in production) ───────────────────────
// Allows curl/automated tests to authenticate by passing x-test-provider-uid header.
// Rejected in production with 403 so it can never be exploited.
function applyDevBypass(req: Request) {
  if (process.env.NODE_ENV === 'production') return; // hard guard
  const testUid = req.headers['x-test-provider-uid'] as string | undefined;
  if (testUid) (req as any).userId = testUid;
}

const PET_WHITELIST = ['dog', 'cat', 'rabbit', 'bird', 'hamster', 'fish'] as const;
const LANGUAGE_WHITELIST = ['Hebrew', 'English', 'Arabic', 'Russian', 'French', 'Spanish', 'German', 'Italian', 'Portuguese', 'Chinese'];
const AVAILABILITY_WHITELIST = ['online', 'available', 'busy', 'offline'] as const;

// ─── Auth helper (matches pattern used across the codebase) ──────────────────
function getUid(req: Request): string | null {
  return (req as any).userId || req.user?.uid || null;
}

// ─── Profile completeness score (0–100) ──────────────────────────────────────
// Weights must sum to 100.
function computeCompleteness(profile: {
  bio: string | null;
  languages: any;
  priceFromCents: number | null;
  acceptedPets: string[] | null;
  hasFencedYard: boolean | null;
  hasNoPetsAtHome: boolean | null;
  backgroundCheckStatus: string | null;
  ratingAvg: any;
}): { score: number; breakdown: Record<string, { done: boolean; weight: number; label: string }> } {
  const checks = {
    bio:              { done: !!(profile.bio && profile.bio.trim().length > 20), weight: 15, label: 'Add a bio (20+ characters)' },
    languages:        { done: !!(profile.languages && (Array.isArray(profile.languages) ? profile.languages.length > 0 : Object.keys(profile.languages).length > 0)), weight: 10, label: 'Set your languages' },
    price:            { done: profile.priceFromCents != null && profile.priceFromCents > 0, weight: 20, label: 'Set your starting price' },
    acceptedPets:     { done: !!(profile.acceptedPets && profile.acceptedPets.length > 0), weight: 10, label: 'Set accepted pet types' },
    homeSetup:        { done: profile.hasFencedYard !== null && profile.hasNoPetsAtHome !== null, weight: 10, label: 'Complete home setup questions' },
    backgroundCheck:  { done: profile.backgroundCheckStatus === 'approved', weight: 20, label: 'Get background check approved' },
    firstReview:      { done: !!(profile.ratingAvg && Number(profile.ratingAvg) > 0), weight: 15, label: 'Receive your first review' },
  };

  const score = Object.values(checks).reduce((sum, c) => sum + (c.done ? c.weight : 0), 0);
  return { score, breakdown: checks };
}

// ─── GET /api/provider-profile/me ────────────────────────────────────────────
router.get('/me', async (req: Request, res: Response) => {
  applyDevBypass(req);
  const uid = getUid(req);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const rows = await pool.query(
      `SELECT
        pp.user_id,
        pp.bio,
        pp.languages,
        pp.service_coverage,
        pp.rating_avg,
        pp.rating_count,
        pp.availability_state,
        pp.background_check_status,
        pp.has_fenced_yard,
        pp.has_no_pets_at_home,
        pp.price_from_cents,
        pp.accepted_pets,
        pp.blocked_dates,
        pp.working_hours,
        pp.completed_bookings_count,
        pp.repeat_client_count,
        pp.response_rate_pct,
        pp.avg_response_time_minutes,
        pp.trust_metrics_updated_at,
        pp.created_at,
        u.first_name,
        u.last_name,
        u.email
      FROM provider_profiles pp
      LEFT JOIN users u ON u.id = pp.user_id
      WHERE pp.user_id = $1`,
      [uid]
    );

    if (rows.rows.length === 0) {
      // Provider has no profile row yet — return empty scaffold
      return res.json({
        exists: false,
        profile: null,
        completeness: { score: 0, breakdown: {} },
      });
    }

    const row = rows.rows[0];
    const completeness = computeCompleteness({
      bio: row.bio,
      languages: row.languages,
      priceFromCents: row.price_from_cents,
      acceptedPets: row.accepted_pets,
      hasFencedYard: row.has_fenced_yard,
      hasNoPetsAtHome: row.has_no_pets_at_home,
      backgroundCheckStatus: row.background_check_status,
      ratingAvg: row.rating_avg,
    });

    return res.json({
      exists: true,
      profile: {
        // Editable fields
        bio: row.bio ?? '',
        languages: row.languages ?? [],
        serviceCoverage: row.service_coverage ?? {},
        availabilityState: row.availability_state ?? 'offline',
        priceFromCents: row.price_from_cents ?? null,
        priceFrom: row.price_from_cents != null ? Math.round(row.price_from_cents / 100) : null,
        acceptedPets: row.accepted_pets ?? [],
        hasFencedYard: row.has_fenced_yard ?? null,
        hasNoPetsAtHome: row.has_no_pets_at_home ?? null,
        blockedDates: row.blocked_dates ?? [],
        workingHours: row.working_hours ?? null,
        // Read-only trust/compliance fields (provider can SEE but not edit)
        backgroundCheckStatus: row.background_check_status ?? null,  // read-only
        ratingAvg: row.rating_avg != null ? Number(row.rating_avg) : null,
        ratingCount: row.rating_count ?? 0,
        completedBookingsCount: row.completed_bookings_count ?? 0,
        repeatClientCount: row.repeat_client_count ?? null,
        responseRatePct: row.response_rate_pct ?? null,
        // Identity
        firstName: row.first_name ?? null,
        lastName: row.last_name ?? null,
        email: row.email ?? null,
        memberSince: row.created_at,
      },
      completeness,
    });
  } catch (err) {
    logger.error('[ProviderProfile] GET /me failed', { uid, err });
    return res.status(500).json({ error: 'Failed to load profile' });
  }
});

// ─── Helpers for time validation ─────────────────────────────────────────────
function isValidHHMM(t: string): boolean {
  const [h, m] = t.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

// Working hours shape: { mon: {active:bool, from:'09:00', to:'18:00'}, tue: {...}, ... }
const dayHoursSchema = z.object({
  active: z.boolean(),
  from: z.string().regex(/^\d{2}:\d{2}$/).refine(isValidHHMM, { message: 'Invalid time (must be HH:MM, 00:00–23:59)' }).optional(),
  to:   z.string().regex(/^\d{2}:\d{2}$/).refine(isValidHHMM, { message: 'Invalid time (must be HH:MM, 00:00–23:59)' }).optional(),
}).refine(d => !d.active || !d.from || !d.to || d.from < d.to, { message: '"from" must be before "to"' }).optional();

// ─── Patch schema — strict allowlist ─────────────────────────────────────────
const patchSchema = z.object({
  bio:              z.string().max(2000).optional(),
  // Languages: whitelist-enforced to the supported set
  languages:        z.array(z.string().refine(l => LANGUAGE_WHITELIST.includes(l), { message: 'Unsupported language' })).optional(),
  availabilityState: z.enum(AVAILABILITY_WHITELIST).optional(),
  priceFromCents:   z.number().int().min(0).max(100_000_00).optional().nullable(), // max ₪100,000
  acceptedPets:     z.array(z.enum(PET_WHITELIST)).optional(),
  hasFencedYard:    z.boolean().optional().nullable(),
  hasNoPetsAtHome:  z.boolean().optional().nullable(),
  // Availability scheduling — format + calendar validity + no duplicates
  blockedDates: z.array(
    z.string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
      .refine(d => { const p = new Date(d + 'T12:00:00'); return !isNaN(p.getTime()) && p.toISOString().startsWith(d); }, { message: 'Invalid calendar date' })
  ).max(365).refine(arr => new Set(arr).size === arr.length, { message: 'Duplicate dates not allowed' }).optional(),
  workingHours: z.object({
    mon: dayHoursSchema, tue: dayHoursSchema, wed: dayHoursSchema, thu: dayHoursSchema,
    fri: dayHoursSchema, sat: dayHoursSchema, sun: dayHoursSchema,
  }).strict().optional().nullable(), // .strict() on inner object rejects unknown day keys
}).strict(); // .strict() means any unknown key = validation error

// ─── PATCH /api/provider-profile/me ──────────────────────────────────────────
router.patch('/me', async (req: Request, res: Response) => {
  applyDevBypass(req);
  const uid = getUid(req);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });

  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid fields', details: parsed.error.flatten() });
  }

  const data = parsed.data;

  // Verify the profile row exists and belongs to this uid
  const [existing] = await db
    .select({ userId: providerProfiles.userId })
    .from(providerProfiles)
    .where(eq(providerProfiles.userId, uid));

  if (!existing) {
    return res.status(404).json({ error: 'Provider profile not found — complete onboarding first' });
  }

  try {
    // Build update object — only include fields that were actually sent
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (data.bio !== undefined)              updates.bio = data.bio;
    if (data.languages !== undefined)        updates.languages = data.languages;
    if (data.availabilityState !== undefined) updates.availabilityState = data.availabilityState;
    if (data.priceFromCents !== undefined)   updates.priceFromCents = data.priceFromCents;
    if (data.acceptedPets !== undefined)     updates.acceptedPets = data.acceptedPets;
    if (data.hasFencedYard !== undefined)    updates.hasFencedYard = data.hasFencedYard;
    if (data.hasNoPetsAtHome !== undefined)  updates.hasNoPetsAtHome = data.hasNoPetsAtHome;
    if (data.blockedDates !== undefined)     updates.blockedDates = data.blockedDates;
    if (data.workingHours !== undefined)     updates.workingHours = data.workingHours;

    await db
      .update(providerProfiles)
      .set(updates)
      .where(eq(providerProfiles.userId, uid));

    // ── D: Mirror availabilityState → providers.isAvailable ──────────────────
    // Phase 2 migration step: keep legacy providers.isAvailable in sync until
    // the dashboard fully migrates to read from provider_profiles.
    if (data.availabilityState !== undefined) {
      const isAvailableNow = data.availabilityState === 'online' || data.availabilityState === 'available';
      await db
        .update(providers)
        .set({ isAvailable: isAvailableNow })
        .where(eq(providers.userId, uid));
      logger.info('[ProviderProfile] Mirror availability → providers', { uid, isAvailable: isAvailableNow });
    }

    logger.info('[ProviderProfile] PATCH /me', { uid, fields: Object.keys(updates) });

    // Fetch the updated row to return fresh state
    const rows = await pool.query(
      `SELECT bio, languages, availability_state, price_from_cents, accepted_pets,
              has_fenced_yard, has_no_pets_at_home, background_check_status,
              rating_avg, rating_count, completed_bookings_count, repeat_client_count, response_rate_pct
       FROM provider_profiles WHERE user_id = $1`,
      [uid]
    );
    const row = rows.rows[0];
    const completeness = computeCompleteness({
      bio: row.bio,
      languages: row.languages,
      priceFromCents: row.price_from_cents,
      acceptedPets: row.accepted_pets,
      hasFencedYard: row.has_fenced_yard,
      hasNoPetsAtHome: row.has_no_pets_at_home,
      backgroundCheckStatus: row.background_check_status,
      ratingAvg: row.rating_avg,
    });

    return res.json({
      success: true,
      completeness,
      updatedFields: Object.keys(data),
    });
  } catch (err) {
    logger.error('[ProviderProfile] PATCH /me failed', { uid, err });
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ─── Services config schema ───────────────────────────────────────────────────
const addonSchema = z.object({
  id:      z.string().max(60),
  label:   z.string().max(100),
  price:   z.number().min(0).max(10000),
  enabled: z.boolean(),
});

const serviceSchema = z.object({
  enabled:   z.boolean(),
  basePrice: z.number().min(0).max(100000).nullable().optional(),
  addons:    z.array(addonSchema).max(20).optional(),
});

const ALLOWED_SERVICE_IDS = ['boarding', 'daycare', 'dogwalking', 'grooming', 'pettraining', 'petsitting', 'housesitting', 'dropinvisit'];

const servicesConfigSchema = z
  .record(z.string(), serviceSchema)
  .refine(obj => Object.keys(obj).every(k => ALLOWED_SERVICE_IDS.includes(k)), { message: 'Unknown service type' });

// ─── GET /api/provider-profile/services ──────────────────────────────────────
router.get('/services', async (req: Request, res: Response) => {
  applyDevBypass(req);
  const uid = getUid(req);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const rows = await pool.query(
      `SELECT services_config FROM provider_profiles WHERE user_id = $1`,
      [uid]
    );
    if (rows.rows.length === 0) return res.status(404).json({ error: 'Provider profile not found' });

    return res.json({ success: true, servicesConfig: rows.rows[0].services_config ?? null });
  } catch (err) {
    logger.error('[ProviderProfile] GET /services failed', { uid, err });
    return res.status(500).json({ error: 'Failed to load services' });
  }
});

// ─── PATCH /api/provider-profile/services ────────────────────────────────────
router.patch('/services', async (req: Request, res: Response) => {
  applyDevBypass(req);
  const uid = getUid(req);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });

  const parsed = servicesConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid services config', details: parsed.error.flatten() });
  }

  const [existing] = await db
    .select({ userId: providerProfiles.userId })
    .from(providerProfiles)
    .where(eq(providerProfiles.userId, uid));
  if (!existing) return res.status(404).json({ error: 'Provider profile not found' });

  try {
    await pool.query(
      `UPDATE provider_profiles SET services_config = $1, updated_at = NOW() WHERE user_id = $2`,
      [JSON.stringify(parsed.data), uid]
    );
    logger.info('[ProviderProfile] PATCH /services', { uid, services: Object.keys(parsed.data) });
    return res.json({ success: true, servicesConfig: parsed.data });
  } catch (err) {
    logger.error('[ProviderProfile] PATCH /services failed', { uid, err });
    return res.status(500).json({ error: 'Failed to save services' });
  }
});

export default router;

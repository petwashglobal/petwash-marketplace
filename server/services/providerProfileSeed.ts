/**
 * providerProfileSeed — the LAST MILE between "approved" and "visible".
 *
 * WHY (platforms audit 2026-09-12): approving a provider application wrote a
 * `providers` row and flipped the Firebase claim — and nothing else. Customer
 * search joins `walker_profiles` / `sitter_profiles` / `trainers`, rows that
 * were only ever written by legacy self-registration endpoints no client calls
 * any more. Result: every approved sitter, walker and trainer was invisible,
 * forever, and all five platforms listed nobody in production.
 *
 * Approval now seeds the platform profile from the application (name, contact,
 * city, DOB where the KYC captured it). The application carries NO rate, so
 * the seeded row is deliberately NOT bookable: walker `isAvailable=false`,
 * sitter `pricePerDayCents=0`, trainer `isAcceptingBookings=false`. The
 * provider sets a rate on the Provider OS rate card
 * (server/routes/provider-rate-card.ts), which flips them live. Search gates
 * enforce the same rule so a ₪0 profile never renders as bookable.
 *
 * Idempotent on user_id: re-approving never creates a second profile.
 */
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db } from '../db';
import { walkerProfiles, sitterProfiles, trainers } from '@shared/schema';
import { logger } from '../lib/logger';

export type SeedableApplication = {
  userId: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phoneNumber?: string | null;
  city?: string | null;
  country?: string | null;
  dateOfBirth?: string | Date | null;
  residentialHistory?: string | null;
  businessName?: string | null;
};

export type SeedPlan = {
  walker?: Record<string, unknown>;
  sitter?: Record<string, unknown>;
  trainer?: Record<string, unknown>;
  skipped: { platform: string; reason: string }[];
};

function firstAddress(residentialHistory: string | null | undefined): { address: string; city: string; postal: string } {
  try {
    const arr = residentialHistory ? JSON.parse(residentialHistory) : [];
    const h = Array.isArray(arr) ? arr[0] : null;
    return {
      address: String(h?.address || h?.street || ''),
      city: String(h?.city || ''),
      postal: String(h?.postalCode || h?.zip || ''),
    };
  } catch {
    return { address: '', city: '', postal: '' };
  }
}

function toDateOnly(d: string | Date | null | undefined): string | null {
  if (!d) return null;
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

/** Pure: what each platform row would look like. Exported for tests. */
export function buildProfileSeeds(app: SeedableApplication, platformIds: Iterable<string>): SeedPlan {
  const plan: SeedPlan = { skipped: [] };
  const firstName = (app.firstName || '').trim() || 'PetWash';
  const lastName = (app.lastName || '').trim() || 'Provider';
  const email = (app.email || '').trim().toLowerCase();
  const phone = (app.phoneNumber || '').trim();
  const city = (app.city || '').trim();
  const addr = firstAddress(app.residentialHistory);

  for (const platformId of platformIds) {
    if (platformId === 'walk_my_pet') {
      plan.walker = {
        walkerId: `WALKER-${randomUUID()}`,
        userId: app.userId,
        firstName, lastName,
        city: city || addr.city || '—',
        country: app.country || 'IL',
        verificationStatus: 'verified',
        kycCompleted: true,
        backgroundCheckStatus: 'passed',
        baseHourlyRate: '0.00',   // set on the rate card
        isAvailable: false,       // not bookable until a rate exists
        isActive: true,
      };
    } else if (platformId === 'sitter_suite') {
      const dob = toDateOnly(app.dateOfBirth);
      if (!dob) {
        plan.skipped.push({ platform: 'sitter_suite', reason: 'no_date_of_birth_on_application' });
        continue;
      }
      if (!email || !phone) {
        plan.skipped.push({ platform: 'sitter_suite', reason: 'no_email_or_phone_on_application' });
        continue;
      }
      plan.sitter = {
        userId: app.userId,
        firstName, lastName,
        dateOfBirth: dob,
        email, phone,
        streetAddress: addr.address || '',
        city: city || addr.city || '—',
        stateProvince: '',
        postalCode: addr.postal || '',
        country: app.country || 'IL',
        yearsOfExperience: 0,
        pricePerDayCents: 0,      // set on the rate card; search requires > 0
        verificationLevel: 'bronze', // KYC passed = bronze; badges raise it later
      };
    } else if (platformId === 'academy') {
      if (!email || !phone) {
        plan.skipped.push({ platform: 'academy', reason: 'no_email_or_phone_on_application' });
        continue;
      }
      plan.trainer = {
        trainerId: `TR-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
        userId: app.userId,
        firstName, lastName, email, phone,
        specialties: [],
        yearsOfExperience: 0,
        hourlyRate: '0.00',       // set on the rate card
        serviceTypes: [],
        serviceArea: city || null,
        languages: ['he', 'en'],
        verificationStatus: 'approved',
        isAcceptingBookings: false, // not bookable until a rate exists
        isActive: true,
        isCertified: false,
      };
    }
  }
  return plan;
}

export type SeedResult = { created: string[]; existing: string[]; skipped: SeedPlan['skipped'] };

/** Upsert the platform profile rows for an approved application. Never throws. */
export async function seedProviderProfiles(app: SeedableApplication, platformIds: Iterable<string>): Promise<SeedResult> {
  const plan = buildProfileSeeds(app, platformIds);
  const result: SeedResult = { created: [], existing: [], skipped: plan.skipped };
  try {
    if (plan.walker) {
      const [w] = await db.select({ id: walkerProfiles.id }).from(walkerProfiles).where(eq(walkerProfiles.userId, app.userId)).limit(1);
      if (w) {
        await db.update(walkerProfiles).set({ verificationStatus: 'verified', isActive: true } as any).where(eq(walkerProfiles.userId, app.userId));
        result.existing.push('walk_my_pet');
      } else {
        await db.insert(walkerProfiles).values(plan.walker as any);
        result.created.push('walk_my_pet');
      }
    }
    if (plan.sitter) {
      const [s] = await db.select({ id: sitterProfiles.id }).from(sitterProfiles).where(eq(sitterProfiles.userId, app.userId)).limit(1);
      if (s) {
        await db.update(sitterProfiles).set({ verificationLevel: 'bronze' } as any).where(eq(sitterProfiles.userId, app.userId));
        result.existing.push('sitter_suite');
      } else {
        await db.insert(sitterProfiles).values(plan.sitter as any);
        result.created.push('sitter_suite');
      }
    }
    if (plan.trainer) {
      const [t] = await db.select({ id: trainers.id }).from(trainers).where(eq(trainers.userId, app.userId)).limit(1);
      if (t) {
        await db.update(trainers).set({ verificationStatus: 'approved', isActive: true } as any).where(eq(trainers.userId, app.userId));
        result.existing.push('academy');
      } else {
        await db.insert(trainers).values(plan.trainer as any);
        result.created.push('academy');
      }
    }
    logger.info('[ProviderProfileSeed] seeded', { userId: app.userId, ...result });
  } catch (err: any) {
    logger.error('[ProviderProfileSeed] FAILED — approved provider may be invisible in search', { userId: app.userId, error: err?.message });
  }
  return result;
}

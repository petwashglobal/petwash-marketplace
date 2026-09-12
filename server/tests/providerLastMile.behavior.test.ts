import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { buildProfileSeeds } from '../services/providerProfileSeed';
import { rateCardUpdates, rateCardSchema } from '../routes/provider-rate-card';

/**
 * Platforms audit 2026-09-12 — the last mile between "approved" and "visible":
 * approval never wrote the profile row the search joins on, and there was no
 * screen to set a rate. Now: approval seeds the profile at ₪0 / unavailable,
 * the Provider OS rate card turns it on, and the search gates never list a
 * ₪0 profile as bookable.
 */
const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

const app = {
  userId: 'u-1', email: 'Sitter@Example.com', firstName: 'Dana', lastName: 'Levi', phoneNumber: '+972501234567',
  city: 'Kfar Saba', country: 'IL', dateOfBirth: '1990-05-01',
  residentialHistory: JSON.stringify([{ address: 'Weizmann 185', city: 'Kfar Saba', postalCode: '4440000' }]),
};

describe('seed plan: bookable only after a rate exists', () => {
  it('walker: verified, active, NOT available, rate 0', () => {
    const p = buildProfileSeeds(app, ['walk_my_pet']);
    expect(p.walker).toMatchObject({ userId: 'u-1', firstName: 'Dana', lastName: 'Levi', city: 'Kfar Saba', verificationStatus: 'verified', isAvailable: false, isActive: true, baseHourlyRate: '0.00' });
    expect(String(p.walker!.walkerId)).toMatch(/^WALKER-/);
    expect(p.skipped).toEqual([]);
  });
  it('sitter: bronze from KYC, price 0, address from residential history, email normalised', () => {
    const p = buildProfileSeeds(app, ['sitter_suite']);
    expect(p.sitter).toMatchObject({ verificationLevel: 'bronze', pricePerDayCents: 0, dateOfBirth: '1990-05-01', streetAddress: 'Weizmann 185', postalCode: '4440000', email: 'sitter@example.com' });
  });
  it('sitter is skipped (not faked) when the application has no date of birth', () => {
    const p = buildProfileSeeds({ ...app, dateOfBirth: null }, ['sitter_suite', 'walk_my_pet']);
    expect(p.sitter).toBeUndefined();
    expect(p.walker).toBeDefined();
    expect(p.skipped).toEqual([{ platform: 'sitter_suite', reason: 'no_date_of_birth_on_application' }]);
  });
  it('trainer: approved, active, NOT accepting bookings, rate 0', () => {
    const p = buildProfileSeeds(app, ['academy']);
    expect(p.trainer).toMatchObject({ verificationStatus: 'approved', isAcceptingBookings: false, isActive: true, hourlyRate: '0.00', serviceArea: 'Kfar Saba' });
    expect(String(p.trainer!.trainerId)).toMatch(/^TR-\d{4}-[A-F0-9]{8}$/);
  });
  it('unknown platforms are ignored', () => {
    expect(buildProfileSeeds(app, ['k9000', 'pet_trek'])).toEqual({ skipped: [] });
  });
});

describe('rate card: a positive rate + available = live; anything else = off the shelf', () => {
  it('walker', () => {
    expect(rateCardUpdates({ walkerHourlyIls: 80, available: true })).toMatchObject({ walker: { baseHourlyRate: '80.00', isAvailable: true } });
    expect(rateCardUpdates({ walkerHourlyIls: 80, available: false })).toMatchObject({ walker: { baseHourlyRate: '80.00', isAvailable: false } });
    expect(rateCardUpdates({ walkerHourlyIls: 0, available: true })).toMatchObject({ walker: { isAvailable: false } });
  });
  it('sitter expresses "unavailable" as price 0 (what the search gate reads)', () => {
    expect(rateCardUpdates({ sitterDayIls: 250, sitterHourIls: 40, available: true })).toMatchObject({ sitter: { pricePerDayCents: 25000, pricePerHourCents: 4000 } });
    expect(rateCardUpdates({ sitterDayIls: 250, available: false })).toMatchObject({ sitter: { pricePerDayCents: 0 } });
  });
  it('trainer', () => {
    expect(rateCardUpdates({ trainerHourlyIls: 150, available: true })).toMatchObject({ trainer: { hourlyRate: '150.00', isAcceptingBookings: true, isActive: true } });
  });
  it('schema rejects negatives and absurd rates', () => {
    expect(rateCardSchema.safeParse({ walkerHourlyIls: -1 }).success).toBe(false);
    expect(rateCardSchema.safeParse({ sitterDayIls: 99999 }).success).toBe(false);
    expect(rateCardSchema.safeParse({}).success).toBe(true);
  });
});

describe('wiring pins', () => {
  it('approval seeds the profiles; the router is mounted; Provider OS has the screen', () => {
    const pa = R('server/routes/provider-applications.ts');
    expect(pa).toContain("import { seedProviderProfiles } from '../services/providerProfileSeed';");
    expect(pa).toContain('await seedProviderProfiles(application as any, Array.from(platformIds));');
    const routes = R('server/routes.ts');
    expect(routes).toContain("app.use('/api/provider-os', apiLimiter, providerRateCardRoutes);");
    const pos = R('client/src/pages/provider-os/ProviderOS.tsx');
    expect(pos).toContain("{activeModule === 'ratecard' && <POSRateCard />}");
    expect(pos).toContain("{ id: 'ratecard' as Module, label: 'Rate Card & Availability', labelHe: 'מחירון וזמינות', icon: DollarSign },");
    expect(R('client/src/pages/provider-os/POSRateCard.tsx')).toContain("apiRequest('PUT', '/api/provider-os/rate-card', body)");
  });
  it('search never lists a ₪0 / unavailable profile', () => {
    const s = R('server/services/providerSearchService.ts');
    expect(s).toContain('eq(walkerProfiles.isAvailable, true),');
    expect(s).toContain('gt(walkerProfiles.baseHourlyRate, "0"),');
    expect(s).toContain('gt(sitterProfiles.pricePerDayCents, 0),');
  });
});

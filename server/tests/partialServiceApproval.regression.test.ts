/**
 * CEO FLY MODE II §36 (2026-08-29) — partial service approval pins.
 *
 * The per-service approval ladder is the legal-spec contract: a
 * provider approved for one service (e.g. `dog_walking`) is NOT
 * approved for another (`pet_sitting`), and approved-for-booking is
 * NOT approved-for-payout. The DB model + admin endpoint + booking
 * gate + payout gate all cooperate to enforce this. These pins lock
 * the discipline source-side so a refactor cannot collapse two
 * services or auto-promote across the ladder.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SERVICE = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'providerServiceApproval.ts'),
  'utf8',
);

const APPROVE_ROUTE = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'provider-applications.ts'),
  'utf8',
);

describe('CEO FLY MODE II §36 — per-service ladder discipline', () => {
  it('LEVEL_TO_STATE has the four canonical levels and NEVER conflates them', () => {
    // waitlist → profile display OFF, booking OFF, payout OFF
    // profile  → profile display ON,  booking OFF, payout OFF
    // booking  → profile display ON,  booking ON,  payout OFF
    // payout   → profile display ON,  booking ON,  payout ON
    expect(SERVICE).toMatch(
      /waitlist:\s*\{\s*serviceStatus:\s*'approved_for_waitlist',\s*profileVisible:\s*false,\s*bookingEnabled:\s*false,\s*payoutEnabled:\s*false\s*\}/,
    );
    expect(SERVICE).toMatch(
      /profile:\s*\{\s*serviceStatus:\s*'approved_for_profile_display',\s*profileVisible:\s*true,\s*bookingEnabled:\s*false,\s*payoutEnabled:\s*false\s*\}/,
    );
    expect(SERVICE).toMatch(
      /booking:\s*\{\s*serviceStatus:\s*'approved_for_booking',\s*profileVisible:\s*true,\s*bookingEnabled:\s*true,\s*payoutEnabled:\s*false\s*\}/,
    );
    expect(SERVICE).toMatch(
      /payout:\s*\{\s*serviceStatus:\s*'approved_for_payout',\s*profileVisible:\s*true,\s*bookingEnabled:\s*true,\s*payoutEnabled:\s*true\s*\}/,
    );
  });

  it('assertServiceApproved reads by (providerId, serviceType) — not by providerId alone', () => {
    // A regression that dropped the serviceType predicate would
    // return a single row (any service) for any query — silently
    // conflating approval across services.
    expect(SERVICE).toMatch(
      /\.where\(and\(eq\(providerServices\.providerId, providerId\), eq\(providerServices\.serviceType, svc\)\)\)/,
    );
  });

  it('setProviderServiceLevel writes ONLY (providerId, serviceType) — never fans out', () => {
    // The insert body targets a single (providerId, serviceType)
    // pair, and the onConflictDoUpdate is keyed on the same pair.
    expect(SERVICE).toMatch(
      /onConflictDoUpdate\(\{\s*target:\s*\[providerServices\.providerId, providerServices\.serviceType\]/,
    );
    // A regression that updates every row for providerId regardless
    // of serviceType would be catastrophic — pin the target keys.
  });

  it('seedProviderServicesOnApproval seeds each service at WAITLIST — never jumps to booking/payout', () => {
    const idx = SERVICE.indexOf('export async function seedProviderServicesOnApproval');
    const block = SERVICE.slice(idx, idx + 1200);
    expect(block).toMatch(/serviceStatus:\s*'approved_for_waitlist'/);
    expect(block).toMatch(/profileVisible:\s*false/);
    expect(block).toMatch(/bookingEnabled:\s*false/);
    expect(block).toMatch(/payoutEnabled:\s*false/);
    // Existing rows must NOT be downgraded — the write is
    // ON CONFLICT DO NOTHING, not DO UPDATE.
    expect(block).toMatch(/onConflictDoNothing/);
    expect(block).not.toMatch(/seedProviderServicesOnApproval[\s\S]{0,1200}onConflictDoUpdate/);
  });
});

describe('CEO FLY MODE II §36 — admin approve endpoint validates per-service', () => {
  it('endpoint path is per-service scoped: /:applicationId/service/:serviceType/approve', () => {
    expect(APPROVE_ROUTE).toMatch(
      /router\.post\('\/admin\/:applicationId\/service\/:serviceType\/approve'/,
    );
  });

  it('accepts ONLY the four canonical ladder levels', () => {
    expect(APPROVE_ROUTE).toMatch(
      /ALLOWED_SERVICE_LEVELS:\s*ServiceLevel\[\][\s\S]{0,120}\[\s*'waitlist',\s*'profile',\s*'booking',\s*'payout'\s*\]/,
    );
    expect(APPROVE_ROUTE).toMatch(/error:\s*'INVALID_LEVEL'/);
  });

  it('requires a reason (audit trail) before any per-service level change', () => {
    expect(APPROVE_ROUTE).toMatch(/error:\s*'REASON_REQUIRED'/);
    expect(APPROVE_ROUTE).toMatch(/String\(reason\)\.trim\(\)\.length < 3/);
  });

  it('refuses to approve a service the applicant DID NOT apply for', () => {
    // §36 core rule: partial-approval means we cannot approve a
    // service the applicant never selected. Guard: canonical-
    // normalise both sides then check membership.
    expect(APPROVE_ROUTE).toMatch(/normalizeServiceType/);
    expect(APPROVE_ROUTE).toMatch(/canonicalApplied\.includes\(canonicalRequested\)/);
    expect(APPROVE_ROUTE).toMatch(/error:\s*'SERVICE_NOT_APPLIED'/);
  });

  it('writes a per-service audit event on every level change', () => {
    expect(APPROVE_ROUTE).toMatch(
      /eventType:\s*'provider_service_level_changed'/,
    );
    // Payload MUST carry the specific serviceType + level + reason
    // so a partial approval is auditable one service at a time.
    expect(APPROVE_ROUTE).toMatch(/serviceType:\s*updated\.serviceType/);
    expect(APPROVE_ROUTE).toMatch(/newStatus:\s*updated\.serviceStatus/);
    expect(APPROVE_ROUTE).toMatch(/reason:\s*String\(reason\)\.slice\(0, 500\)/);
  });

  it('refreshes Firebase claims with the FULL per-service map (not just the changed one)', () => {
    // After a single-service change, the customClaims must list
    // EVERY provider_services row for that provider — so a service
    // that stayed at waitlist is not silently promoted, and a
    // service that was denied still shows as denied in the claim.
    expect(APPROVE_ROUTE).toMatch(
      /approvedServices:\s*allRows\.map\(\(r\)\s*=>\s*\(\{[\s\S]{0,200}serviceType:\s*r\.serviceType,[\s\S]{0,200}serviceStatus:\s*r\.serviceStatus/,
    );
  });
});

describe('CEO FLY MODE II §36 — booking / payout gates read per-service', () => {
  it('APPROVED_SERVICE_STATUSES lists BOTH ladder tops (booking + payout)', () => {
    // me-status treats "approved" as either approved_for_booking OR
    // approved_for_payout — a lower ladder rung must not count.
    const meStatus = fs.readFileSync(
      path.resolve(__dirname, '..', 'routes', 'me-status.ts'),
      'utf8',
    );
    expect(meStatus).toMatch(
      /APPROVED_SERVICE_STATUSES\s*=\s*\['approved_for_booking',\s*'approved_for_payout'\]/,
    );
  });

  it('providerHasAnyServiceRows exists — the LEGACY vs "explicitly not approved" distinction', () => {
    // A legacy provider (approved before the ladder existed) has
    // zero rows and fail-OPEN; a provider WITH rows who lacks the
    // requested service fails CLOSED. Two different behaviours,
    // both driven by this predicate.
    expect(SERVICE).toMatch(/export async function providerHasAnyServiceRows/);
  });
});

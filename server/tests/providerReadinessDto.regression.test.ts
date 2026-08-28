/**
 * CEO §23 (2026-08-28) — machine-readable provider readiness bitmap.
 *
 * sectionStatus is the UI checklist (complete / checking / action_required).
 * `readiness` is the machine-readable eligibility bitmap the search + booking
 * gates read at runtime. Splitting the two lets the UI render friendly copy
 * while the gates remain boolean-strict.
 *
 * Fail-CLOSED: any lookup error leaves a flag FALSE. `searchEligible` and
 * `bookingEligible` are strict AND compositions — they can never light up
 * from partial state.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'provider-onboarding.ts'),
  'utf8',
);

describe('provider-onboarding — /my/status readiness DTO (CEO §23)', () => {
  it('emits a top-level `readiness` field alongside sectionStatus', () => {
    // Both keys appear inside the /my/status res.json literal.
    expect(SRC).toMatch(/sectionStatus,\s*\n\s*readiness,/);
  });

  it('declares the full 11-flag readiness bitmap', () => {
    for (const flag of [
      'identityReady',
      'insuranceReady',
      'backgroundReady',
      'payoutReady',
      'agreementsReady',
      'profileReady',
      'serviceApproved',
      'pricingReady',
      'availabilityReady',
      'searchEligible',
      'bookingEligible',
    ]) {
      expect(SRC).toContain(flag);
    }
  });

  it('searchEligible is a strict AND of the seven pre-service flags', () => {
    expect(SRC).toMatch(
      /const searchEligible =\s*\n\s*serviceApproved && identityReady && insuranceReady && backgroundReady &&\s*\n\s*payoutReady && agreementsReady && profileReady;/,
    );
  });

  it('bookingEligible requires searchEligible + pricing + availability', () => {
    expect(SRC).toMatch(
      /const bookingEligible = searchEligible && pricingReady && availabilityReady;/,
    );
  });

  it('insuranceReady requires a not-expired policy (notExpired helper wraps the timestamp)', () => {
    // Regression: an audit found the previous /my/status only checked
    // policy presence, so an expired policy still flagged the applicant
    // ready. Pin the notExpired call on insurance_expires_at.
    expect(SRC).toMatch(
      /const insuranceReady =\s*\n\s*!!\(app\.insurance_policy_number && app\.insurance_provider\) && notExpired\(app\.insurance_expires_at\);/,
    );
  });

  it('identityReady tolerates a missing KYC expiry but rejects an expired one', () => {
    // Some passport rows carry no expiry field yet — that must not
    // block eligibility, but an EXPIRED expiry must.
    expect(SRC).toMatch(
      /const identityReady =\s*\n\s*hasIdentityDocs && \(app\.kyc_document_expiry \? notExpired\(app\.kyc_document_expiry\) : true\);/,
    );
  });

  it('pricingReady + availabilityReady only run when the applicant is approved (fail-CLOSED otherwise)', () => {
    // A pending applicant has no provider_id yet — the query would
    // silently match nothing (or throw), which is fine, but we should
    // not even attempt it. Pin the gate.
    expect(SRC).toMatch(/if \(serviceApproved && app\.approved_as_provider_id\) \{/);
  });

  it('pricingReady reads provider_services with booking_enabled + unpaused', () => {
    // Neither paused_by_provider nor paused_by_admin may count toward
    // "ready". The full three-condition WHERE clause.
    expect(SRC).toMatch(/FROM provider_services\s*\n\s*WHERE provider_id = \$1\s*\n\s*AND booking_enabled = TRUE\s*\n\s*AND paused_by_provider = FALSE\s*\n\s*AND paused_by_admin = FALSE/);
  });

  it('availabilityReady reads provider_availability for a future is_available row', () => {
    expect(SRC).toMatch(/FROM provider_availability\s*\n\s*WHERE provider_id = \$1\s*\n\s*AND is_available = TRUE\s*\n\s*AND date >= CURRENT_DATE/);
  });

  it('every readiness lookup is wrapped in try/catch that FAILS the flag on error', () => {
    // Fail-CLOSED discipline: DB error must never LIGHT UP a flag.
    expect(SRC).toMatch(/catch \{ pricingReady = false; \}/);
    expect(SRC).toMatch(/catch \{ availabilityReady = false; \}/);
  });
});

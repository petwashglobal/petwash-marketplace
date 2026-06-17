/**
 * Tests the legal-gate foundation: the pure per-service approval ladder
 * (the rule "approved for one service ≠ approved for another", and
 * "approved-for-booking ≠ approved-for-payout"), plus source-introspection
 * that the requireConsent gate fails closed and the migration creates the tables.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { isServiceApprovedFor } from '../../shared/provider-service-levels';

const ROOT = resolve(__dirname, '..', '..');
const src = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8');

const row = (over: Partial<Parameters<typeof isServiceApprovedFor>[0] & object> = {}) => ({
  serviceStatus: 'approved_for_booking', bookingEnabled: true, payoutEnabled: false,
  pausedByProvider: false, pausedByAdmin: false, ...over,
});

describe('per-service approval ladder', () => {
  it('no service row → blocked (not set up)', () => {
    expect(isServiceApprovedFor(null, 'booking')).toMatchObject({ ok: false, reason: 'SERVICE_NOT_SET_UP' });
  });

  it('approved_for_booking + bookingEnabled clears BOOKING', () => {
    expect(isServiceApprovedFor(row(), 'booking').ok).toBe(true);
  });

  it('approved_for_booking does NOT clear PAYOUT', () => {
    const r = isServiceApprovedFor(row({ serviceStatus: 'approved_for_booking', payoutEnabled: false }), 'payout');
    expect(r.ok).toBe(false);
  });

  it('approved_for_payout + payoutEnabled clears PAYOUT', () => {
    expect(isServiceApprovedFor(row({ serviceStatus: 'approved_for_payout', payoutEnabled: true }), 'payout').ok).toBe(true);
  });

  it('waitlist-level status does NOT clear booking', () => {
    const r = isServiceApprovedFor(row({ serviceStatus: 'approved_for_waitlist', bookingEnabled: false }), 'booking');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/NEEDS_BOOKING_APPROVAL|BOOKING_NOT_ENABLED/);
  });

  it('booking flag off blocks even when status is high enough', () => {
    expect(isServiceApprovedFor(row({ serviceStatus: 'approved_for_payout', bookingEnabled: false }), 'booking'))
      .toMatchObject({ ok: false, reason: 'BOOKING_NOT_ENABLED' });
  });

  it('paused / suspended / needs-reconfirmation always block', () => {
    expect(isServiceApprovedFor(row({ pausedByAdmin: true }), 'booking').ok).toBe(false);
    expect(isServiceApprovedFor(row({ serviceStatus: 'suspended' }), 'booking').ok).toBe(false);
    expect(isServiceApprovedFor(row({ serviceStatus: 'needs_reconfirmation' }), 'booking').ok).toBe(false);
  });
});

describe('requireConsent gate fails closed', () => {
  const mw = src('server/middleware/requireConsent.ts');
  it('returns 403 CONSENT_REQUIRED with the missing list', () => {
    expect(mw).toMatch(/CONSENT_REQUIRED/);
    expect(mw).toMatch(/missing/);
  });
  it('a lookup error fails closed (does not let the action through)', () => {
    expect(mw).toMatch(/CONSENT_CHECK_UNAVAILABLE/);
    expect(mw).not.toMatch(/catch[\s\S]{0,80}next\(\)/); // no "swallow error then next()"
  });
});

describe('migration creates the foundation tables', () => {
  const mig = src('migrations/0053_legal_gates_foundation.sql');
  it('creates provider_services, consent_requirements, reconfirmation_records', () => {
    expect(mig).toMatch(/CREATE TABLE IF NOT EXISTS provider_services/);
    expect(mig).toMatch(/CREATE TABLE IF NOT EXISTS consent_requirements/);
    expect(mig).toMatch(/CREATE TABLE IF NOT EXISTS reconfirmation_records/);
  });
  it('provider_services is unique per (provider, service_type)', () => {
    expect(mig).toMatch(/UNIQUE \(provider_id, service_type\)/);
  });
});

import { describe, it, expect } from 'vitest';
import {
  isServiceApprovedFor,
  normalizeServiceType,
} from '../../shared/provider-service-levels';

const row = (over: Partial<Parameters<typeof isServiceApprovedFor>[0] & object> = {}) => ({
  serviceStatus: 'approved_for_payout',
  bookingEnabled: true,
  payoutEnabled: true,
  pausedByProvider: false,
  pausedByAdmin: false,
  ...over,
});

describe('normalizeServiceType — divergent vocab collapses to one canonical key', () => {
  it('maps booking short-forms and application long-forms to the SAME canonical key', () => {
    expect(normalizeServiceType('sitting')).toBe('pet_sitting');
    expect(normalizeServiceType('pet_sitting')).toBe('pet_sitting');
    expect(normalizeServiceType('walking')).toBe('dog_walking');
    expect(normalizeServiceType('dog_walking')).toBe('dog_walking');
    expect(normalizeServiceType('training')).toBe('pet_training');
    expect(normalizeServiceType('pet_training')).toBe('pet_training');
    expect(normalizeServiceType('pettrek')).toBe('pet_transport');
    expect(normalizeServiceType('pet_transport')).toBe('pet_transport');
    expect(normalizeServiceType('grooming')).toBe('grooming');
  });

  it('is case-insensitive and trims, and passes unknown values through lower-cased', () => {
    expect(normalizeServiceType('  WALKING ')).toBe('dog_walking');
    expect(normalizeServiceType('Some_New_Service')).toBe('some_new_service');
    expect(normalizeServiceType('')).toBe('');
    expect(normalizeServiceType(null)).toBe('');
    expect(normalizeServiceType(undefined)).toBe('');
  });
});

describe('isServiceApprovedFor — payout is fail-CLOSED and distinct from booking', () => {
  it('PAYOUT approved when status=approved_for_payout AND payoutEnabled', () => {
    expect(isServiceApprovedFor(row(), 'payout').ok).toBe(true);
  });

  it('PAYOUT blocked when approved-for-booking but NOT payout (booking ≠ payout)', () => {
    const r = isServiceApprovedFor(row({ serviceStatus: 'approved_for_booking', payoutEnabled: false, bookingEnabled: true }), 'payout');
    expect(r.ok).toBe(false);
  });

  it('PAYOUT blocked when payoutEnabled flag is off even if rank is high enough', () => {
    expect(isServiceApprovedFor(row({ payoutEnabled: false }), 'payout').ok).toBe(false);
  });

  it('PAYOUT blocked (fail-closed) when no row at all', () => {
    expect(isServiceApprovedFor(null, 'payout')).toMatchObject({ ok: false, reason: 'SERVICE_NOT_SET_UP' });
  });

  it('PAYOUT blocked when suspended / paused regardless of flags', () => {
    expect(isServiceApprovedFor(row({ serviceStatus: 'suspended' }), 'payout').ok).toBe(false);
    expect(isServiceApprovedFor(row({ pausedByAdmin: true }), 'payout').ok).toBe(false);
    expect(isServiceApprovedFor(row({ pausedByProvider: true }), 'payout').ok).toBe(false);
  });
});

describe('isServiceApprovedFor — booking gate', () => {
  it('BOOKING approved when bookingEnabled and rank ≥ booking', () => {
    expect(isServiceApprovedFor(row({ serviceStatus: 'approved_for_booking', payoutEnabled: false }), 'booking').ok).toBe(true);
  });
  it('BOOKING blocked at waitlist level', () => {
    const r = isServiceApprovedFor(row({ serviceStatus: 'approved_for_waitlist', bookingEnabled: false, payoutEnabled: false }), 'booking');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('NEEDS_BOOKING_APPROVAL');
  });
});

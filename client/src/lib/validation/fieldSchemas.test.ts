import { describe, it, expect } from 'vitest';
import { isValidIsraeliId, isValidPhone, fieldSchemas } from './fieldSchemas';
import { vmsg } from './messages';
import { isAtLeastAge, isNotFutureDate, isEndOnOrAfterStart } from './dates';
import { providerApplicationSchema } from './providers';
import { bookingRequestSchema } from './bookings';
import { pawFinderPublishSchema } from './pawFinder';
import { incidentMinimalSchema } from './incidents';
import { giftPurchaseSchema } from './gifts';
import { petPassportSchema } from './pets';

describe('isValidIsraeliId (checksum)', () => {
  it('accepts valid Israeli IDs', () => {
    expect(isValidIsraeliId('000000018')).toBe(true);
    expect(isValidIsraeliId('123456782')).toBe(true);
  });
  it('rejects invalid checksums, empty, all-zero', () => {
    expect(isValidIsraeliId('123456789')).toBe(false);
    expect(isValidIsraeliId('')).toBe(false);
    expect(isValidIsraeliId('000000000')).toBe(false);
  });
});

describe('isValidPhone (E.164)', () => {
  it('accepts valid IL mobile, rejects junk', () => {
    expect(isValidPhone('+972541234567')).toBe(true);
    expect(isValidPhone('')).toBe(false);
    expect(isValidPhone('123')).toBe(false);
  });
});

describe('common fieldSchemas', () => {
  const f = fieldSchemas('en');
  it('email + postalCode + consent', () => {
    expect(f.email.safeParse('nope').success).toBe(false);
    expect(f.email.safeParse('a@b.co').success).toBe(true);
    expect(f.postalCode.safeParse('1234').success).toBe(false);
    expect(f.postalCode.safeParse('1234567').success).toBe(true);
    expect(f.consent.safeParse(false).success).toBe(false);
    expect(f.consent.safeParse(true).success).toBe(true);
  });
  it('amount enforces min/max and parses currency strings', () => {
    const amt = f.amount(10, 1000);
    expect(amt.safeParse('₪5').success).toBe(false);
    expect(amt.safeParse('5000').success).toBe(false);
    const ok = amt.safeParse('₪250');
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data).toBe(250);
  });
});

describe('dates / age business rules', () => {
  it('isAtLeastAge: 18+ gate', () => {
    expect(isAtLeastAge('1990-01-01', 18)).toBe(true);
    expect(isAtLeastAge('2020-01-01', 18)).toBe(false);
  });
  it('isNotFutureDate + isEndOnOrAfterStart', () => {
    expect(isNotFutureDate('2999-01-01')).toBe(false);
    expect(isNotFutureDate('2000-01-01')).toBe(true);
    expect(isEndOnOrAfterStart('2030-01-10', '2030-01-05')).toBe(false);
    expect(isEndOnOrAfterStart('2030-01-10', '2030-01-12')).toBe(true);
  });
});

describe('provider application — under-18 is blocked', () => {
  const s = providerApplicationSchema('en');
  const base = {
    legalName: 'Dana Cohen',
    email: 'dana@example.com',
    phone: '+972541234567',
    nationalId: '123456782',
    requestedServices: ['walker'],
    city: 'Tel Aviv',
    country: 'Israel',
    postalCode: '',
  };
  it('rejects an under-18 applicant', () => {
    expect(s.safeParse({ ...base, dob: '2020-01-01' }).success).toBe(false);
  });
  it('accepts an adult applicant with a service selected', () => {
    expect(s.safeParse({ ...base, dob: '1990-01-01' }).success).toBe(true);
  });
  it('rejects when no service selected', () => {
    expect(s.safeParse({ ...base, dob: '1990-01-01', requestedServices: [] }).success).toBe(false);
  });
});

describe('booking request — date order', () => {
  const s = bookingRequestSchema('en');
  it('rejects end before start', () => {
    expect(s.safeParse({ petId: 'p1', startDate: '2030-01-10', endDate: '2030-01-05' }).success).toBe(false);
  });
  it('accepts end after start', () => {
    expect(s.safeParse({ petId: 'p1', startDate: '2030-01-10', endDate: '2030-01-12' }).success).toBe(true);
  });
  it('requires a pet', () => {
    expect(s.safeParse({ petId: '', startDate: '2030-01-10', endDate: '2030-01-12' }).success).toBe(false);
  });
});

describe('paw finder — minimum safe-publish fields', () => {
  const s = pawFinderPublishSchema('en');
  it('rejects missing location', () => {
    expect(s.safeParse({ petType: 'DOG', lastSeenArea: '', contactPreference: 'IN_APP' }).success).toBe(false);
  });
  it('accepts full minimal report', () => {
    expect(s.safeParse({ petType: 'DOG', lastSeenArea: 'Kfar Saba', contactPreference: 'PHONE' }).success).toBe(true);
  });
});

describe('incident — minimal urgent report', () => {
  const s = incidentMinimalSchema('en');
  it('accepts a sufficient description, rejects too short', () => {
    expect(s.safeParse({ description: 'too short' }).success).toBe(false);
    expect(s.safeParse({ description: 'My dog was injured during the wash today.' }).success).toBe(true);
  });
});

describe('gift purchase — recipient contact required before pay', () => {
  const s = giftPurchaseSchema('en');
  it('rejects when no recipient email or mobile', () => {
    expect(s.safeParse({ recipientEmail: '', recipientMobile: '', amount: '200' }).success).toBe(false);
  });
  it('accepts with a recipient email', () => {
    expect(s.safeParse({ recipientEmail: 'gift@example.com', recipientMobile: '', amount: '200' }).success).toBe(true);
  });
});

describe('pet passport — DOB not future', () => {
  const s = petPassportSchema('en');
  it('rejects a future birth date', () => {
    expect(s.safeParse({ petName: 'Kenzo', petType: 'DOG', dob: '2999-01-01' }).success).toBe(false);
  });
  it('accepts a past birth date', () => {
    expect(s.safeParse({ petName: 'Kenzo', petType: 'DOG', dob: '2020-01-01' }).success).toBe(true);
  });
});

describe('vmsg localization', () => {
  it('he + en variants, en fallback', () => {
    expect(vmsg('validation.email.invalid', 'he')).toContain('אימייל');
    expect(vmsg('validation.email.invalid', 'en')).toContain('email');
    expect(vmsg('validation.email.invalid', 'ar')).toBe(vmsg('validation.email.invalid', 'en'));
  });
});

import { describe, it, expect } from 'vitest';
import {
  CARD_STATUSES,
  CARD_TIERS,
  SCAN_TYPES,
  SCAN_RESULTS,
  TIER_CODE,
} from '@shared/schema-membership-cards';

describe('membership credential constants', () => {
  it('every tier has a short code used in the member id (PW-{code}-{n})', () => {
    for (const tier of CARD_TIERS) {
      expect(TIER_CODE[tier]).toMatch(/^[A-Z]{3}$/);
    }
    expect(TIER_CODE.platinum).toBe('PLT'); // PW-PLT-000128
    expect(TIER_CODE.founder).toBe('FDR');
  });

  it('card statuses include the full lifecycle from the spec', () => {
    expect([...CARD_STATUSES]).toEqual(['active', 'frozen', 'lost', 'expired', 'cancelled']);
  });

  it('scan types + results match the spec', () => {
    expect([...SCAN_TYPES]).toEqual(['qr', 'barcode', 'nfc']);
    expect([...SCAN_RESULTS]).toEqual(['approved', 'rejected', 'expired', 'suspicious']);
  });

  it('tier codes are unique', () => {
    const codes = Object.values(TIER_CODE);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

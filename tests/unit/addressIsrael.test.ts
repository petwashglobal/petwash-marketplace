import { describe, it, expect } from 'vitest';
import {
  cityKey,
  stripHebrewStreetPrefix,
  normalizeIsraeliPostalCode,
  sameCity,
  knownCityKeys,
} from '../../shared/lib/address';

/**
 * Israel-specific address handling — regression suite.
 *
 * These tests cover the two real examples from the audit:
 *   רחוב רימלט 18 דירה 77 רמת גן ישראל
 *   עוזי חיטמן 8 ראש העין ישראל
 *
 * Plus the silent Hebrew↔English mismatch class of bug.
 */

describe('cityKey — Israel locality normalization', () => {
  it('maps Hebrew and English Tel Aviv to the same key', () => {
    expect(cityKey('Tel Aviv')).toBe('tel-aviv');
    expect(cityKey('תל אביב')).toBe('tel-aviv');
    expect(cityKey('תל-אביב')).toBe('tel-aviv');
    expect(cityKey('Tel Aviv-Yafo')).toBe('tel-aviv');
    expect(cityKey('תל אביב-יפו')).toBe('tel-aviv');
  });

  it('maps Hebrew and English Ramat Gan to the same key (real example A)', () => {
    expect(cityKey('Ramat Gan')).toBe('ramat-gan');
    expect(cityKey('רמת גן')).toBe('ramat-gan');
    expect(cityKey('רמת-גן')).toBe('ramat-gan');
    expect(cityKey(' רמת גן ')).toBe('ramat-gan');
  });

  it('maps Hebrew and English Rosh HaAyin to the same key (real example B)', () => {
    expect(cityKey('Rosh HaAyin')).toBe('rosh-haayin');
    expect(cityKey("rosh ha'ayin")).toBe('rosh-haayin');
    expect(cityKey('ראש העין')).toBe('rosh-haayin');
    expect(cityKey('ראש-העין')).toBe('rosh-haayin');
  });

  it('returns empty string for null / empty / whitespace input', () => {
    expect(cityKey(null)).toBe('');
    expect(cityKey(undefined)).toBe('');
    expect(cityKey('')).toBe('');
    expect(cityKey('   ')).toBe('');
  });

  it('produces a deterministic slug for unknown localities (fallback)', () => {
    const a = cityKey('Some New Suburb');
    const b = cityKey(' some new suburb ');
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-z0-9א-ת-]+$/);
  });

  it('exposes a list of known city keys', () => {
    const keys = knownCityKeys();
    expect(keys.length).toBeGreaterThanOrEqual(40);
    expect(keys).toContain('tel-aviv');
    expect(keys).toContain('ramat-gan');
    expect(keys).toContain('rosh-haayin');
    expect(keys).toContain('jerusalem');
    expect(keys).toContain('haifa');
  });
});

describe('sameCity — silent Hebrew/English mismatch fix', () => {
  it('considers Hebrew and English Ramat Gan equal', () => {
    expect(sameCity('Ramat Gan', 'רמת גן')).toBe(true);
    expect(sameCity('רמת גן', 'Ramat Gan')).toBe(true);
  });

  it('considers Hebrew and English Rosh HaAyin equal', () => {
    expect(sameCity('Rosh HaAyin', 'ראש העין')).toBe(true);
    expect(sameCity('ראש-העין', 'rosh ha ayin')).toBe(true);
  });

  it('returns false for two genuinely different cities', () => {
    expect(sameCity('Tel Aviv', 'Ramat Gan')).toBe(false);
    expect(sameCity('תל אביב', 'ירושלים')).toBe(false);
  });

  it('returns false when one side is empty', () => {
    expect(sameCity('', 'Ramat Gan')).toBe(false);
    expect(sameCity(null, 'רמת גן')).toBe(false);
  });
});

describe('stripHebrewStreetPrefix', () => {
  it('strips רחוב prefix (real example A)', () => {
    expect(stripHebrewStreetPrefix('רחוב רימלט')).toBe('רימלט');
  });

  it('strips שדרות prefix', () => {
    expect(stripHebrewStreetPrefix('שדרות רוטשילד')).toBe('רוטשילד');
  });

  it('strips דרך prefix', () => {
    expect(stripHebrewStreetPrefix('דרך נמיר')).toBe('נמיר');
  });

  it('returns input unchanged for English street names', () => {
    expect(stripHebrewStreetPrefix('Rothschild')).toBe('Rothschild');
    expect(stripHebrewStreetPrefix('HaYarkon St')).toBe('HaYarkon St');
  });

  it('is idempotent', () => {
    const once = stripHebrewStreetPrefix('רחוב רימלט');
    const twice = stripHebrewStreetPrefix(once);
    expect(once).toBe(twice);
  });

  it('handles example B (no prefix — name is the street)', () => {
    expect(stripHebrewStreetPrefix('עוזי חיטמן')).toBe('עוזי חיטמן');
  });
});

describe('normalizeIsraeliPostalCode', () => {
  it('accepts a 5-digit code', () => {
    expect(normalizeIsraeliPostalCode('51234')).toBe('51234');
  });

  it('accepts a 7-digit code', () => {
    expect(normalizeIsraeliPostalCode('5121234')).toBe('5121234');
  });

  it('strips spaces, dashes, and other separators', () => {
    expect(normalizeIsraeliPostalCode('512-1234')).toBe('5121234');
    expect(normalizeIsraeliPostalCode('51 234')).toBe('51234');
  });

  it('returns null for missing or malformed input (NEVER throws)', () => {
    expect(normalizeIsraeliPostalCode(null)).toBeNull();
    expect(normalizeIsraeliPostalCode(undefined)).toBeNull();
    expect(normalizeIsraeliPostalCode('')).toBeNull();
    expect(normalizeIsraeliPostalCode('123')).toBeNull(); // 3 digits
    expect(normalizeIsraeliPostalCode('123456789')).toBeNull(); // 9 digits
  });
});

describe('Real example traces from the address audit', () => {
  // Example A:  רחוב רימלט 18 דירה 77 רמת גן ישראל
  it('Example A — Ramat Gan flow stores a clean structured address', () => {
    // Simulate what the shared component would emit after Places resolves.
    const placeDetails = {
      street: 'רחוב רימלט',
      streetNumber: '18',
      city: 'רמת גן',
      country: 'IL',
      apartment: '77', // user types separately
    };
    const stored = {
      street: stripHebrewStreetPrefix(placeDetails.street),
      streetNumber: placeDetails.streetNumber,
      city: placeDetails.city,
      cityKey: cityKey(placeDetails.city),
      country: placeDetails.country,
      apartment: placeDetails.apartment,
    };
    expect(stored.street).toBe('רימלט');
    expect(stored.streetNumber).toBe('18');
    expect(stored.cityKey).toBe('ramat-gan');
    expect(stored.country).toBe('IL');
    expect(stored.apartment).toBe('77');
  });

  // Example B:  עוזי חיטמן 8 ראש העין ישראל
  it('Example B — Rosh HaAyin flow stores a clean structured address', () => {
    const placeDetails = {
      street: 'עוזי חיטמן',
      streetNumber: '8',
      city: 'ראש העין',
      country: 'IL',
    };
    const stored = {
      street: stripHebrewStreetPrefix(placeDetails.street),
      streetNumber: placeDetails.streetNumber,
      city: placeDetails.city,
      cityKey: cityKey(placeDetails.city),
      country: placeDetails.country,
    };
    expect(stored.street).toBe('עוזי חיטמן');
    expect(stored.streetNumber).toBe('8');
    expect(stored.cityKey).toBe('rosh-haayin');
  });

  it('matches a customer in Hebrew Ramat Gan with a provider in English Ramat Gan', () => {
    const customerCity = 'רמת גן';
    const providerCity = 'Ramat Gan';
    expect(sameCity(customerCity, providerCity)).toBe(true);
  });

  it('does NOT match a customer in Ramat Gan with a provider in Tel Aviv', () => {
    expect(sameCity('רמת גן', 'Tel Aviv')).toBe(false);
  });
});

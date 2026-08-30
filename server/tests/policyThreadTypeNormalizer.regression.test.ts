/**
 * normalizePolicyThreadType — CEO DEEP-LOGIC §21.
 *
 * The prior wire used `(t.threadType as PolicyThreadType)` — a
 * compile-time cast that does no runtime validation. Values the DB
 * carries but the policy vocabulary does NOT (INCIDENT, FRANCHISE)
 * would reach evaluateMessage() as unknown ThreadType strings. This
 * normalizer is a CLOSED switch so no policy path ever depends on an
 * unvalidated string.
 */
import { describe, it, expect } from 'vitest';
import { normalizePolicyThreadType } from '@shared/marketplace/policyEngine';

describe('closed vocabulary', () => {
  it.each([
    'BOOKING', 'MEET_AND_GREET', 'SUPPORT', 'K9000', 'PAW_FINDER',
    'SHOP_ORDER', 'GIFT', 'PROVIDER_APPLICATION', 'ADMIN',
  ])('passes %s through unchanged', (v) => {
    expect(normalizePolicyThreadType(v)).toBe(v);
  });
});

describe('DB-only values collapse to their nearest policy sibling', () => {
  it("'INCIDENT' collapses to SUPPORT (§22 — support/incident share context rules)", () => {
    expect(normalizePolicyThreadType('INCIDENT')).toBe('SUPPORT');
  });

  it("'FRANCHISE' collapses to ADMIN", () => {
    expect(normalizePolicyThreadType('FRANCHISE')).toBe('ADMIN');
  });
});

describe('unknown / non-string inputs default to SUPPORT (§22 conservative)', () => {
  it.each([
    'PIZZA', '', 'booking', 'Support', 'MEET_GREET',
  ])('unknown %j → SUPPORT', (v) => {
    expect(normalizePolicyThreadType(v)).toBe('SUPPORT');
  });

  it('non-string values → SUPPORT (never throws)', () => {
    expect(normalizePolicyThreadType(undefined)).toBe('SUPPORT');
    expect(normalizePolicyThreadType(null)).toBe('SUPPORT');
    expect(normalizePolicyThreadType(42)).toBe('SUPPORT');
    expect(normalizePolicyThreadType({})).toBe('SUPPORT');
  });
});

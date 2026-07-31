import { describe, it, expect } from 'vitest';
import { assertNoRawCardData, isTokenExpired } from '../services/PaymentTokenVault';

/**
 * Pins the vault's PCI safety guard (CTO P0-2): raw card data (PAN/CVV) can NEVER
 * enter the token vault — only the processor's surrogate token. If this regresses,
 * a future change could silently store cardholder data and drag us into PCI scope.
 */
describe('PaymentTokenVault — PCI guard: never accept raw card data', () => {
  it('throws on a full card number / PAN', () => {
    expect(() => assertNoRawCardData({ cardNumber: '4111111111111111' } as any)).toThrow();
    expect(() => assertNoRawCardData({ card_number: '4111111111111111' } as any)).toThrow();
    expect(() => assertNoRawCardData({ pan: '4111111111111111' } as any)).toThrow();
  });

  it('throws on CVV / CVC / security code', () => {
    expect(() => assertNoRawCardData({ cvv: '123' } as any)).toThrow();
    expect(() => assertNoRawCardData({ cvc: '123' } as any)).toThrow();
    expect(() => assertNoRawCardData({ cvv2: '123' } as any)).toThrow();
    expect(() => assertNoRawCardData({ security_code: '123' } as any)).toThrow();
    expect(() => assertNoRawCardData({ track2: '...' } as any)).toThrow();
  });

  it('accepts a token-only input (the ONLY thing the vault stores)', () => {
    expect(() => assertNoRawCardData({
      userId: 'u1', processorTokenId: 'tok_abc123', cardBrand: 'visa', cardLast4: '4242', expMonth: 12, expYear: 2030,
    } as any)).not.toThrow();
  });

  it('rejects a full number smuggled through cardLast4', () => {
    expect(() => assertNoRawCardData({ cardLast4: '4111111111111111' } as any)).toThrow();
    expect(() => assertNoRawCardData({ cardLast4: '4242' } as any)).not.toThrow();
  });
});

describe('PaymentTokenVault — card expiry', () => {
  const now = new Date(Date.UTC(2026, 6, 31)); // 2026-07-31
  it('a card that expired last month is expired', () => {
    expect(isTokenExpired(6, 2026, now)).toBe(true);   // June 2026 ended
  });
  it('a card valid this month is NOT expired', () => {
    expect(isTokenExpired(7, 2026, now)).toBe(false);  // July 2026, still valid through month-end
  });
  it('a future card is NOT expired', () => {
    expect(isTokenExpired(1, 2030, now)).toBe(false);
  });
  it('unknown expiry does not guess (let the processor decline)', () => {
    expect(isTokenExpired(null, null, now)).toBe(false);
    expect(isTokenExpired(undefined, undefined, now)).toBe(false);
  });
});

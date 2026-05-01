import { describe, it, expect } from 'vitest';
import {
  resolveProviderForPlatform,
  type PaymentPlatform,
  type PaymentProvider,
} from '../../server/services/PaymentGatewayService';

/**
 * Phase B7 / Architecture cleanup — PaymentProvider discriminator.
 *
 * The system has two strictly separate payment processors:
 *   - 'nayax'    — physical kiosk + QR redemption (K9000)
 *   - 'tranzila' — online card capture (sitter / walker / etc.)
 *
 * Mistakenly routing a marketplace booking to Nayax (or vice versa)
 * is a compliance / accounting nightmare. This test suite locks the
 * mapping so a future commit cannot silently change it.
 */

describe('resolveProviderForPlatform — strict mapping', () => {
  it('K9000 self-service kiosk → Nayax', () => {
    expect(resolveProviderForPlatform('k9000_wash')).toBe('nayax');
  });

  it('Sitter Suite booking → Tranzila', () => {
    expect(resolveProviderForPlatform('sitter_suite')).toBe('tranzila');
  });

  it('Walk My Pet booking → Tranzila', () => {
    expect(resolveProviderForPlatform('walk_my_pet')).toBe('tranzila');
  });

  it('PetTrek transport → Tranzila', () => {
    expect(resolveProviderForPlatform('pet_trek')).toBe('tranzila');
  });

  it('e-gift purchase → Tranzila', () => {
    expect(resolveProviderForPlatform('e_gift')).toBe('tranzila');
  });

  it('K9000 is the ONLY platform that routes to Nayax', () => {
    const platforms: PaymentPlatform[] = ['sitter_suite', 'walk_my_pet', 'pet_trek', 'k9000_wash', 'e_gift'];
    const nayaxCount = platforms.filter(p => resolveProviderForPlatform(p) === 'nayax').length;
    const tranzilaCount = platforms.filter(p => resolveProviderForPlatform(p) === 'tranzila').length;
    expect(nayaxCount).toBe(1);
    expect(tranzilaCount).toBe(4);
  });

  it('every platform resolves to a valid provider (no dropped enum value)', () => {
    const platforms: PaymentPlatform[] = ['sitter_suite', 'walk_my_pet', 'pet_trek', 'k9000_wash', 'e_gift'];
    const validProviders: PaymentProvider[] = ['nayax', 'tranzila'];
    for (const p of platforms) {
      expect(validProviders).toContain(resolveProviderForPlatform(p));
    }
  });
});

describe('Architecture rule — Nayax + Tranzila are completely separate', () => {
  // These tests document the contract: do NOT change the mapping
  // without updating this test AND docs/booking-state-machine.md.

  it('K9000 must NEVER route to Tranzila — that would put Nayax kiosk under online card flow', () => {
    expect(resolveProviderForPlatform('k9000_wash')).not.toBe('tranzila');
  });

  it('sitter / walker / pettrek / e-gift must NEVER route to Nayax', () => {
    const onlinePlatforms: PaymentPlatform[] = ['sitter_suite', 'walk_my_pet', 'pet_trek', 'e_gift'];
    for (const p of onlinePlatforms) {
      expect(resolveProviderForPlatform(p)).not.toBe('nayax');
    }
  });
});

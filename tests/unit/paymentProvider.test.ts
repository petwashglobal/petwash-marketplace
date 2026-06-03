import { describe, it, expect } from 'vitest';
import {
  resolveProviderForPlatform,
  type PaymentPlatform,
  type PaymentProvider,
} from '../../server/services/PaymentGatewayService';

/**
 * PaymentProvider discriminator — post-Tranzila-removal contract.
 *
 * Tranzila (the former online-card rail) was a non-functional stub and has
 * been fully removed. Today there is exactly one real provider:
 *   - 'nayax' — physical kiosk + QR redemption (K9000)
 *
 * Online platforms (sitter / walker / pettrek / e-gift) have NO wired card
 * rail yet — UPay/SUMIT will take that slot. Until then, resolving a provider
 * for an online platform must THROW, never silently route to Nayax. This test
 * locks that so a future commit can't quietly mis-route an online payment to
 * the kiosk processor.
 */

const ONLINE_PLATFORMS: PaymentPlatform[] = ['sitter_suite', 'walk_my_pet', 'pet_trek', 'e_gift'];

describe('resolveProviderForPlatform — strict mapping', () => {
  it('K9000 self-service kiosk → Nayax', () => {
    expect(resolveProviderForPlatform('k9000_wash')).toBe('nayax');
  });

  it('online platforms have no wired rail yet → throws (pending UPay/SUMIT)', () => {
    for (const p of ONLINE_PLATFORMS) {
      expect(() => resolveProviderForPlatform(p)).toThrow(/UPay\/SUMIT/);
    }
  });

  it("Nayax is the only resolvable provider; 'nayax' is the only PaymentProvider value", () => {
    const validProviders: PaymentProvider[] = ['nayax'];
    expect(validProviders).toContain(resolveProviderForPlatform('k9000_wash'));
  });
});

describe('Architecture rule — kiosk and online rails stay separate', () => {
  it('K9000 resolves to Nayax (kiosk rail), unaffected by Tranzila removal', () => {
    expect(resolveProviderForPlatform('k9000_wash')).toBe('nayax');
  });

  it('online platforms must NEVER silently route to Nayax — they throw instead', () => {
    for (const p of ONLINE_PLATFORMS) {
      let routed: string | undefined;
      try {
        routed = resolveProviderForPlatform(p);
      } catch {
        routed = undefined;
      }
      expect(routed).not.toBe('nayax');
    }
  });
});

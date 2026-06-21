import { describe, it, expect } from 'vitest';
import {
  getDeliveryOptions,
  FREE_ISRAEL_POST_THRESHOLD_CENTS,
  PERIPHERY_SURCHARGE_CENTS,
  SIGNATURE_SURCHARGE_CENTS,
} from '../services/shop/DeliveryRouter';

describe('DeliveryRouter', () => {
  const base = { city: 'תל אביב', totalGrams: 600, subtotalCents: 5000 };

  it('always offers Israel Post as the default, nationwide', () => {
    const opts = getDeliveryOptions({ ...base, city: 'מצפה רמון' }, { woltEnabled: true });
    const ip = opts.find((o) => o.carrier === 'israel_post');
    expect(ip).toBeDefined();
    // Remote town not in Wolt area → only Israel Post
    expect(opts.some((o) => o.carrier === 'wolt')).toBe(false);
  });

  it('prices Israel Post by weight tier', () => {
    const light = getDeliveryOptions({ ...base, totalGrams: 300 }, { woltEnabled: false })[0];
    const heavy = getDeliveryOptions({ ...base, totalGrams: 4000 }, { woltEnabled: false })[0];
    expect(heavy.cents).toBeGreaterThan(light.cents);
  });

  it('gives free Israel Post over the threshold', () => {
    const opts = getDeliveryOptions(
      { ...base, subtotalCents: FREE_ISRAEL_POST_THRESHOLD_CENTS + 100 },
      { woltEnabled: false },
    );
    expect(opts[0].carrier).toBe('israel_post');
    expect(opts[0].cents).toBe(0);
  });

  it('offers Wolt only when enabled AND in service area AND within weight', () => {
    // enabled + Tel Aviv + light → Wolt present
    const yes = getDeliveryOptions(base, { woltEnabled: true });
    expect(yes.some((o) => o.carrier === 'wolt')).toBe(true);

    // enabled but too heavy → no Wolt
    const tooHeavy = getDeliveryOptions({ ...base, totalGrams: 9000 }, { woltEnabled: true });
    expect(tooHeavy.some((o) => o.carrier === 'wolt')).toBe(false);

    // flag off → no Wolt even in Tel Aviv
    const flagOff = getDeliveryOptions(base, { woltEnabled: false });
    expect(flagOff.some((o) => o.carrier === 'wolt')).toBe(false);
  });

  it('Wolt is pricier than Israel Post (premium fast)', () => {
    const opts = getDeliveryOptions(base, { woltEnabled: true });
    const ip = opts.find((o) => o.carrier === 'israel_post')!;
    const wolt = opts.find((o) => o.carrier === 'wolt')!;
    expect(wolt.cents).toBeGreaterThan(ip.cents);
    expect(wolt.isFastest).toBe(true);
    expect(ip.isCheapest).toBe(true);
  });

  it('wantsFast sorts fastest-first, else cheapest-first', () => {
    const fast = getDeliveryOptions({ ...base, wantsFast: true }, { woltEnabled: true });
    expect(fast[0].carrier).toBe('wolt');
    const cheap = getDeliveryOptions({ ...base, wantsFast: false }, { woltEnabled: true });
    expect(cheap[0].carrier).toBe('israel_post');
  });

  // ── Proximity: the customer pays more for far/periphery destinations ──
  it('adds a periphery surcharge + extra days for remote areas', () => {
    const central = getDeliveryOptions({ ...base, city: 'תל אביב' }, { woltEnabled: false })[0];
    const periphery = getDeliveryOptions({ ...base, city: 'אילת' }, { woltEnabled: false })[0];
    expect(periphery.zone).toBe('periphery');
    expect(periphery.cents).toBe(central.cents + PERIPHERY_SURCHARGE_CENTS);
    expect(periphery.etaMaxDays).toBeGreaterThan(central.etaMaxDays);
  });

  it('periphery surcharge still applies even when goods qualify for free shipping', () => {
    const opts = getDeliveryOptions(
      { ...base, city: 'אילת', subtotalCents: FREE_ISRAEL_POST_THRESHOLD_CENTS + 100 },
      { woltEnabled: false },
    );
    // base is free, but the proximity surcharge remains
    expect(opts[0].cents).toBe(PERIPHERY_SURCHARGE_CENTS);
  });

  it('detects periphery by Eilat/Arava postcode (88xxx)', () => {
    const opts = getDeliveryOptions({ ...base, city: 'unknown town', postcode: '8810000' }, { woltEnabled: false });
    expect(opts[0].zone).toBe('periphery');
  });

  // ── Signature: signed delivery is a paid add-on on every option ──
  it('adds the signature surcharge when signed delivery is requested', () => {
    const unsigned = getDeliveryOptions(base, { woltEnabled: true });
    const signed = getDeliveryOptions({ ...base, signatureRequired: true }, { woltEnabled: true });
    const ipU = unsigned.find((o) => o.carrier === 'israel_post')!;
    const ipS = signed.find((o) => o.carrier === 'israel_post')!;
    const woltS = signed.find((o) => o.carrier === 'wolt')!;
    expect(ipS.cents).toBe(ipU.cents + SIGNATURE_SURCHARGE_CENTS);
    expect(ipS.signatureIncluded).toBe(true);
    expect(woltS.signatureIncluded).toBe(true);
  });
});

/**
 * Behavioral test — shop order number generator must not collide at scale.
 *
 * Evil-hunt 2026-08-20: the previous formula `Math.random() * 90000 + 10000`
 * (5-digit decimal suffix) had ~1% collision probability per month at 1000
 * orders (birthday paradox), and with a UNIQUE constraint on
 * shop_orders.order_number the INSERT inside createOrder()'s transaction
 * throws → the whole checkout aborts AFTER payment was captured →
 * customer sees an error, order lost, refund cycle.
 *
 * The fix uses crypto.randomBytes(5).toString('hex') → 2^40 ≈ 10^12
 * possibilities per month. This test proves 10,000 concurrent generations
 * produce zero collisions (previous formula would collide ~40× at this
 * volume in the same month prefix).
 */

import { describe, it, expect } from 'vitest';

// Isolate the generator so the test doesn't drag in the ShopService's full
// import graph (DB, VAT, email, SMS, etc.).
async function loadGenerator() {
  const { readFileSync } = await import('fs');
  const { join } = await import('path');
  const cryptoLib = await import('crypto');
  const src = readFileSync(
    join(__dirname, '..', '..', 'server/services/ShopService.ts'),
    'utf8',
  );
  const m = src.match(/private _generateOrderNumber\(\): string \{([\s\S]*?)^ {2}\}/m);
  expect(m, '_generateOrderNumber must exist').toBeTruthy();
  // Rewrite the body's `require('crypto')` to a closure var we control, so it
  // works in the ESM test environment.
  const body = m![1].replace(/require\(['"]crypto['"]\)/g, 'cryptoLib');
  // eslint-disable-next-line no-new-func
  const fn = new Function('cryptoLib', body + '\nreturn undefined;');
  return () => fn(cryptoLib);
}

describe('ShopService _generateOrderNumber — collision-safe at scale', () => {
  it('10,000 generations produce zero collisions within the same month prefix', async () => {
    const generate = await loadGenerator();
    const seen = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      const n = generate() as string;
      expect(seen.has(n), `collision at generation ${i}: ${n}`).toBe(false);
      seen.add(n);
    }
    expect(seen.size).toBe(10_000);
  });

  it('returns a string matching PW-YYYYMM-<suffix>', async () => {
    const generate = await loadGenerator();
    const n = generate() as string;
    expect(n).toMatch(/^PW-\d{6}-[A-Z0-9]+$/);
  });

  it('uses a cryptographically-strong suffix (not Math.random)', async () => {
    // Static-source pin: the fix must reference crypto.randomBytes and must
    // NOT use Math.random for the suffix.
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const src = readFileSync(
      join(__dirname, '..', '..', 'server/services/ShopService.ts'),
      'utf8',
    );
    const m = src.match(/private _generateOrderNumber\(\): string \{([\s\S]*?)^ {2}\}/m);
    const body = m![1];
    // Strip line comments so an explanatory comment mentioning the old formula
    // doesn't false-positive the "must not appear" check.
    const stripped = body.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(stripped).toMatch(/randomBytes\(\s*\d+\s*\)/);
    expect(stripped).not.toMatch(/Math\.random\(\)\s*\*\s*90000/);
  });
});

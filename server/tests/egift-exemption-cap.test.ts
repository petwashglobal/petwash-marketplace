/**
 * E-gift voucher value must never exceed the Payment Services closed-loop
 * exemption cap (₪1,500). Above it, PetWash would need a payment LICENCE.
 * The /api/multi-service-gift endpoint previously allowed up to ₪10,000 (guest
 * checkout) — a real exemption breach. This guards server + client + the
 * single-source cap constant.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { EGIFT_EXEMPTION_CAP_ILS, EGIFT_ALLOWED_DENOMINATIONS } from '../lib/egift-denominations';

const routes = fs.readFileSync(path.resolve(__dirname, '..', 'routes.ts'), 'utf8');
const egiftPage = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'EGift.tsx'),
  'utf8',
);

describe('e-gift exemption cap (₪1,500)', () => {
  it('the cap constant is ₪1,500 and every denomination stays under it', () => {
    expect(EGIFT_EXEMPTION_CAP_ILS).toBe(1500);
    for (const d of EGIFT_ALLOWED_DENOMINATIONS) {
      expect(d).toBeLessThanOrEqual(EGIFT_EXEMPTION_CAP_ILS);
    }
  });

  it('the multi-service-gift endpoint caps value at the exemption (NOT 10000)', () => {
    expect(routes).toMatch(/value: z\.number\(\)\.min\(1\)\.max\(EGIFT_EXEMPTION_CAP_ILS\)/);
    expect(routes).not.toMatch(/value: z\.number\(\)\.min\(1\)\.max\(10000\)/);
  });

  it('the client custom amount is capped at ₪1,500, no ₪5,000 left', () => {
    expect(egiftPage).toMatch(/parsed >= 50 && parsed <= 1500/);
    expect(egiftPage).not.toMatch(/parsed <= 5000/);
    expect(egiftPage).not.toMatch(/> 5000/);
    expect(egiftPage).not.toMatch(/₪50-₪5,000/);
  });
});

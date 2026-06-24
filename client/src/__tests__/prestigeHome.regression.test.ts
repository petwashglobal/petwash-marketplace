/**
 * PrestigeHome — luxury customer home, built to the CEO's 2026-06-24 design.
 * Source-introspection guards (the screen is data/auth-runtime-bound) lock in the
 * brand + scope corrections so they can't silently regress.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = path.resolve(__dirname, '..');
const home = fs.readFileSync(path.join(ROOT, 'pages', 'PrestigeHome.tsx'), 'utf8');

describe('PrestigeHome (customer luxury home)', () => {
  it('uses ₪ (Israel), never a $ currency symbol', () => {
    expect(home).toMatch(/₪/);
    expect(home).not.toMatch(/\$\{?\d|\$\d|`\$\$/); // no literal $-currency
    expect(home).not.toMatch(/\$120|\$75|\$\s?\d/);
  });

  it('uses the real PetWash logo asset top-center (never a recreated mark)', () => {
    expect(home).toMatch(/\/brand\/petwash-logo-official\.png/);
    expect(home).toMatch(/PRESTIGE/);
  });

  it('uses bright metallic gold #D4AF37 as the accent', () => {
    expect(home).toMatch(/#D4AF37/);
  });

  it('the center QR / Card button opens the redeem flow (wash is redeem, not bookable)', () => {
    expect(home).toMatch(/navigate\('\/prestige-pass'\)/);
    expect(home).toMatch(/QR \/ Card/);
  });

  it('PetTrek is present but coming-soon / disabled', () => {
    expect(home).toMatch(/PetTrek/);
    expect(home).toMatch(/soon: true/);
  });

  it('reads live data endpoints (no hard-coded fake balances)', () => {
    expect(home).toMatch(/\/api\/prestige-pass\/me/);
    expect(home).toMatch(/\/api\/prestige-pass\/summary/);
    expect(home).toMatch(/\/api\/prestige-pass\/token\/generate/);
    expect(home).toMatch(/\/api\/pets/);
  });
});

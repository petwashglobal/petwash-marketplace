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
    // The inline <img src="/brand/petwash-logo-official.png"> was replaced
    // by the shared <PetWashLogo> component, which renders the SAME real
    // asset (see client/src/components/brand/PetWashLogo.tsx). The
    // never-recreate-the-mark invariant is preserved via that component.
    expect(home).toMatch(/PetWashLogo/);
    expect(home).toMatch(/PRESTIGE/);
  });

  it('uses bright metallic gold #D4AF37 as the accent', () => {
    expect(home).toMatch(/#D4AF37/);
  });

  it('wash is redeem-by-QR (not bookable): live QR on the card + Book Wash -> stations', () => {
    // UX refactor: the old center "QR / Card" button that navigated to
    // /prestige-pass was replaced by rendering the live, short-lived QR
    // token directly on the membership card ("Show at the bay to redeem").
    // The load-bearing invariant is unchanged — wash is redeemed by QR at
    // the bay, and "Book Wash" points at the stations/redeem flow, NOT a
    // booking engine.
    expect(home).toMatch(/QRCodeSVG\s+value=\{qrToken\}/);
    expect(home).toMatch(/\/api\/prestige-pass\/token\/generate/);
    // "Book Wash" routes to /stations (redeem), never a booking engine.
    expect(home).toMatch(/label:\s*'Book Wash'[\s\S]{0,120}to:\s*'\/stations'/);
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

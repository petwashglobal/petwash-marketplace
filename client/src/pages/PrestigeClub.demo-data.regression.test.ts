/**
 * PR-PRESTIGE-CLUB-DEMO-DATA-KILL — regression pin for the removal of
 * fake demo data on the public /prestige-club marketing page.
 *
 * Before: the metal member card hard-coded a real person's name
 * ("ניר הדד" / "Nir Hadad") with tier "Active member · Gold", balance
 * ₪2,450, 34 washes; the progress panel had a fake ledger (+₪200, -₪55,
 * +₪150). Live on the public route with no "Sample" label.
 *
 * This pin locks the neutral illustrative values in place so a future
 * copy-paste doesn't reintroduce the real name or invented ledger.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, 'PrestigeClub.tsx'),
  'utf8',
);

describe('PrestigeClub — demo data killed', () => {
  it('does not hardcode the founder name (HE)', () => {
    expect(SRC).not.toContain('metal_name: "ניר הדד"');
    expect(SRC).not.toContain('metal_name: \'ניר הדד\'');
  });

  it('does not hardcode the founder name (EN)', () => {
    expect(SRC).not.toContain('metal_name: "Nir Hadad"');
    expect(SRC).not.toContain('metal_name: \'Nir Hadad\'');
  });

  it('sample metal-card block carries a testid so QA can spot it', () => {
    expect(SRC).toContain('data-testid="prestige-club-sample-metal"');
  });

  it('sample progress block carries a testid', () => {
    expect(SRC).toContain('data-testid="prestige-club-sample-progress"');
  });

  it('does not render the invented balance ₪ 2,450', () => {
    expect(SRC).not.toMatch(/₪\s*2[,\s]450/);
  });

  it('does not render the invented ledger amounts (+₪200, -₪55, +₪150) as literals', () => {
    expect(SRC).not.toMatch(/\+\s*₪\s*200(?!,)/);
    expect(SRC).not.toMatch(/-\s*₪\s*55(?!\d)/);
    expect(SRC).not.toMatch(/\+\s*₪\s*150(?!,)/);
  });

  it('does not render "Active member · Gold tier" as literal marketing copy', () => {
    expect(SRC).not.toMatch(/Active member\s*·\s*Gold tier/);
    expect(SRC).not.toMatch(/חבר פעיל\s*·\s*דרגת Gold/);
  });
});

/**
 * The welcome popup must be a clean editorial splash, not the glossy Smart-Hub
 * PNG (which baked a tinted background + dated bevelled icons — off-brand on the
 * pure-white luxury shell). Guards the maison-grade direction.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const src = fs.readFileSync(
  path.resolve(__dirname, '..', 'components', 'PromoAdPopup.tsx'),
  'utf8',
);

describe('promo popup — editorial, no glossy PNG', () => {
  it('no longer references the baked Smart-Hub poster image', () => {
    expect(src).not.toMatch(/petwash-smart-hub-2026/i);
  });

  it('renders a typographic maison splash (serif wordmark + restrained gold)', () => {
    expect(src).toMatch(/Playfair Display/);
    expect(src).toMatch(/Maison/);
  });

  it('keeps a pure-white shell', () => {
    expect(src).toMatch(/bg-white/);
  });
});

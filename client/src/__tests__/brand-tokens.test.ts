/**
 * Brand design tokens — the single source of truth for the PetWash look:
 * pure white · black text · bright metallic gold. This guard prevents the
 * rejected palette (cream/ivory/off-white, brown, muted/antique gold) from
 * ever creeping back into the token file, and confirms it's wired globally.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = path.resolve(__dirname, '..');
const tokens = fs.readFileSync(path.join(ROOT, 'styles', 'petwash-brand-tokens.css'), 'utf8');
const indexCss = fs.readFileSync(path.join(ROOT, 'index.css'), 'utf8');

describe('PetWash brand tokens', () => {
  it('ground is pure white, ink is black, gold is the bright metallic reference', () => {
    expect(tokens).toMatch(/--pw-white:\s*#FFFFFF/i);
    expect(tokens).toMatch(/--pw-ink:\s*#111111/i);
    expect(tokens).toMatch(/--pw-gold:\s*#D4AF37/i);
  });

  it('does NOT contain the rejected cream / antique-brown-gold values', () => {
    // the cream/ivory and the muted olive-gold the CEO rejected
    expect(tokens).not.toMatch(/#F7F4EE/i); // cream/ivory ground
    expect(tokens).not.toMatch(/#735511/i); // muted antique/olive gold
    expect(tokens).not.toMatch(/#c9a96e/i); // washed gold
  });

  it('is imported globally in index.css', () => {
    expect(indexCss).toMatch(/petwash-brand-tokens\.css/);
  });
});

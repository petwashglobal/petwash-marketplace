/**
 * Brand design tokens — the single source of truth for the PetWash look:
 * pure white · black text · METALLIC GOLD accent. Base gold #D4AF37, primary tone
 * warmed to #D9B84C toward Cartier yellow-gold (CEO 2026-06-22). This guard keeps
 * the rejected palettes (cream/ivory, and the dead emerald #12936A) from creeping
 * back, and confirms the tokens are wired globally.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = path.resolve(__dirname, '..');
const tokens = fs.readFileSync(path.join(ROOT, 'styles', 'petwash-brand-tokens.css'), 'utf8');
const indexCss = fs.readFileSync(path.join(ROOT, 'index.css'), 'utf8');

describe('PetWash brand tokens', () => {
  it('ground is pure white, ink is black, accent is the warm Cartier-leaning gold', () => {
    expect(tokens).toMatch(/--pw-white:\s*#FFFFFF/i);
    expect(tokens).toMatch(/--pw-ink:\s*#111111/i);
    expect(tokens).toMatch(/--pw-gold:\s*#D9B84C/i); // warm Cartier-leaning gold
  });

  it('keeps the base gold and the metallic sheen gradient (deep / base / light)', () => {
    expect(tokens).toMatch(/--pw-gold-base:\s*#D4AF37/i); // original base gold, retained
    expect(tokens).toMatch(/--pw-gold-deep:\s*#B8860B/i);
    expect(tokens).toMatch(/--pw-gold-light:\s*#F4D77A/i);
    expect(tokens).toMatch(/--pw-gold-grad:\s*linear-gradient/i); // sheen, not flat
    expect(tokens).toMatch(/--pw-gold-ink:\s*#1A1A1A/i); // near-black text on a gold fill
  });

  it('does NOT contain the dead emerald or the rejected cream / antique values', () => {
    expect(tokens).not.toMatch(/#12936A/i); // emerald — removed for good
    expect(tokens).not.toMatch(/#0C5B3F/i); // emerald deep — removed
    expect(tokens).not.toMatch(/#36C98F/i); // emerald light — removed
    expect(tokens).not.toMatch(/#F7F4EE/i); // cream/ivory ground — never
    expect(tokens).not.toMatch(/#735511/i); // muted antique/olive gold — never
  });

  it('is imported globally in index.css', () => {
    expect(indexCss).toMatch(/petwash-brand-tokens\.css/);
  });
});

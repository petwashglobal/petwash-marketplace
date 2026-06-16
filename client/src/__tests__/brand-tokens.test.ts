/**
 * Brand design tokens — the single source of truth for the PetWash look:
 * pure white · black text · HOT METALLIC EMERALD GREEN accents. Gold was removed
 * 2026-06-16 (read too cheap/yellow). This guard prevents the rejected palettes
 * (cream/ivory, and ANY gold) from creeping back, and confirms it's wired globally.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = path.resolve(__dirname, '..');
const tokens = fs.readFileSync(path.join(ROOT, 'styles', 'petwash-brand-tokens.css'), 'utf8');
const indexCss = fs.readFileSync(path.join(ROOT, 'index.css'), 'utf8');

describe('PetWash brand tokens', () => {
  it('ground is pure white, ink is black, accent is the emerald reference', () => {
    expect(tokens).toMatch(/--pw-white:\s*#FFFFFF/i);
    expect(tokens).toMatch(/--pw-ink:\s*#111111/i);
    expect(tokens).toMatch(/--pw-gold:\s*#12936A/i); // legacy var name, emerald value
  });

  it('uses the emerald gradient (deep / light) and white text on the fill', () => {
    expect(tokens).toMatch(/--pw-gold-deep:\s*#0C5B3F/i);
    expect(tokens).toMatch(/--pw-gold-light:\s*#36C98F/i);
    expect(tokens).toMatch(/--pw-gold-ink:\s*#FFFFFF/i); // white text on a green fill
  });

  it('does NOT contain gold or the rejected cream / antique-gold values', () => {
    expect(tokens).not.toMatch(/#D4AF37/i); // bright gold — removed
    expect(tokens).not.toMatch(/#B8860B/i); // deep gold — removed
    expect(tokens).not.toMatch(/#F2D778/i); // gold sheen — removed
    expect(tokens).not.toMatch(/#F7F4EE/i); // cream/ivory ground
    expect(tokens).not.toMatch(/#735511/i); // muted antique/olive gold
  });

  it('is imported globally in index.css', () => {
    expect(indexCss).toMatch(/petwash-brand-tokens\.css/);
  });
});

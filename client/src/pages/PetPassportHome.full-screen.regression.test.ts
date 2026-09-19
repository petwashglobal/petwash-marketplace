/**
 * PetPassportHome — full-screen on every device (CEO 2026-09-18).
 *
 * The screen used to be a fixed 440px phone column on every device: on an iPad
 * or a desktop it was a narrow strip. Phones keep the mockup's single column
 * and bottom nav; from `md` up it is a two-column layout with the nav in the
 * header. This pins the layout contract so a refactor cannot quietly put the
 * strip back — and pins two luxury-surface rules the repaint enforced.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = readFileSync(join(__dirname, 'PetPassportHome.tsx'), 'utf8');

describe('PetPassportHome.tsx — fills tablets and desktops, stays the mockup on phones', () => {
  it('the container widens from md up (phone column stays 440px)', () => {
    expect(SRC).toMatch(/max-w-\[440px\][^"]*md:max-w-\[1120px\]/);
  });

  it('from md the body is a two-column grid: hero + records left, pets + quick actions right', () => {
    expect(SRC).toMatch(/md:grid md:grid-cols-\[minmax\(0,1\.15fr\)_minmax\(0,1fr\)\]/);
    expect(SRC).toContain('{/* /left column */}');
    expect(SRC).toContain('{/* /right column */}');
  });

  it('the phone bottom nav is hidden from md and the same five items render in the header', () => {
    expect(SRC).toMatch(/fixed inset-x-0 bottom-0[^"]*md:hidden/);
    expect(SRC).toMatch(/<nav[^>]*className="hidden md:flex/);
    expect(SRC).toMatch(/function useNavItems\(/);
    // exactly five destinations, and both navs consume the same list
    expect((SRC.match(/\{ key: '(home|pets|health|docs|alerts)'/g) ?? []).length).toBe(5);
    expect((SRC.match(/navItems\.map\(/g) ?? []).length).toBe(2);
  });

  it('the hero photo, name and card scale up from md', () => {
    expect(SRC).toMatch(/md:!h-\[140px\] md:!w-\[140px\]/);
    expect(SRC).toMatch(/text-\[30px\][^"]*md:text-\[42px\]/);
    expect(SRC).toMatch(/md:rounded-\[28px\] md:p-8/);
  });

  it('uses 100dvh, not 100vh (iOS Safari toolbar)', () => {
    expect(SRC).toContain('min-h-[100dvh]');
    expect(SRC).not.toContain('min-h-screen');
  });

  it('no emoji stands in for a pet photo — the fallback is the paw icon from the passport icon set', () => {
    expect(SRC).not.toMatch(/SPECIES_EMOJI/);
    expect(SRC).not.toMatch(/[\u{1F400}-\u{1F4FF}\u{1F980}-\u{1F9FF}]/u);
    expect(SRC).toMatch(/<PawPrint style=\{\{ color: GREEN/);
  });

  it('the Home nav item goes to the canonical Pet Parent home, not the deprecated /prestige/home alias', () => {
    expect(SRC).toMatch(/onClick:\s*\(\) => navigate\('\/pet-parent\/home'\)/);
    expect(SRC).not.toMatch(/navigate\('\/prestige\/home'\)/);
  });

  it('the green-marble tokens are untouched', () => {
    expect(SRC).toContain("const GREEN = '#063B22'");
    expect(SRC).toContain("const GOLD = '#D6B56D'");
    expect(SRC).toContain('#FAFAF7');
    expect(SRC).toContain('#ECE6D8');
    expect(SRC).toContain('#121212');
  });
});

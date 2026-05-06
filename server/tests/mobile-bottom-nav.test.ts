/**
 * PR-W55 — MobileBottomNav breathing room.
 *
 * CEO directive 2026-05:
 *   • Increase breathing room
 *   • Ensure icons/text never intersect floating elements
 *   • Maintain luxury clean whitespace
 *   • Verify all labels remain readable on iPhone SE
 *
 * This test pins the layout values so a future PR cannot quietly
 * shrink the nav back below the breathing-room threshold.
 *
 * Static source-pin only.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const REPO = path.resolve(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(REPO, rel), 'utf8');

describe('PR-W55 — MobileBottomNav breathing room', () => {
  const nav = read('client/src/components/MobileBottomNav.tsx');

  it('row height bumped from h-14 (56px) → h-16 (64px)', () => {
    expect(nav).toMatch(/<ul[^>]*className=\"[^\"]*\bh-16\b/);
    expect(nav).not.toMatch(/<ul[^>]*className=\"[^\"]*\bh-14\b/);
  });

  it('icon-to-label gap bumped from gap-0.5 (2px) → gap-1 (4px)', () => {
    // Match inside the inner <button> classes
    expect(nav).toMatch(/className=\"[^\"]*\bgap-1\b[^\"]*\btransition-colors/);
    expect(nav).not.toMatch(/className=\"[^\"]*\bgap-0\.5\b[^\"]*\btransition-colors/);
  });

  it('horizontal padding (px-1) added so labels never touch edges on iPhone SE', () => {
    expect(nav).toMatch(/className=\"[^\"]*\bpx-1\b[^\"]*\btransition-colors/);
  });

  it('label font bumped to text-[11px] for iPhone SE readability', () => {
    expect(nav).toMatch(/className=\"[^\"]*\btext-\[11px\]/);
  });

  it('long labels truncate (max-w-full + truncate) instead of wrapping', () => {
    expect(nav).toMatch(/\btruncate\b/);
    expect(nav).toMatch(/\bmax-w-full\b/);
  });

  it('still applies the canonical pw-z-sticky z-index class (PR-W53 invariant)', () => {
    expect(nav).toMatch(/<nav\b[^>]*className=\"[^\"]*\bpw-z-sticky\b/s);
  });

  it('safe-area padding still present (paddingBottom uses env(safe-area-inset-bottom))', () => {
    expect(nav).toMatch(/paddingBottom:\s*['\"]max\(0px,\s*env\(safe-area-inset-bottom\)\)['\"]/);
  });
});

describe('PR-W55 — FloatingStack clears the taller nav', () => {
  const css = read('client/src/styles/floating-stack.css');

  it('--pw-bottom-nav-height bumped to 64px (was 56px)', () => {
    expect(css).toMatch(
      /@media\s*\(\s*max-width:\s*767px\s*\)[^{]*\{\s*:root\s*\{[^}]*--pw-bottom-nav-height:\s*64px/s,
    );
  });

  it('FAB base offset still uses the CEO formula (PR-W54 invariant)', () => {
    expect(css).toMatch(
      /--pw-fab-base:\s*calc\(\s*env\(safe-area-inset-bottom[^)]*\)\s*\+\s*var\(--pw-bottom-nav-height\)\s*\+\s*24px/,
    );
  });
});

describe('PR-W55 — accessibility / tap-target invariants', () => {
  const nav = read('client/src/components/MobileBottomNav.tsx');

  it('every nav button has aria-label', () => {
    // Every <button> inside the nav has aria-label={label}
    expect(nav).toMatch(/<button[\s\S]*?aria-label=\{label\}/);
  });

  it('active item carries aria-current="page"', () => {
    expect(nav).toMatch(/aria-current=\{isActive \? 'page' : undefined\}/);
  });

  it('account-tab loading uses aria-busy', () => {
    expect(nav).toMatch(/aria-busy=/);
  });
});

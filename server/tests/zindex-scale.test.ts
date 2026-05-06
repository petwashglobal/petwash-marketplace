/**
 * PR-W53 — pin the canonical z-index scale.
 *
 * Single source of truth for stacking order. New surfaces MUST pick
 * from this scale; ad-hoc values like z-[9050] are deprecated.
 *
 * This test pins:
 *   1. The 7 CSS variables exist on :root with the CEO-mandated values.
 *   2. The 7 .pw-z-* utility classes exist and reference the variables.
 *   3. floating-stack.css uses var(--pw-z-floating), not a magic number.
 *   4. MobileBottomNav uses .pw-z-sticky, not a magic number.
 *
 * Static source-pin only.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const REPO = path.resolve(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(REPO, rel), 'utf8');

describe('PR-W53 — z-index canonical scale', () => {
  const css = read('client/src/index.css');

  describe('CSS variables on :root', () => {
    const expected: Array<[string, number]> = [
      ['--pw-z-content', 1],
      ['--pw-z-sticky', 100],
      ['--pw-z-floating', 200],
      ['--pw-z-popover', 300],
      ['--pw-z-modal-overlay', 500],
      ['--pw-z-toast', 700],
      ['--pw-z-critical', 900],
    ];

    for (const [varName, value] of expected) {
      it(`${varName} = ${value}`, () => {
        const re = new RegExp(`${varName.replace(/-/g, '\\-')}:\\s*${value}\\b`);
        expect(css).toMatch(re);
      });
    }
  });

  describe('utility classes', () => {
    const expected: Array<[string, string]> = [
      ['.pw-z-content', '--pw-z-content'],
      ['.pw-z-sticky', '--pw-z-sticky'],
      ['.pw-z-floating', '--pw-z-floating'],
      ['.pw-z-popover', '--pw-z-popover'],
      ['.pw-z-modal-overlay', '--pw-z-modal-overlay'],
      ['.pw-z-toast', '--pw-z-toast'],
      ['.pw-z-critical', '--pw-z-critical'],
    ];

    for (const [cls, varRef] of expected) {
      it(`${cls} → var(${varRef})`, () => {
        const escapedCls = cls.replace(/[-./]/g, '\\$&');
        const re = new RegExp(`${escapedCls}\\s*\\{[^}]*z-index:\\s*var\\(${varRef.replace(/-/g, '\\-')}\\)`);
        expect(css).toMatch(re);
      });
    }
  });

  describe('floating-stack uses the canonical variable', () => {
    const fs1 = read('client/src/styles/floating-stack.css');

    it('.pw-float-stack uses var(--pw-z-floating)', () => {
      expect(fs1).toMatch(/\.pw-float-stack\s*\{[^}]*z-index:\s*var\(--pw-z-floating\)/);
    });

    it('.pw-float uses var(--pw-z-floating)', () => {
      expect(fs1).toMatch(/\.pw-float\s*\{[^}]*z-index:\s*var\(--pw-z-floating\)/);
    });

    it('does NOT contain the old magic 9050 value', () => {
      expect(fs1).not.toMatch(/z-index:\s*9050/);
    });
  });

  describe('MobileBottomNav uses the canonical class', () => {
    const nav = read('client/src/components/MobileBottomNav.tsx');

    it('uses pw-z-sticky utility class on the <nav> root', () => {
      expect(nav).toMatch(/<nav\b[^>]*className=\"[^\"]*pw-z-sticky/s);
    });

    it('does NOT use the old z-40 magic class on the <nav> root', () => {
      expect(nav).not.toMatch(/<nav\b[^>]*className=\"[^\"]*\bz-40\b/s);
    });
  });

  describe('layer ordering invariant (sticky < floating < modal-overlay < toast < critical)', () => {
    // Extract the values from the css and assert the strict order.
    function extract(varName: string): number {
      const re = new RegExp(`${varName}:\\s*(\\d+)`);
      const m = css.match(re);
      if (!m) throw new Error(`${varName} not found`);
      return parseInt(m[1], 10);
    }
    it('content < sticky < floating < popover < modal-overlay < toast < critical', () => {
      const vals = [
        extract('--pw-z-content'),
        extract('--pw-z-sticky'),
        extract('--pw-z-floating'),
        extract('--pw-z-popover'),
        extract('--pw-z-modal-overlay'),
        extract('--pw-z-toast'),
        extract('--pw-z-critical'),
      ];
      for (let i = 1; i < vals.length; i++) {
        expect(vals[i], `layer ${i} must be > layer ${i - 1}`).toBeGreaterThan(vals[i - 1]);
      }
    });
  });
});

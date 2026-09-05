/**
 * ProviderPending — WCAG contrast regression pin.
 *
 * Two blanket sweeps silently destroyed the readability of the provider
 * "application received" screen, and neither was caught because nothing
 * measured contrast on this page:
 *
 *   1. a84ea1ac6 "enforce pure white backgrounds" replaced the INACTIVE
 *      progress-indicator dots/track `bg-gray-200` (1.24:1 — already a
 *      fail) with `bg-white` — 1.00:1 on the white card. The unfinished
 *      half of the progress bar became literally invisible, so an
 *      applicant could not tell how far along their application was.
 *
 *   2. e7944afdb "brand sweep → gold" turned the "you'll get an email"
 *      panel into `text-[#B8932F]` on `bg-[#D4AF37]` — gold text on a
 *      gold ground, 1.38:1. Unreadable.
 *
 * Thresholds (WCAG 2.1 AA):
 *   • 4.5:1 for body text
 *   • 3:1   for non-text UI components / meaningful graphics (1.4.11)
 *
 * The brand palette is unchanged — white / black / gold (#D4AF37). This
 * pin only forbids the specific sub-threshold combinations.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'pages', 'ProviderPending.tsx'),
  'utf8',
);

// ── contrast maths (WCAG 2.1 relative luminance) ────────────────────────────
function luminance(hex: string): number {
  const c = hex.replace('#', '');
  const full = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(full.substr(i, 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Only the tokens this page actually uses. */
const TW: Record<string, string> = {
  white: '#ffffff',
  black: '#000000',
  'gray-200': '#e5e7eb',
  'gray-400': '#9ca3af',
  'gray-500': '#6b7280',
  'gray-600': '#4b5563',
  'gray-900': '#111827',
  'amber-50': '#fffbeb',
  'amber-500': '#f59e0b',
  'amber-600': '#d97706',
  'amber-700': '#b45309',
  'amber-800': '#92400e',
  'green-50': '#f0fdf4',
  'green-100': '#dcfce7',
  'green-500': '#22c55e',
  'green-600': '#16a34a',
  'green-700': '#15803d',
  'green-800': '#166534',
  'red-500': '#ef4444',
  'red-600': '#dc2626',
  '[#D4AF37]': '#D4AF37',
  '[#B8932F]': '#B8932F',
};

const CARD = TW.white; // every surface on this page is a white Card

function px(token: string): string {
  const hex = TW[token];
  if (!hex) throw new Error(`test palette is missing the token "${token}"`);
  return hex;
}

describe('ProviderPending — WCAG AA contrast', () => {
  // ── 1. the progress indicator ─────────────────────────────────────────────
  it('the INACTIVE progress dot is not invisible on the white card', () => {
    // Regression: `bg-white` (1.00:1) and `bg-gray-200` (1.24:1) both leave
    // the "not reached yet" half of the tracker undetectable.
    const dots = [...SRC.matchAll(/w-3 h-3 rounded-full \$\{[^}]*?:\s*"([^"]+)"\}/g)]
      .map((m) => m[1]);
    expect(dots.length, 'expected to find the two progress-dot class expressions').toBe(2);

    for (const cls of dots) {
      // The inactive dot must carry a >=3:1 boundary (border) or fill.
      const fill = /bg-([a-z0-9-]+|\[#[0-9a-fA-F]+\])/.exec(cls)?.[1];
      const border = /border-((?:gray|amber|green|red)-\d{3})/.exec(cls)?.[1];
      const best = Math.max(
        fill ? ratio(px(fill), CARD) : 0,
        border ? ratio(px(border), CARD) : 0,
      );
      expect(
        Number(best.toFixed(2)),
        `inactive progress dot "${cls}" is ${best.toFixed(2)}:1 on white — WCAG 1.4.11 needs >= 3:1`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it('the INACTIVE progress connector line is not invisible on the white card', () => {
    const line = /w-8 h-0\.5 \$\{[^}]*?:\s*"bg-([a-z0-9-]+)"\}/.exec(SRC)?.[1];
    expect(line, 'expected to find the progress connector class').toBeTruthy();
    expect(
      Number(ratio(px(line!), CARD).toFixed(2)),
      `inactive connector bg-${line} is below 3:1 on white`,
    ).toBeGreaterThanOrEqual(3);
  });

  it('the ACTIVE progress dot/connector clears 3:1 on the white card', () => {
    // Brand gold #D4AF37 is 2.10:1 on white and amber-500 is 2.15:1 — both
    // fail as a standalone indicator, so the active state uses a darker gold.
    const actives = [...SRC.matchAll(/rounded-full \$\{[^}]*?\?\s*"bg-([a-z0-9-]+)"/g)].map((m) => m[1]);
    const activeLine = /w-8 h-0\.5 \$\{[^}]*?\?\s*"bg-([a-z0-9-]+)"/.exec(SRC)?.[1];
    for (const token of [...actives, activeLine].filter(Boolean) as string[]) {
      expect(
        Number(ratio(px(token), CARD).toFixed(2)),
        `active progress token bg-${token} is below 3:1 on white`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it('the progress step LABEL clears 4.5:1 in both states', () => {
    const labels = /text-xs \$\{active \? "text-([a-z0-9-]+) font-medium" : "text-([a-z0-9-]+)"\}/.exec(SRC);
    expect(labels, 'expected to find the progress step label classes').toBeTruthy();
    for (const token of [labels![1], labels![2]]) {
      expect(
        Number(ratio(px(token), CARD).toFixed(2)),
        `progress label text-${token} is below 4.5:1 on white`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  // ── 2. the gold notification panel ────────────────────────────────────────
  it('nothing is gold-on-gold: no #B8932F text/icon on the #D4AF37 panel', () => {
    expect(
      Number(ratio(px('[#B8932F]'), px('[#D4AF37]')).toFixed(2)),
      'sanity: #B8932F on #D4AF37 really is ~1.38:1',
    ).toBeLessThan(2);
    expect(
      SRC,
      'gold #B8932F text on the gold #D4AF37 panel is 1.38:1 — unreadable',
    ).not.toMatch(/text-\[#B8932F\]/);
  });

  it('text on the gold #D4AF37 panel clears 4.5:1', () => {
    const panel = /bg-\[#D4AF37\][\s\S]{0,400}?<p className="text-sm text-([a-z0-9-]+|\[#[0-9a-fA-F]{3,8}\])">/.exec(SRC);
    expect(panel, 'expected to find the gold panel body text').toBeTruthy();
    expect(
      Number(ratio(px(panel![1]), px('[#D4AF37]')).toFixed(2)),
      `text-${panel![1]} on the gold panel is below 4.5:1`,
    ).toBeGreaterThanOrEqual(4.5);
  });

  // ── 3. blanket bans for the classes that caused the two regressions ───────
  it('no sub-AA faded grays are used as text on this page', () => {
    // gray-400 = 2.54:1 on white, gray-300 = 1.47:1, gray-200 = 1.24:1.
    expect(SRC).not.toMatch(/text-gray-(200|300|400)\b/);
  });

  it('the primary Upload button clears 4.5:1 for its white label', () => {
    const btn = /"bg-(amber-\d{3}) hover:bg-amber-\d{3} text-white"/.exec(SRC);
    expect(btn, 'expected to find the Upload button classes').toBeTruthy();
    expect(
      Number(ratio(TW.white, px(btn![1])).toFixed(2)),
      `white on bg-${btn![1]} is below 4.5:1`,
    ).toBeGreaterThanOrEqual(4.5);
  });

  // ── 4. the brand is untouched ─────────────────────────────────────────────
  it('still uses the brand gold #D4AF37 — no new brand colours introduced', () => {
    expect(SRC).toMatch(/bg-\[#D4AF37\]/);
    const hexes = new Set([...SRC.matchAll(/#[0-9a-fA-F]{6}/g)].map((m) => m[0].toUpperCase()));
    // Only the two brand golds may appear as raw hex on this page.
    expect([...hexes].sort()).toEqual(['#B8932F', '#D4AF37']);
  });
});

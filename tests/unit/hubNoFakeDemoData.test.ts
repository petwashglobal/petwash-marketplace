/**
 * PR-DANGER-9 regression pins — Hub.tsx ships no rendered fake demo data.
 *
 * The pre-fix state had a `SHOW_DEMO_PANELS = false` flag gating two JSX
 * blocks that displayed hardcoded per-user stats: "3" active bookings,
 * "1,250" loyalty points, "12" services used, "Wash station booking — Tel
 * Aviv Marina", "Gold member", 62.5% progress bar. All strings shipped in
 * the production bundle. One flag flip (or one accidental refactor that
 * mounted the block) would have displayed invented activity to real users.
 *
 * NOTE on test scope: the translation-string constants (e.g. "goldMember"
 * as an i18n key with translations for en/he/ar/ru/fr/es) may still exist
 * in the hubText dictionary at the top of the file — those are inert
 * unless code calls `tx('goldMember', language)`. The dangerous shape
 * is CODE that renders them, not their presence as translation entries.
 * These tests target the code-use side.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const src = fs.readFileSync(path.join(root, 'client/src/pages/Hub.tsx'), 'utf8');

// Strip block + line comments so we can distinguish "the string appears
// as inert content" vs "the code actually uses this identifier".
const codeOnly = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

describe('PR-DANGER-9 — Hub.tsx no longer carries fake demo data', () => {
  it('the SHOW_DEMO_PANELS feature flag identifier is gone from code', () => {
    // Regression: the exact flag identifier from the pre-fix state.
    // Its absence from code is the load-bearing invariant of this PR.
    expect(codeOnly).not.toMatch(/\bSHOW_DEMO_PANELS\b/);
  });

  it('the quickStats array declaration + invented numbers are gone', () => {
    // The exact literal shape that shipped, plus the array itself.
    expect(codeOnly).not.toMatch(/const quickStats = \[/);
    expect(codeOnly).not.toMatch(/labelKey:\s*["']activeBookings["'],\s*value:\s*["']3["']/);
    expect(codeOnly).not.toMatch(/labelKey:\s*["']loyaltyPoints["'],\s*value:\s*["']1,250["']/);
    expect(codeOnly).not.toMatch(/labelKey:\s*["']servicesUsed["'],\s*value:\s*["']12["']/);
  });

  it('the recentActivity array declaration is gone', () => {
    expect(codeOnly).not.toMatch(/const recentActivity = \[/);
    // The array's data-shape keys (titleKey/descKey/timeKey/badgeKey) were
    // only used to render the fixture list. Their absence from code
    // proves the render path is gone.
    expect(codeOnly).not.toMatch(/titleKey:\s*["']washStationBooking["']/);
    expect(codeOnly).not.toMatch(/titleKey:\s*["']walkScheduled["']/);
    expect(codeOnly).not.toMatch(/titleKey:\s*["']loyaltyRewardEarned["']/);
  });

  it('the loyalty-status invented "1,250 points" render is gone', () => {
    // The hardcoded "1,250 {tx('points', …)}" text and the 62.5%
    // progress-bar style attribute that rendered fake progress.
    expect(codeOnly).not.toMatch(/1,250 \{tx\(['"]points['"]/);
    expect(codeOnly).not.toMatch(/width:\s*['"]62\.5%['"]/);
    // The "goldMember" i18n key is not rendered anywhere from code:
    expect(codeOnly).not.toMatch(/tx\(['"]goldMember['"]/);
  });

  it('the orphan lucide icon imports (Activity/Star/Sparkles/Clock) are removed', () => {
    // These icons were only used by the deleted panels. Left imported
    // would ship dead bundle weight AND hint that a future refactor
    // could re-attach them without a review noticing.
    for (const icon of ['Activity', 'Star', 'Sparkles', 'Clock']) {
      // The icon must not appear as an import line (`Activity,` on its
      // own line inside the lucide-react import block).
      expect(codeOnly, `orphan icon '${icon}' still imported`)
        .not.toMatch(new RegExp(`^\\s+${icon},\\s*$`, 'm'));
    }
  });
});

/**
 * WashPackages empty-state guard — regression pin.
 *
 * HISTORY / POLICY REVERSAL (do not "restore" the old behaviour):
 *   The original 2026-07-09 guard hid the section entirely on an empty
 *   API and refused to substitute FALLBACK_PACKAGES for an empty [] —
 *   the stated fear was that the ₪55 fallback single-wash price didn't
 *   match the live Kfar Saba price and would mis-price a purchasable card.
 *
 *   That fear was RESOLVED and the policy DELIBERATELY reversed:
 *     - #1351 (CEO 2026-07-09) corrected the single-wash price to ₪55
 *       (was ₪48) — so the ₪55 fallback is now the CEO-CONFIRMED price,
 *       no longer a mis-price.
 *     - #1367 then decided the section must NEVER vanish on an empty API:
 *       on empty OR error, show FALLBACK_PACKAGES at the confirmed ₪55.
 *       "A visible, correctly-priced section beats a blank one."
 *
 * Current canonical behaviour (this test now pins):
 *   (1) FALLBACK_PACKAGES is shown whenever the API returns no real
 *       packages (empty OR error) — the section never silently vanishes.
 *   (2) The fallback single-wash price stays ₪55 (CEO-confirmed) so a
 *       real, purchasable sale is never mis-priced.
 *   (3) The final render still bails to null if there is genuinely
 *       nothing to display (defensive; fallback is non-empty by design).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'components', 'WashPackages.tsx'),
  'utf8',
);

describe('WashPackages never vanishes on an empty API (#1367)', () => {
  it('defensively bails to null if there is genuinely nothing to display', () => {
    expect(SRC).toMatch(/if \(displayPackages\.length === 0\)\s*\{\s*return null/);
  });

  it('shows FALLBACK_PACKAGES whenever the API returns no real packages (empty OR error)', () => {
    // Policy (#1367): the section must never silently vanish. displayPackages
    // is the real list only when it is non-empty; otherwise FALLBACK_PACKAGES.
    expect(SRC).toMatch(
      /const\s+displayPackages\s*=\s*\(packages\s*&&\s*packages\.length\s*>\s*0\)\s*\?\s*packages\s*:\s*FALLBACK_PACKAGES/,
    );
  });

  it('fallback single-wash price stays ₪55 (CEO-confirmed, #1351) so a real sale is never mis-priced', () => {
    // Guard the money invariant: the purchasable fallback single wash must
    // be priced 55 (the corrected Kfar Saba single-wash price), never a
    // stale value. Anchor on the Single Wash entry.
    const singleIdx = SRC.indexOf("name: 'Single Wash'");
    expect(singleIdx).toBeGreaterThan(0);
    const block = SRC.slice(singleIdx, singleIdx + 220);
    expect(block).toMatch(/price:\s*'55'/);
    expect(block).toMatch(/washCount:\s*1/);
  });
});

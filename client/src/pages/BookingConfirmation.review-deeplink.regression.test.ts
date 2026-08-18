/**
 * PR-REVIEW-DEEPLINK — regression pin for the ?review=1 email deep-link
 * behavior on BookingConfirmation.tsx.
 *
 * Contract locked here:
 *   1. The page reads ?review=1 from window.location.search.
 *   2. It scrolls the end-of-stay banner into view via scrollIntoView.
 *   3. It only scrolls when the booking is in the exact status where the
 *      confirm form is actually rendered (provider_marked_complete) —
 *      otherwise the DOM node isn't mounted and the scroll would no-op
 *      (or worse, scroll past the actionable area).
 *   4. The scroll runs from a requestAnimationFrame so the banner has
 *      painted before we target it.
 *
 * Source-text pins (same discipline as BookingConfirmation.nav.regression
 * and BookingConfirmation.confirm-end.regression). Full DOM behavior would
 * need jsdom + React Testing Library; the pins guarantee the wiring stays
 * in place across refactors.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, 'BookingConfirmation.tsx'),
  'utf8',
);

describe('BookingConfirmation — PR-REVIEW-DEEPLINK pin', () => {
  it('reads ?review=1 from window.location.search', () => {
    expect(SRC).toMatch(/new URLSearchParams\(\s*window\.location\.search\s*\)/);
    expect(SRC).toMatch(/params\.get\(\s*['"]review['"]\s*\)\s*!==\s*['"]1['"]/);
  });

  it('scrolls the end-of-stay-banner into view (targets its data-testid)', () => {
    expect(SRC).toMatch(
      /document\.querySelector\(\s*['"`]\[data-testid="end-of-stay-banner"\]['"`]\s*\)/,
    );
    expect(SRC).toMatch(/scrollIntoView\(\s*\{\s*behavior:\s*['"]smooth['"]/);
  });

  it('only scrolls when the confirm form is actually rendered (status === provider_marked_complete)', () => {
    expect(SRC).toMatch(
      /booking\.status\s*!==\s*['"]provider_marked_complete['"]/,
    );
  });

  it('defers the scroll to the next animation frame so the DOM has painted', () => {
    expect(SRC).toMatch(/requestAnimationFrame\(/);
    expect(SRC).toMatch(/cancelAnimationFrame\(/);
  });

  it('does not run on SSR (guards against typeof window === undefined)', () => {
    expect(SRC).toMatch(/typeof\s+window\s*===\s*['"]undefined['"]/);
  });
});

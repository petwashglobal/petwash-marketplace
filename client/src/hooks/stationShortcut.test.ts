/**
 * The floating "Show Pass — K9000" button must not cover the QR it points at.
 * Regression pin — 2026-09-19.
 *
 * WHAT HAPPENED
 * The CEO's own screenshots of /prestige/pass show a pulsing gold pill,
 * position:fixed at bottom:88px, sitting on top of the page content beneath it
 * — over the "missing ₪39" low-balance row in one shot, over the
 * "Scan to identify — membership card" heading in another.
 *
 * It is worse than a normal floating button: the page ALREADY renders the K9000
 * redemption QR inline (PrestigePassWallet.tsx, "Scan to Redeem — K9000"), and
 * the button opens an overlay showing the same QR again. A floating shortcut to
 * something already on screen is not a shortcut, it is an obstruction.
 *
 * WHY THIS FILE TESTS A FUNCTION AND NOT A SCREEN
 * This repo's vitest runs `environment: 'node'` with no jsdom, no happy-dom and
 * no @testing-library. No UI behaviour in this codebase can be asserted — which
 * is a large part of why layout bugs like this one reach production and are
 * found on a phone instead of in CI. Adding a DOM environment is a dependency
 * decision for the CEO; until then the honest move is to keep the DECISION pure
 * and test that exhaustively, and source-pin the DOM wiring separately.
 *
 * THE ASYMMETRY BEING PROTECTED
 * Hiding the button from someone standing at a wash station with a wet dog is a
 * real failure. Showing a redundant button is cosmetic. Every uncertain input
 * must therefore resolve to SHOW, and that is what most of these cases check.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { shouldShowStationShortcut } from './useElementInView';

const base = { redeemSectionInView: false, overlayOpen: false, observerAvailable: true };

describe('shouldShowStationShortcut', () => {
  it('shows the button when the redemption QR is scrolled away', () => {
    expect(shouldShowStationShortcut(base)).toBe(true);
  });

  it('hides it while the inline redemption QR is on screen — the actual bug', () => {
    expect(shouldShowStationShortcut({ ...base, redeemSectionInView: true })).toBe(false);
  });

  it('hides it while the full-screen kiosk overlay is open', () => {
    expect(shouldShowStationShortcut({ ...base, overlayOpen: true })).toBe(false);
  });

  it('hides it when the overlay is open even if the section is also in view', () => {
    expect(shouldShowStationShortcut({
      redeemSectionInView: true, overlayOpen: true, observerAvailable: true,
    })).toBe(false);
  });

  // ── fail-safe direction ──
  it('SHOWS the button when there is no IntersectionObserver — never strand a user at a station', () => {
    expect(shouldShowStationShortcut({
      ...base, observerAvailable: false,
    })).toBe(true);
  });

  it('still shows it with no observer even if a stale inView somehow says true', () => {
    // Without an observer, redeemSectionInView can only be a stale or bogus
    // value; it must not be trusted into hiding the button.
    expect(shouldShowStationShortcut({
      redeemSectionInView: true, overlayOpen: false, observerAvailable: false,
    })).toBe(true);
  });

  it('an open overlay still wins over a missing observer', () => {
    // The overlay is a real, locally-known fact — not something the observer
    // tells us — so it stays authoritative.
    expect(shouldShowStationShortcut({
      redeemSectionInView: false, overlayOpen: true, observerAvailable: false,
    })).toBe(false);
  });

  it('is exhaustive and total over all eight input combinations', () => {
    const results: Record<string, boolean> = {};
    for (const redeemSectionInView of [false, true]) {
      for (const overlayOpen of [false, true]) {
        for (const observerAvailable of [false, true]) {
          const key = `${+redeemSectionInView}${+overlayOpen}${+observerAvailable}`;
          results[key] = shouldShowStationShortcut({
            redeemSectionInView, overlayOpen, observerAvailable,
          });
        }
      }
    }
    // key = redeemInView|overlayOpen|observerAvailable
    expect(results).toEqual({
      '000': true,   // nothing known, no observer → show
      '001': true,   // section away → show
      '010': false,  // overlay open → hide
      '011': false,  // overlay open → hide
      '100': true,   // inView untrustworthy without an observer → show
      '101': false,  // inView, observed → hide (the fix)
      '110': false,  // overlay open → hide
      '111': false,  // overlay open → hide
    });
  });
});

describe('the decision is actually wired into the Prestige pass page', () => {
  // Source pins, because the DOM half cannot be executed in a `node` test env.
  // Without these the pure function above could pass forever while the page
  // renders the button unconditionally, which is exactly the bug.
  const PAGE = readFileSync(
    path.join(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..'),
      'client/src/pages/PrestigePassWallet.tsx',
    ),
    'utf8',
  );

  it('renders the floating button conditionally, not unconditionally', () => {
    expect(PAGE).toContain('{showStationShortcut && (');
  });

  it('computes the flag from the decision function rather than inline logic', () => {
    expect(PAGE).toMatch(/const showStationShortcut = shouldShowStationShortcut\(\{/);
  });

  it('observes the inline redemption block by the id that block actually carries', () => {
    expect(PAGE).toContain(`useElementInView('k9000-redeem-section'`);
    expect(PAGE).toContain('id="k9000-redeem-section"');
  });

  it('tells the decision when the overlay is open', () => {
    expect(PAGE).toMatch(/overlayOpen: showKioskPass/);
  });
});

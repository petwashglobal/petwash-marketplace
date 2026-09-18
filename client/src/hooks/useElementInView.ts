/**
 * useElementInView — is the element with this id currently on screen?
 *
 * Built for a narrow, real problem (2026-09-19): the Prestige pass page renders
 * the K9000 redemption QR inline AND floats a fixed "Show Pass — K9000" button
 * over the page that opens an overlay showing the same QR. On a phone the
 * button lands squarely on the inline block it duplicates — the CEO's own
 * screenshots show it covering the "missing ₪39" row and the "Scan to identify"
 * heading. A floating shortcut to something already on screen is not a
 * shortcut; it is an obstruction.
 *
 * So: watch the target, and let the caller hide the shortcut while the real
 * thing is visible.
 *
 * Deliberately id-based rather than ref-based. The button and the section live
 * in different components several hundred lines apart in the same file, and
 * threading a ref between them would mean restructuring a component that
 * handles live money display. An id is the smaller change.
 *
 * Degrades safely. If IntersectionObserver is missing (old Safari, a JSDOM test
 * that has not stubbed it) or the element never mounts, this reports FALSE —
 * "not in view" — so the caller keeps showing its shortcut. Losing the
 * de-duplication is a cosmetic regression; losing the button would strand
 * someone standing at a station.
 */
import { useEffect, useState } from 'react';

/**
 * Should the floating station shortcut be on screen?
 *
 * Pulled out as a pure function on purpose: this repo's vitest runs in the
 * `node` environment with no jsdom and no @testing-library, so DOM behaviour
 * cannot be asserted here at all. Keeping the DECISION free of the DOM is the
 * only way any of this gets real test coverage rather than a source pin.
 *
 * The fail-safe direction matters and is asymmetric:
 *   hiding a button someone needs at a wash station is a real failure;
 *   showing a redundant one is cosmetic.
 * So anything uncertain resolves to SHOW.
 */
export function shouldShowStationShortcut(state: {
  /** the inline redemption QR is at least partly on screen */
  redeemSectionInView: boolean;
  /** the full-screen kiosk overlay is open */
  overlayOpen: boolean;
  /** false on a browser with no IntersectionObserver, where inView is unknowable */
  observerAvailable: boolean;
}): boolean {
  // The overlay is a full-screen scrim at a higher z-index. The button cannot
  // help there and a pulsing gold pill under a scrim is just noise.
  if (state.overlayOpen) return false;
  // Without an observer we can never learn the section is visible, so the
  // de-duplication is off and the button always shows. Cosmetic, not broken.
  if (!state.observerAvailable) return true;
  // The whole point: do not float a shortcut on top of the thing it points at.
  return !state.redeemSectionInView;
}

export function useElementInView(
  elementId: string,
  options?: { threshold?: number; enabled?: boolean },
): boolean {
  const threshold = options?.threshold ?? 0.25;
  const enabled = options?.enabled ?? true;
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!enabled) { setInView(false); return; }
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
      setInView(false);
      return;
    }

    let observer: IntersectionObserver | null = null;
    let cancelled = false;

    // The target can mount after this effect runs (the section is behind a
    // loading state). Poll briefly for it rather than giving up on first miss.
    let attempts = 0;
    const attach = () => {
      if (cancelled) return;
      const el = document.getElementById(elementId);
      if (!el) {
        if (attempts++ < 20) setTimeout(attach, 150);
        return;
      }
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[entries.length - 1];
          if (entry) setInView(entry.isIntersecting);
        },
        { threshold },
      );
      observer.observe(el);
    };
    attach();

    return () => {
      cancelled = true;
      try { observer?.disconnect(); } catch { /* already gone */ }
      observer = null;
    };
  }, [elementId, threshold, enabled]);

  return inView;
}

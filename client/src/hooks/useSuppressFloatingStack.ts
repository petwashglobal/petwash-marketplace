import { useEffect, type RefObject } from 'react';

/**
 * Quiet the FloatingStack while a given block is on screen.
 *
 * WHY THIS IS GENERIC NOW (CEO 2026-09-12). Measured on the live site at
 * 375x812 with no scrolling at all:
 *
 *     "צור חשבון" (Create account)   x 16..359   y 518..566
 *     #pw-a11y (accessibility FAB)   x 76..132   y 540..596
 *
 * The black accessibility circle sits ON TOP of 56px of the primary signup
 * button. A thumb landing there opens the accessibility panel instead of
 * creating an account. That is not a matter of taste — the FAB column is
 * ~200px tall (a quarter of the screen) and any CTA that lands beneath it is
 * simply not tappable.
 *
 * The codebase already solved this three times — cookie consent, the egift
 * hero, and the member dashboard all fade the stack out while something more
 * important owns the screen (see client/src/styles/floating-stack.css). This
 * is that same, already-approved pattern, extracted so any hero can use it
 * instead of each one growing its own copy.
 *
 * Sets `data-pw-suppress-floating="true"` on <body> while the observed element
 * is at least `threshold` visible; the CSS layer fades `.pw-float-stack` to
 * opacity 0 with pointer-events: none, using the transition already declared
 * there (and disabled under prefers-reduced-motion).
 *
 * The stack returns the moment the block scrolls away, and on unmount, so the
 * accessibility / WhatsApp / AI buttons are never more than one scroll away.
 */
export function useSuppressFloatingStack(
  ref: RefObject<HTMLElement | null>,
  options: { threshold?: number; attribute?: string } = {},
): void {
  const threshold = options.threshold ?? 0.5;
  const attribute = options.attribute ?? 'pwSuppressFloating';

  useEffect(() => {
    const target = ref.current;
    if (!target) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= threshold) {
          document.body.dataset[attribute] = 'true';
        } else {
          delete document.body.dataset[attribute];
        }
      },
      { threshold: [0, threshold, 1] },
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
      delete document.body.dataset[attribute];
    };
  }, [ref, threshold, attribute]);
}

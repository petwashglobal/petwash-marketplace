import { useEffect, type RefObject } from 'react';

/**
 * Phase E — quiet the FloatingStack while the egift hero is in view.
 *
 * Pattern mirrors the existing cookie-consent suppression in
 * client/src/styles/floating-stack.css (the `body[data-cookie-consent-active]`
 * rule). We set a body data attribute `data-pw-egift-hero-visible="true"`
 * when the egift hero scrolls into view, and a CSS rule fades the
 * `.pw-float-stack` to opacity 0 with `pointer-events: none`.
 *
 * Scope: /egift only. Other pages do not call this hook, so the
 * attribute is never set and the floating stack behaves as today.
 *
 * Transition: the existing CSS already declares
 * `transition: opacity 0.2s ease` on `.pw-float-stack`. Subtle and
 * premium per CEO direction (no glow / bounce / neon).
 *
 * Reduced motion: the CSS layer also adds a
 * `@media (prefers-reduced-motion: reduce)` rule that disables the
 * transition for users who request reduced motion. The fade becomes
 * instant for them.
 *
 * Cleanup: when the component unmounts (e.g., navigating away from
 * /egift), the attribute is removed so the floating stack returns to
 * its normal visibility on the next page.
 */
export function useEgiftHeroSuppressFloating(
  heroRef: RefObject<HTMLElement | null>,
  options: { threshold?: number } = {},
): void {
  const threshold = options.threshold ?? 0.5;

  useEffect(() => {
    const target = heroRef.current;
    if (!target) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= threshold) {
          document.body.dataset.pwEgiftHeroVisible = 'true';
        } else {
          delete document.body.dataset.pwEgiftHeroVisible;
        }
      },
      { threshold: [0, threshold, 1] },
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
      delete document.body.dataset.pwEgiftHeroVisible;
    };
  }, [heroRef, threshold]);
}

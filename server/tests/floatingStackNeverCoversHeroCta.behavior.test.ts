/**
 * CEO 2026-09-12: "floating buttons overlapping the hero CTAs".
 *
 * I reported this twice as a design call and left it alone. Then I measured it
 * on the live site at 375x812 with NO scrolling:
 *
 *     "צור חשבון" (Create account)   x  16..359   y 518..566
 *     #pw-a11y  (accessibility FAB)  x  76..132   y 540..596
 *
 * The black circle covers 56px of the primary signup button. A thumb landing
 * there opens the accessibility panel instead of creating an account. That is
 * a bug, not a preference, so it is fixed rather than escalated.
 *
 * The fix reuses the pattern this codebase already applies three times over
 * (cookie consent, egift hero, member dashboard): fade the stack while the
 * block that matters owns the screen, restore it the moment it scrolls away.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const R = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const CSS = () => R('client/src/styles/floating-stack.css');

/** Pull `bottom: calc(<N>px + ...)` for one FAB id, and the shared FAB size. */
function fabBottomPx(id: string): number {
  const css = CSS();
  const at = css.indexOf(`#${id} {`);
  expect(at, `#${id} has no rule`).toBeGreaterThan(-1);
  const block = css.slice(at, css.indexOf('}', at));
  const m = /bottom:\s*calc\((\d+)px/.exec(block);
  expect(m, `#${id} no longer positions from the bottom`).not.toBeNull();
  return parseInt(m![1], 10);
}

describe('the floating stack really does own a quarter of a phone screen', () => {
  it('the FAB column spans ~200px — big enough to swallow a CTA', () => {
    const size = (() => {
      const css = CSS();
      // Anchor to line start: several suppression rules end in `.pw-float {`
      // (body[data-cookie-consent-active] .pw-float { ... }), and matching one
      // of those instead of the base rule made this read `undefined`.
      const at = css.indexOf('\n.pw-float {');
      expect(at, 'base .pw-float rule not found').toBeGreaterThan(-1);
      const m = /(?<!min-)height:\s*(\d+)px/.exec(css.slice(at, css.indexOf('}', at)));
      expect(m, '.pw-float no longer declares a fixed height').not.toBeNull();
      return parseInt(m![1], 10);
    })();
    expect(size).toBe(56);

    const bottoms = ['pw-ai', 'pw-wa', 'pw-a11y'].map(fabBottomPx);
    const lowest = Math.min(...bottoms);
    const highestTop = Math.max(...bottoms) + size;
    const column = highestTop - lowest;
    // 16 -> 88 -> 160, plus the 56px button = 200px of vertical edge.
    expect(column).toBe(200);
    // On the shortest iPhone in portrait (568px) that is over a third of the screen.
    expect(column / 812).toBeGreaterThan(0.24);
  });
});

describe('a hero that owns the screen suppresses the stack', () => {
  it('the CSS rule exists and kills BOTH paint and touch', () => {
    const css = CSS();
    const at = css.indexOf('body[data-pw-suppress-floating="true"]');
    expect(at, 'no generic suppression rule').toBeGreaterThan(-1);
    const block = css.slice(at, css.indexOf('}', at));
    expect(block).toMatch(/opacity:\s*0\s*!important/);
    // opacity alone is NOT enough — an invisible button that still eats the tap
    // is worse than a visible one.
    expect(block, 'invisible but still tappable').toMatch(/pointer-events:\s*none\s*!important/);
    // it must cover the individual FABs too; .pw-float is position:fixed and is
    // NOT a child of .pw-float-stack, so a stack-only rule would miss them.
    expect(css.slice(at - 90, at + 200)).toContain('.pw-float');
  });

  it('the landing hero actually uses it', () => {
    const src = R('client/src/pages/Landing.tsx');
    expect(src).toContain('useSuppressFloatingStack');
    expect(src, 'hook imported but never called').toMatch(/useSuppressFloatingStack\(\s*heroCtaRef\s*\)/);
    expect(src, 'the ref is not attached to anything').toMatch(/ref=\{heroCtaRef\}/);
    // the ref must sit on the element that WRAPS both CTAs
    const at = src.indexOf('ref={heroCtaRef}');
    const after = src.slice(at, at + 3000);
    expect(after).toContain('button-signin-hero');
    expect(after).toContain('button-create-account-hero');
  });

  it('the stack comes BACK — suppression is scroll-scoped, not permanent', () => {
    const hook = R('client/src/hooks/useSuppressFloatingStack.ts');
    // cleared when the block leaves the viewport...
    expect(hook).toMatch(/else\s*\{\s*delete document\.body\.dataset\[attribute\]/);
    // ...and on unmount, so navigating away can never strand it.
    expect(hook).toMatch(/return \(\) => \{[\s\S]*?delete document\.body\.dataset\[attribute\]/);
    expect(hook).toContain('observer.disconnect()');
  });

  it('it degrades safely where IntersectionObserver is missing', () => {
    // No observer => attribute never set => the stack behaves exactly as before.
    expect(R('client/src/hooks/useSuppressFloatingStack.ts'))
      .toContain("typeof IntersectionObserver === 'undefined'");
  });
});

describe('/egift is untouched by the extraction', () => {
  it('its own attribute and CSS rule still exist', () => {
    expect(CSS()).toContain('body[data-pw-egift-hero-visible="true"]');
    const hook = R('client/src/hooks/useEgiftHeroSuppressFloating.ts');
    expect(hook).toContain('pwEgiftHeroVisible');
    expect(hook, 'egift should now delegate, not keep a second copy')
      .toContain('useSuppressFloatingStack');
  });

  it('EGift still calls its hook', () => {
    expect(R('client/src/pages/EGift.tsx')).toContain('useEgiftHeroSuppressFloating(heroRef)');
  });
});

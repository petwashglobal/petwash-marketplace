import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * LANDSCAPE HEADER BUDGET (2026-09-10)
 *
 * On a 667x375 landscape iPhone SE the header was 156px — 42% of the screen
 * before one line of content. Measured on a booted app at real device widths
 * (iframes honour media queries; the browser pane's own viewport does not).
 *
 *   .pw-header-row-logo       50px
 *   .pw-header-row-controls   52px
 *   .pw-mobile-nav-strip      53px
 *
 * The landscape media block existed and MATCHED, but every rule in it targeted
 * `.pw-header-inner` — an element the mobile header does not render. So it
 * changed nothing about the three rows that make the height.
 *
 * After: 91px, 24%. Portrait tiers unchanged, burger nav still present.
 *
 * This is a source pin — jsdom does not evaluate media queries against a real
 * viewport, so there is no geometry to assert. What it pins is that the
 * landscape block still reaches the two elements that actually cost the
 * height, which is the only way the regression could return.
 */
const css = readFileSync(
  resolve(__dirname, '../../client/src/styles/petwash-header.css'),
  'utf8',
);

/** Body of each @media block whose condition matches `test`. */
function mediaBlocks(test: (condition: string) => boolean): string[] {
  const blocks: string[] = [];
  const re = /@media([^{]+)\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    if (!test(m[1].trim())) continue;
    let depth = 1;
    let i = re.lastIndex;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
      i++;
    }
    blocks.push(css.slice(re.lastIndex, i - 1));
  }
  return blocks;
}

const landscapeShort = () =>
  mediaBlocks((c) => /orientation:\s*landscape/.test(c) && /max-height/.test(c));

describe('the header may not eat a landscape phone screen', () => {
  it('has a landscape + short-viewport block at all', () => {
    expect(landscapeShort().length).toBeGreaterThan(0);
  });

  it('hides the mobile nav strip — its 53px is the biggest single line item', () => {
    // Already hidden at >=768px; this is the same decision on the other axis.
    // The burger drawer still carries navigation, so nothing is unreachable.
    const hidesStrip = landscapeShort().some((b) =>
      /\.pw-mobile-nav-strip\s*\{[^}]*display:\s*none/.test(b),
    );
    expect(hidesStrip).toBe(true);
  });

  it('shrinks the logo LINK, not just the logo image', () => {
    // The image was already pulled to 2.25rem, but the anchor wrapping it held
    // a 48px min-height that kept the row at 50px regardless — shrinking only
    // the image bought nothing.
    const shrinksLink = landscapeShort().some((b) =>
      /\.pw-logo-link\s*\{[^}]*min-height/.test(b),
    );
    expect(shrinksLink).toBe(true);
  });

  it('does not re-center or move the logo — that is a CEO rule', () => {
    // The crown stays top-centre. Only the vertical box may shrink.
    for (const body of landscapeShort()) {
      expect(body).not.toMatch(/\.pw-header-row-logo\s*\{[^}]*justify-content/);
    }
  });
});

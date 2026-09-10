import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * HEADER LOGO TIERS (2026-09-10)
 *
 * petwash-header.css sizes .pw-header-logo-img from FOUR rules that all carry
 * `!important` at the same (0,1,0) specificity:
 *
 *   @media (max-width: 375px)                              height 2.75rem
 *   @media (min-width: 376px) and (max-width: 639px)       height 3.25rem
 *   @media (orientation: landscape) and (max-height:500px) height 2.25rem
 *   @media (max-width: 767px)   <- the "mobile de-salad" block
 *
 * At equal specificity SOURCE ORDER decides, and the de-salad block is
 * deliberately appended last ("so it wins the cascade" — which was about
 * hiding the social links). It therefore also beat all three per-device tiers.
 *
 * Measured consequences before the fix:
 *   320px portrait  logo 52px inside a 120px-wide box (tier wanted 44px)
 *   667x375 landscape  logo 52px inside a 48px bar — it OVERFLOWED its header
 *
 * The invariant: the blanket `max-width: 767px` block must not size the logo,
 * because any rule there silently outranks every narrower tier below it.
 */
const css = readFileSync(
  resolve(__dirname, '../../client/src/styles/petwash-header.css'),
  'utf8',
);

/** Body of the first @media block whose condition matches `test`. */
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

describe('the blanket phone breakpoint does not outrank the per-device logo tiers', () => {
  it('no `max-width: 767px`-only block sizes .pw-header-logo-img', () => {
    // "767px-only" = a blanket phone query, as opposed to the narrower band
    // (min-width: 640px) and (max-width: 767px) and (min-height: 501px),
    // which is scoped precisely to the gap no other tier covers.
    const blanket = mediaBlocks(
      (cond) => /max-width:\s*767px/.test(cond) && !/min-width/.test(cond),
    );
    expect(blanket.length).toBeGreaterThan(0); // the de-salad block still exists

    for (const body of blanket) {
      const rule = body.match(/\.pw-header-logo-img\s*\{[^}]*\}/);
      expect(
        rule?.[0],
        'a blanket max-width:767px rule for .pw-header-logo-img outranks the ' +
          '<=375px, 376-639px and landscape tiers by source order alone',
      ).toBeUndefined();
    }
  });

  it('the three per-device logo tiers are all still present', () => {
    const has = (cond: RegExp) =>
      mediaBlocks((c) => cond.test(c)).some((b) => b.includes('.pw-header-logo-img'));
    expect(has(/max-width:\s*375px/)).toBe(true);
    expect(has(/min-width:\s*376px/)).toBe(true);
    expect(has(/orientation:\s*landscape/)).toBe(true);
  });
});

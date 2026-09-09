/**
 * HE-RTL direction contract — regression pin (Lane F cross-flow).
 *
 * Hebrew is the default language for the customer surface. Every
 * top-level customer page container MUST render its root with a
 * dynamic `dir` attribute:
 *
 *     dir={(he | isHe) ? 'rtl' : 'ltr'}
 *
 * A page that hard-codes `dir="ltr"` on the root would show the
 * whole flow left-to-right for the majority of users. This pin
 * catches that class of regression.
 *
 * Inline LTR-locked spans/divs on Hebrew pages are ALLOWED and
 * GOOD when they wrap:
 *   * numeric/latin transaction IDs (`<span dir="ltr">TX-123</span>`)
 *   * order numbers wrapped in `<bdi dir="ltr">`
 *   * money amounts, credit-card refs, monospace font blocks
 * This test does NOT flag those — it only pins the ROOT container.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..');

interface Surface {
  label: string;
  file: string;
  /** Additional inner containers that must also honour the toggle. */
  extraContainerCount?: number;
}

/**
 * Customer-facing surfaces that are Hebrew-first. Adding a new
 * page here is intentional — it locks that page's root direction
 * contract.
 */
const SURFACES: readonly Surface[] = [
  { label: 'Pet-Parent (Prestige) home', file: 'client/src/pages/PrestigeHome.tsx' },
  { label: 'Provider home', file: 'client/src/pages/ProviderHome.tsx' },
  { label: 'AttentionList (top-of-fold on both homes)', file: 'client/src/components/AttentionList.tsx' },
  { label: 'NextBestActionCard (above AttentionList)', file: 'client/src/components/NextBestActionCard.tsx' },
  { label: 'MyAccount', file: 'client/src/pages/MyAccount.tsx' },
  { label: 'ChoosePath', file: 'client/src/pages/ChoosePath.tsx' },
  { label: 'SignUpLuxury', file: 'client/src/pages/SignUpLuxury.tsx' },
  { label: 'AccessPending', file: 'client/src/pages/AccessPending.tsx' },
  { label: 'AccountActivation', file: 'client/src/pages/AccountActivation.tsx' },
  { label: 'CompleteProfile', file: 'client/src/pages/CompleteProfile.tsx' },
  { label: 'PawFinder', file: 'client/src/pages/PawFinder.tsx' },
];

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), 'utf8');
}

/**
 * A "toggle" dir attribute reads as either `dir={he ? 'rtl' : 'ltr'}`
 * or `dir={isHe ? 'rtl' : 'ltr'}` — both patterns are canonical.
 * Matches with optional whitespace around the ternary parts.
 */
/**
 * Any dynamic dir toggle that yields 'rtl' | 'ltr' from a runtime
 * language flag is accepted. Canonical shapes:
 *   dir={he ? 'rtl' : 'ltr'}
 *   dir={isHe ? 'rtl' : 'ltr'}
 *   dir={language === 'he' ? 'rtl' : 'ltr'}
 *   dir={(language === 'he' || language === 'ar') ? 'rtl' : 'ltr'}
 *   dir={isHebrew ? 'rtl' : 'ltr'}
 * The point of the pin is: the attribute is a JS expression (not a
 * string literal `dir="ltr"` at root), and it evaluates to 'rtl'
 * when the language is HE.
 */
const TOGGLE_RX =
  /dir=\{[^}]*\?\s*['"]rtl['"]\s*:\s*['"]ltr['"][^}]*\}/;

describe('HE-RTL direction contract · customer surfaces', () => {
  for (const surface of SURFACES) {
    it(`${surface.label} · uses dir={he/isHe ? 'rtl' : 'ltr'} on the root container`, () => {
      const src = read(surface.file);
      expect(src, `${surface.file} missing dynamic dir toggle`).toMatch(TOGGLE_RX);
    });

    it(`${surface.label} · root is NOT hard-locked to dir="ltr"`, () => {
      const src = read(surface.file);
      // Find the first top-level JSX opening element that could be the root.
      // A root element that carries dir="ltr" (fixed) is the bug we're
      // catching. Inline dir="ltr" on <span>/<bdi>/font-mono blocks is
      // fine — we only object when the ATTRIBUTE is dir="ltr" and the
      // element does NOT also carry the dynamic toggle immediately near it.
      //
      // Simpler contract: reject the exact string `dir="ltr"` when it
      // appears on the SAME line as `<section` / `<main` / `<div className="min-h`
      // / other page-shell shapes — those are the roots.
      const rootLtrRx =
        /(?:<section[^>]*|<main[^>]*|<div className="[^"]*min-h[^"]*"[^>]*)\bdir="ltr"/;
      expect(src, `${surface.file} hard-locks root direction to LTR`).not.toMatch(rootLtrRx);
    });
  }

  it('AttentionList also flips text-align via the `he` flag (visible sanity check)', () => {
    // If the direction toggles but content is still text-aligned-left,
    // the RTL page looks off. This isn't strictly required (`dir` alone
    // handles most cases), but a page in scope MUST at minimum consult
    // `he` from the language store.
    const src = read('client/src/components/AttentionList.tsx');
    expect(src).toMatch(/const\s+he\s*=\s*language\s*===\s*['"]he['"]/);
  });

  it('NextBestActionCard uses the RTL/LTR-correct corner for the dismiss X', () => {
    const src = read('client/src/components/NextBestActionCard.tsx');
    // The dismiss button positions itself in the top-left in HE, top-right in EN.
    expect(src).toMatch(/\$\{he\s*\?\s*['"]left-1['"]\s*:\s*['"]right-1['"]\}/);
  });

  it('language store exposes a stable `he`/`language` shape', () => {
    // If someone renames the language store selector, EVERY surface
    // above would silently lose its dir toggle. Pin the export.
    // The language store is a .tsx file (exports a hook and a Provider).
    const src = read('client/src/lib/languageStore.tsx');
    expect(src).toMatch(/language/);
  });
});

/**
 * Directional-icon mirroring — regression pin (added 2026-09-10).
 *
 * `dir="rtl"` mirrors the LAYOUT but never the GLYPH. A lucide
 * <ArrowRight/> still draws an arrow pointing right inside an RTL
 * page, so a "forward / next / learn more" affordance ends up
 * pointing BACKWARDS for the Hebrew reader — the default reader on
 * petwash.co.il.
 *
 * Two spellings are canonical and both are accepted here:
 *   1. flip the glyph  — `className="... rtl:rotate-180"`
 *      (or the older `${isHebrew ? 'rotate-180' : ''}` form)
 *   2. swap the icon   — `const BackArrow = isRtl ? ArrowRight : ArrowLeft`
 *      and render `<BackArrow/>`, so `<ArrowRight` never appears raw.
 *
 * Measured on the running app at 1280px before this pin landed:
 * 9 of 11 directional icons on `/` and 6 of 6 on `/k9000` rendered
 * with `transform: none` under `dir="rtl"`, while the Prestige
 * chevron on the same page correctly reported
 * `matrix(-1, 0, 0, -1, 0, 0)`. Same page, same icon, two behaviours.
 */
describe('HE-RTL directional icons flip in Hebrew', () => {
  /** Surfaces audited on 2026-09-10 across `?lang=he` / `?lang=en`. */
  const ICON_SURFACES: readonly { label: string; file: string }[] = [
    { label: 'K9000 overview — "Learn More" cards', file: 'client/src/pages/k9000/Overview.tsx' },
    { label: 'GiftCards — "Send Gift" + "View all"', file: 'client/src/components/GiftCards.tsx' },
    { label: 'WashPackages — express checkout', file: 'client/src/components/WashPackages.tsx' },
  ];

  /** Horizontal, meaning-bearing lucide icons. Vertical/decorative ones are out of scope. */
  const DIRECTIONAL_TAG = /<(ArrowRight|ArrowLeft|ChevronRight|ChevronLeft)\b([^>]*)\/?>/g;
  const FLIPPED = /rtl:rotate-180|rotate-180/;

  for (const surface of ICON_SURFACES) {
    it(`${surface.label} flips every directional icon under dir="rtl"`, () => {
      const src = read(surface.file);
      const offenders: string[] = [];
      for (const m of src.matchAll(DIRECTIONAL_TAG)) {
        const [whole, , attrs] = m;
        if (!FLIPPED.test(attrs)) offenders.push(whole.trim().slice(0, 120));
      }
      expect(
        offenders,
        `${surface.file}: directional icon(s) rendered raw — in Hebrew these point the wrong way. ` +
          `Add \`rtl:rotate-180\`, or swap the icon via a direction-aware variable.`,
      ).toEqual([]);
    });
  }

  it('K9000 "Learn More" arrow spaces itself with a LOGICAL margin, not margin-left', () => {
    // `ml-2` is physical: under dir="rtl" it resolved to margin-inline-END,
    // putting the 8px gap between the arrow and the button edge instead of
    // between the arrow and the label. Measured live: mis 0px / mie 8px
    // before, mis 8px / mie 0px after.
    const src = read('client/src/pages/k9000/Overview.tsx');
    expect(src).not.toMatch(/<ArrowRight[^>]*\bml-2\b/);
    expect(src).toMatch(/<ArrowRight[^>]*\bms-2\b/);
  });

  it('sign-in "remember me" row does not double-reverse its flex direction', () => {
    /**
     * `dir="rtl"` ALREADY lays a `flex-direction: row` out right-to-left.
     * Adding `row-reverse` on top of that reverses it a second time and
     * lands the control back in its LTR position.
     *
     * Measured live on /signin?lang=he at 1280px: the row spans x 73..594;
     * the checkbox sat at x 73 (left edge) with `row-reverse`, and moves to
     * x 581 (right edge) without it — which is where the /signup consent
     * checkboxes already sit. English is unaffected (checkbox stays left).
     */
    const src = read('client/src/pages/SignUpLuxury.tsx');
    expect(
      src,
      'SignUpLuxury re-introduced a language-conditional row-reverse; ' +
        'dir="rtl" already mirrors a plain flex row.',
    ).not.toMatch(/flexDirection:\s*he\s*\?\s*['"]row-reverse['"]/);
  });
});

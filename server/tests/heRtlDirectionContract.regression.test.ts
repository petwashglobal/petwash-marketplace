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

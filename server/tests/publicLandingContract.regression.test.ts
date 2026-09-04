/**
 * Public Landing page contract — regression pin (Lane C brochureware).
 *
 * The public homepage (`/`, Landing.tsx) is the single most-visited
 * surface in the app. This pin locks the invariants a refactor must
 * not silently violate:
 *
 *   1. LandingLiveBayStrip is NEVER mounted on public Landing.
 *      CEO 2026-08-22 directive: live per-station hardware telemetry
 *      is back-office only. The component still lives in the code
 *      for the /k9000/bay-status admin view, but the public page
 *      must never re-mount it (data-leak risk + performance risk).
 *
 *   2. The four canonical marketing sections stay mounted:
 *      * WashPackages (K9000 station pricing)
 *      * PetWashDivisions (four SaaS pillars)
 *      * PremiumPlatformGrid (new hero grid)
 *      * ProviderRegistrationBanner (provider funnel entry)
 *
 *   3. The `language` prop threads through every child section — a
 *      refactor that hard-codes `language="he"` in one child would
 *      silently break the EN toggle for the whole page.
 *
 *   4. The greeting-context fetch is fail-soft (auth-optional and
 *      wrapped in useQuery — even if the endpoint throws, the page
 *      still renders because the greeting reads use `?? null`).
 *
 *   5. Real Kfar Saba station photo (approved asset) is imported,
 *      not a rendered / placeholder image.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..');

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), 'utf8');
}

describe('Public Landing page · contract', () => {
  const src = read('client/src/pages/Landing.tsx');

  it('does NOT mount LandingLiveBayStrip — back-office-only (CEO 2026-08-22)', () => {
    // Reject any actual JSX usage `<LandingLiveBayStrip ...`.
    expect(src).not.toMatch(/<LandingLiveBayStrip\b/);
    // Reject any live import.
    expect(src).not.toMatch(/from\s+['"][^'"]*LandingLiveBayStrip['"]/);
    // The comment ABOUT its removal may reference the name — that
    // is allowed and encouraged; the reject above only fires on
    // real JSX usage / import statements.
  });

  it('mounts the four canonical marketing sections', () => {
    for (const cmp of ['WashPackages', 'PetWashDivisions', 'PremiumPlatformGrid', 'ProviderRegistrationBanner']) {
      expect(src, `Landing missing <${cmp}>`).toMatch(new RegExp(`<${cmp}\\b`));
    }
  });

  it('threads the language prop through the marketing sections', () => {
    // Each marketing section receives language={language} (not a
    // hard-coded value). Match on `<Section language={language}`
    // with either `language={language}` or `language={language as ...}`.
    for (const cmp of ['WashPackages', 'PetWashDivisions', 'PremiumPlatformGrid']) {
      const rx = new RegExp(`<${cmp}[^>]*language=\\{language\\b`);
      expect(src, `<${cmp}> missing language={language}`).toMatch(rx);
    }
  });

  it('greeting-context fetch is auth-gated and useQuery-wrapped (fail-soft render)', () => {
    // useQuery over /api/me/greeting-context with `enabled: !!user`.
    expect(src).toMatch(/useQuery[\s\S]{0,400}\/api\/me\/greeting-context/);
    expect(src).toMatch(/enabled:\s*!!user/);
    // greetCtx reads use ?? null so undefined data never crashes render.
    expect(src).toMatch(/greetCtx\?\.birthday\s*\?\?\s*null/);
    expect(src).toMatch(/greetCtx\?\.pets\s*\?\?\s*\[\s*\]/);
  });

  it('imports the REAL Kfar Saba station photo (approved asset) — not a placeholder', () => {
    expect(src).toMatch(/import\s+greenKfarSabaStationPhoto\s+from\s+['"]@assets\/green_kfarsaba_station\.jpg['"]/);
  });

  it('LandingLiveBayStrip is preserved for back-office use (not deleted from the tree)', () => {
    // The strip must still exist as a file — it powers
    // /k9000/bay-status. If deleted here, back-office breaks.
    const bayStripExists = (() => {
      try {
        read('client/src/components/LandingLiveBayStrip.tsx');
        return true;
      } catch {
        return false;
      }
    })();
    expect(
      bayStripExists,
      'LandingLiveBayStrip.tsx has been removed — /k9000/bay-status will break',
    ).toBe(true);
  });

  it('AccountNavigation handoff never navigates while auth is still loading', () => {
    // getAccountRoute() returns '#' while auth is rehydrating. The
    // Landing handler MUST short-circuit on that sentinel, otherwise
    // a logged-in user refreshing and tapping instantly gets bounced
    // to sign-in (this was the 2026-07-27 iPhone Safari bug).
    expect(src).toMatch(/if\s*\(\s*route\s*===\s*['"]#['"]\s*\)\s*return/);
  });
});

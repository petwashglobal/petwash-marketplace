/**
 * Lane A (CEO 2026-09-03): canonical signed-in customer workspace is
 * `/pet-parent/home`. Prestige (member entitlements + club pages)
 * renders INSIDE this workspace as a badge — never as a competing
 * destination that forces a customer into a separate auth universe.
 *
 * Source-anchored pins on every emission site so a refactor cannot
 * silently regress a customer branch back to /prestige/home or /home.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), 'utf8');
}

describe('canonical customer destination · server post-login decider', () => {
  const src = read('server/routes/post-login.ts');

  it('every customer branch returns /pet-parent/home (never /prestige/home)', () => {
    // Zero prestige/home returns anywhere in the decider.
    expect(src).not.toMatch(/nextUrl:\s*['"]\/prestige\/home['"]/);
    // Multiple pet-parent/home returns — one per customer branch (super_admin
    // member view, loyalty, explicit intent, default).
    const hits = (src.match(/nextUrl:\s*['"]\/pet-parent\/home['"]/g) || []).length;
    expect(hits).toBeGreaterThanOrEqual(4);
  });

  it('loyalty role decoder returns /pet-parent/home', () => {
    expect(src).toMatch(
      /if \(role === 'loyalty'\)[\s\S]{0,600}nextUrl:\s*['"]\/pet-parent\/home['"]/,
    );
  });

  it('default customer fallback returns /pet-parent/home, not /home', () => {
    // The Lane A ruling comment names /pet-parent/home as the default
    // customer destination and the fallback returns it right after.
    expect(src).toMatch(
      /Lane A[\s\S]{0,400}nextUrl:\s*['"]\/pet-parent\/home['"]/,
    );
  });
});

describe('canonical customer destination · client fallbacks', () => {
  it('ChoosePath "Pet Parent" tile navigates to /pet-parent/home', () => {
    const src = read('client/src/pages/ChoosePath.tsx');
    // Old /home target must not sneak back
    expect(src).not.toMatch(/onClick:\s*\(\)\s*=>\s*navigate\(['"]\/home['"]\)/);
    // New target present
    expect(src).toMatch(/onClick:\s*\(\)\s*=>\s*navigate\(['"]\/pet-parent\/home['"]\)/);
  });

  it('ChoosePath "decide later" link navigates to /pet-parent/home', () => {
    const src = read('client/src/pages/ChoosePath.tsx');
    // Locate the "decide later" button and confirm it targets the canonical
    // customer workspace, whichever order testid / onClick appear in.
    const idx = src.indexOf('data-testid="choosepath-decide-later"');
    expect(idx).toBeGreaterThan(0);
    const region = src.slice(Math.max(0, idx - 200), idx + 200);
    expect(region).toMatch(/navigate\(['"]\/pet-parent\/home['"]\)/);
  });

  it('ProviderOnboarding blocked-role fallback lands on /pet-parent/home', () => {
    const src = read('client/src/pages/ProviderOnboarding.tsx');
    expect(src).toMatch(/data\.nextUrl \|\| data\.redirectTo \|\| ['"]\/pet-parent\/home['"]/);
    expect(src).toMatch(/navigate\(['"]\/pet-parent\/home['"]\)/);
  });
});

/**
 * Regression pins — CEO 2026-08-26 role model (items 2/3/4 of the 20).
 *
 * Prestige is NOT a role. Workspaces are Pet Parent ↔ Provider. Every
 * human is a Pet Parent by default; the /mode picker appears iff they
 * are ALSO an approved provider. Prestige is a badge inside Pet Parent.
 *
 * These are STRUCTURAL pins — they read the source and assert the
 * routing shape survives a future refactor. They complement the
 * behavior tests in userCapabilities.test.ts (which verify the
 * capability aggregator itself).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const REPO = path.resolve(__dirname, '..', '..');

const CHOOSE_MODE = fs.readFileSync(
  path.join(REPO, 'client/src/pages/ChooseMode.tsx'),
  'utf8',
);
const POST_LOGIN = fs.readFileSync(
  path.join(REPO, 'server/routes/post-login.ts'),
  'utf8',
);
const ROLES_LIB = fs.readFileSync(
  path.join(REPO, 'shared/lib/userCapabilities.ts'),
  'utf8',
);
const PRESTIGE_HOME = fs.readFileSync(
  path.join(REPO, 'client/src/pages/PrestigeHome.tsx'),
  'utf8',
);

describe('Pet Parent ↔ Provider picker — CEO 2026-08-26 role model', () => {

  it('#2 provider without Prestige STILL sees the picker (customer workspace is implicit)', () => {
    // The picker branch fires on provider.status==='approved' ALONE — no
    // hasPrestige gate. Every approved provider is also a Pet Parent.
    expect(POST_LOGIN).toMatch(/providerApp\.status\s*===\s*'approved'/);
    expect(POST_LOGIN).toMatch(/nextUrl:\s*'\/mode'/);
    // Regression guard: the earlier bug had `if (hasPrestige)` gating the
    // /mode branch — the picker MUST NOT depend on hasPrestige today.
    expect(POST_LOGIN).not.toMatch(/if\s*\(\s*hasPrestige\s*\)\s*\{[^}]*'\/mode'/s);
  });

  it('#3 Prestige non-provider gets NO picker — routes straight to Pet Parent home', () => {
    // ChooseMode auto-routes on missing provider capability. Path is
    // /prestige/home (the historical customer home name).
    expect(CHOOSE_MODE).toMatch(/if\s*\(\s*!providerActive\s*\)\s*\{\s*navigate\(\s*CUSTOMER_FALLBACK\s*\)/);
    expect(CHOOSE_MODE).toMatch(/const\s+CUSTOMER_FALLBACK\s*=\s*'\/prestige\/home'/);
  });

  it('#4 provider+Prestige — picker renders BOTH tiles with a Prestige badge on Pet Parent', () => {
    // Both tiles exist by testid; the Prestige badge is gated on
    // prestigeEnrolled inside the Pet Parent tile only.
    expect(CHOOSE_MODE).toMatch(/data-testid="choose-mode-pet-parent"/);
    expect(CHOOSE_MODE).toMatch(/data-testid="choose-mode-provider"/);
    expect(CHOOSE_MODE).toMatch(/data-testid="choose-mode-prestige-badge"/);
    // The badge must render conditionally on prestigeEnrolled (not
    // inside the Provider tile — that would repeat the Prestige-as-mode
    // bug).
    const prestigeTile = CHOOSE_MODE.slice(
      CHOOSE_MODE.indexOf('data-testid="choose-mode-pet-parent"'),
      CHOOSE_MODE.indexOf('data-testid="choose-mode-provider"'),
    );
    expect(prestigeTile).toMatch(/prestigeEnrolled\s*&&/);
    // And the Provider tile does NOT reference Prestige.
    const providerTile = CHOOSE_MODE.slice(
      CHOOSE_MODE.indexOf('data-testid="choose-mode-provider"'),
    );
    expect(providerTile).not.toMatch(/prestige|Prestige/);
  });

  it('Prestige is NOT emitted as a role — rolesFromCapabilities has no push("loyalty")', () => {
    const marker = ROLES_LIB.indexOf('export function rolesFromCapabilities');
    expect(marker).toBeGreaterThan(-1);
    const body = ROLES_LIB.slice(marker, marker + 600);
    expect(body).not.toMatch(/push\(\s*'loyalty'\s*\)/);
    // Order still customer → provider → staff → admin.
    const positions = ['customer', 'provider', 'staff', 'admin']
      .map((r) => body.indexOf(`'${r}'`));
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }
  });

  it('PrestigeHome hides the wordmark for non-enrolled Pet Parents', () => {
    expect(PRESTIGE_HOME).toMatch(/prestigeEnrolled\s*&&\s*\(/);
    // The "PRESTIGE" wordmark is inside a testid'd span gated on
    // prestigeEnrolled — non-enrolled users see the logo without it.
    expect(PRESTIGE_HOME).toMatch(/data-testid="prestige-wordmark"/);
    // Non-enrolled users see an explicit Join CTA (no stolen valor).
    expect(PRESTIGE_HOME).toMatch(/data-testid="prestige-join-cta"/);
  });
});

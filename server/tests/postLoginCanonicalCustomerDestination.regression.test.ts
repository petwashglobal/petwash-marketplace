/**
 * CEO AUTH MASTER §P0-5 (2026-08-29) — one canonical customer
 * destination. `/pet-parent/home` is THE customer workspace;
 * Prestige is an entitlement that renders inside it (not a
 * separate destination); `/home` renders the MARKETING page for
 * signed-in web users and must never be a post-login target.
 *
 * Confirmed fragmentation the CEO caught:
 *   * ChooseMode → /pet-parent/home        (correct)
 *   * post-login.ts customer paths → /prestige/home  (WRONG)
 *   * ChoosePath "Pet Parent" tile → /home (WRONG)
 *   * ProviderOnboarding blocked-role fallback → /home (WRONG)
 *
 * This suite pins the reconciliation: every server post-login branch
 * that would previously have said /prestige/home now says
 * /pet-parent/home; every client destination for "Pet Parent" says
 * /pet-parent/home too. A refactor that re-introduces the
 * fragmentation trips CI here.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const REPO = path.resolve(__dirname, '..', '..');

const POST = fs.readFileSync(path.join(REPO, 'server', 'routes', 'post-login.ts'), 'utf8');
const CHOOSE = fs.readFileSync(path.join(REPO, 'client', 'src', 'pages', 'ChoosePath.tsx'), 'utf8');
const ONBOARDING = fs.readFileSync(
  path.join(REPO, 'client', 'src', 'pages', 'ProviderOnboarding.tsx'),
  'utf8',
);

describe('server post-login — canonical customer destination', () => {
  it('super_admin with member intent → /pet-parent/home (NOT /prestige/home)', () => {
    expect(POST).toMatch(/if \(wantsMemberView\) \{\s*\n\s*return \{ nextUrl: '\/pet-parent\/home',[^}]+role: 'super_admin'/);
  });

  it('role === loyalty → /pet-parent/home (Prestige is entitlement, not workspace)', () => {
    expect(POST).toMatch(/if \(role === 'loyalty'\) \{[\s\S]*?nextUrl: '\/pet-parent\/home'/);
  });

  it('approved provider + wantsCustomer → /pet-parent/home', () => {
    expect(POST).toMatch(/if \(wantsCustomer\) \{\s*\n\s*return \{ nextUrl: '\/pet-parent\/home',/);
  });

  it('default customer/member exit → /pet-parent/home', () => {
    // Last return in the file — matches the "Default customer" branch.
    expect(POST).toMatch(/Default customer[\s\S]{0,400}return \{ nextUrl: '\/pet-parent\/home',/);
  });

  it('NO branch emits /prestige/home any more', () => {
    // A `nextUrl: '/prestige/home'` string appearing anywhere in
    // post-login.ts re-opens the exact fragmentation the CEO named.
    expect(POST).not.toMatch(/nextUrl:\s*'\/prestige\/home'/);
  });

  it('provider workspace stays /provider-os — customer reconciliation does not accidentally demote providers', () => {
    // Belt-and-braces: verify the provider branch is untouched.
    expect(POST).toMatch(/if \(wantsProvider\) \{\s*\n\s*return \{ nextUrl: '\/provider-os'/);
  });
});

describe('ChoosePath — Pet Parent tile', () => {
  it('primary "Continue as Pet Parent" onClick navigates to /pet-parent/home', () => {
    expect(CHOOSE).toMatch(/onClick: \(\) => navigate\('\/pet-parent\/home'\)/);
  });

  it('"I\'ll decide later" ALSO navigates to /pet-parent/home — the marketing /home is not a customer destination', () => {
    expect(CHOOSE).toMatch(/onClick=\{\(\) => navigate\('\/pet-parent\/home'\)\}\s*\n\s*data-testid="choosepath-decide-later"/);
  });

  it('NO ChoosePath navigate() writes /home or /prestige/home', () => {
    expect(CHOOSE).not.toMatch(/navigate\('\/home'\)/);
    expect(CHOOSE).not.toMatch(/navigate\('\/prestige\/home'\)/);
  });
});

describe('ProviderOnboarding — blocked-role fallback', () => {
  it('resolvePostLogin fallback is /pet-parent/home, not /home', () => {
    expect(ONBOARDING).toMatch(/const nextUrl = data\.nextUrl \|\| data\.redirectTo \|\| '\/pet-parent\/home';/);
    expect(ONBOARDING).toMatch(/catch \{[\s\S]{0,80}navigate\('\/pet-parent\/home'\);/);
  });

  it('NO more navigate("/home") in the customer-facing fallback', () => {
    // Search the specific effect block for the historic string.
    const start = ONBOARDING.indexOf('await resolvePostLogin');
    const end = ONBOARDING.indexOf('return () => { cancelled = true;', start);
    const block = ONBOARDING.slice(start, end);
    expect(block).not.toMatch(/navigate\('\/home'\)/);
  });
});

/**
 * Issue #153 PR-FRES-3 — canonical onClickBecomeProvider helper + CTA drift fixes
 *
 * Audit found 15+ Become Provider CTAs scattered across the app, mixing
 * five route targets (/become-provider, /join/walker, /join/sitter,
 * /join/trainer, /apply-provider, /provider-application 404), three
 * element types (Link, Button onClick, raw <a href> full reload), and
 * ZERO of them set localStorage.signup_intent='provider' before
 * navigation. Provider intent only got set inside SignIn.tsx:220 when
 * the user happened to land there with ?redirect=…provider-onboarding —
 * every other path silently fell back to intent=customer at post-login.
 *
 * After PR-FRES-3:
 *   • client/src/lib/becomeProvider.ts is the ONE source of truth.
 *   • becomeProviderHref(type?) returns the canonical href.
 *   • setProviderSignupIntent() writes localStorage.signup_intent='provider'.
 *   • onClickBecomeProvider(navigate, type?) does both in one call.
 *   • Every CTA across PlatformHub, Layout, SitterSuite, WalkMyPet, their
 *     sub-pages, ProviderDashboard, ProviderApplicationStatus,
 *     MarketplaceTerms, ProviderPending, BrowseSitters, BrowseWalkers,
 *     and ProviderRegistrationBanner is wired through the helper.
 *
 * Source pins are file-string anchors so vitest is fast and stable
 * regardless of unrelated edits.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

// vitest runs under environment=node by default in this repo; stub a minimal
// window + localStorage so the helper's localStorage write path is observable.
function installLocalStorageStub() {
  const store = new Map<string, string>();
  const ls = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
  if (typeof (globalThis as any).window === 'undefined') {
    (globalThis as any).window = { localStorage: ls };
  } else {
    (globalThis as any).window.localStorage = ls;
  }
}

// ── A. BEHAVIOUR TESTS ON THE HELPER ─────────────────────────────────────────

describe('becomeProvider helper behaviour', () => {
  beforeAll(() => { installLocalStorageStub(); });
  beforeEach(() => {
    try { (globalThis as any).window.localStorage.clear(); } catch { /* noop */ }
  });

  it('1. becomeProviderHref() returns the bare canonical path when no type', async () => {
    const { becomeProviderHref } = await import('../lib/becomeProvider');
    expect(becomeProviderHref()).toBe('/become-provider');
    expect(becomeProviderHref(null)).toBe('/become-provider');
    expect(becomeProviderHref(undefined)).toBe('/become-provider');
  });

  it('2. becomeProviderHref(type) appends ?type=… for whitelisted types', async () => {
    const { becomeProviderHref } = await import('../lib/becomeProvider');
    expect(becomeProviderHref('walker')).toBe('/become-provider?type=walker');
    expect(becomeProviderHref('sitter')).toBe('/become-provider?type=sitter');
    expect(becomeProviderHref('trainer')).toBe('/become-provider?type=trainer');
    expect(becomeProviderHref('driver')).toBe('/become-provider?type=driver');
    expect(becomeProviderHref('station_operator')).toBe('/become-provider?type=station_operator');
    expect(becomeProviderHref('pet_trek')).toBe('/become-provider?type=pet_trek');
  });

  it('3. becomeProviderHref drops non-whitelisted types silently', async () => {
    const { becomeProviderHref } = await import('../lib/becomeProvider');
    expect(becomeProviderHref('admin')).toBe('/become-provider');
    expect(becomeProviderHref('"; DROP TABLE users; --')).toBe('/become-provider');
    expect(becomeProviderHref('')).toBe('/become-provider');
  });

  it('4. setProviderSignupIntent writes signup_intent=provider to localStorage', async () => {
    const { setProviderSignupIntent } = await import('../lib/becomeProvider');
    setProviderSignupIntent();
    expect(window.localStorage.getItem('signup_intent')).toBe('provider');
  });

  it('5. setProviderSignupIntent is idempotent', async () => {
    const { setProviderSignupIntent } = await import('../lib/becomeProvider');
    setProviderSignupIntent();
    setProviderSignupIntent();
    setProviderSignupIntent();
    expect(window.localStorage.getItem('signup_intent')).toBe('provider');
  });

  it('6. onClickBecomeProvider sets intent AND navigates to canonical href', async () => {
    const { onClickBecomeProvider } = await import('../lib/becomeProvider');
    let captured = '';
    onClickBecomeProvider((p) => { captured = p; }, 'walker');
    expect(window.localStorage.getItem('signup_intent')).toBe('provider');
    expect(captured).toBe('/become-provider?type=walker');
  });

  it('7. onClickBecomeProvider with no type still sets intent', async () => {
    const { onClickBecomeProvider } = await import('../lib/becomeProvider');
    let captured = '';
    onClickBecomeProvider((p) => { captured = p; });
    expect(window.localStorage.getItem('signup_intent')).toBe('provider');
    expect(captured).toBe('/become-provider');
  });

  it('8. PROVIDER_TYPE_WHITELIST locks the canonical 6-type set', async () => {
    const { PROVIDER_TYPE_WHITELIST } = await import('../lib/becomeProvider');
    expect([...PROVIDER_TYPE_WHITELIST].sort()).toEqual(
      ['driver', 'pet_trek', 'sitter', 'station_operator', 'trainer', 'walker'],
    );
  });
});

// ── B. CALLER-INTEGRATION SOURCE PINS ────────────────────────────────────────

describe('PR-FRES-3 caller-integration source pins', () => {
  it('9. PlatformHub.tsx dead Become Provider button now uses helper', () => {
    const src = read('client/src/pages/PlatformHub.tsx');
    expect(src).toMatch(/from\s*['"]@\/lib\/becomeProvider['"]/);
    // The dead Button now lives inside a Link wrapper with onClick
    const idx = src.indexOf('cta-become-provider');
    expect(idx).toBeGreaterThan(0);
    const window_ = src.slice(Math.max(0, idx - 800), idx + 200);
    expect(window_).toMatch(/<Link\s+href=\{becomeProviderHref\(\)\}\s+onClick=\{setProviderSignupIntent\}/);
  });

  it('10. ProviderDashboard.tsx <a href> full reload converted to Link + helper', () => {
    const src = read('client/src/pages/ProviderDashboard.tsx');
    expect(src).toMatch(/from\s*['"]@\/lib\/becomeProvider['"]/);
    // No more <a href="/become-provider"> full-reload pattern
    expect(src).not.toMatch(/<a\s+href=["']\/become-provider["']/);
    // Link with helper
    expect(src).toMatch(/<Link\s+href=\{becomeProviderHref\(\)\}\s+onClick=\{setProviderSignupIntent\}/);
  });

  it('11. ProviderApplicationStatus.tsx wrong-route /provider-application is gone', () => {
    const src = read('client/src/pages/ProviderApplicationStatus.tsx');
    expect(src).toMatch(/from\s*['"]@\/lib\/becomeProvider['"]/);
    // The legacy 404 target /provider-application must not be re-introduced
    expect(src).not.toMatch(/href=["']\/provider-application["']/);
    expect(src).toMatch(/<Link\s+href=\{becomeProviderHref\(\)\}\s+onClick=\{setProviderSignupIntent\}/);
  });

  it('12. Layout.tsx Join-as-Provider Link uses helper href + onClick', () => {
    const src = read('client/src/components/Layout.tsx');
    expect(src).toMatch(/from\s*['"]@\/lib\/becomeProvider['"]/);
    const idx = src.indexOf('Join as Provider');
    expect(idx).toBeGreaterThan(0);
    const window_ = src.slice(Math.max(0, idx - 600), idx + 200);
    expect(window_).toMatch(/href=\{becomeProviderHref\(\)\}/);
    expect(window_).toMatch(/onClick=\{setProviderSignupIntent\}/);
  });

  it('13. legal/MarketplaceTerms.tsx Join-as-Provider Link uses helper', () => {
    const src = read('client/src/pages/legal/MarketplaceTerms.tsx');
    expect(src).toMatch(/from\s*['"]@\/lib\/becomeProvider['"]/);
    expect(src).toMatch(/<Link\s+href=\{becomeProviderHref\(\)\}\s+onClick=\{setProviderSignupIntent\}/);
  });

  it('14. SitterSuite.tsx all 3 /join/sitter Links carry onClick={setProviderSignupIntent}', () => {
    const src = read('client/src/pages/SitterSuite.tsx');
    expect(src).toMatch(/from\s*['"]@\/lib\/becomeProvider['"]/);
    const matches = src.match(/<Link\s+href="\/join\/sitter"\s+onClick=\{setProviderSignupIntent\}/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
    // No remaining bare-Link pattern
    expect(src).not.toMatch(/<Link\s+href="\/join\/sitter">/);
  });

  it('15. WalkMyPet.tsx all 2 /join/walker Links carry onClick={setProviderSignupIntent}', () => {
    const src = read('client/src/pages/WalkMyPet.tsx');
    expect(src).toMatch(/from\s*['"]@\/lib\/becomeProvider['"]/);
    const matches = src.match(/<Link\s+href="\/join\/walker"\s+onClick=\{setProviderSignupIntent\}/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
    expect(src).not.toMatch(/<Link\s+href="\/join\/walker">/);
  });

  it('16. sitter-suite/Overview.tsx Become-a-Sitter Link uses helper with type=sitter', () => {
    const src = read('client/src/pages/sitter-suite/Overview.tsx');
    expect(src).toMatch(/from\s*['"]@\/lib\/becomeProvider['"]/);
    expect(src).toMatch(/becomeProviderHref\('sitter'\)/);
    expect(src).toMatch(/onClick=\{setProviderSignupIntent\}/);
  });

  it('17. sitter-suite/BrowseSitters.tsx onClick uses onClickBecomeProvider helper', () => {
    const src = read('client/src/pages/sitter-suite/BrowseSitters.tsx');
    expect(src).toMatch(/from\s*['"]@\/lib\/becomeProvider['"]/);
    expect(src).toMatch(/onClickBecomeProvider\(setLocation,\s*['"]sitter['"]\)/);
    // Old bare setLocation('/become-provider') is gone
    expect(src).not.toMatch(/setLocation\(['"]\/become-provider['"]\)/);
  });

  it('18. walk-my-pet/BrowseWalkers.tsx onClick uses onClickBecomeProvider helper', () => {
    const src = read('client/src/pages/walk-my-pet/BrowseWalkers.tsx');
    expect(src).toMatch(/from\s*['"]@\/lib\/becomeProvider['"]/);
    expect(src).toMatch(/onClickBecomeProvider\(setLocation,\s*['"]walker['"]\)/);
    expect(src).not.toMatch(/setLocation\(['"]\/become-provider['"]\)/);
  });

  it('19. ProviderPending.tsx Apply-Now button uses helper (programmatic redirects preserved)', () => {
    const src = read('client/src/pages/ProviderPending.tsx');
    expect(src).toMatch(/from\s*['"]@\/lib\/becomeProvider['"]/);
    // The clickable button uses the helper
    expect(src).toMatch(/onClick=\{\(\)\s*=>\s*onClickBecomeProvider\(setLocation\)\}/);
  });

  it('20. ProviderRegistrationBanner.tsx navigateToOnboarding sets intent before nav', () => {
    const src = read('client/src/components/ProviderRegistrationBanner.tsx');
    expect(src).toMatch(/from\s*['"]@\/lib\/becomeProvider['"]/);
    // Intent is set inside navigateToOnboarding so EVERY caller goes through it
    const idx = src.indexOf('const navigateToOnboarding');
    expect(idx).toBeGreaterThan(0);
    const fnBlock = src.slice(idx, idx + 800);
    expect(fnBlock).toMatch(/setProviderSignupIntent\(\)/);
    // Intent must be set BEFORE setLocation so the call is observable when
    // the next page mounts.
    const intentPos = fnBlock.indexOf('setProviderSignupIntent()');
    const navPos = fnBlock.indexOf('setLocation(route)');
    expect(intentPos).toBeGreaterThan(0);
    expect(navPos).toBeGreaterThan(0);
    expect(intentPos).toBeLessThan(navPos);
  });
});

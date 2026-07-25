/**
 * Two-app flavor sandbox — each native app stays inside its own product.
 *
 * CEO (2026-07-21): "each with his own operation and needs, provider is not
 * loyalty". The canonical two-app spec: Prestige = Home/Book/Shop/Wallet/Account,
 * Provider = Jobs/Calendar/Earnings/Compliance/Account — two truly separate
 * native apps, not one web app twice.
 *
 * Both apps ship one bundle, so every route exists in both. Root routing alone
 * is not separation: a deep link, push tap or stray <Link> could drop the
 * PROVIDER app into the member world (loyalty / shop / eGift / Prestige wallet)
 * or the CUSTOMER app into provider ops. The sandbox effect bounces
 * out-of-flavor paths to that app's home. Web browsers are untouched.
 *
 * Also pinned here:
 *  - the marketing promo popup never renders in a native app;
 *  - the "website under development" notice never renders in a native app
 *    (it is about the WEBSITE — wrong context inside the apps).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..', '..');
const app = readFileSync(resolve(ROOT, 'client/src/App.tsx'), 'utf8');
const layout = readFileSync(resolve(ROOT, 'client/src/components/Layout.tsx'), 'utf8');

describe('flavor sandbox — provider app is not loyalty', () => {
  it('provider app blocks the member/marketing pillars', () => {
    expect(app).toMatch(/PROVIDER_APP_BLOCKED/);
    for (const p of ['/loyalty', '/prestige', '/shop', '/egift', '/my-wallet']) {
      expect(app).toContain(`'${p}'`);
    }
  });

  it('customer app blocks provider ops', () => {
    expect(app).toMatch(/CUSTOMER_APP_BLOCKED/);
    for (const p of ['/provider', '/provider-os', '/provider-compliance']) {
      expect(app).toContain(`'${p}'`);
    }
  });

  it('out-of-flavor paths bounce to that app\'s OWN home', () => {
    expect(app).toMatch(/hits\(PROVIDER_APP_BLOCKED\)[\s\S]{0,80}setLocation\('\/provider\/home'\)/);
    expect(app).toMatch(/hits\(CUSTOMER_APP_BLOCKED\)[\s\S]{0,80}setLocation\('\/prestige\/home'\)/);
  });

  it('the sandbox reacts to the live route (wouter path), not a one-shot check', () => {
    expect(app).toMatch(/\[appPath, isProviderApp, isCustomerApp, loading, setLocation\]/);
  });
});

describe('marketing surfaces stay out of the native apps', () => {
  it('promo popup is gated on !isNativeApp', () => {
    expect(app).toMatch(/showPromoPopup = !isNativeApp/);
  });

  it('the "under development" beta notice is GONE — the site is live (CEO 2026-07-25)', () => {
    // A live business must never label its whole site as unfinished. If a
    // site-wide "under development / in testing" strip ever comes back, this
    // fails on purpose — readiness is gated per-feature, not with a global label.
    expect(layout).not.toMatch(/devNoticeDismissed/);
    expect(layout).not.toMatch(/בפיתוח|under development/i);
  });
});

describe('apps do not look like the website (CEO canonical designs)', () => {
  const header = readFileSync(resolve(ROOT, 'client/src/components/PetWashHeader.tsx'), 'utf8');
  const footer = readFileSync(resolve(ROOT, 'client/src/components/Footer.tsx'), 'utf8');

  it('the website header never renders inside a native app', () => {
    expect(header).toMatch(/if \(appFlavor !== 'web'\) return null;/);
  });

  it('the website footer never renders inside a native app', () => {
    expect(footer).toMatch(/if \(appFlavor !== 'web'\) return null;/);
  });

  it('header guard sits AFTER the hooks (flavor flips web→native post-detection)', () => {
    // The guard must not create a conditional hook order when useAppFlavor
    // resolves asynchronously inside the apps.
    const guardIdx = header.indexOf("if (appFlavor !== 'web') return null;");
    const lastEffectIdx = header.lastIndexOf('useEffect(', guardIdx);
    expect(guardIdx).toBeGreaterThan(lastEffectIdx);
  });
});

describe('leaks caught in the flavor demo (2026-07-22)', () => {
  const appSrc = readFileSync(resolve(ROOT, 'client/src/App.tsx'), 'utf8');
  const signup = readFileSync(resolve(ROOT, 'client/src/pages/SignUpLuxury.tsx'), 'utf8');

  it('the web cookie banner never renders inside a native app', () => {
    expect(appSrc).toMatch(/\{!isNativeApp && \(\s*<CookieConsent/);
  });

  it('the provider app signup carries no loyalty language', () => {
    // Title + helper switch to work-oriented copy for the provider flavor.
    expect(signup).toMatch(/nativeFlavor === 'provider'[\s\S]{0,200}provider account/);
    expect(signup).toMatch(/your PetWash work app/);
  });

  it('the provider app hides the member\/provider intent picker entirely', () => {
    expect(signup).toMatch(/nativeFlavor !== 'provider' && \(\s*<div className="sl-intent">/);
  });

  it('signup uses the canonical useAppFlavor, not a private Capacitor probe', () => {
    expect(signup).toMatch(/useAppFlavor\(\)/);
    expect(signup).not.toMatch(/Capacitor\.isNativePlatform/);
  });
});

describe('build-time flavor must actually work', () => {
  const flavorLib = readFileSync(resolve(ROOT, 'client/src/lib/appFlavor.ts'), 'utf8');

  it('reads the exact import.meta.env token Vite recognises', () => {
    expect(flavorLib).toMatch(/import\.meta\.env\.VITE_APP_FLAVOR/);
    // The optional-chained form is invisible to Vite's env injection AND its
    // build-time define — VITE_APP_FLAVOR was silently never read.
    expect(flavorLib).not.toMatch(/import\.meta as any\)\?\.env/);
    expect(flavorLib).not.toMatch(/import\.meta\?\.env/);
  });

  it('App.tsx flavor seed uses the exact token too', () => {
    expect(appSrc2).toMatch(/import\.meta\.env\.VITE_APP_FLAVOR/);
    expect(appSrc2).not.toMatch(/import\.meta as any\)\?\.env/);
  });
});

const appSrc2 = readFileSync(resolve(ROOT, 'client/src/App.tsx'), 'utf8');

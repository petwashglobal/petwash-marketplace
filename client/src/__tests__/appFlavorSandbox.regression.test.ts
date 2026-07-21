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

  it('the website dev notice renders only on the web flavor', () => {
    expect(layout).toMatch(/appFlavor === 'web' && !devNoticeDismissed/);
  });
});

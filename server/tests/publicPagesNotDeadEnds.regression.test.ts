/**
 * Live mobile sweep 2026-09-18 (anonymous, iPhone 13, he-IL):
 *  - the footer's "תנאי שימוש" opened an English page with NO header and NO
 *    footer — the only way out was the browser's back button — while the same
 *    document sits in Hebrew, inside the layout, at /legal/terms (the link the
 *    menu uses)
 *  - the same dead-end shape on the disclaimer, trademarks, cancellation and
 *    station-terms pages
 *  - the homepage sold a ₪55 single wash under a picture reading "Gift Card
 *    Value: 100 Shekel", and a ₪150 three-wash under "250 Shekel"
 *  - /contact printed the support number as plain text: a phone visitor could
 *    not call it
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const app = read('client/src/App.tsx');

describe('a legal page is never a dead end', () => {
  for (const path of [
    '/legal/terms',
    '/legal/customer-terms',
    '/legal/disclaimer',
    '/legal/trademarks',
    '/legal/cancellation-refund-policy',
    '/legal/marketplace-terms',
    '/legal/station-use-terms',
    '/legal/cookies',
    '/legal/privacy',
  ]) {
    it(`${path} renders inside the site layout`, () => {
      const at = app.indexOf(`<Route path="${path}">`);
      expect(at, `${path} has no route`).toBeGreaterThan(0);
      expect(app.slice(at, at + 260)).toContain('<Layout>');
    });
  }
});

describe('the footer points at the pages a customer can read', () => {
  it('terms goes to the Hebrew, in-layout document the menu uses', () => {
    const footer = read('client/src/components/Footer.tsx');
    expect(footer).toContain('<Link href="/legal/terms"');
    expect(footer).not.toContain('<Link href="/terms"');
  });
});

describe('the homepage never sells a wash package with gift-card artwork', () => {
  const home = read('client/src/components/WashPackages.tsx');

  it('the gift-card images are gone', () => {
    expect(home).not.toContain('IMG_3094_1770832584882');
    expect(home).not.toContain('IMG_3091_1770832584882');
    expect(home).not.toContain('pinkCardFront');
  });

  it('a wash count without its own art gets a branded panel', () => {
    expect(home).toContain('data-testid={`home-package-panel-${pkg.washCount}`}');
    expect(home).not.toMatch(/\|\| pinkCardFront/);
  });
});

describe('support is reachable from a phone', () => {
  it('the number on /contact is a tel: link', () => {
    const contact = read('client/src/pages/Contact.tsx');
    expect(contact).toContain('href="tel:+972549833355"');
    expect(contact).toContain('data-testid="contact-phone-link"');
  });
});

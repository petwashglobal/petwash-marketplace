import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { sumitPageLanguage, paymentLanguageFor } from '../lib/paymentPageLanguage';

/**
 * 2026-09-17 (CEO: "what if not an Israeli credit card?"). Upay accepts
 * foreign cards (4.2% fee), but every SUMIT hosted page was opened with
 * Language: 'Hebrew' — a tourist got a Hebrew-only card form. The page now
 * opens in the customer's language (SUMIT supports Hebrew/English/Arabic/Spanish).
 */
const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('sumitPageLanguage', () => {
  it('maps to SUMIT enum names; Russian/French/unknown read English; empty stays Hebrew', () => {
    expect(sumitPageLanguage('he')).toBe('Hebrew');
    expect(sumitPageLanguage('iw')).toBe('Hebrew');
    expect(sumitPageLanguage('')).toBe('Hebrew');
    expect(sumitPageLanguage(undefined)).toBe('Hebrew');
    expect(sumitPageLanguage('en')).toBe('English');
    expect(sumitPageLanguage('en-GB')).toBe('English');
    expect(sumitPageLanguage('ar')).toBe('Arabic');
    expect(sumitPageLanguage('es')).toBe('Spanish');
    expect(sumitPageLanguage('ru')).toBe('English');
    expect(sumitPageLanguage('fr')).toBe('English');
    expect(sumitPageLanguage('de')).toBe('English');
  });
});

describe('paymentLanguageFor', () => {
  const req = (body: any, accept?: string) => ({ body, headers: accept ? { 'accept-language': accept } : {} }) as any;
  it('site language wins, then profile, then browser, then Hebrew', () => {
    expect(paymentLanguageFor(req({ language: 'ru' }, 'he-IL'), 'he')).toBe('ru');
    expect(paymentLanguageFor(req({}, 'he-IL'), 'en')).toBe('en');
    expect(paymentLanguageFor(req({}, 'fr-FR,fr;q=0.9'))).toBe('fr');
    expect(paymentLanguageFor(req({}))).toBe('he');
  });
  it('ignores junk in the body', () => {
    expect(paymentLanguageFor(req({ language: '<script>' }, 'en-US'))).toBe('en');
    expect(paymentLanguageFor(req({ language: 42 }))).toBe('he');
  });
});

describe('every hosted-page caller passes a language', () => {
  it('beginRedirect no longer hard-codes Hebrew', () => {
    const c = R('server/services/SumitClient.ts');
    const br = c.slice(c.indexOf('async beginRedirect('), c.indexOf('async beginRedirect(') + 4000);
    expect(br).toContain('Language: sumitPageLanguage(input.language),');
    expect(br).not.toContain("Language: 'Hebrew',");
  });
  it.each([
    ['server/services/SumitBookingPayment.ts', 'language: input.language,'],
    ['server/routes/booking-requests.ts', 'language: paymentLanguageFor(req, ownerUser?.language),'],
    ['server/routes/payments-sumit.ts', 'language: paymentLanguageFor(req),'],
    ['server/routes/egift-guest.ts', 'language: paymentLanguageFor(req),'],
    ['server/routes/save-card.ts', 'language: paymentLanguageFor(req),'],
    ['server/routes/shop.ts', 'language: body.language,'],
  ])('%s', (file, needle) => {
    expect(R(file)).toContain(needle);
  });
  it('the client sends the site language on every payment start', () => {
    expect(R('client/src/pages/BookingConfirmation.tsx')).toContain("language: document.documentElement.lang || 'he'");
    expect(R('client/src/pages/MyWallet.tsx')).toContain("'/api/payments/save-card/start', { language: document.documentElement.lang || 'he' }");
    expect(R('client/src/lib/sumitCheckout.ts').match(/language: pageLanguage\(\),/g)?.length).toBe(3);
  });
});

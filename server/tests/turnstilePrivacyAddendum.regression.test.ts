/**
 * Cloudflare requires the Turnstile Privacy Addendum to be referenced in our
 * own privacy policy as a CONDITION of enabling invisible mode.
 *
 * The PetWash widget was switched Managed -> Invisible on 2026-09-06 so that
 * `turnstile.render(..., { size: 'invisible' })` in TurnstileWidget.tsx works
 * at all. That switch is what creates the obligation — it is not a preference,
 * and I initially filed it as an optional legal opinion. It is not.
 *
 * This pin exists because the obligation is invisible in the code: nothing
 * breaks if the link is removed, so nothing would ever catch it.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const PRIVACY = readFileSync(join(ROOT, 'client/src/pages/PrivacyPolicy.tsx'), 'utf8');
const WIDGET = readFileSync(join(ROOT, 'client/src/components/TurnstileWidget.tsx'), 'utf8');

describe('invisible Turnstile obliges a Privacy Addendum reference', () => {
  it('the code really does use invisible mode — the premise of the obligation', () => {
    expect(WIDGET).toMatch(/size:\s*'invisible'/);
  });

  it('the privacy policy links the Cloudflare Turnstile Privacy Addendum', () => {
    expect(PRIVACY).toContain(
      'https://www.cloudflare.com/application-services/terms/turnstile-privacy-addendum/',
    );
  });

  it('the reference appears in BOTH languages — the page is bilingual', () => {
    const count = PRIVACY.split('turnstile-privacy-addendum').length - 1;
    expect(count, 'expected the addendum link in the Hebrew and English sections').toBeGreaterThanOrEqual(2);
  });

  it('names Cloudflare Turnstile in prose, not just as a table row', () => {
    // A vendor row satisfies a GDPR processor list; it does not satisfy
    // "reference the Addendum".
    expect(PRIVACY).toMatch(/Cloudflare Turnstile<\/strong>/);
  });

  it('the Hebrew reference is actually Hebrew', () => {
    expect(PRIVACY).toContain('נספח הפרטיות של Cloudflare Turnstile');
  });

  it('opens externally without leaking referrer context', () => {
    const at = PRIVACY.indexOf('turnstile-privacy-addendum');
    const around = PRIVACY.slice(at - 200, at + 300);
    expect(around).toContain('rel="noopener noreferrer"');
  });

  it('Cloudflare is disclosed as a service provider in the English list too', () => {
    // It was only in the Hebrew table before this change.
    expect(PRIVACY).toMatch(/Service Providers:.*Cloudflare/s);
  });
});

/**
 * Pure unit tests for the "please confirm end of stay" email template
 * (server/email/templates/confirm-end-of-stay-2026.ts).
 *
 * Contract locked by these tests:
 *   1. The deep-link CTA (/booking/confirmation/:ref) is present exactly
 *      once as an href — that link is the entire point of the email.
 *   2. HE (default) and EN both render the provider name + booking ref
 *      inside the visible body.
 *   3. The email is bilingual-aware — RTL for HE, LTR for EN.
 *   4. No unsubscribe link (transactional email).
 *   5. Auto-approve fallback wording is present so the owner understands
 *      what happens if they ignore this.
 */

import { describe, it, expect } from 'vitest';
import { buildConfirmEndOfStayEmail } from '../email/templates/confirm-end-of-stay-2026';

const baseParams = {
  bookingRef: 'BOOK-abc-123',
  firstName: 'Nir',
  providerName: 'KELING',
  serviceLabelHe: 'שמרטפות',
  serviceLabelEn: 'Pet Sitting',
  petName: 'Miso',
  endDateHe: '18 באוגוסט 2026',
  endDateEn: '18 Aug 2026',
  confirmUrl: 'https://petwash.co.il/booking/confirmation/BOOK-abc-123',
};

describe('buildConfirmEndOfStayEmail — HE (default) render', () => {
  const html = buildConfirmEndOfStayEmail(baseParams);

  it('renders exactly one confirm-CTA href pointing at /booking/confirmation/:ref', () => {
    const hrefs = html.match(/href="https:\/\/petwash\.co\.il\/booking\/confirmation\/BOOK-abc-123"/g) || [];
    expect(hrefs.length).toBe(1);
  });

  it('is RTL for the HE render', () => {
    expect(html).toMatch(/dir="rtl"/);
  });

  it('shows the provider name in the headline', () => {
    expect(html).toContain('KELING');
  });

  it('shows the booking ref in monospace', () => {
    expect(html).toMatch(/BOOK-abc-123/);
    expect(html).toMatch(/font-family:'Courier New',monospace/);
  });

  it('surfaces the 24h auto-approve fallback so the owner is not surprised', () => {
    expect(html).toContain('24 שעות');
  });

  it('renders the pet name when provided', () => {
    expect(html).toContain('Miso');
  });

  it('does NOT include an unsubscribe link (this is a transactional email)', () => {
    expect(html).not.toMatch(/unsubscribe/i);
    expect(html).not.toContain('הסרה מרשימת תפוצה');
  });

  it('carries the Rover/MadPaws-parity "right?" headline', () => {
    expect(html).toContain('הסתיימה — נכון?');
  });
});

describe('buildConfirmEndOfStayEmail — EN render', () => {
  const html = buildConfirmEndOfStayEmail({ ...baseParams, language: 'en' });

  it('is LTR for the EN render', () => {
    expect(html).toMatch(/dir="ltr"/);
  });

  it('carries the Rover/MadPaws-parity headline in English', () => {
    expect(html).toContain('is complete — right?');
  });

  it('CTA label reads "Confirm end of service"', () => {
    expect(html).toContain('Confirm end of service');
  });

  it('shows the auto-approve fallback in English', () => {
    expect(html).toMatch(/24 hours/);
  });
});

describe('buildConfirmEndOfStayEmail — defensive render (missing optionals)', () => {
  it('omits the pet-name row when petName is undefined', () => {
    const html = buildConfirmEndOfStayEmail({ ...baseParams, petName: undefined });
    expect(html).not.toContain('Miso');
    // The label row wrapper shouldn't render either
    expect(html).not.toContain('חיית המחמד:');
  });

  it('still renders when firstName is empty', () => {
    const html = buildConfirmEndOfStayEmail({ ...baseParams, firstName: '' });
    // HE default falls back to "הורה יקר" when firstName is empty
    expect(html).toContain('הורה יקר');
  });
});

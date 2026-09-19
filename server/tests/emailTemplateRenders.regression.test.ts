import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildBookingConfirmationEmail, formatDuration } from '../email/templates/booking-confirmation-2026';

/**
 * CEO, 2026-09-19, looking at the rendered booking email: "you have design
 * skills fix templates lokm how bad on left".
 *
 * Four separate defects were visible in that one screenshot:
 *
 *  1. RTL ALIGNMENT — label and value were BOTH aligned to the start edge, so
 *     every value floated mid-row and the whole opposite margin was ragged. A
 *     details row reads as a document only when the label sits on the start
 *     edge and the value on the end edge.
 *  2. HEBREW — the pet row was labelled "חיית", a construct form ("animal
 *     of…") with nothing after it. Correct is "חיית מחמד".
 *  3. THE LOGO BOX — the white-wordmark asset ships with an OPAQUE BLACK matte,
 *     so on any header that is not exactly #000000 it renders as a black
 *     rectangle pasted on the design.
 *  4. OUTLOOK — the header and the primary button were linear-gradients.
 *     Outlook paints no background at all for those, which left gold-on-white
 *     text and an invisible button in the client most likely to open a
 *     business email.
 */
const ROOT = path.resolve(__dirname, '..', '..');
const tpl = fs.readFileSync(
  path.join(ROOT, 'server', 'email', 'templates', 'booking-confirmation-2026.ts'), 'utf8',
);

const sample = {
  recipientType: 'customer' as const, language: 'he' as const,
  bookingRef: 'PW-2026-084512', customerName: 'ניר חדד', providerName: 'מיכל ברששת',
  serviceName: 'pet_sitting' as const, serviceLabel: 'פט־סיטר',
  petName: 'Kenzo', dateFormatted: 'יום ראשון', timeFormatted: '09:00',
  locationName: 'רמת גן', durationMinutes: 2880,
  priceFormatted: '₪480.00', loyaltyPointsEarned: 48,
  dashboardUrl: 'https://petwash.co.il/my-bookings',
};

describe('the booking email renders as a finished document', () => {
  const html = buildBookingConfirmationEmail(sample as any);

  it('label and value sit on OPPOSITE edges, so neither margin is ragged', () => {
    expect(tpl).toContain("const valueAlign = isHe ? 'left' : 'right';");
    // in Hebrew: labels right, values left
    expect(html).toMatch(/color:#888;[^"]*text-align:right/);
    expect(html).toMatch(/color:#1a1a1a;[^"]*text-align:left/);
  });

  it('the pet label is a complete Hebrew phrase', () => {
    expect(html).toContain('חיית מחמד');
    expect(html).not.toMatch(/>חיית</);
  });

  it('a multi-day stay reads in days, not raw minutes', () => {
    expect(formatDuration(2880, true)).toBe('2 ימים');
    expect(html).not.toContain('2880');
  });

  it('the logo is the transparent asset, so no box appears on the header', () => {
    expect(html).toContain('petwash-logo-on-dark.png');
    expect(html).not.toContain('petwash-logo-black-bg.png');
    expect(html).not.toContain('petwash-logo-official.png');
  });

  it('header and button survive Outlook — no gradient carries a background', () => {
    const header = html.slice(html.indexOf('<!-- HEADER -->'), html.indexOf('<!-- SERVICE BADGE -->'));
    // The header's own surface must be a flat colour. A 2px decorative hairline
    // may still use a gradient — if Outlook drops that, one accent line is lost
    // and nothing becomes unreadable.
    expect(header).toContain('background:#0a0a0a');
    const surface = header.slice(0, header.indexOf('<img'));
    expect(surface).not.toContain('linear-gradient');
    const cta = html.slice(html.indexOf('<!-- CTA BUTTON -->'));
    expect(cta.slice(0, 400)).not.toContain('linear-gradient');
  });

  it('no display:flex — email clients ignore it and the row collapses', () => {
    expect(html).not.toContain('display:flex');
  });

  it('the markup is balanced', () => {
    expect(html.split('<div').length).toBe(html.split('</div>').length);
    expect(html.split('<table').length).toBe(html.split('</table>').length);
  });
});

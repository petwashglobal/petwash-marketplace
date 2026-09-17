import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * "SAYS LIVE, NOT TRUE" (CEO 2026-09-17).
 *
 * The control tower headed itself "נתונים חיים" and showed "עמדות (Nayax) ₪0"
 * every day. The bays DO sell — their invoices are issued through SUMIT by the
 * bay bridge — but those sales have never reached nayax_transaction_events, so
 * the ₪0 meant "not connected", not "nothing sold". A source that has never
 * recorded a sale now shows a status in words, and the page says plainly that
 * station sales are not in the totals.
 */
const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('the overview reports whether each source has ever recorded a sale', () => {
  const src = R('server/routes/admin-octopus.ts');
  it('returns feeds for all five sources, from the same tables the totals read', () => {
    expect(src).toContain("const feeds = await block('feeds'");
    expect(src).toContain('return { kiosk, sumit, shop, booking, egiftGuest };');
    expect(src).toMatch(/FROM nayax_transaction_events\s+WHERE approval_status = 'approved' AND event_type = 'transaction'`\)/);
    expect(src).toMatch(/FROM purchases\s+WHERE status IN \('paid','activated'\)`\)/);
    expect(src).toMatch(/FROM egift_guest_orders\s+WHERE status = 'issued'`\)/);
    expect(src).toContain('sales, feeds, stations,');
  });
});

describe('the page never shows a bare ₪0 for a source that is not connected', () => {
  const page = R('client/src/pages/AdminOctopus.tsx');
  it('no longer claims "live data"', () => {
    expect(page).not.toContain('נתונים חיים');
    expect(page).toContain('מתעדכן כל דקה');
  });
  it('station sales read "not connected" and are called out as missing from the totals', () => {
    expect(page).toContain("{ feed: 'kiosk', label: 'עמדות (Nayax)', short: 'עמדות', cents: (p) => p.kioskCents, never: 'לא מחובר' }");
    expect(page).toContain('data-testid="octopus-kiosk-not-connected"');
    expect(page).toContain("'מקורות מחוברים בלבד'");
  });
  it('every sales cell goes through hasFeed before printing an amount', () => {
    expect(page).toContain("hasFeed(feeds, src.feed) ? nis(src.cents(p))");
    expect(page).not.toMatch(/nis\(s\.today\.kioskCents\)|nis\(p\.kioskCents\)/);
  });
  it('an unreadable feeds block falls back to the amounts, never hides them', () => {
    expect(page).toContain('const hasFeed = (feeds: Overview[\'feeds\'], k: FeedKey) => !feeds ||');
  });
});

/**
 * REGRESSION PIN — customer and provider must AGREE on booking status.
 *
 * My Bookings aggregates five rails. Two disagreements made real bookings
 * either invisible or permanently mislabelled:
 *
 * 1. MARKETPLACE (`bookings` table). Its state machine is
 *    BOOKING_STATUS_TRANSITIONS (shared/schema.ts) and
 *    BookingLifecycleService.createBooking() opens every booking at 'inquiry'.
 *    NONE of inquiry / quote_sent / quote_expired / deposit_pending /
 *    deposit_received / owner_confirmed / provider_confirmed /
 *    owner_completion_review / provider_completion_review / refunded were in
 *    STATUS_TO_TAB. An unmapped status matches no tab and is skipped by the
 *    badge counts, so the booking was invisible in EVERY tab — from creation,
 *    through the customer paying a deposit, through both parties confirming.
 *
 * 2. ACADEMY (`trainer_bookings`). The column is `booking_status` -> Drizzle
 *    property `bookingStatus`, and GET /api/academy/bookings res.json's the raw
 *    row. academyFromRow read `row.status`, which is never present, so every
 *    training booking rendered as "Pending" forever — a cancelled one sat in
 *    the Pending tab still offering a Cancel button.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const page = readFileSync(resolve(__dirname, 'CustomerBookings.tsx'), 'utf8');
const schema = readFileSync(
  resolve(__dirname, '..', '..', '..', 'shared', 'schema.ts'),
  'utf8',
);

/** Keys of STATUS_TO_TAB in CustomerBookings.tsx. */
function mappedStatuses(): Set<string> {
  const start = page.indexOf('const STATUS_TO_TAB');
  expect(start).toBeGreaterThan(-1);
  const body = page.slice(start, page.indexOf('\n};', start));
  return new Set(
    [...body.matchAll(/^\s*([a-z_]+):\s*'(pending|upcoming|past|archived)'/gm)].map((m) => m[1]),
  );
}

/** Keys of BOOKING_STATUS_TRANSITIONS in shared/schema.ts. */
function marketplaceStatuses(): string[] {
  const start = schema.indexOf('export const BOOKING_STATUS_TRANSITIONS');
  expect(start).toBeGreaterThan(-1);
  const body = schema.slice(start, schema.indexOf('\n};', start));
  return [...body.matchAll(/^\s*([a-z_]+):\s*\[/gm)].map((m) => m[1]);
}

describe('status agreement — marketplace rail', () => {
  it('every BOOKING_STATUS_TRANSITIONS status is mapped to a tab', () => {
    const mapped = mappedStatuses();
    const all = marketplaceStatuses();
    expect(all.length).toBeGreaterThan(10); // sanity: we really parsed the machine
    expect(all.filter((s) => !mapped.has(s))).toEqual([]);
  });

  it("maps the bookings.status column default ('draft') too", () => {
    expect(mappedStatuses().has('draft')).toBe(true);
  });

  it('keeps paid / confirmed states in an ACTIVE tab, never archived or dropped', () => {
    for (const s of ['deposit_received', 'owner_confirmed', 'provider_confirmed']) {
      expect(page).toMatch(new RegExp(`^\\s*${s}:\\s*'upcoming'`, 'm'));
    }
  });
});

describe('status agreement — unmapped statuses cannot vanish', () => {
  it('routes tab resolution through a total function with a visible fallback', () => {
    expect(page).toMatch(/function tabForStatus\(status: string\): TabId \{[\s\S]*?\?\? 'pending';/);
  });

  it('no consumer indexes STATUS_TO_TAB directly any more', () => {
    // strip comments so the prose describing the old bug isn't matched as code
    const code = page
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toMatch(/STATUS_TO_TAB\[[^\]]+\]\s*===/);
    expect(code).not.toMatch(/const tab = STATUS_TO_TAB\[/);
  });
});

describe('status agreement — academy rail', () => {
  it('reads the bookingStatus field the API actually returns', () => {
    expect(page).toMatch(/status: row\.bookingStatus \?\? row\.status \?\? 'pending'/);
  });

  it('declares bookingStatus on AcademyRow', () => {
    const start = page.indexOf('type AcademyRow');
    expect(start).toBeGreaterThan(-1);
    expect(page.slice(start, page.indexOf('};', start))).toMatch(/bookingStatus\?: string;/);
  });
});

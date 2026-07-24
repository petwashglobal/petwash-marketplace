/**
 * The date filter was DECORATIVE (CEO 2026-07-24 audit finding #4).
 * getConflictedProviderIds queried only `bookings`, keyed by providers.id,
 * on a lowercase platformId, with a status list the writer never used — three
 * independent reasons it could never match, so availableForRequestedDates was
 * permanently true: a fully-booked provider still showed as available.
 *
 * Now it checks booking_requests (where every real booking lands, incl. the
 * legacy bridge) AND bookings, both keyed by the provider's Firebase UID.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const s = readFileSync(resolve(__dirname, '..', '..', 'server/services/providerSearchService.ts'), 'utf8');

describe('availability is real', () => {
  it('checks booking_requests — the canonical table every booking reaches', () => {
    expect(s).toMatch(/\.from\(bookingRequests\)/);
    expect(s).toMatch(/REQUEST_BLOCKING_STATUSES/);
    // declined/cancelled/completed must NOT block a new booking
    const block = s.slice(s.indexOf('const REQUEST_BLOCKING_STATUSES'), s.indexOf('] as const;', s.indexOf('const REQUEST_BLOCKING_STATUSES')));
    expect(block).toContain('"pending"');
    expect(block).toContain('"confirmed"');
    expect(block).not.toContain('"declined"');
    expect(block).not.toContain('"cancelled"');
    expect(block).not.toContain('"completed"');
  });

  it('still checks marketplace-checkout rows, incl. the status they actually use', () => {
    expect(s).toMatch(/"inquiry",/);
  });

  it('is keyed by provider UID end to end (query args AND the consumer check)', () => {
    expect(s).toMatch(/providerUids: string\[\]/);
    expect(s).toMatch(/rows\.map\(\(r\) => String\(r\.userId \?\? ""\)\)/);
    expect(s).toMatch(/availableForRequestedDates: !conflictSet\.has\(providerUid\)/);
    expect(s).not.toMatch(/availableForRequestedDates: !conflictSet\.has\(providerIdStr\)/);
  });

  it('no longer filters on a lowercase platformId that never matched', () => {
    expect(s).not.toMatch(/eq\(bookings\.platformId, platformId\)/);
  });
});

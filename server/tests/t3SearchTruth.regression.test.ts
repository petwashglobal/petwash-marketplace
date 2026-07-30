/**
 * Tranche 3 — search truthfulness (marketplace 360 audit 2026-07-30).
 *
 * Locked invariants (all pins match CALL SITES, never comments):
 *
 *   A. Groomer PII: marketplace searchGroomers must NOT serialise the
 *      trainer's raw email/phone — walker/sitter rows already null them.
 *   B. Groomers dead-end: searchGroomers rows carry the provider's Firebase
 *      userId, and GET /provider/:platform/:id has a 'groomers' case
 *      resolving the same trainers table (by numeric id, trainerId or uid).
 *   C. Availability truth: getBusyProviderIds (booking-search) queries
 *      booking_requests with the blocking statuses — an accepted/confirmed
 *      request must make the provider busy, not just a `bookings` row.
 *   D. Browse mapper: toLegacyBrowseProvider maps item.userId through so
 *      browse pages deep-link the RIGHT provider (uid, not providers.id).
 *   E. Self-exclusion: /api/providers/search passes the caller's uid to
 *      runProviderSearch so a provider is never matched to themselves.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

// Strip block comments and full-line // comments so a comment can never
// satisfy a code pin.
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const marketplaceSrc = read('server/routes/marketplace.ts');
const marketplaceCode = stripComments(marketplaceSrc);
const bookingSearchCode = stripComments(read('server/routes/booking-search.ts'));
const providerSearchRouteCode = stripComments(read('server/routes/provider-search.ts'));
const providerSearchApiCode = stripComments(read('client/src/api/providerSearchApi.ts'));
const bookingSearchTsxCode = stripComments(read('client/src/components/booking/BookingSearch.tsx'));
const browseWalkersCode = stripComments(read('client/src/pages/walk-my-pet/BrowseWalkers.tsx'));

/** Slice a source between a start marker and the next marker (or EOF). */
function slice(src: string, startMarker: string, endMarker?: string): string {
  const start = src.indexOf(startMarker);
  expect(start, `marker not found: ${startMarker}`).toBeGreaterThan(-1);
  const end = endMarker ? src.indexOf(endMarker, start + startMarker.length) : -1;
  return end > -1 ? src.slice(start, end) : src.slice(start);
}

// ── A. Groomer PII nulled ────────────────────────────────────────────────

describe('T3-A — groomer search rows leak no PII', () => {
  const groomerFn = slice(
    marketplaceCode,
    'async function searchGroomers',
    "router.get('/provider/:platform/:id'",
  );

  it('1. email is nulled, never trainer.email', () => {
    expect(groomerFn).toMatch(/email:\s*null/);
    expect(groomerFn).not.toMatch(/email:\s*trainer\.email/);
  });

  it('2. phone is nulled, never trainer.phone', () => {
    expect(groomerFn).toMatch(/phone:\s*null/);
    expect(groomerFn).not.toMatch(/phone:\s*trainer\.phone/);
  });

  it('3. rows carry the Firebase userId (deep-link + ranking key)', () => {
    expect(groomerFn).toMatch(/userId:\s*trainer\.userId/);
  });
});

// ── B. Groomers provider-detail case ─────────────────────────────────────

describe('T3-B — provider detail resolves groomers', () => {
  const detailRoute = slice(marketplaceCode, "router.get('/provider/:platform/:id'");

  it('4. switch has a groomers case', () => {
    expect(detailRoute).toMatch(/case\s*'groomers'\s*:/);
  });

  it('5. groomers case reads the trainers table by id, trainerId or userId', () => {
    const groomersCase = slice(detailRoute, "case 'groomers'", 'default:');
    expect(groomersCase).toMatch(/\.from\(trainers\)/);
    expect(groomersCase).toMatch(/eq\(trainers\.trainerId,\s*id\)/);
    expect(groomersCase).toMatch(/eq\(trainers\.userId,\s*id\)/);
    expect(groomersCase).toMatch(/eq\(trainers\.id,\s*numericId\)/);
  });

  it('6. groomers detail nulls PII and returns userId like the other cases', () => {
    const groomersCase = slice(detailRoute, "case 'groomers'", 'default:');
    expect(groomersCase).toMatch(/email:\s*null/);
    expect(groomersCase).toMatch(/phone:\s*null/);
    expect(groomersCase).toMatch(/userId:\s*trainer\.userId/);
  });
});

// ── C. booking-search availability includes booking_requests ─────────────

describe('T3-C — getBusyProviderIds sees booking_requests', () => {
  const busyFn = slice(
    bookingSearchCode,
    'async function getBusyProviderIds',
    'function validateSearchDates',
  );

  it('7. queries the bookingRequests table inside getBusyProviderIds', () => {
    expect(busyFn).toMatch(/\.from\(bookingRequests\)/);
  });

  it('8. blocks on the live request statuses, with date overlap', () => {
    for (const status of [
      'pending',
      'accepted',
      'meet_greet_scheduled',
      'meet_greet_completed',
      'payment_pending',
      'confirmed',
      'in_progress',
    ]) {
      expect(busyFn).toContain(`'${status}'`);
    }
    expect(busyFn).toMatch(/bookingRequests\.startDate/);
    expect(busyFn).toMatch(/bookingRequests\.endDate/);
  });

  it('9. request providerIds are added to the busy set', () => {
    expect(busyFn).toMatch(/busyFromRequests\.forEach/);
    expect(busyFn).toMatch(/busyIds\.add\(r\.providerId\)/);
  });

  it('10. trainer exclusions cover BOTH id spaces (trainerId + Firebase uid)', () => {
    // busy set is keyed by uid for booking_requests rows; trainers were only
    // excluded by trainerId, so the new busy entries need a userId exclusion.
    const matches = bookingSearchCode.match(/\$\{trainers\.userId\}\s+NOT IN/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2); // searchGroomers + searchTrainers
  });
});

// ── D. Browse mapper keeps userId ────────────────────────────────────────

describe('T3-D — toLegacyBrowseProvider maps userId', () => {
  it('11. the mapper passes item.userId through', () => {
    const mapper = slice(
      providerSearchApiCode,
      'function toLegacyBrowseProvider',
      'export async function fetchProviderBrowseResults',
    );
    expect(mapper).toMatch(/userId:\s*item\.userId/);
  });

  it('12. BrowseWalkers routes through the marketplace detail path by uid', () => {
    expect(browseWalkersCode).toMatch(
      /\/marketplace\/walk_my_pet\/\$\{walker\.userId \|\| walker\.id\}/,
    );
    expect(browseWalkersCode).not.toMatch(/\/walk-my-pet\/walkers\/\$\{walker\.id\}/);
  });

  it('13. BookingSearch cards no longer hit the dead /provider/:id route', () => {
    expect(bookingSearchTsxCode).not.toMatch(/\/provider\/\$\{provider\.id\}/);
    expect(bookingSearchTsxCode).toMatch(
      /\/marketplace\/\$\{platformSlug\}\/\$\{provider\.userId \|\| provider\.id\}/,
    );
  });
});

// ── E. Self-exclusion actually wired ─────────────────────────────────────

describe('T3-E — /api/providers/search passes the caller uid', () => {
  it('14. runProviderSearch receives callerUserId at the route call site', () => {
    expect(providerSearchRouteCode).toMatch(
      /runProviderSearch\(filters,\s*callerUserId\)/,
    );
    expect(providerSearchRouteCode).toMatch(/user\?\.uid/);
  });
});

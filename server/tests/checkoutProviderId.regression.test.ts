/**
 * Marketplace checkout bookings were INVISIBLE to providers forever
 * (CEO 2026-07-24). BookingLifecycleService wrote the numeric provider-PROFILE
 * id into bookings.provider_id, while every reader — the provider job inbox,
 * marketplace-ranking, and the service's own getBookingsForUser — queries that
 * column by the provider's Firebase UID. Money-taking checkouts created
 * bookings no provider could ever see.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');
const svc = R('server/services/BookingLifecycleService.ts');
const v2 = R('server/routes/provider-dashboard-v2.ts');

describe('checkout writes the provider UID', () => {
  it('bookings.provider_id gets the uid, not the profile id', () => {
    expect(svc).toContain('providerId: input.providerId,');
    expect(svc).not.toMatch(/providerId: input\.providerProfileId,/);
  });

  it('the profile id is preserved, not lost', () => {
    expect(svc).toMatch(/platformData: \{ providerProfileId: input\.providerProfileId \?\? null \}/);
  });

  it('uid semantics are consistent with the self-booking guard', () => {
    expect(svc).toMatch(/input\.customerId === input\.providerId/);
  });
});

describe('provider inbox also sees already-written legacy rows', () => {
  it('matches uid OR a profile id belonging to that uid', () => {
    expect(v2).toMatch(/SELECT p\.id::text FROM providers p WHERE p\.user_id = \$1/);
  });
});

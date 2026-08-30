/**
 * FavouriteScopingService — Program 30.
 *
 * Doctrine: Maya walking favourite may NOT mean Maya daycare
 * favourite.
 */
import { describe, it, expect } from 'vitest';
import {
  isFavourite,
  suggestScope,
  addFavourite,
  removeFavourite,
} from '../services/marketplace/FavouriteScopingService';

describe('FavouriteScopingService', () => {
  it('PROVIDER-scope favourite covers any service query', () => {
    const favs = { entries: [{ providerId: 'maya', scope: 'PROVIDER' as const }] };
    expect(isFavourite(favs, 'maya')).toBe(true);
    expect(isFavourite(favs, 'maya', 'DOG_WALK')).toBe(true);
    expect(isFavourite(favs, 'maya', 'DAYCARE')).toBe(true);
  });

  it('PROVIDER_AND_SERVICE — Maya-walking does NOT imply Maya-daycare (§ Program 30)', () => {
    const favs = { entries: [{ providerId: 'maya', scope: 'PROVIDER_AND_SERVICE' as const, serviceCode: 'DOG_WALK' }] };
    expect(isFavourite(favs, 'maya', 'DOG_WALK')).toBe(true);
    expect(isFavourite(favs, 'maya', 'DAYCARE')).toBe(false);
  });

  it('suggestScope: profile → PROVIDER; service card / booking / AI rec → PROVIDER_AND_SERVICE', () => {
    expect(suggestScope('PROVIDER_PROFILE')).toBe('PROVIDER');
    expect(suggestScope('SERVICE_CARD')).toBe('PROVIDER_AND_SERVICE');
    expect(suggestScope('BOOKING_CONFIRMATION')).toBe('PROVIDER_AND_SERVICE');
    expect(suggestScope('AI_RECOMMENDATION')).toBe('PROVIDER_AND_SERVICE');
  });

  it('addFavourite is idempotent (same entry twice → one row)', () => {
    let favs = { entries: [] as any[] };
    favs = addFavourite(favs, { providerId: 'maya', scope: 'PROVIDER' });
    favs = addFavourite(favs, { providerId: 'maya', scope: 'PROVIDER' });
    expect(favs.entries).toHaveLength(1);
  });

  it('addFavourite refuses PROVIDER_AND_SERVICE without a serviceCode', () => {
    const favs = { entries: [] as any[] };
    const after = addFavourite(favs, { providerId: 'maya', scope: 'PROVIDER_AND_SERVICE' });
    expect(after.entries).toHaveLength(0);
  });

  it('removeFavourite removes only the matching scoped row', () => {
    const favs = {
      entries: [
        { providerId: 'maya', scope: 'PROVIDER_AND_SERVICE' as const, serviceCode: 'DOG_WALK' },
        { providerId: 'maya', scope: 'PROVIDER_AND_SERVICE' as const, serviceCode: 'DAYCARE' },
      ],
    };
    const after = removeFavourite(favs, { providerId: 'maya', scope: 'PROVIDER_AND_SERVICE', serviceCode: 'DOG_WALK' });
    expect(after.entries).toHaveLength(1);
    expect(after.entries[0].serviceCode).toBe('DAYCARE');
  });
});

/**
 * FavouriteScopingService — CEO PROGRAM 30 (Favourites Scoping).
 *
 * Pure evaluator. Doctrine: a favourite may be scoped to (provider)
 * OR (provider + service) depending on the product surface. Maya as
 * a walking favourite does NOT imply Maya as a daycare favourite.
 *
 * The evaluator answers two questions:
 *   1. isFavourite(scope, providerId, serviceCode?) — whether the
 *      user has marked this exact scope.
 *   2. suggestScope(surface) — for a UI surface (favourite-star on
 *      a walking card vs a general provider profile), which scope
 *      the toggle should use.
 */

export type FavouriteScope = 'PROVIDER' | 'PROVIDER_AND_SERVICE';

export interface FavouriteEntry {
  providerId: string;
  scope: FavouriteScope;
  serviceCode?: string;                     // required when scope === 'PROVIDER_AND_SERVICE'
}

export interface Favourites {
  entries: FavouriteEntry[];
}

export function isFavourite(
  favs: Favourites,
  providerId: string,
  serviceCode?: string,
): boolean {
  return favs.entries.some((e) => {
    if (e.providerId !== providerId) return false;
    if (e.scope === 'PROVIDER') return !serviceCode || true; // provider-level covers any service
    return !!serviceCode && e.serviceCode === serviceCode;
  });
}

export type FavouriteSurface =
  | 'PROVIDER_PROFILE'
  | 'SERVICE_CARD'
  | 'BOOKING_CONFIRMATION'
  | 'AI_RECOMMENDATION';

/**
 * Which scope should a favourite-star on this surface toggle?
 *   PROVIDER_PROFILE      → PROVIDER (whole provider).
 *   SERVICE_CARD          → PROVIDER_AND_SERVICE (this exact service).
 *   BOOKING_CONFIRMATION  → PROVIDER_AND_SERVICE (they just used this service).
 *   AI_RECOMMENDATION     → PROVIDER_AND_SERVICE (context is a specific service).
 */
export function suggestScope(surface: FavouriteSurface): FavouriteScope {
  if (surface === 'PROVIDER_PROFILE') return 'PROVIDER';
  return 'PROVIDER_AND_SERVICE';
}

/** Add a favourite; no-op if it's already there. Returns the next favourites value. */
export function addFavourite(favs: Favourites, entry: FavouriteEntry): Favourites {
  if (entry.scope === 'PROVIDER_AND_SERVICE' && !entry.serviceCode) return favs;
  const already = favs.entries.some((e) =>
    e.providerId === entry.providerId
    && e.scope === entry.scope
    && (e.scope === 'PROVIDER' || e.serviceCode === entry.serviceCode),
  );
  if (already) return favs;
  return { entries: [...favs.entries, entry] };
}

/** Remove a favourite. Returns the next value. */
export function removeFavourite(favs: Favourites, entry: FavouriteEntry): Favourites {
  return {
    entries: favs.entries.filter((e) => {
      if (e.providerId !== entry.providerId) return true;
      if (e.scope !== entry.scope) return true;
      if (e.scope === 'PROVIDER_AND_SERVICE' && e.serviceCode !== entry.serviceCode) return true;
      return false;
    }),
  };
}

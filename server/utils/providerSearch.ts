/**
 * MARKETPLACE PROVIDER SEARCH UTILITIES
 * Filtering, haversine distance, and composite ranking.
 *
 * Online service domains only (pet_sitting, dog_walking, grooming, transport, daycare).
 * NOT for K9000.
 */

import type {
  ProviderSearchFilters,
  ProviderSearchItem,
  ProviderSortMode,
} from "../../shared/provider-search-types";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function normalizeProviderSearchFilters(query: any): ProviderSearchFilters {
  return {
    q: typeof query.q === "string" ? query.q.trim() : "",
    serviceType: (query.serviceType || "") as any,
    startDate: query.startDate || undefined,
    endDate: query.endDate || undefined,
    postcode: query.postcode || undefined,
    lat: query.lat ? Number(query.lat) : undefined,
    lng: query.lng ? Number(query.lng) : undefined,
    radiusKm: query.radiusKm ? clamp(Number(query.radiusKm), 1, 100) : 15,

    verifiedOnly: String(query.verifiedOnly || "") === "true",
    instantBookOnly: String(query.instantBookOnly || "") === "true",
    insuredOnly: String(query.insuredOnly || "") === "true",

    minRating: query.minRating ? clamp(Number(query.minRating), 0, 5) : 0,
    minReviews: query.minReviews ? Math.max(0, Number(query.minReviews)) : 0,
    priceMin: query.priceMin ? Math.max(0, Number(query.priceMin)) : 0,
    priceMax: query.priceMax ? Math.max(0, Number(query.priceMax)) : 999999,

    petType: (query.petType || "") as any,
    petSize: (query.petSize || "") as any,

    sort: (query.sort || "recommended") as ProviderSortMode,
    page: query.page ? Math.max(1, Number(query.page)) : 1,
    pageSize: query.pageSize ? clamp(Number(query.pageSize), 1, 50) : 20,
  };
}

export function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function applyProviderFilters(
  providers: ProviderSearchItem[],
  filters: ProviderSearchFilters
): ProviderSearchItem[] {
  return providers.filter((p) => {
    if (
      filters.serviceType &&
      !p.supportedServices.includes(filters.serviceType as any)
    )
      return false;
    if (filters.verifiedOnly && !p.verified) return false;
    if (filters.instantBookOnly && !p.instantBook) return false;
    if (filters.insuredOnly && !p.insured) return false;
    if ((filters.minRating || 0) > p.rating) return false;
    if ((filters.minReviews || 0) > p.reviewsCount) return false;
    if (p.startingPrice < (filters.priceMin || 0)) return false;
    if (p.startingPrice > (filters.priceMax || 999999)) return false;

    if (filters.q) {
      const haystack = [p.displayName, p.shortBio, p.city, p.suburb, p.postcode]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(filters.q.toLowerCase())) return false;
    }

    // Open browse mode: if no dates, show everyone.
    // If dates given, only show providers available for those dates.
    if (filters.startDate && filters.endDate && !p.availableForRequestedDates)
      return false;

    return true;
  });
}

export function scoreProvider(
  provider: ProviderSearchItem,
  filters: ProviderSearchFilters,
  userLocation?: { lat?: number; lng?: number }
): ProviderSearchItem {
  let distanceKm: number | undefined;

  if (
    typeof userLocation?.lat === "number" &&
    typeof userLocation?.lng === "number" &&
    typeof provider.lat === "number" &&
    typeof provider.lng === "number"
  ) {
    distanceKm = haversineKm(
      userLocation.lat,
      userLocation.lng,
      provider.lat,
      provider.lng
    );
  }

  provider.distanceKm = distanceKm;

  // Hard radius cutoff when location is known
  if (distanceKm != null && distanceKm > (filters.radiusKm || 15)) {
    provider.rankingScore = -999999;
    return provider;
  }

  const radiusKm = filters.radiusKm || 15;
  const distanceScore =
    distanceKm == null ? 0.3 : Math.max(0, 1 - distanceKm / radiusKm);

  const ratingScore = provider.rating / 5;
  const trustScore =
    (provider.verified ? 0.45 : 0) +
    (provider.insured ? 0.2 : 0) +
    Math.min(0.35, provider.reviewsCount / 400);
  const bookingVolumeScore = Math.min(1, provider.completedBookings / 1000);
  const priceScore = 1 / Math.max(1, provider.startingPrice);
  const responseScore =
    provider.responseTimeMinutes != null
      ? 1 / Math.max(1, provider.responseTimeMinutes)
      : 0.1;

  let score = 0;

  switch (filters.sort || "recommended") {
    case "closest":
      score =
        distanceScore * 0.7 +
        ratingScore * 0.15 +
        trustScore * 0.1 +
        bookingVolumeScore * 0.05;
      break;

    case "top_rated":
      score =
        ratingScore * 0.55 +
        trustScore * 0.2 +
        distanceScore * 0.15 +
        bookingVolumeScore * 0.1;
      break;

    case "lowest_price":
      score =
        priceScore * 0.6 +
        distanceScore * 0.15 +
        ratingScore * 0.15 +
        trustScore * 0.1;
      break;

    case "fastest_response":
      score =
        responseScore * 0.55 +
        ratingScore * 0.2 +
        trustScore * 0.15 +
        distanceScore * 0.1;
      break;

    case "recommended":
    default:
      score =
        distanceScore * 0.4 +
        ratingScore * 0.25 +
        trustScore * 0.15 +
        bookingVolumeScore * 0.1 +
        responseScore * 0.1;
      break;
  }

  // Small boosts for trust signals
  if (provider.instantBook) score += 0.02;
  if (provider.verified) score += 0.015;
  if (provider.insured) score += 0.01;

  provider.rankingScore = score;
  return provider;
}

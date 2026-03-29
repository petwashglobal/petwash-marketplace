/**
 * MARKETPLACE PROVIDER SEARCH SERVICE
 * Online service domains only: pet_sitting, dog_walking, grooming, transport, daycare.
 * NOT for K9000.
 *
 * The `fetchMarketplaceProviders` function below uses demo seed data.
 * Replace it with real Drizzle queries against the provider / sitter_profiles /
 * walker_profiles / availability_slots tables. The geocode stub at the bottom
 * delegates to the existing google-services route when postcode is provided.
 */

import type {
  ProviderSearchFilters,
  ProviderSearchItem,
} from "../../shared/provider-search-types";
import {
  applyProviderFilters,
  scoreProvider,
} from "../utils/providerSearch";

async function resolveSearchLocation(filters: ProviderSearchFilters): Promise<{
  lat?: number;
  lng?: number;
  source: "input" | "query_geocode" | "none";
}> {
  // If frontend already sent GPS coordinates, use them directly
  if (typeof filters.lat === "number" && typeof filters.lng === "number") {
    return { lat: filters.lat, lng: filters.lng, source: "input" };
  }

  // TODO: wire to existing GoogleServicesRoute geocode or google-services.ts
  // when postcode or city is provided and GPS is not available
  return { source: "none" };
}

/**
 * Replace with real Drizzle queries.
 *
 * Query strategy:
 * - Join sitter_profiles (or walker_profiles / groomers etc.) with providers table
 * - Left join availability_slots to check date availability if startDate/endDate given
 * - Pull rating, reviewsCount, completedBookings from materialized columns
 * - Pull startingPrice from the rate_cards table for the requested service type
 * - Return isVerified, insured, instantBook flags from provider record
 */
async function fetchMarketplaceProviders(
  filters: ProviderSearchFilters
): Promise<ProviderSearchItem[]> {
  const seed: ProviderSearchItem[] = [
    {
      providerId: "prov_sit_001",
      providerSlug: "royal-paws-petah-tikva",
      displayName: "Royal Paws Pet Sitting",
      avatarUrl: undefined,
      coverImageUrl: undefined,
      shortBio: "Trusted pet sitting with calm handling, photo updates, and repeat clients.",
      city: "Petah Tikva",
      suburb: "Petah Tikva",
      postcode: "4806859",
      lat: 32.0871,
      lng: 34.8878,
      verified: true,
      insured: true,
      instantBook: false,
      rating: 4.8,
      reviewsCount: 94,
      completedBookings: 312,
      responseTimeMinutes: 18,
      supportedServices: ["pet_sitting", "daycare"],
      startingPrice: 110,
      currency: "ILS",
      priceLabel: "מ-₪110",
      availableForRequestedDates: true,
      nextAvailableText: "מחר בבוקר",
      rankingScore: 0,
      badges: ["מאומת", "מבוטח"],
    },
    {
      providerId: "prov_walk_002",
      providerSlug: "urban-paws-rg",
      displayName: "Urban Paws Walking",
      avatarUrl: undefined,
      coverImageUrl: undefined,
      shortBio: "הליכות מהימנות עם GPS ועדכונים בזמן אמת.",
      city: "רמת גן",
      suburb: "רמת גן",
      postcode: "5252201",
      lat: 32.0684,
      lng: 34.8248,
      verified: true,
      insured: false,
      instantBook: true,
      rating: 4.9,
      reviewsCount: 181,
      completedBookings: 901,
      responseTimeMinutes: 7,
      supportedServices: ["dog_walking"],
      startingPrice: 75,
      currency: "ILS",
      priceLabel: "מ-₪75",
      availableForRequestedDates: true,
      nextAvailableText: "היום ב-17:00",
      rankingScore: 0,
      badges: ["מאומת", "הזמנה מיידית", "מדורג גבוה"],
    },
    {
      providerId: "prov_groom_003",
      providerSlug: "luna-grooming-tel-aviv",
      displayName: "Luna Grooming",
      avatarUrl: undefined,
      coverImageUrl: undefined,
      shortBio: "תספורות פרמיום עם טיפול רגוע ומוצרים איכותיים.",
      city: "תל אביב",
      suburb: "תל אביב",
      postcode: "6343210",
      lat: 32.0853,
      lng: 34.7818,
      verified: true,
      insured: true,
      instantBook: true,
      rating: 4.9,
      reviewsCount: 221,
      completedBookings: 1221,
      responseTimeMinutes: 6,
      supportedServices: ["grooming"],
      startingPrice: 180,
      currency: "ILS",
      priceLabel: "מ-₪180",
      availableForRequestedDates: true,
      nextAvailableText: "היום ב-19:00",
      rankingScore: 0,
      badges: ["מאומת", "מבוטח", "הזמנה מיידית", "פרמיום"],
    },
    {
      providerId: "prov_daycare_004",
      providerSlug: "sunny-paws-holon",
      displayName: "Sunny Paws Daycare",
      avatarUrl: undefined,
      coverImageUrl: undefined,
      shortBio: "פנסיון יומי בבית פרטי, גינה מאובטחת, עדכונים כל שעה.",
      city: "חולון",
      suburb: "חולון",
      postcode: "5881009",
      lat: 32.0167,
      lng: 34.7792,
      verified: true,
      insured: true,
      instantBook: false,
      rating: 4.7,
      reviewsCount: 63,
      completedBookings: 189,
      responseTimeMinutes: 25,
      supportedServices: ["daycare", "pet_sitting"],
      startingPrice: 95,
      currency: "ILS",
      priceLabel: "מ-₪95",
      availableForRequestedDates: true,
      nextAvailableText: "מחר",
      rankingScore: 0,
      badges: ["מאומת", "מבוטח"],
    },
    {
      providerId: "prov_transport_005",
      providerSlug: "petride-tlv",
      displayName: "PetRide TLV",
      avatarUrl: undefined,
      coverImageUrl: undefined,
      shortBio: "הסעות מחמד לווטרינר, מספרה וחזרה — מכונית מותאמת לחיות.",
      city: "תל אביב",
      suburb: "תל אביב",
      postcode: "6100000",
      lat: 32.0700,
      lng: 34.7750,
      verified: false,
      insured: true,
      instantBook: true,
      rating: 4.6,
      reviewsCount: 38,
      completedBookings: 77,
      responseTimeMinutes: 12,
      supportedServices: ["transport"],
      startingPrice: 60,
      currency: "ILS",
      priceLabel: "מ-₪60",
      availableForRequestedDates: true,
      nextAvailableText: "עוד שעה",
      rankingScore: 0,
      badges: ["מבוטח", "הזמנה מיידית"],
    },
  ];

  // Coarse pre-filter by service type before scoring
  if (filters.serviceType) {
    return seed.filter((p) =>
      p.supportedServices.includes(filters.serviceType as any)
    );
  }

  return seed;
}

export async function runProviderSearch(filters: ProviderSearchFilters) {
  const location = await resolveSearchLocation(filters);
  const providers = await fetchMarketplaceProviders(filters);

  const scored = providers
    .map((p) => scoreProvider({ ...p }, filters, location))
    .filter((p) => p.rankingScore > -999999);

  const filtered = applyProviderFilters(scored, filters).sort(
    (a, b) => b.rankingScore - a.rankingScore
  );

  const page = filters.page || 1;
  const pageSize = filters.pageSize || 20;
  const offset = (page - 1) * pageSize;

  return {
    filters,
    total: filtered.length,
    page,
    pageSize,
    results: filtered.slice(offset, offset + pageSize),
    debug: {
      usedLocation: location.source !== "none",
      locationSource: location.source,
    },
  };
}

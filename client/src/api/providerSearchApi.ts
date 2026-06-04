/**
 * MARKETPLACE PROVIDER SEARCH API CLIENT
 * Online service domains only (pet_sitting, dog_walking, grooming, transport, daycare).
 * NOT for K9000.
 */

import type {
  MarketplaceServiceType,
  ProviderSearchItem,
  ProviderSearchFilters,
  ProviderSearchResponse,
  ProviderSortMode,
} from "@shared/provider-search-types";

export async function fetchProviderSearch(
  filters: ProviderSearchFilters
): Promise<ProviderSearchResponse> {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === false)
      return;
    params.set(key, String(value));
  });

  const response = await fetch(`/api/providers/search?${params.toString()}`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Search request failed: ${response.status}`);
  }

  return response.json();
}

export type LegacyBrowseService = "dog_walking" | "pet_sitting" | "grooming";

export interface LegacyBrowseProvider {
  id: string;
  platform: "walk_my_pet" | "sitter_suite" | "groomers";
  serviceType: MarketplaceServiceType;
  displayName: string;
  bio: string;
  profilePhotoUrl: string | null;
  location: string;
  suburb: string | null;
  postalCode: string | null;
  distanceKm: number | null;
  distanceMeters?: number | null;
  proximityLabel?: string | null;
  rating: number | null;
  reviewCount: number;
  pricing: {
    perNight: string | null;
    perHour: string | null;
    additionalPet: string | null;
    currency: string;
  };
  maxPets: number;
  acceptedPetTypes: string[];
  supportedServices: MarketplaceServiceType[];
  addons: string[];
  instantBooking: boolean;
  cancellationPolicy: string;
}

export interface LegacyBrowseResponse {
  success: boolean;
  providers: LegacyBrowseProvider[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

function mapBrowseSort(sortBy: string): ProviderSortMode {
  switch (sortBy) {
    case "distance":
      return "closest";
    case "price":
      return "lowest_price";
    case "rating":
    case "reviews":
      return "top_rated";
    default:
      return "recommended";
  }
}

function toLegacyBrowseProvider(
  item: ProviderSearchItem,
  serviceType: LegacyBrowseService,
): LegacyBrowseProvider {
  const platform =
    serviceType === "dog_walking" ? "walk_my_pet" :
    serviceType === "pet_sitting" ? "sitter_suite" :
    "groomers";
  const price = item.startingPrice ? item.startingPrice.toFixed(2) : null;

  return {
    id: item.providerId,
    platform,
    serviceType,
    displayName: item.displayName,
    bio: item.shortBio || "",
    profilePhotoUrl: item.avatarUrl || null,
    location: item.city || item.suburb || "",
    suburb: item.suburb || null,
    postalCode: item.postcode || null,
    distanceKm: item.distanceKm ?? null,
    distanceMeters: item.distanceKm != null ? Math.round(item.distanceKm * 1000) : null,
    proximityLabel: item.matchLabel || null,
    rating: item.rating ?? null,
    reviewCount: item.reviewsCount || 0,
    pricing: {
      perNight: serviceType === "pet_sitting" ? price : null,
      perHour: serviceType === "dog_walking" || serviceType === "grooming" ? price : null,
      additionalPet: null,
      currency: item.currency || "ILS",
    },
    maxPets: 1,
    acceptedPetTypes: [],
    supportedServices: item.supportedServices,
    addons: item.badges || [],
    instantBooking: item.instantBook,
    cancellationPolicy: "standard",
  };
}

export async function fetchProviderBrowseResults(params: {
  serviceType: LegacyBrowseService;
  q?: string;
  location?: string;
  lat?: number | null;
  lng?: number | null;
  radiusKm?: number;
  maxPrice?: number;
  minRating?: number;
  sortBy?: string;
  startDate?: string;
  endDate?: string;
  petType?: string;
  page?: number;
  pageSize?: number;
}): Promise<LegacyBrowseResponse> {
  const response = await fetchProviderSearch({
    q: params.q || params.location || "",
    serviceType: params.serviceType,
    lat: params.lat ?? undefined,
    lng: params.lng ?? undefined,
    radiusKm: params.radiusKm,
    priceMax: params.maxPrice,
    minRating: params.minRating,
    sort: mapBrowseSort(params.sortBy || "bestMatch"),
    startDate: params.startDate,
    endDate: params.endDate,
    petType: (params.petType || "") as any,
    page: params.page || 1,
    pageSize: params.pageSize || 20,
  });

  return {
    success: response.ok,
    providers: response.results.map((item) => toLegacyBrowseProvider(item, params.serviceType)),
    pagination: {
      page: response.page,
      limit: response.pageSize,
      total: response.total,
      hasMore: response.page * response.pageSize < response.total,
    },
  };
}

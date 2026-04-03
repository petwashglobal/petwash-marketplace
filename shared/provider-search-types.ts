/**
 * MARKETPLACE PROVIDER SEARCH TYPES
 * For online service domains only:
 *   pet_sitting | dog_walking | grooming | transport | daycare
 *
 * NOT FOR K9000
 */

export type MarketplaceServiceType =
  | "pet_sitting"
  | "dog_walking"
  | "grooming"
  | "transport"
  | "daycare";

export type ProviderSortMode =
  | "recommended"
  | "closest"
  | "top_rated"
  | "lowest_price"
  | "fastest_response";

export interface ProviderSearchFilters {
  q?: string;
  serviceType?: MarketplaceServiceType | "";
  startDate?: string;
  endDate?: string;
  postcode?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;

  verifiedOnly?: boolean;
  instantBookOnly?: boolean;
  insuredOnly?: boolean;

  minRating?: number;
  minReviews?: number;
  priceMin?: number;
  priceMax?: number;

  petType?: "dog" | "cat" | "other" | "";
  petSize?: "small" | "medium" | "large" | "";

  sort?: ProviderSortMode;
  page?: number;
  pageSize?: number;
}

export interface ProviderSearchItem {
  providerId: string;
  providerSlug: string;
  displayName: string;
  avatarUrl?: string;
  coverImageUrl?: string;
  shortBio?: string;

  city?: string;
  suburb?: string;
  postcode?: string;
  lat?: number;
  lng?: number;

  verified: boolean;
  insured: boolean;
  instantBook: boolean;

  rating: number;
  reviewsCount: number;
  completedBookings: number;
  responseTimeMinutes?: number;

  supportedServices: MarketplaceServiceType[];

  startingPrice: number;
  currency: string;
  priceLabel: string;

  distanceKm?: number;
  availableForRequestedDates: boolean;
  nextAvailableText?: string;

  rankingScore: number;
  badges: string[];

  matchLabel?: 'best_match' | 'great_option' | 'budget_option';
  matchLabelHe?: string;
  matchScore?: number;
}

export interface ProviderSearchResponse {
  ok: true;
  filters: ProviderSearchFilters;
  total: number;
  page: number;
  pageSize: number;
  results: ProviderSearchItem[];
  debug?: {
    usedLocation: boolean;
    locationSource: "input" | "query_geocode" | "none";
  };
}

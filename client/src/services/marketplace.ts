/**
 * MARKETPLACE SERVICE - TanStack Query Hooks
 * 
 * Colocated React Query hooks for marketplace operations:
 * - Provider search across all platforms
 * - Provider details
 * - Booking creation
 * - Reviews and ratings
 * 
 * Uses hierarchical query keys for proper cache invalidation
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type {
  MarketplaceProvider,
  MarketplaceSearchFilters,
  MarketplaceSearchResponse,
  MarketplacePlatformId,
} from '@shared/schema';

/**
 * Search providers across all marketplace platforms
 * 
 * @param filters - Search filters (platform, location, rating, price, etc.)
 * @returns MarketplaceSearchResponse with normalized provider list
 */
export function useMarketplaceSearch(filters: MarketplaceSearchFilters) {
  return useQuery<MarketplaceSearchResponse>({
    queryKey: ['/api/marketplace/search', filters],
    queryFn: async () => {
      const response = await apiRequest('POST', '/api/marketplace/search', filters);
      return response.json();
    },
    enabled: !!filters.platform,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}

/**
 * Get provider details by platform and ID
 * 
 * @param platform - Platform ID (walk_my_pet, sitter_suite, etc.)
 * @param id - Provider ID (walkerId, sitterId, etc.)
 * @returns MarketplaceProvider with full details
 */
export function useProviderDetails(
  platform: MarketplacePlatformId,
  id: string | number
) {
  return useQuery<{ provider: MarketplaceProvider }>({
    queryKey: [`/api/marketplace/provider/${platform}/${id}`],
    enabled: !!platform && !!id,
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
  });
}

/**
 * Create a new booking
 * 
 * @returns Mutation for creating bookings with cache invalidation
 */
export function useCreateBooking() {
  return useMutation({
    mutationFn: async (bookingData: {
      platformId: string;
      providerId?: number;
      userId: string;
      startTime: string;
      endTime: string;
      serviceType?: string;
      petIds?: string[];
      notes?: string;
    }) => {
      void bookingData;
      throw new Error(
        'Legacy /api/bookings creation is disabled. Use the canonical booking-request or marketplace checkout flow.',
      );
    },
  });
}

/*
 * REMOVED 2026-08-17 (client<->server contract sweep, Lane E D15):
 *   export function useCustomerBookings(userId, status)
 * It queried `['/api/bookings', {...}]`; the default queryFn fetches queryKey[0],
 * and there is no bare `GET /api/bookings` handler — server/routes/bookings.ts
 * exposes /create, /my-bookings, /availability, /:bookingId/*, /lock, /release.
 * The hook had ZERO callers, so nothing regressed; it was a 404 waiting for its
 * first consumer. Customer bookings must go through `GET /api/bookings/my-bookings`.
 */

/**
 * Cancel a booking with refund
 * 
 * @returns Mutation for cancelling bookings
 */
export function useCancelBooking() {
  return useMutation({
    mutationFn: async ({
      bookingId,
      reason,
    }: {
      bookingId: string;
      reason: string;
    }) => {
      void bookingId;
      void reason;
      throw new Error(
        'Legacy /api/bookings cancellation is disabled. Use the canonical booking-request cancellation flow.',
      );
    },
  });
}

/**
 * Submit a review for a provider
 * 
 * @returns Mutation for submitting reviews
 */
export function useSubmitReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reviewData: {
      bookingId: string;
      providerId: number;
      platform: MarketplacePlatformId;
      rating: number;
      comment: string;
      photos?: string[];
    }) => {
      // Server route is /api/reviews/submit — a bare POST /api/reviews has no handler
      // (dead-endpoint sweep 2026-07-24).
      const response = await apiRequest('POST', '/api/reviews/submit', reviewData);
      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate provider details cache to show new review
      queryClient.invalidateQueries({
        queryKey: [`/api/marketplace/provider/${variables.platform}/${variables.providerId}`],
      });
      // Invalidate reviews cache
      queryClient.invalidateQueries({ queryKey: ['/api/reviews'] });
    },
  });
}

/**
 * Get provider reviews
 * 
 * @param platform - Platform ID
 * @param providerId - Provider ID
 * @returns List of reviews with ratings
 */
export function useProviderReviews(
  platform: MarketplacePlatformId,
  providerId: number | string
) {
  return useQuery({
    queryKey: [`/api/reviews/${platform}/${providerId}`],
    enabled: !!platform && !!providerId,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}

/*
 * REMOVED 2026-08-17 (client<->server contract sweep, Lane E D16):
 *   export function useProviderEarnings(providerId)
 * It queried `/api/providers/earnings/:providerId` — no such handler exists on the
 * `/api/providers` mount (provider-search.ts / providers.ts). ZERO callers, so this
 * removes a 404 trap rather than a feature. Provider earnings are owned by the
 * payout/escrow surfaces, not by a marketplace search service.
 */

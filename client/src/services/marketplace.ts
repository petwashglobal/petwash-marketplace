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
    queryKey: ['/api/marketplace/provider', platform, id],
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
  const queryClient = useQueryClient();

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
      const response = await apiRequest('POST', '/api/bookings', bookingData);
      return response.json();
    },
    onSuccess: () => {
      // Invalidate bookings cache
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
    },
  });
}

/**
 * Get user's bookings (past and upcoming)
 * 
 * @param userId - User ID
 * @param status - Optional status filter (upcoming, past, cancelled)
 * @returns List of bookings
 */
export function useCustomerBookings(
  userId: string,
  status?: 'upcoming' | 'past' | 'cancelled'
) {
  return useQuery({
    queryKey: ['/api/bookings', { userId, status }],
    enabled: !!userId,
    staleTime: 1000 * 60 * 2, // Cache for 2 minutes
  });
}

/**
 * Cancel a booking with refund
 * 
 * @returns Mutation for cancelling bookings
 */
export function useCancelBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      bookingId,
      reason,
    }: {
      bookingId: string;
      reason: string;
    }) => {
      const response = await apiRequest('POST', `/api/bookings/${bookingId}/cancel`, { reason });
      return response.json();
    },
    onSuccess: () => {
      // Invalidate bookings cache
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
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
      const response = await apiRequest('POST', '/api/reviews', reviewData);
      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate provider details cache to show new review
      queryClient.invalidateQueries({
        queryKey: ['/api/marketplace/provider', variables.platform, variables.providerId],
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
    queryKey: ['/api/reviews', platform, providerId],
    enabled: !!platform && !!providerId,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}

/**
 * Get provider earnings (for provider dashboard)
 * 
 * @param providerId - Provider ID
 * @returns Earnings summary with escrow, released payouts, total revenue
 */
export function useProviderEarnings(providerId: number) {
  return useQuery({
    queryKey: ['/api/providers/earnings', providerId],
    enabled: !!providerId,
    staleTime: 1000 * 60 * 1, // Cache for 1 minute (earnings should be fresh)
  });
}

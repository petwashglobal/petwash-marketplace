/**
 * usePaymentPreview — call the ONE customer-facing "what do I owe?"
 * endpoint (CEO 2026-08-26 §9-10). The server owns the number; this
 * hook just fetches it.
 */

import { useQuery } from '@tanstack/react-query';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { getApiUrl } from '@/lib/apiConfig';
import type {
  PaymentPreview,
  PaymentSurface,
} from '@shared/lib/paymentPreview';

export interface PaymentPreviewRequest {
  surface: PaymentSurface;
  quoteInput?: {
    providerId: string;
    serviceType: string;
    bookingWindow: { startAt: string; endAt: string };
    pets: any[];
    addons?: any[];
    promoCode?: string | null;
    giftCardCode?: string | null;
    useWalletCredit?: boolean;
    applyLoyaltyCredits?: boolean;
  };
  shopInput?: {
    cartId: number;
    deliveryMethod: 'delivery' | 'pickup';
    deliveryAddressId?: number | null;
    giftWrap?: boolean;
  };
}

/**
 * @param req — the shape the server composer expects. When `enabled` is
 *              false the hook is dormant (typical use: skip while the
 *              cart / booking-form has no valid inputs yet).
 */
export function usePaymentPreview(req: PaymentPreviewRequest | null, opts: { enabled?: boolean } = {}) {
  const { user } = useFirebaseAuth();
  const enabled = opts.enabled !== false && !!req;
  // The (surface, cart/quote hash) is stable — we let react-query
  // dedupe by the entire body so a re-render with identical inputs
  // does not refetch.
  const queryKey = ['/api/payment-preview', req ? JSON.stringify(req) : null];
  const query = useQuery<PaymentPreview | null>({
    queryKey,
    enabled,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!req) return null;
      const token = await user?.getIdToken().catch(() => undefined);
      const res = await fetch(getApiUrl('/api/payment-preview'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(req),
      });
      if (!res.ok) throw new Error(`payment-preview ${res.status}`);
      const data = await res.json();
      return (data?.preview as PaymentPreview) ?? null;
    },
  });
  return {
    preview: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

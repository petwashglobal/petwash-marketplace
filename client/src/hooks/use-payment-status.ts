import { useQuery } from '@tanstack/react-query';

interface PaymentStatus {
  nayax: { enabled: boolean; status: string; message: string; messageHe: string };
  creditCard: { enabled: boolean; status: string; message: string; messageHe: string };
  /** The rail eGift actually rides (SUMIT) + the PETWASH_EGIFT_PURCHASE_ENABLED flag. */
  egiftPurchase?: { enabled: boolean; railWired: boolean; featureEnabled: boolean };
}

export function usePaymentStatus() {
  const { data, isLoading } = useQuery<PaymentStatus>({
    // MUST stay under /api (2026-09-13): Firebase Hosting forwards only
    // /api/**, /auth/** and /uploads/** to Cloud Run. A bare '/payment-status'
    // returned the SPA's index.html, res.json() threw, and this hook fell back
    // to paymentsEnabled=false — so every payment surface said "Coming Soon"
    // while Nayax was fully configured. Pinned by clientApiPathsReachServer.
    queryKey: ['/api/payments/gateway-status'],
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const paymentsEnabled = data?.nayax?.enabled ?? false;
  /**
   * THE GATE MUST MATCH THE RAIL (2026-09-13). Screens that sell through the
   * SUMIT hosted page must ask about SUMIT, not about Nayax. /buy-gift-card
   * hid itself behind `nayax.enabled` while its own submit goes to
   * /api/egift/guest/start, which rides SUMIT — so it would have stayed shut
   * even with a perfectly working till.
   */
  const cardPaymentsEnabled = data?.creditCard?.enabled ?? false;
  const egiftPurchaseEnabled = data?.egiftPurchase?.enabled ?? false;

  return { paymentsEnabled, cardPaymentsEnabled, egiftPurchaseEnabled, status: data, isLoading };
}

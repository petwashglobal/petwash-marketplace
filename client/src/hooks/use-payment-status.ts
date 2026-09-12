import { useQuery } from '@tanstack/react-query';

interface PaymentStatus {
  nayax: { enabled: boolean; status: string; message: string; messageHe: string };
  creditCard: { enabled: boolean; status: string; message: string; messageHe: string };
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

  return { paymentsEnabled, status: data, isLoading };
}

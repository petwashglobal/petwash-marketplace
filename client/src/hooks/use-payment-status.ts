import { useQuery } from '@tanstack/react-query';

interface PaymentStatus {
  nayax: { enabled: boolean; status: string; message: string; messageHe: string };
  creditCard: { enabled: boolean; status: string; message: string; messageHe: string };
}

export function usePaymentStatus() {
  const { data, isLoading } = useQuery<PaymentStatus>({
    queryKey: ['/payment-status'],
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const paymentsEnabled = data?.nayax?.enabled ?? false;

  return { paymentsEnabled, status: data, isLoading };
}

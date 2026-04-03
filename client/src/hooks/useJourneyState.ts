/**
 * useJourneyState — fetches and advances the customer journey state
 * States: visitor → browsing → authenticated → ready_to_book → booked
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';

export type JourneyState = 'visitor' | 'browsing' | 'authenticated' | 'ready_to_book' | 'booked';

export const JOURNEY_STEPS: { key: JourneyState; he: string; en: string }[] = [
  { key: 'visitor',       he: 'מבקר',         en: 'Visitor' },
  { key: 'browsing',      he: 'מחפש',          en: 'Browsing' },
  { key: 'authenticated', he: 'מחובר',          en: 'Signed In' },
  { key: 'ready_to_book', he: 'מוכן להזמנה',   en: 'Ready to Book' },
  { key: 'booked',        he: 'הוזמן',          en: 'Booked' },
];

export function useJourneyState() {
  const { data, isLoading } = useQuery<{ journeyState: JourneyState }>({
    queryKey: ['/api/user/journey-state'],
    retry: false,
    staleTime: 30_000,
  });

  const advanceMutation = useMutation({
    mutationFn: (state: JourneyState) =>
      apiRequest('POST', '/api/user/journey-state', { state }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/journey-state'] });
    },
  });

  return {
    journeyState: data?.journeyState ?? 'visitor',
    isLoading,
    advance: advanceMutation.mutate,
  };
}

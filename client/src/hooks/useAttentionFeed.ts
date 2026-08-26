/**
 * useAttentionFeed — read the server-side attention projection for
 * either workspace home (CEO 2026-08-26 §27-29).
 *
 * The server owns "what needs my attention right now" — the client
 * just renders. No client-side aggregation, no priority logic
 * duplicated here.
 */

import { useQuery } from '@tanstack/react-query';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { getApiUrl } from '@/lib/apiConfig';
import { useLanguage } from '@/lib/languageStore';
import type { AttentionActor, AttentionFeed } from '@shared/lib/attentionFeed';

async function fetchAttention(actor: AttentionActor, lang: string, token: string | undefined): Promise<AttentionFeed> {
  const url = getApiUrl(`/api/attention/${actor === 'pet_parent' ? 'pet-parent' : 'provider'}?lang=${lang}`);
  const res = await fetch(url, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`attention ${res.status}`);
  const data = await res.json();
  return data?.feed ?? { actor, items: [], composedAt: new Date().toISOString() };
}

export function useAttentionFeed(actor: AttentionActor) {
  const { user } = useFirebaseAuth();
  const { language } = useLanguage();
  const query = useQuery<AttentionFeed>({
    queryKey: ['/api/attention', actor, language],
    enabled: !!user,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    queryFn: async () => {
      const token = await user?.getIdToken().catch(() => undefined);
      return fetchAttention(actor, language, token);
    },
  });
  return {
    feed: query.data ?? null,
    items: query.data?.items ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

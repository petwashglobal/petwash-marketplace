/**
 * useNextBestActionFeed — CEO MASTER 2026-08-28 §36 §65 (Journey
 * Brain Phase 5). Read the server-side NextBestAction projection for
 * either workspace home.
 *
 * The server owns "what to do next" — this hook just renders. No
 * client-side aggregation, no priority logic duplicated here. The
 * concierge component maps reasonCode → localised copy at render
 * time; the LLM (if any) never touches this hook.
 */
import { useQuery } from '@tanstack/react-query';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { getApiUrl } from '@/lib/apiConfig';
import { useLanguage } from '@/lib/languageStore';
import type {
  NextBestActionActor,
  NextBestActionFeed,
} from '@shared/lib/nextBestAction';

async function fetchNba(
  actor: NextBestActionActor,
  lang: string,
  token: string | undefined,
): Promise<NextBestActionFeed> {
  const url = getApiUrl(
    `/api/next-best-action/${actor === 'pet_parent' ? 'pet-parent' : 'provider'}?lang=${lang}`,
  );
  const res = await fetch(url, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`nba ${res.status}`);
  const data = await res.json();
  return data?.feed ?? { actor, actions: [], composedAt: new Date().toISOString() };
}

export function useNextBestActionFeed(actor: NextBestActionActor) {
  const { user } = useFirebaseAuth();
  const { language } = useLanguage();
  const query = useQuery<NextBestActionFeed>({
    queryKey: ['/api/next-best-action', actor, language],
    enabled: !!user,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    queryFn: async () => {
      const token = await user?.getIdToken().catch(() => undefined);
      return fetchNba(actor, language, token);
    },
  });
  return {
    feed: query.data ?? null,
    actions: query.data?.actions ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

/**
 * useNextBestAction — read the server-side "what should I do next"
 * projection (Journey Brain Phase 5 · post-release 2026-09-04).
 *
 * The server (server/services/nextBestAction.ts, shipped in #2208)
 * owns:
 *   • the selection rules (urgent > resume > due_soon > informational)
 *   • the payload sanitation (never any payment truth on the wire)
 *   • the fail-CLOSED envelope on any partial outage
 *
 * The client just renders the shape. No aggregation, no priority
 * logic duplicated here, no re-fetch storm — one poll every 60s,
 * one refetch on window focus, otherwise React Query's cache.
 *
 * The hook is intentionally EMPTY when the user is signed out. That
 * matches the server contract: no uid → empty projection. Home
 * surfaces call it unconditionally; a signed-out home does not show
 * any next-action card.
 */

import { useQuery } from '@tanstack/react-query';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { getApiUrl } from '@/lib/apiConfig';
import { useLanguage } from '@/lib/languageStore';
import type { AttentionActor, AttentionItem } from '@shared/lib/attentionFeed';

/**
 * A "resume where you left off" action. Server-emitted alongside
 * attention items; the client tells them apart via `kind: 'resume'`.
 *
 * NEVER carries payment-truth keys (chargeId, paidAt, refundId,
 * fiscalDocumentNumber, or the raw draft payload) — the server
 * strips those on the way out.
 */
export interface ResumeAction {
  kind: 'resume';
  domain: string;
  destination: string;
  title: string;
  reason: string;
  updatedAt: string;
  checkpointId: string;
}

export type NextAction = AttentionItem | ResumeAction;

export interface NextBestActionResult {
  primaryAction: NextAction | null;
  secondaryActions: NextAction[];
  composedAt: string;
}

const EMPTY_RESULT: NextBestActionResult = Object.freeze({
  primaryAction: null,
  secondaryActions: [],
  composedAt: new Date(0).toISOString(),
});

async function fetchNextBestAction(
  actor: AttentionActor,
  lang: string,
  token: string | undefined,
): Promise<NextBestActionResult> {
  const url = getApiUrl(`/api/next-best-action?actor=${actor}&lang=${lang}`);
  const res = await fetch(url, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  // Server fails-CLOSED to 200 + empty projection even on outage.
  // On the rare hard-fail we treat it the same — never break home.
  if (!res.ok) return EMPTY_RESULT;
  try {
    const data = (await res.json()) as Partial<NextBestActionResult>;
    return {
      primaryAction: data.primaryAction ?? null,
      secondaryActions: Array.isArray(data.secondaryActions) ? data.secondaryActions : [],
      composedAt: typeof data.composedAt === 'string' ? data.composedAt : new Date().toISOString(),
    };
  } catch {
    return EMPTY_RESULT;
  }
}

/** Type-guard — a resume action has `kind: 'resume'`. */
export function isResumeAction(action: NextAction | null | undefined): action is ResumeAction {
  return !!action && (action as ResumeAction).kind === 'resume';
}

export function useNextBestAction(actor: AttentionActor) {
  const { user } = useFirebaseAuth();
  const { language } = useLanguage();
  const query = useQuery<NextBestActionResult>({
    queryKey: ['/api/next-best-action', actor, language],
    enabled: !!user,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    queryFn: async () => {
      const token = await user?.getIdToken().catch(() => undefined);
      return fetchNextBestAction(actor, language, token);
    },
  });
  const data = query.data ?? EMPTY_RESULT;
  return {
    primaryAction: data.primaryAction,
    secondaryActions: data.secondaryActions,
    composedAt: data.composedAt,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

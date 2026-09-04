/**
 * useNextBestActionFeedback — post ONE user verdict per tap on a
 * NextBestActionCard action (Journey Brain Phase 6 · post-release
 * 2026-09-04). Fire-and-forget; a network failure NEVER blocks the
 * UI action that surrounded it.
 *
 * Contract:
 *
 *   • Auth: apiRequest attaches the Firebase Bearer token; the
 *     endpoint refuses anonymous callers with 401.
 *   • Body: { actionKey, verdict } — the server-side registry
 *     validates verdict against the closed enum and rejects
 *     over-length or empty action keys with typed 400s.
 *   • On success, TanStack Query invalidates the next-best-action
 *     cache so the composer re-runs with the suppression applied
 *     (the composer reads recent 'not_interested' verdicts in a
 *     7-day cooldown window).
 *
 * The action_key vocabulary matches the server:
 *
 *   AttentionItem → `attn:<id>`
 *   ResumeAction  → `resume:<domain>`
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { apiRequest } from '@/lib/queryClient';
import { isResumeAction, type NextAction } from '@/hooks/useNextBestAction';

export type NextBestActionVerdict =
  | 'act'
  | 'dismiss'
  | 'not_interested'
  | 'fewer_like_this';

/** Same shape the server's deriveActionKey uses — mirrored here so the
 *  client can compose it locally without a round-trip. */
export function actionKeyFor(action: NextAction): string | null {
  if (!action || typeof action !== 'object') return null;
  if (isResumeAction(action) && action.domain) return `resume:${action.domain}`;
  const id = (action as any).id;
  if (typeof id === 'string' && id) return `attn:${id}`;
  return null;
}

export function useNextBestActionFeedback() {
  const { user } = useFirebaseAuth();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (args: { actionKey: string; verdict: NextBestActionVerdict }) => {
      if (!user) return { ok: false, skipped: 'no_user' as const };
      try {
        const r = await apiRequest('POST', '/api/next-best-action/feedback', args);
        if (!r.ok) return { ok: false, status: r.status };
        return { ok: true };
      } catch {
        // Fire-and-forget — a network failure never blocks the UI.
        return { ok: false, skipped: 'network' as const };
      }
    },
    onSuccess: (out) => {
      if (out?.ok) {
        // The composer will re-run and skip the suppressed action_key.
        queryClient.invalidateQueries({ queryKey: ['/api/next-best-action'] });
      }
    },
  });
  return {
    submit: (actionKey: string, verdict: NextBestActionVerdict) =>
      mutation.mutate({ actionKey, verdict }),
    isSubmitting: mutation.isPending,
  };
}

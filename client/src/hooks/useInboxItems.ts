/**
 * useInboxItems — client hook for the Unified Inbox (CEO NEXT-AUTO §21).
 *
 * Fetches GET /api/marketplace/inbox and maps the response onto a
 * client outcome union. §72 discipline: an empty response is
 * distinct from an unauthorized / errored response.
 */
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type {
  InboxItem,
  InboxWorkspace,
  InboxCategory,
  InboxUnreadCounts,
} from '@shared/marketplace/inboxItem';

export type InboxOutcome =
  | { status: 'ok'; items: InboxItem[]; unread: InboxUnreadCounts; unreadDegraded?: boolean }
  | { status: 'workspace_unavailable' }
  | { status: 'auth_required' }
  | { status: 'error' };

interface Options {
  workspace: InboxWorkspace;
  category?: InboxCategory;
  limit?: number;
  locale?: 'he' | 'en';
  enabled?: boolean;
  staleTimeMs?: number;
}

export function useInboxItems(opts: Options) {
  const enabled = Boolean(opts.enabled ?? true);
  const params = new URLSearchParams();
  params.set('workspace', opts.workspace);
  if (opts.category) params.set('category', opts.category);
  if (typeof opts.limit === 'number') params.set('limit', String(opts.limit));
  if (opts.locale) params.set('locale', opts.locale);

  const q = useQuery<InboxOutcome>({
    queryKey: ['/api/marketplace/inbox', opts.workspace, opts.category, opts.limit, opts.locale],
    enabled,
    retry: false,
    staleTime: opts.staleTimeMs ?? 20_000,
    queryFn: async () => {
      try {
        const res = await apiRequest('GET', `/api/marketplace/inbox?${params.toString()}`);
        const body: any = await (res as Response).json();
        if (body && Array.isArray(body.items) && body.unread) {
          return {
            status: 'ok',
            items: body.items as InboxItem[],
            unread: body.unread as InboxUnreadCounts,
            unreadDegraded: Boolean(body.unreadDegraded),
          };
        }
        return { status: 'error' };
      } catch (err: any) {
        const code = err?.status ?? err?.response?.status;
        if (code === 401) return { status: 'auth_required' };
        if (code === 403) return { status: 'workspace_unavailable' };
        return { status: 'error' };
      }
    },
  });

  return {
    outcome: q.data,
    items: q.data?.status === 'ok' ? q.data.items : undefined,
    unread: q.data?.status === 'ok' ? q.data.unread : undefined,
    isLoading: q.isLoading,
    isError: q.isError,
    refetch: q.refetch,
  };
}

/**
 * CommunicationHubService — CEO Business Doctrine §22, §23, §89, §92.
 *
 * ONE projection over booking chat + chat_threads + attention events
 * that returns `InboxItem[]` for the customer + provider Inbox
 * screens. NOT a new storage universe (§92); a read-model.
 *
 * Sources are INJECTED so the service stays pure of DB deps:
 *   • bookingConversations — legacy booking-side messages
 *   • chatThreads          — canonical chat_threads spine
 *   • attention             — attention feed events surfaced as inbox items
 *
 * The doctrine forbids destructive rewrite of the sources (§23). This
 * service lets the render layer see one consistent Inbox while the
 * two storages remain in place.
 */
import type {
  InboxItem,
  InboxWorkspace,
  InboxCategory,
  InboxUnreadCounts,
} from '../../../shared/marketplace/inboxItem';
import {
  computeUnreadCounts,
  filterByCategory,
} from '../../../shared/marketplace/inboxItem';

export interface HubSource {
  listBookingConversationInboxItems(uid: string, workspace: InboxWorkspace): Promise<InboxItem[]>;
  listChatThreadInboxItems(uid: string, workspace: InboxWorkspace): Promise<InboxItem[]>;
  listAttentionInboxItems(uid: string, workspace: InboxWorkspace): Promise<InboxItem[]>;
}

export interface ListForUserOptions {
  workspace: InboxWorkspace;
  category?: InboxCategory;             // default 'ALL'
  limit?: number;                        // default 50
  since?: string;                        // ISO — for incremental refresh
}

export interface HubListResult {
  items: InboxItem[];
  unread: InboxUnreadCounts;
}

/**
 * Sort inbox items newest-first by lastMessageAt. Stable within
 * equal timestamps so pagination is deterministic.
 */
function sortNewestFirst(items: InboxItem[]): InboxItem[] {
  return [...items].sort((a, b) => {
    if (a.lastMessageAt === b.lastMessageAt) return 0;
    return a.lastMessageAt < b.lastMessageAt ? 1 : -1;
  });
}

/**
 * Deduplicate by threadId. Same thread that shows up in both booking
 * conversation and chat_threads is projected once. This is the read-
 * model's job — the sources themselves stay independent.
 */
function dedupeByThreadId(items: InboxItem[]): InboxItem[] {
  const seen = new Set<string>();
  const out: InboxItem[] = [];
  for (const i of items) {
    if (seen.has(i.threadId)) continue;
    seen.add(i.threadId);
    out.push(i);
  }
  return out;
}

/**
 * The one function the Inbox screens call.
 */
export async function listForUser(
  uid: string,
  source: HubSource,
  opts: ListForUserOptions,
): Promise<HubListResult> {
  const { workspace, category = 'ALL', limit = 50, since } = opts;

  const [bookingItems, threadItems, attentionItems] = await Promise.all([
    source.listBookingConversationInboxItems(uid, workspace),
    source.listChatThreadInboxItems(uid, workspace),
    source.listAttentionInboxItems(uid, workspace),
  ]);

  let merged = [...bookingItems, ...threadItems, ...attentionItems];
  merged = dedupeByThreadId(merged);

  if (since) {
    merged = merged.filter((i) => i.lastMessageAt > since);
  }

  const filtered = filterByCategory(merged, workspace, category);
  const sorted = sortNewestFirst(filtered);
  const capped = sorted.slice(0, limit);
  const unread = computeUnreadCounts(merged); // count against the FULL set, not the filtered slice

  return { items: capped, unread };
}

/**
 * Empty-source implementation for boot / tests. Returns [] for every
 * source — the endpoint reaches production with a well-formed empty
 * Inbox while adapters land.
 */
export function createStubHubSource(): HubSource {
  return {
    async listBookingConversationInboxItems() { return []; },
    async listChatThreadInboxItems() { return []; },
    async listAttentionInboxItems() { return []; },
  };
}

/**
 * Production HubSource wired to the three real adapters that landed in
 * CEO NEXT-AUTO §14, §15, §16. Every entry is a live DB read; each
 * adapter is independently fail-CLOSED (an adapter error becomes []
 * for its lane so a partial outage never nukes the whole Inbox).
 *
 * The imports are LAZY (dynamic import()) for two reasons:
 *   • Boot-time cycles: the adapter modules touch shared/schema, which
 *     itself imports through this service in test setups. Lazy loading
 *     breaks any circular startup order.
 *   • Cloud Run cold-start: an unused adapter never pays its module-load
 *     cost until the first real Inbox request.
 */
export function createProductionHubSource(): HubSource {
  return {
    async listBookingConversationInboxItems(uid, workspace) {
      try {
        const { listBookingConversationInboxItems } = await import('./BookingConversationInboxAdapter');
        return await listBookingConversationInboxItems(uid, workspace);
      } catch {
        return [];
      }
    },
    async listChatThreadInboxItems(uid, workspace) {
      try {
        const { listChatThreadInboxItems } = await import('./ChatThreadInboxAdapter');
        return await listChatThreadInboxItems(uid, workspace);
      } catch {
        return [];
      }
    },
    async listAttentionInboxItems(uid, workspace) {
      try {
        const { listAttentionInboxItems } = await import('./AttentionInboxAdapter');
        return await listAttentionInboxItems(uid, workspace);
      } catch {
        return [];
      }
    },
  };
}

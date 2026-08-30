/**
 * CommunicationHubService — CEO Business Doctrine §22, §23, §89, §92,
 * plus DEEP-LOGIC §7 (localization) and §8/§9 (degraded ≠ empty).
 *
 * ONE projection over booking chat + chat_threads + attention events
 * that returns `InboxItem[]` for the customer + provider Inbox
 * screens. NOT a new storage universe (§92); a read-model.
 *
 * The doctrine forbids destructive rewrite of the sources (§23). This
 * service lets the render layer see one consistent Inbox while the
 * two storages remain in place.
 *
 * Health-aware contract (§8/§9):
 *   Every source method returns `{ items, degraded? }`. A degraded
 *   lane surfaces as `sourceHealth.<lane> = 'degraded'` on the result;
 *   the client can render "Some messages couldn't be loaded" instead
 *   of showing an empty inbox. "Fail-CLOSED" was the wrong label for
 *   a read projection error — this is a "degraded / partial" outcome.
 *
 * Locale (§7):
 *   `listForUser` accepts `locale` and passes it to every source. The
 *   attention source uses it to server-render Hebrew or English
 *   strings; the chat sources ignore it (chat messages travel in the
 *   author's language).
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

export type InboxLocale = 'he' | 'en';

export interface HubSourceOptions {
  locale: InboxLocale;
}

export type HubSourceLane = 'bookingChat' | 'threadChat' | 'attention' | 'documents';
export type SourceHealth = 'ok' | 'degraded';

export interface HubSourceResult {
  items: InboxItem[];
  degraded?: boolean;
}

export interface HubSource {
  listBookingConversationInboxItems(
    uid: string,
    workspace: InboxWorkspace,
    opts: HubSourceOptions,
  ): Promise<HubSourceResult>;
  listChatThreadInboxItems(
    uid: string,
    workspace: InboxWorkspace,
    opts: HubSourceOptions,
  ): Promise<HubSourceResult>;
  listAttentionInboxItems(
    uid: string,
    workspace: InboxWorkspace,
    opts: HubSourceOptions,
  ): Promise<HubSourceResult>;
  /**
   * CEO NEXT-AUTO §11 Lane A — Documents. Optional so a caller can
   * still bind only the chat + attention lanes; the aggregator
   * skips this lane when not implemented.
   */
  listDocumentInboxItems?(
    uid: string,
    workspace: InboxWorkspace,
    opts: HubSourceOptions,
  ): Promise<HubSourceResult>;
}

export interface ListForUserOptions {
  workspace: InboxWorkspace;
  category?: InboxCategory;             // default 'ALL'
  limit?: number;                        // default 50
  since?: string;                        // ISO — for incremental refresh
  locale?: InboxLocale;                  // default 'he'
}

export interface HubListResult {
  items: InboxItem[];
  unread: InboxUnreadCounts;
  sourceHealth: Record<HubSourceLane, SourceHealth>;
  partial: boolean;
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
 * CEO DEEP-LOGIC §10, §11 — canonical dedupe key.
 *
 * The prior dedupeByCanonicalIdentity(...) collapsed items when their raw
 * threadId strings matched. In practice each lane produces
 * structurally distinct threadIds (BC-{nanoid} for booking-
 * conversations, UUIDs for chat_threads, `attention:{itemId}` for
 * Attention). The real risk the doctrine calls out is the opposite:
 * when the SAME business booking has both a bookingConversation row
 * AND a chat_threads spine row, the two lanes produce different
 * threadIds and the projection surfaces the booking TWICE.
 *
 * The canonical key resolves that:
 *   • Attention items keep their own namespace (their threadId
 *     already starts with `attention:`), so they NEVER dedupe with a
 *     chat card — §11 discipline: "Booking has a human conversation.
 *     Attention says: `Maya proposed a change.` Both may appear."
 *   • Every other item uses `${threadType}:${entityId}` as its
 *     canonical key. Two BOOKING chats for the same booking (one
 *     bookingConversations, one chat_threads) collapse; a SUPPORT
 *     case that happens to reference the same booking DOES NOT
 *     merge because its threadType is SUPPORT.
 *
 * Order-preserving: the FIRST occurrence in the merged list wins.
 * Callers control that order by passing lanes to the hub in the
 * priority order they want dedupe to prefer (chat_threads first
 * today since it is the spine of newer traffic).
 */
function canonicalKey(i: InboxItem): string {
  if (i.threadId.startsWith('attention:')) return i.threadId;
  return `${i.threadType}:${i.entityId}`;
}

function dedupeByCanonicalIdentity(items: InboxItem[]): InboxItem[] {
  const seen = new Set<string>();
  const out: InboxItem[] = [];
  for (const i of items) {
    const key = canonicalKey(i);
    if (seen.has(key)) continue;
    seen.add(key);
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
  const { workspace, category = 'ALL', limit = 50, since, locale = 'he' } = opts;
  const sourceOpts: HubSourceOptions = { locale };

  const [bookingRes, threadRes, attentionRes, documentRes] = await Promise.all([
    source.listBookingConversationInboxItems(uid, workspace, sourceOpts),
    source.listChatThreadInboxItems(uid, workspace, sourceOpts),
    source.listAttentionInboxItems(uid, workspace, sourceOpts),
    source.listDocumentInboxItems ? source.listDocumentInboxItems(uid, workspace, sourceOpts) : Promise.resolve<HubSourceResult>({ items: [] }),
  ]);

  const sourceHealth: Record<HubSourceLane, SourceHealth> = {
    bookingChat: bookingRes.degraded ? 'degraded' : 'ok',
    threadChat: threadRes.degraded ? 'degraded' : 'ok',
    attention: attentionRes.degraded ? 'degraded' : 'ok',
    documents: documentRes.degraded ? 'degraded' : 'ok',
  };
  const partial =
    sourceHealth.bookingChat === 'degraded' ||
    sourceHealth.threadChat === 'degraded' ||
    sourceHealth.attention === 'degraded' ||
    sourceHealth.documents === 'degraded';

  let merged = [...bookingRes.items, ...threadRes.items, ...attentionRes.items, ...documentRes.items];
  merged = dedupeByCanonicalIdentity(merged);

  if (since) {
    merged = merged.filter((i) => i.lastMessageAt > since);
  }

  const filtered = filterByCategory(merged, workspace, category);
  const sorted = sortNewestFirst(filtered);
  const capped = sorted.slice(0, limit);
  const unread = computeUnreadCounts(merged); // count against the FULL set, not the filtered slice

  return { items: capped, unread, sourceHealth, partial };
}

/**
 * Empty-source implementation for boot / tests. Returns { items: [] }
 * with `degraded` unset for every source — the endpoint reaches
 * production with a well-formed empty Inbox while adapters land.
 */
export function createStubHubSource(): HubSource {
  return {
    async listBookingConversationInboxItems() { return { items: [] }; },
    async listChatThreadInboxItems() { return { items: [] }; },
    async listAttentionInboxItems() { return { items: [] }; },
    async listDocumentInboxItems() { return { items: [] }; },
  };
}

/**
 * Production HubSource wired to the three real adapters that landed in
 * CEO NEXT-AUTO §14, §15, §16. Every entry is a live DB read; each
 * adapter is independently DEGRADED-aware — an adapter throw becomes
 * `{ items: [], degraded: true }` for its lane so a partial outage
 * surfaces on `sourceHealth.<lane>` instead of being hidden as an
 * empty inbox (CEO DEEP-LOGIC §8/§9).
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
    async listBookingConversationInboxItems(uid, workspace, opts) {
      try {
        const { listBookingConversationInboxItems } = await import('./BookingConversationInboxAdapter');
        const items = await listBookingConversationInboxItems(uid, workspace);
        return { items };
      } catch {
        return { items: [], degraded: true };
      }
    },
    async listChatThreadInboxItems(uid, workspace, opts) {
      try {
        const { listChatThreadInboxItems } = await import('./ChatThreadInboxAdapter');
        const items = await listChatThreadInboxItems(uid, workspace);
        return { items };
      } catch {
        return { items: [], degraded: true };
      }
    },
    async listAttentionInboxItems(uid, workspace, opts) {
      try {
        const { listAttentionInboxItems } = await import('./AttentionInboxAdapter');
        const items = await listAttentionInboxItems(uid, workspace, opts.locale);
        return { items };
      } catch {
        return { items: [], degraded: true };
      }
    },
    async listDocumentInboxItems(uid, workspace) {
      // CEO NEXT-AUTO §11 Lane A — real Documents projected via
      // PostgresDocumentSource + DocumentInboxService. Fail-soft: a
      // receipts outage marks the lane degraded, other lanes carry on.
      try {
        const { createPostgresDocumentSource } = await import('./PostgresDocumentSource');
        const { listDocumentInboxItems } = await import('./DocumentInboxService');
        const items = await listDocumentInboxItems(uid, workspace, createPostgresDocumentSource());
        return { items };
      } catch {
        return { items: [], degraded: true };
      }
    },
  };
}

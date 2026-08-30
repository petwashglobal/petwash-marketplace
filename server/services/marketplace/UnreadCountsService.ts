/**
 * UnreadCountsService — CEO DEEP-LOGIC §19, §20.
 *
 * The prior Inbox response advertised a `global` unread number, but
 * the underlying `computeUnreadCounts(merged)` walked only the items
 * that were fetched for the requested workspace. A call for
 * `workspace=PET_PARENT` therefore always saw `provider = 0`, so
 * `global = petParent + 0`. That was a lie.
 *
 * This service builds real per-workspace counts with SQL SUMs — no
 * history hydration (§20). Two independent projections:
 *
 *   – countPetParentUnread(uid)
 *       booking_conversations.customer_unread WHERE customer_id = uid
 *     + chat_threads.unread_customer_count    WHERE customer_user_id = uid
 *
 *   – countProviderUnread(uid)
 *       booking_conversations.provider_unread WHERE provider_id = uid
 *     + chat_threads.unread_provider_count    WHERE provider_user_id = uid
 *
 * Attention items count as informational nudges, not "unread messages"
 * — the doctrine's Inbox distinguishes conversation unread from action
 * needsAction. Attention badges live on their own counter.
 *
 * Failure discipline: an individual SUM that fails is treated as
 * `null` (degraded) and reported to the caller via `degraded: {…}`
 * flags on the result. `global` still adds up whatever COMPLETED so
 * the number is honest about its scope.
 */
import { eq, sql } from 'drizzle-orm';
import { db } from '../../db';
import { bookingConversations } from '@shared/schema';
import { chatThreads } from '@shared/schema-chat';

export interface UnreadTotals {
  petParent: number;
  provider: number;
  global: number;
  degraded: {
    bookingConversationsPetParent: boolean;
    bookingConversationsProvider: boolean;
    chatThreadsPetParent: boolean;
    chatThreadsProvider: boolean;
  };
}

async function sumOrDegraded(query: () => Promise<{ total: number | null }[]>): Promise<{ value: number; degraded: boolean }> {
  try {
    const rows = await query();
    const raw = rows?.[0]?.total ?? 0;
    const n = typeof raw === 'number' ? raw : Number(raw);
    return { value: Number.isFinite(n) ? n : 0, degraded: false };
  } catch {
    return { value: 0, degraded: true };
  }
}

/**
 * ONE round-trip is preferred but keeping four independent SUMs
 * means a single failed source degrades only its lane, not the whole
 * count. Every query is bounded, indexed, and returns a single row.
 */
export async function loadUnreadTotals(uid: string): Promise<UnreadTotals> {
  const [bcPP, bcPV, ctPP, ctPV] = await Promise.all([
    sumOrDegraded(() =>
      db
        .select({ total: sql<number>`COALESCE(SUM(${bookingConversations.customerUnread}), 0)` })
        .from(bookingConversations)
        .where(eq(bookingConversations.customerId, uid)) as any,
    ),
    sumOrDegraded(() =>
      db
        .select({ total: sql<number>`COALESCE(SUM(${bookingConversations.providerUnread}), 0)` })
        .from(bookingConversations)
        .where(eq(bookingConversations.providerId, uid)) as any,
    ),
    sumOrDegraded(() =>
      db
        .select({ total: sql<number>`COALESCE(SUM(${chatThreads.unreadCustomerCount}), 0)` })
        .from(chatThreads)
        .where(eq(chatThreads.customerUserId, uid)) as any,
    ),
    sumOrDegraded(() =>
      db
        .select({ total: sql<number>`COALESCE(SUM(${chatThreads.unreadProviderCount}), 0)` })
        .from(chatThreads)
        .where(eq(chatThreads.providerUserId, uid)) as any,
    ),
  ]);
  const petParent = bcPP.value + ctPP.value;
  const provider = bcPV.value + ctPV.value;
  return {
    petParent,
    provider,
    global: petParent + provider,
    degraded: {
      bookingConversationsPetParent: bcPP.degraded,
      bookingConversationsProvider: bcPV.degraded,
      chatThreadsPetParent: ctPP.degraded,
      chatThreadsProvider: ctPV.degraded,
    },
  };
}

/**
 * BookingConversationInboxAdapter — CEO NEXT-AUTO §14 + Doctrine §22, §23, §92.
 *
 * Real HubSource.listBookingConversationInboxItems() implementation over
 * the existing `booking_conversations` table. NO new storage universe —
 * this is a read-model that projects a table PetWash already runs into
 * the unified InboxItem shape.
 *
 * Isolation invariants:
 *   • Two bookings between the same customer + provider are TWO threads
 *     (§81) — the natural key here is booking_id (unique per booking).
 *   • Unread counters are per-workspace (§37) — a Pet Parent viewing
 *     their inbox reads customer_unread; a Provider reads provider_unread.
 *     The same UID acting in both workspaces gets DISTINCT counters.
 *   • Chat that is closed / archived is NOT hidden — the doctrine's Inbox
 *     is a history, not a "live threads only" filter. Status is surfaced
 *     via statusBadge so the UI can render it correctly.
 *
 * Contact discipline (§10.2, §80):
 *   • otherParticipant.displayName is a MASKED label ("Pet parent" /
 *     "Provider") when we cannot cheaply resolve a proper display name
 *     from the users table. It is NEVER the raw booking counterparty
 *     email or phone.
 */
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../db';
import { bookingConversations, users } from '@shared/schema';
import type {
  InboxItem,
  InboxWorkspace,
} from '@shared/marketplace/inboxItem';

interface Row {
  conversationId: string;
  bookingId: string;
  platform: string;
  customerId: string;
  providerId: string;
  chatStatus: string;
  customerUnread: number;
  providerUnread: number;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  closedReason: string | null;
}

function displayNameFor(u: { firstName: string | null; lastName: string | null } | undefined, fallback: string): string {
  if (!u) return fallback;
  const first = (u.firstName ?? '').trim();
  const lastInitial = ((u.lastName ?? '').trim()[0] ?? '').toUpperCase();
  if (!first) return fallback;
  return lastInitial ? `${first} ${lastInitial}.` : first;
}

// CEO DEEP-LOGIC §15 — closed reasons that are safe to display to
// the customer. Anything else (internal compliance text, admin
// notes, undocumented values) collapses to a generic "Closed" — the
// raw column value NEVER reaches the UI. The schema comment lists
// completed/cancelled/refunded/disputed/expired but a compliance
// closure may write free text; we cannot let that surface.
const CUSTOMER_SAFE_CLOSED_REASONS: Record<string, string> = {
  completed: 'Completed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
  expired: 'Expired',
};

function statusBadgeFor(chatStatus: string, closedReason: string | null): string | undefined {
  if (chatStatus === 'active') return undefined;
  if (chatStatus === 'archived') return 'Archived';
  if (chatStatus === 'read_only') {
    if (!closedReason) return 'Closed';
    const key = closedReason.toLowerCase();
    // "disputed" is documented but sensitive — surface it as a
    // neutral "Under review" so a customer-facing card doesn't broadcast
    // an open dispute state.
    if (key === 'disputed') return 'Under review';
    const safe = CUSTOMER_SAFE_CLOSED_REASONS[key];
    return safe ? `Closed · ${safe}` : 'Closed';
  }
  return undefined;
}

async function fetchRowsForWorkspace(uid: string, workspace: InboxWorkspace): Promise<Row[]> {
  // A Pet Parent inbox lists the conversations where this uid is the
  // booking customer; a Provider inbox lists the ones where this uid is
  // the assigned provider. Multi-role UIDs get BOTH lists rendered
  // under DISTINCT workspaces — never merged.
  const whereClause = workspace === 'PET_PARENT'
    ? eq(bookingConversations.customerId, uid)
    : eq(bookingConversations.providerId, uid);

  const rows = await db
    .select({
      conversationId: bookingConversations.conversationId,
      bookingId: bookingConversations.bookingId,
      platform: bookingConversations.platform,
      customerId: bookingConversations.customerId,
      providerId: bookingConversations.providerId,
      chatStatus: bookingConversations.chatStatus,
      customerUnread: bookingConversations.customerUnread,
      providerUnread: bookingConversations.providerUnread,
      lastMessageAt: bookingConversations.lastMessageAt,
      lastMessagePreview: bookingConversations.lastMessagePreview,
      closedReason: bookingConversations.closedReason,
    })
    .from(bookingConversations)
    .where(whereClause);

  return rows as Row[];
}

async function fetchOtherDisplayNames(rows: Row[], workspace: InboxWorkspace): Promise<Map<string, { firstName: string | null; lastName: string | null }>> {
  // CEO DEEP-LOGIC §12 — ONE query with `WHERE id IN (...)`. The prior
  // implementation ran Promise.all over per-uid selects, which is N
  // round-trips for N unique correspondents (up to a full page of the
  // Inbox). Never fetch email / phone — the inbox card only needs the
  // masked name, so the projection stays (id, firstName, lastName)
  // only per §10.2.
  const otherUids = new Set<string>();
  for (const r of rows) {
    otherUids.add(workspace === 'PET_PARENT' ? r.providerId : r.customerId);
  }
  if (otherUids.size === 0) return new Map();
  const list = Array.from(otherUids);
  const found = await db
    .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(inArray(users.id, list));
  const map = new Map<string, { firstName: string | null; lastName: string | null }>();
  for (const row of found) {
    map.set(row.id, { firstName: row.firstName, lastName: row.lastName });
  }
  return map;
}

export async function listBookingConversationInboxItems(
  uid: string,
  workspace: InboxWorkspace,
): Promise<InboxItem[]> {
  const rows = await fetchRowsForWorkspace(uid, workspace);
  if (rows.length === 0) return [];

  const nameMap = await fetchOtherDisplayNames(rows, workspace);

  return rows.map<InboxItem>((r) => {
    const isPP = workspace === 'PET_PARENT';
    const otherUid = isPP ? r.providerId : r.customerId;
    const otherRow = nameMap.get(otherUid);
    const otherFallback = isPP ? 'Provider' : 'Pet parent';
    const otherName = displayNameFor(otherRow, otherFallback);
    const lastAt = r.lastMessageAt ? new Date(r.lastMessageAt).toISOString() : new Date(0).toISOString();

    return {
      threadId: r.conversationId,
      threadType: 'BOOKING',
      entityId: r.bookingId,
      workspaceContext: workspace,
      title: otherName,
      subtitle: r.platform,
      otherParticipant: {
        displayName: otherName,
        role: isPP ? 'PROVIDER' : 'BOOKER',
      },
      lastMessage: r.lastMessagePreview ?? '',
      lastMessageAt: lastAt,
      unreadCount: isPP ? r.customerUnread : r.providerUnread,
      statusBadge: statusBadgeFor(r.chatStatus, r.closedReason),
      secondaryActions: [],
    };
  });
}

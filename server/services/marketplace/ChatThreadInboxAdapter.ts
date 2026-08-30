/**
 * ChatThreadInboxAdapter — CEO NEXT-AUTO §15 + Doctrine §22, §23, §92.
 *
 * Real HubSource.listChatThreadInboxItems() implementation over the
 * canonical chat_threads spine. The doctrine ships §92: this is a
 * READ-MODEL — never a new storage universe — that projects rows the
 * platform already writes into the shared InboxItem shape.
 *
 * Workspace routing (§37):
 *   • PET_PARENT sees threads where uid is the customer participant.
 *   • PROVIDER   sees threads where uid is the provider participant.
 *   • A support-owned thread with a customer uid shows only in that
 *     customer's PET_PARENT list — support owners see it in their own
 *     workflow, not through this adapter.
 *   • A single UID acting as both roles gets DISTINCT lists (§37) —
 *     the same row never surfaces under BOTH workspaces from one call.
 *
 * Entity anchoring (§81):
 *   • threadId = chat_threads.thread_id (unique per thread) — never a
 *     participant-heuristic collapse.
 *   • entityId picks the row's actual anchor: bookingId / orderId /
 *     giftId / caseId / applicationId / stationId — first non-null wins
 *     in that priority.
 */
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../db';
import { chatThreads } from '@shared/schema-chat';
import { users } from '@shared/schema';
import type {
  InboxItem,
  InboxWorkspace,
  InboxDomain,
  InboxItemKind,
} from '@shared/marketplace/inboxItem';
import type { ThreadType } from '@shared/marketplace/policyEngine';

interface Row {
  threadId: string;
  threadType: string;
  bookingId: string | null;
  caseId: string | null;
  orderId: string | null;
  giftId: string | null;
  stationId: string | null;
  applicationId: string | null;
  customerUserId: string | null;
  providerUserId: string | null;
  supportOwnerId: string | null;
  status: string;
  unreadCustomerCount: number;
  unreadProviderCount: number;
  lastMessageAt: Date | null;
}

// The chat_threads.thread_type column carries a wider vocabulary than
// the doctrine's InboxItem.threadType. INCIDENT is a SUPPORT flavour;
// FRANCHISE is an ADMIN-side thread. Map them into the inbox vocab
// rather than leaking unknown strings to the UI.
function mapThreadType(t: string): ThreadType {
  switch (t) {
    case 'BOOKING':
    case 'SUPPORT':
    case 'K9000':
    case 'PAW_FINDER':
    case 'SHOP_ORDER':
    case 'GIFT':
    case 'PROVIDER_APPLICATION':
    case 'ADMIN':
      return t;
    case 'INCIDENT':
      return 'SUPPORT';
    case 'FRANCHISE':
      return 'ADMIN';
    default:
      return 'SUPPORT';
  }
}

function itemKindAndDomainFor(t: ThreadType): [InboxItemKind, InboxDomain] {
  // Every chat_threads row is a CONVERSATION; the domain follows the
  // mapped policy ThreadType. K9000 / PAW_FINDER / GIFT / SHOP_ORDER
  // get their own domain so category filtering does not lump them
  // together under SUPPORT.
  switch (t) {
    case 'BOOKING':
    case 'MEET_AND_GREET':       return ['CONVERSATION', 'BOOKING'];
    case 'K9000':                return ['CONVERSATION', 'K9000'];
    case 'PAW_FINDER':           return ['CONVERSATION', 'PAW_FINDER'];
    case 'SHOP_ORDER':           return ['CONVERSATION', 'SHOP'];
    case 'GIFT':                 return ['CONVERSATION', 'EGIFT'];
    case 'PROVIDER_APPLICATION': return ['CONVERSATION', 'PROVIDER'];
    case 'SUPPORT':
    case 'ADMIN':
    default:                     return ['CONVERSATION', 'SUPPORT'];
  }
}

function pickEntityId(r: Row): string {
  return r.bookingId
    ?? r.orderId
    ?? r.giftId
    ?? r.caseId
    ?? r.applicationId
    ?? r.stationId
    ?? r.threadId;
}

function displayNameFor(u: { firstName: string | null; lastName: string | null } | undefined, fallback: string): string {
  if (!u) return fallback;
  const first = (u.firstName ?? '').trim();
  const lastInitial = ((u.lastName ?? '').trim()[0] ?? '').toUpperCase();
  if (!first) return fallback;
  return lastInitial ? `${first} ${lastInitial}.` : first;
}

function statusBadgeFor(status: string): string | undefined {
  if (status === 'active') return undefined;
  if (status === 'archived') return 'Archived';
  return undefined;
}

async function fetchRowsForWorkspace(uid: string, workspace: InboxWorkspace): Promise<Row[]> {
  // Split on workspace BEFORE the query — never merge across roles.
  const whereClause = workspace === 'PET_PARENT'
    ? eq(chatThreads.customerUserId, uid)
    : eq(chatThreads.providerUserId, uid);

  const rows = await db
    .select({
      threadId: chatThreads.threadId,
      threadType: chatThreads.threadType,
      bookingId: chatThreads.bookingId,
      caseId: chatThreads.caseId,
      orderId: chatThreads.orderId,
      giftId: chatThreads.giftId,
      stationId: chatThreads.stationId,
      applicationId: chatThreads.applicationId,
      customerUserId: chatThreads.customerUserId,
      providerUserId: chatThreads.providerUserId,
      supportOwnerId: chatThreads.supportOwnerId,
      status: chatThreads.status,
      unreadCustomerCount: chatThreads.unreadCustomerCount,
      unreadProviderCount: chatThreads.unreadProviderCount,
      lastMessageAt: chatThreads.lastMessageAt,
    })
    .from(chatThreads)
    .where(whereClause);

  return rows as Row[];
}

async function fetchOtherDisplayNames(rows: Row[], workspace: InboxWorkspace): Promise<Map<string, { firstName: string | null; lastName: string | null }>> {
  // CEO DEEP-LOGIC §12 — ONE query with `WHERE id IN (...)`. Previous
  // implementation ran Promise.all over per-uid selects (N round-trips
  // for N correspondents). Projection stays (id, firstName, lastName)
  // only — no email or phone (§10.2).
  const otherUids = new Set<string>();
  for (const r of rows) {
    const other = workspace === 'PET_PARENT' ? r.providerUserId : r.customerUserId;
    if (other) otherUids.add(other);
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

export async function listChatThreadInboxItems(
  uid: string,
  workspace: InboxWorkspace,
): Promise<InboxItem[]> {
  const rows = await fetchRowsForWorkspace(uid, workspace);
  if (rows.length === 0) return [];

  const nameMap = await fetchOtherDisplayNames(rows, workspace);

  return rows.map<InboxItem>((r) => {
    const isPP = workspace === 'PET_PARENT';
    const otherUid = isPP ? r.providerUserId : r.customerUserId;
    const otherRow = otherUid ? nameMap.get(otherUid) : undefined;
    const otherFallback = isPP ? 'Provider' : 'Pet parent';
    const otherName = displayNameFor(otherRow, otherFallback);
    const lastAt = r.lastMessageAt ? new Date(r.lastMessageAt).toISOString() : new Date(0).toISOString();
    const mappedType = mapThreadType(r.threadType);
    const [kind, dom] = itemKindAndDomainFor(mappedType);

    return {
      threadId: r.threadId,
      threadType: mappedType,
      entityId: pickEntityId(r),
      workspaceContext: workspace,
      // CEO DEEP-LOGIC §22 — chat_threads carries conversations for
      // many domains; the map below assigns the correct (kind, domain).
      itemKind: kind,
      domain: dom,
      title: otherName,
      subtitle: mappedType.replace(/_/g, ' ').toLowerCase(),
      otherParticipant: {
        displayName: otherName,
        role: isPP ? 'PROVIDER' : 'BOOKER',
      },
      lastMessage: '',
      lastMessageAt: lastAt,
      unreadCount: isPP ? r.unreadCustomerCount : r.unreadProviderCount,
      statusBadge: statusBadgeFor(r.status),
      secondaryActions: [],
    };
  });
}

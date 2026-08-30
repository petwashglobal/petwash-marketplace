/**
 * InboxItem — CEO Business Doctrine §10.4, §22–§26, §36, §37, §80, §92.
 *
 * The unified read-model that the customer + provider Inbox screens
 * consume. NOT a new storage universe (§92) — this is a PROJECTION
 * over booking chat + chat_threads + attention events, stitched by
 * `CommunicationHubService.listForUser(uid, workspace)`.
 *
 * Two Inbox contexts SHARE this type but their filters differ:
 *   Pet Parent → ALL | MESSAGES | BOOKINGS | ORDERS | PAYMENTS &
 *                DOCUMENTS | SUPPORT
 *   Provider   → ALL | REQUESTS | MESSAGES | ACTIVE JOBS | EARNINGS |
 *                COMPLIANCE | SUPPORT
 *
 * §37 discipline: unread counts are per-workspace. Reading a provider
 * message does NOT mark a customer message read.
 */
import type { ThreadType } from './policyEngine';
import type { ChatActionKind } from './chatActions';

export type InboxWorkspace = 'PET_PARENT' | 'PROVIDER';

export type InboxCategory =
  // Pet Parent categories
  | 'ALL'
  | 'MESSAGES'
  | 'BOOKINGS'
  | 'ORDERS'
  | 'PAYMENTS_AND_DOCUMENTS'
  | 'SUPPORT'
  // Provider categories
  | 'REQUESTS'
  | 'ACTIVE_JOBS'
  | 'EARNINGS'
  | 'COMPLIANCE';

export interface MaskedParticipant {
  displayName: string;                  // "Maya C." — never raw full name
  avatarUrl?: string;
  role: 'BOOKER' | 'PROVIDER' | 'RECIPIENT' | 'MERCHANT' | 'STAFF' | 'SYSTEM';
}

export interface InboxAction {
  kind: ChatActionKind;                 // reuses the doctrine's action catalog
  label: string;                        // §80: specific verbs, no "OK"
  destructive?: boolean;
}

/**
 * CEO DEEP-LOGIC §22 — a card is not always a conversation. The
 * doctrine's Inbox mixes CONVERSATIONs, ATTENTION nudges, PROVIDER
 * REQUESTs, BOOKING/ORDER/PAYMENT events, DOCUMENTs, SUPPORT_CASEs,
 * and EARNINGS events. `itemKind` names WHAT the card is; `domain`
 * names the business area. ThreadType is only meaningful when the
 * card is a CONVERSATION. Both fields are OPTIONAL for backward
 * compatibility with existing InboxItem consumers.
 */
export type InboxItemKind =
  | 'CONVERSATION'
  | 'ATTENTION'
  | 'PROVIDER_REQUEST'
  | 'BOOKING_EVENT'
  | 'ORDER_EVENT'
  | 'PAYMENT_EVENT'
  | 'DOCUMENT'
  | 'SUPPORT_CASE'
  | 'EARNINGS_EVENT';

export type InboxDomain =
  | 'BOOKING'
  | 'PET'
  | 'PROVIDER'
  | 'PRESTIGE'
  | 'SHOP'
  | 'K9000'
  | 'EGIFT'
  | 'WALLET'
  | 'PAYOUT'
  | 'SUPPORT'
  | 'PAW_FINDER';

export interface InboxItem {
  threadId: string;
  threadType: ThreadType;
  entityId: string;                     // bookingId / orderId / giftId / caseId
  workspaceContext: InboxWorkspace;

  // CEO DEEP-LOGIC §22 — optional richer identity.
  itemKind?: InboxItemKind;
  domain?: InboxDomain;

  title: string;
  subtitle: string;
  otherParticipant?: MaskedParticipant;
  petSummary?: string;
  serviceSummary?: string;

  lastMessage: string;
  lastMessageAt: string;                // ISO
  unreadCount: number;

  statusBadge?: string;
  primaryAction?: InboxAction;
  secondaryActions: InboxAction[];
}

export interface InboxUnreadCounts {
  global: number;
  petParent: number;
  provider: number;
}

// ── Category filters (§10.4) ──────────────────────────────────────────

/**
 * Bind ThreadType → default Pet Parent category so the "Bookings" tab
 * shows exactly booking threads, not shop orders or support cases.
 */
export function categoryForPetParent(threadType: ThreadType): InboxCategory {
  switch (threadType) {
    case 'BOOKING':
    case 'MEET_AND_GREET':
      return 'BOOKINGS';
    case 'SHOP_ORDER':
    case 'GIFT':
      return 'ORDERS';
    case 'SUPPORT':
      return 'SUPPORT';
    default:
      return 'ALL';
  }
}

export function categoryForProvider(threadType: ThreadType): InboxCategory {
  switch (threadType) {
    case 'BOOKING':
    case 'MEET_AND_GREET':
      return 'ACTIVE_JOBS';
    case 'PROVIDER_APPLICATION':
      return 'COMPLIANCE';
    case 'SUPPORT':
      return 'SUPPORT';
    default:
      return 'ALL';
  }
}

/**
 * Filter an InboxItem[] to a category. `ALL` returns everything for
 * that workspace unchanged; specific categories filter down.
 */
/**
 * CEO DEEP-LOGIC §23-§27 — richer category mapping when itemKind /
 * domain are present. Falls back to the legacy ThreadType mapping
 * when a caller hasn't set them yet.
 *
 *   MESSAGES              → itemKind === 'CONVERSATION'.
 *   BOOKINGS              → domain === 'BOOKING' (any kind).
 *   ORDERS                → domain === 'SHOP' | 'EGIFT'.
 *   PAYMENTS_AND_DOCUMENTS → itemKind in {PAYMENT_EVENT, DOCUMENT}.
 *   SUPPORT               → itemKind === 'SUPPORT_CASE' or
 *                           domain === 'SUPPORT'.
 *   REQUESTS              → itemKind === 'PROVIDER_REQUEST'.
 *   ACTIVE_JOBS           → domain === 'BOOKING' AND
 *                           itemKind in {CONVERSATION, BOOKING_EVENT}
 *                           (NOT PROVIDER_REQUEST).
 *   EARNINGS              → itemKind === 'EARNINGS_EVENT' or
 *                           domain === 'PAYOUT'.
 *   COMPLIANCE            → domain === 'PROVIDER' (provider
 *                           application / KYC).
 */
function categoryMatchesRich(item: InboxItem, category: InboxCategory): boolean {
  const kind = item.itemKind;
  const dom = item.domain;
  switch (category) {
    case 'MESSAGES':               return kind === 'CONVERSATION';
    case 'BOOKINGS':               return dom === 'BOOKING';
    case 'ORDERS':                 return dom === 'SHOP' || dom === 'EGIFT';
    case 'PAYMENTS_AND_DOCUMENTS': return kind === 'PAYMENT_EVENT' || kind === 'DOCUMENT';
    case 'SUPPORT':                return kind === 'SUPPORT_CASE' || dom === 'SUPPORT';
    case 'REQUESTS':               return kind === 'PROVIDER_REQUEST';
    case 'ACTIVE_JOBS':            return dom === 'BOOKING' && kind !== 'PROVIDER_REQUEST';
    case 'EARNINGS':               return kind === 'EARNINGS_EVENT' || dom === 'PAYOUT';
    case 'COMPLIANCE':             return dom === 'PROVIDER';
    case 'ALL':                    return true;
    default:                       return true;
  }
}

export function filterByCategory(
  items: InboxItem[],
  workspace: InboxWorkspace,
  category: InboxCategory,
): InboxItem[] {
  const scoped = items.filter((i) => i.workspaceContext === workspace);
  if (category === 'ALL') return scoped;
  return scoped.filter((i) => {
    // If the item carries the richer identity (itemKind / domain),
    // use it. Otherwise fall back to the legacy ThreadType mapping so
    // adapters that have not been migrated still filter correctly.
    if (i.itemKind || i.domain) return categoryMatchesRich(i, category);
    const c =
      workspace === 'PET_PARENT'
        ? categoryForPetParent(i.threadType)
        : categoryForProvider(i.threadType);
    return c === category;
  });
}

/**
 * Compute per-workspace unread counts (§37).
 * A single UID acting as both Pet Parent and Provider gets DISTINCT
 * counters — reading a provider thread never marks a customer
 * thread read.
 */
export function computeUnreadCounts(items: InboxItem[]): InboxUnreadCounts {
  let pp = 0;
  let pv = 0;
  for (const i of items) {
    if (i.workspaceContext === 'PET_PARENT') pp += i.unreadCount;
    else if (i.workspaceContext === 'PROVIDER') pv += i.unreadCount;
  }
  return { global: pp + pv, petParent: pp, provider: pv };
}

// ── Isolation guard (§81) ─────────────────────────────────────────────

/**
 * Two bookings between the same customer + provider must show as TWO
 * separate threads. This guard verifies the projection did not
 * collapse them by same-participant heuristic.
 */
export function threadsAreIsolated(
  items: InboxItem[],
): boolean {
  const ids = items.map((i) => i.threadId);
  return new Set(ids).size === ids.length;
}

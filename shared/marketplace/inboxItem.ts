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

export interface InboxItem {
  threadId: string;
  threadType: ThreadType;
  entityId: string;                     // bookingId / orderId / giftId / caseId
  workspaceContext: InboxWorkspace;

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
export function filterByCategory(
  items: InboxItem[],
  workspace: InboxWorkspace,
  category: InboxCategory,
): InboxItem[] {
  const scoped = items.filter((i) => i.workspaceContext === workspace);
  if (category === 'ALL') return scoped;
  return scoped.filter((i) => {
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

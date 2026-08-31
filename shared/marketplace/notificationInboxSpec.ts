/**
 * NotificationInboxSpec — CEO P0-CEP Batch §12.
 *
 * Doctrine: "Every push / email / SMS also lands in an in-app inbox.
 * The user MUST be able to find the message later, even if they
 * cleared the OS notification or missed it entirely. And the inbox
 * itself is authoritative — a delivery failure on push does not
 * mean the message never happened."
 *
 * This file DECLARES the inbox item shape every producer writes and
 * every UI reads, plus two pure evaluators:
 *   • allocateInboxItem(input) → deterministic InboxItem for a given
 *     EventEnvelope (idempotencyKey preserved so the same event
 *     delivered twice produces one row, not two).
 *   • transitionInboxItem(input) → verdict on user-driven state
 *     changes (MARK_READ, MARK_UNREAD, ARCHIVE, RESTORE, DISMISS).
 *
 * No DB, no I/O. The runtime inbox store consumes this spec.
 * Placed in shared/ so client and server agree on shape.
 */

/**
 * Every inbox item MUST be classified into exactly one purpose so
 * the client can render sections consistently and the user can
 * filter. Closed union — new purposes land here first.
 */
export const INBOX_ITEM_PURPOSES = [
  // Transactional — the user is expecting these
  'BOOKING_UPDATE',
  'PAYMENT_UPDATE',
  'DOCUMENT_ISSUED',
  'PROVIDER_APPLICATION_UPDATE',
  'ACCOUNT_SECURITY',
  // Relationship — the user opted in
  'MESSAGE_FROM_PROVIDER',
  'MESSAGE_FROM_CUSTOMER',
  // Announcements
  'ANNOUNCEMENT',
  // Marketing (SEPARATED per Batch §13 — user preference gates delivery)
  'MARKETING',
] as const;

export type InboxItemPurpose = (typeof INBOX_ITEM_PURPOSES)[number];

export function isInboxItemPurpose(v: unknown): v is InboxItemPurpose {
  return typeof v === 'string' && (INBOX_ITEM_PURPOSES as readonly string[]).includes(v);
}

/**
 * User-visible state of an inbox row. The runtime lifecycle is
 * strictly acyclic-except-for-toggling-read: an item can go
 * UNREAD ↔ READ any number of times, and ARCHIVED ↔ ACTIVE any
 * number of times, but a DISMISSED item is terminal — it never
 * re-appears in the inbox (though the audit trail persists).
 */
export type InboxItemState = 'UNREAD' | 'READ' | 'ARCHIVED' | 'DISMISSED';

/** Deep-link surface the item's primary CTA opens. */
export interface InboxItemDeepLink {
  code: string;                    // e.g. BOOKING_DETAIL, DOCUMENT_DETAIL
  args?: Record<string, string>;
}

export interface InboxItem {
  /** Deterministic id — usually the envelope's idempotencyKey. */
  itemId: string;
  ownerUid: string;                // whose inbox
  purpose: InboxItemPurpose;
  /** Short, translated label slug (client renders per locale). */
  titleSlug: string;
  /** Optional slug for a one-line body. */
  bodySlug?: string;
  createdAt: Date;
  state: InboxItemState;
  readAt?: Date;
  archivedAt?: Date;
  dismissedAt?: Date;
  deepLink?: InboxItemDeepLink;
  /**
   * Delivery record: did we also try to send this out-of-band?
   * The inbox row is AUTHORITATIVE — a failed push does not mean
   * the message never happened; the user still sees it here.
   */
  outOfBandAttempts: {
    push?: 'sent' | 'failed' | 'suppressed';
    email?: 'sent' | 'failed' | 'suppressed';
    sms?: 'sent' | 'failed' | 'suppressed';
  };
}

/* ------------------------------------------------------------------
 * Allocation
 * ------------------------------------------------------------------ */

export interface AllocateInput {
  ownerUid: string;
  idempotencyKey: string;
  purpose: InboxItemPurpose;
  titleSlug: string;
  bodySlug?: string;
  now: Date;
  deepLink?: InboxItemDeepLink;
  outOfBandAttempts?: InboxItem['outOfBandAttempts'];
}

export type AllocateVerdict =
  | { code: 'OK'; item: InboxItem }
  | { code: 'REJECTED'; reasonCode:
      | 'NO_OWNER'
      | 'EMPTY_IDEMPOTENCY_KEY'
      | 'UNKNOWN_PURPOSE'
      | 'EMPTY_TITLE'
    };

export function allocateInboxItem(input: AllocateInput): AllocateVerdict {
  if (!input.ownerUid.trim()) return { code: 'REJECTED', reasonCode: 'NO_OWNER' };
  if (!input.idempotencyKey.trim()) return { code: 'REJECTED', reasonCode: 'EMPTY_IDEMPOTENCY_KEY' };
  if (!isInboxItemPurpose(input.purpose)) return { code: 'REJECTED', reasonCode: 'UNKNOWN_PURPOSE' };
  if (!input.titleSlug.trim()) return { code: 'REJECTED', reasonCode: 'EMPTY_TITLE' };
  return {
    code: 'OK',
    item: {
      itemId: input.idempotencyKey,
      ownerUid: input.ownerUid,
      purpose: input.purpose,
      titleSlug: input.titleSlug,
      bodySlug: input.bodySlug,
      createdAt: input.now,
      state: 'UNREAD',
      deepLink: input.deepLink,
      outOfBandAttempts: input.outOfBandAttempts ?? {},
    },
  };
}

/* ------------------------------------------------------------------
 * User-driven state transitions
 * ------------------------------------------------------------------ */

export type InboxTransition = 'MARK_READ' | 'MARK_UNREAD' | 'ARCHIVE' | 'RESTORE' | 'DISMISS';

export interface TransitionInboxInput {
  item: InboxItem;
  transition: InboxTransition;
  now: Date;
}

export type TransitionInboxVerdict =
  | { code: 'OK'; next: InboxItem }
  | { code: 'REFUSE'; reasonCode:
      | 'ITEM_DISMISSED'       // terminal
      | 'ILLEGAL_STATE_FOR_TRANSITION'
    };

export function transitionInboxItem(input: TransitionInboxInput): TransitionInboxVerdict {
  const { item, transition, now } = input;
  if (item.state === 'DISMISSED') {
    return { code: 'REFUSE', reasonCode: 'ITEM_DISMISSED' };
  }
  switch (transition) {
    case 'MARK_READ': {
      if (item.state !== 'UNREAD') {
        return { code: 'REFUSE', reasonCode: 'ILLEGAL_STATE_FOR_TRANSITION' };
      }
      return { code: 'OK', next: { ...item, state: 'READ', readAt: now } };
    }
    case 'MARK_UNREAD': {
      if (item.state !== 'READ') {
        return { code: 'REFUSE', reasonCode: 'ILLEGAL_STATE_FOR_TRANSITION' };
      }
      // Clear readAt — the row is unread again.
      const { readAt: _dropped, ...rest } = item;
      void _dropped;
      return { code: 'OK', next: { ...rest, state: 'UNREAD' } };
    }
    case 'ARCHIVE': {
      if (item.state !== 'UNREAD' && item.state !== 'READ') {
        return { code: 'REFUSE', reasonCode: 'ILLEGAL_STATE_FOR_TRANSITION' };
      }
      return { code: 'OK', next: { ...item, state: 'ARCHIVED', archivedAt: now } };
    }
    case 'RESTORE': {
      if (item.state !== 'ARCHIVED') {
        return { code: 'REFUSE', reasonCode: 'ILLEGAL_STATE_FOR_TRANSITION' };
      }
      // Restore lands the item in READ (not UNREAD) — the user
      // already saw it once, restoring is a change of shelf, not a
      // new arrival.
      const { archivedAt: _dropped, ...rest } = item;
      void _dropped;
      return { code: 'OK', next: { ...rest, state: 'READ', readAt: rest.readAt ?? now } };
    }
    case 'DISMISS': {
      // DISMISS is the terminal user choice — legal from any live state.
      return { code: 'OK', next: { ...item, state: 'DISMISSED', dismissedAt: now } };
    }
  }
}

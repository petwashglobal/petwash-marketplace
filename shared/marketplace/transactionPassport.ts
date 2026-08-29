/**
 * Transaction Passport — CEO Business Doctrine §13, §48.
 *
 * Every commercial transaction across the marketplace is traceable via
 * this canonical shape. Bookings, shop orders, K9000 washes, eGifts,
 * wallet moves — all share the SAME passport identifiers so support,
 * audit, dispute, and admin timelines can stitch them together.
 *
 *   transactionId + jobRef + correlationId
 *   → domain
 *   → actors[]
 *   → reference (bookingId / orderId / giftId / stationTx / walletTx)
 *   → money snapshot
 *   → documents index
 *   → fulfillment snapshot
 *   → thread (chat context, when applicable)
 *   → auditEvents[]
 *
 * The passport is a READ MODEL. Domain tables (bookings, shop_orders,
 * etc.) remain the source of truth for their own fields; the passport
 * projects them into one traceable shape. See §18.2 — build read
 * models, not new storage universes.
 */
import type { TransactionActor } from './actors';
import type { DocumentEffect, MoneyEffect } from './action';

export type TransactionDomain =
  | 'BOOKING'
  | 'SHOP'
  | 'K9000'
  | 'EGIFT'
  | 'GIFT'
  | 'WALLET'
  | 'REFUND';

export interface FulfillmentSnapshot {
  status:
    | 'NOT_STARTED'
    | 'IN_PROGRESS'
    | 'DELIVERED'
    | 'CANCELLED'
    | 'FAILED'
    | 'DISPUTED';
  startedAt?: string;
  completedAt?: string;
  cancelReason?: string;
  disputeCaseRef?: string;
}

export interface AuditEvent {
  eventId: string;
  actorUid: string;
  eventType: string;                  // e.g. 'BOOKING_ACCEPT'
  at: string;                         // ISO
  correlationId: string;
  redactedPayload?: Record<string, unknown>; // no secrets
}

export interface ThreadRef {
  threadId: string;
  threadType: 'BOOKING' | 'SUPPORT' | 'SHOP_ORDER' | 'GIFT' | 'PROVIDER_APPLICATION' | 'ADMIN' | 'MEET_AND_GREET';
}

export interface TransactionPassport {
  transactionId: string;              // stable internal id
  jobRef: string;                     // human-readable public id (PW-BKG-…)
  correlationId: string;              // set at intent time, propagated
  domain: TransactionDomain;

  actors: TransactionActor[];         // multiple where applicable (buyer + recipient, booker + provider)

  reference: string;                  // domain-specific id (bookingId / orderId / giftId / stationTx / walletTx)

  money?: MoneyEffect;                // absent for L0 domain-only events
  documents: DocumentEffect[];        // fiscal + receipts (indexed via DocumentIndexEntry)

  fulfillment: FulfillmentSnapshot;
  thread?: ThreadRef;

  auditEvents: AuditEvent[];          // append-only

  createdAt: string;
  updatedAt: string;
}

/**
 * Deterministic passport-id / jobRef helpers. These match the shape the
 * doctrine implies (`PW-BKG-XXXX`, `PW-SHOP-XXXX`, etc.) so admin +
 * support can grep by prefix.
 */
const DOMAIN_PREFIX: Record<TransactionDomain, string> = {
  BOOKING: 'BKG',
  SHOP: 'SHOP',
  K9000: 'K9K',
  EGIFT: 'EGIFT',
  GIFT: 'GIFT',
  WALLET: 'WAL',
  REFUND: 'REF',
};

export function makeJobRef(domain: TransactionDomain, id: string): string {
  const prefix = DOMAIN_PREFIX[domain];
  // Keep the id readable — uppercase, trimmed to a reasonable slice.
  const tail = id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
  return `PW-${prefix}-${tail}`;
}

/**
 * Append an event to the passport's audit stream. Pure — returns a new
 * passport, never mutates. (§50 audit discipline: append-only.)
 */
export function appendAuditEvent(
  passport: TransactionPassport,
  event: Omit<AuditEvent, 'correlationId'> & { correlationId?: string },
): TransactionPassport {
  const stamped: AuditEvent = {
    ...event,
    correlationId: event.correlationId ?? passport.correlationId,
  };
  return {
    ...passport,
    auditEvents: [...passport.auditEvents, stamped],
    updatedAt: event.at,
  };
}

/**
 * Confirm the passport contains at least one actor with the given role.
 * Used by support / admin to verify who "owns" a receipt or refund
 * before responding.
 */
export function hasActorWithRole(
  passport: TransactionPassport,
  role: TransactionActor['role'],
): boolean {
  return passport.actors.some((a) => a.role === role);
}

/**
 * §43 discipline: eGift buyer holds the receipt; recipient holds the
 * entitlement. Never mix them. This helper is what support uses to
 * answer "whose receipt is this" without accidentally routing the
 * fiscal document to the recipient.
 */
export function receiptOwnerUid(passport: TransactionPassport): string | null {
  const buyer = passport.actors.find((a) => a.role === 'BUYER');
  if (buyer) return buyer.uid;
  const booker = passport.actors.find((a) => a.role === 'BOOKER');
  return booker ? booker.uid : null;
}

/**
 * §47 discipline: provider earnings surface uses the PROVIDER actor,
 * not the buyer. This helper enforces the separation so a
 * dashboard-side call site cannot accidentally show the customer's
 * receipt inside provider earnings.
 */
export function providerEarningsUid(passport: TransactionPassport): string | null {
  if (passport.domain !== 'BOOKING') return null;
  const provider = passport.actors.find((a) => a.role === 'PROVIDER');
  return provider ? provider.uid : null;
}

/**
 * Attention feed — the "what needs my attention" projection each
 * workspace home renders (CEO 2026-08-26 §27-29).
 *
 * The rule: home pages should ANSWER what the actor needs to do next,
 * not fan out 20 disconnected modules. One canonical read model, one
 * shape, one endpoint per actor.
 *
 * This file is types only. The composer lives at
 * server/services/attentionFeed.ts and the endpoints at
 * server/routes/attention.ts.
 */

/** Which actor is asking. */
export type AttentionActor = 'pet_parent' | 'provider';

/**
 * The domain the item belongs to. Client uses this to pick the icon
 * and to route the tap into the right surface without a second API
 * lookup.
 */
export type AttentionDomain =
  | 'booking'      // a booking needs a decision, a payment, a review
  | 'walk'         // a live walk / walker on the way
  | 'sitting'      // a sitter stay confirm / arrival / handoff
  | 'academy'      // a trainer session
  | 'shop'         // an order awaiting action
  | 'wallet'       // top-up needed / refund landed
  | 'egift'        // received / expiring
  | 'prestige'     // benefit ready / tier progress
  | 'paw_finder'   // incoming contact / match
  | 'pet_passport' // vaccine due / doc expiring
  | 'profile'      // missing field / verification pending
  | 'kyc';         // provider onboarding step

/**
 * The concrete action the actor is expected to take. Client renders
 * this as the primary CTA on the card and the analytics event name.
 */
export type AttentionAction =
  | 'pay'
  | 'confirm'
  | 'review'
  | 'accept_or_decline'
  | 'start'
  | 'complete'
  | 'track'
  | 'open_chat'
  | 'open_document'
  | 'top_up'
  | 'claim'
  | 'upload'
  | 'view';

export type AttentionPriority = 'urgent' | 'due_soon' | 'informational';

/** Optional money summary the client shows on the card. */
export interface AttentionMoneySummary {
  amountCents: number;
  currency: 'ILS';
  /** e.g. "Amount due" / "Amount you'll receive". Server-localised. */
  label: string;
}

export interface AttentionItem {
  /** Stable per (actor, domain, entityId) so a client can dedupe / patch. */
  id: string;
  actor: AttentionActor;
  domain: AttentionDomain;
  /** The primary business entity the card is about (bookingId / orderId / etc.). */
  entityId: string;
  priority: AttentionPriority;
  /** Short heading — already localised. */
  title: string;
  /** One-line "why this is here" — already localised. */
  reason: string;
  nextAction: AttentionAction;
  /** ISO timestamp when the required action becomes overdue (optional). */
  dueAt?: string;
  moneySummary?: AttentionMoneySummary;
  /** Absolute route the primary CTA opens. */
  destination: string;
}

export interface AttentionFeed {
  actor: AttentionActor;
  /** Ordered urgent → due_soon → informational, then newest first. */
  items: AttentionItem[];
  /** ISO when this feed was composed; client re-reads on a shorter TTL. */
  composedAt: string;
}

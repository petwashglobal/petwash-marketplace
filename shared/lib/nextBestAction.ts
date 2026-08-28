/**
 * NextBestAction — CEO MASTER DIRECTIVE 2026-08-28 §36 §37 §65.
 *
 * Structured code decides WHAT ACTION exists.
 * LLM decides HOW to explain / render it.
 *
 * Distinct from AttentionItem by intent:
 *   * AttentionItem = things that need action NOW (urgent bookings,
 *     expiring documents, refunds in flight)
 *   * NextBestAction = the recommender's answer to "what should this
 *     user do next", including forward-looking suggestions (rebook
 *     Maya, use Prestige benefit, review a completed session)
 *
 * Every action carries a reasonCode so the "Why am I seeing this?"
 * transparency (CEO §23) works: the client resolves the code to
 * localised copy — the server never ships arbitrary strings.
 *
 * Security-level rules (CEO §37):
 *   L0 read/explain              → requiresConfirmation = false
 *   L1 navigation / preferences  → requiresConfirmation = false
 *   L2 business action (send req)→ requiresConfirmation = true
 *   L3 money / legal (pay/cancel)→ requiresConfirmation = true AND
 *                                  actionType MUST be routed through
 *                                  a deterministic backend (never AI)
 */

export type NextBestActionActor = 'pet_parent' | 'provider';

export type NextBestActionDomain =
  | 'booking'
  | 'walk'
  | 'sitting'
  | 'academy'
  | 'shop'
  | 'wallet'
  | 'egift'
  | 'prestige'
  | 'pet_passport'
  | 'kyc'
  | 'profile'
  | 'referral'
  | 'review';

/**
 * The action label the client renders as a CTA / analytics event.
 * Superset of AttentionAction — recommender-only verbs (rebook, star,
 * try_similar) live here.
 */
export type NextBestActionType =
  | 'view'
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
  | 'rebook'
  | 'try_similar'
  | 'star'
  | 'use_benefit'
  | 'update_availability'
  | 'renew_document';

/**
 * Stable reason codes. Localised copy lives on the client. A refactor
 * that added a new domain MUST add a matching code — the client
 * fallback treats unknown codes as generic "recommended for you".
 */
export type NextBestActionReasonCode =
  | 'BOOKING_PAYMENT_DUE'
  | 'BOOKING_STARTS_SOON'
  | 'BOOKING_PROVIDER_ACCEPTED'
  | 'BOOKING_AWAITING_YOU'
  | 'BOOKING_REVIEW_AVAILABLE'
  | 'BOOKING_REQUEST_WAITING'
  | 'JOURNEY_RESUME_SAVED'
  | 'SAVED_SEARCH_CONTINUE'
  | 'FAVOURITE_REBOOK'
  | 'REFUND_IN_PROGRESS'
  | 'EGIFT_BALANCE_AVAILABLE'
  | 'EGIFT_EXPIRING_SOON'
  | 'WALLET_BALANCE_AVAILABLE'
  | 'WASH_PACKAGE_AVAILABLE'
  | 'PRESTIGE_BENEFIT_AVAILABLE'
  | 'KYA_STALE_REVIEW'
  | 'PROVIDER_INSURANCE_EXPIRING'
  | 'PROVIDER_KYC_DOC_EXPIRING'
  | 'PROVIDER_PAYOUT_AVAILABLE'
  | 'PROVIDER_AVAILABILITY_STALE'
  | 'PROVIDER_REQUEST_WAITING';

/**
 * The recommender priority — a ranking hint the client uses to pick
 * how many cards to render. Independent of the AttentionItem priority
 * because a low-urgency but high-fit recommendation (rebook Maya)
 * should still sort above a low-fit informational (marginal wallet
 * balance).
 */
export type NextBestActionPriority = 'critical' | 'high' | 'normal' | 'low';

export interface NextBestAction {
  /** Stable per (actor, reasonCode, entityRef) so a client can dedupe. */
  id: string;
  actor: NextBestActionActor;
  domain: NextBestActionDomain;
  /** The primary business entity the card is about; null for domain-level nudges. */
  entityRef?: string | null;
  reasonCode: NextBestActionReasonCode;
  priority: NextBestActionPriority;
  actionType: NextBestActionType;
  /** Absolute route the primary CTA opens — MUST be a mounted client route. */
  destination: string;
  /** ISO timestamp when the action becomes obsolete (optional). */
  expiresAt?: string;
  /**
   * The recommender's confidence 0..1. Absent when the recommender
   * used a deterministic rule (e.g. payment due — score 1.0 is
   * implicit). Present when a scoring model produced the item.
   */
  recommendationScore?: number;
  /** CEO §37 L2/L3 gate. Client wraps the CTA in a confirm modal. */
  requiresConfirmation: boolean;
  /**
   * Money hint the client can render on the card without a second
   * API call. NEVER the source of truth — canonical ledgers own the
   * real number.
   */
  moneyHintCents?: number;
}

export interface NextBestActionFeed {
  actor: NextBestActionActor;
  /** Ordered critical → high → normal → low, then by expiresAt. */
  actions: NextBestAction[];
  composedAt: string;
}

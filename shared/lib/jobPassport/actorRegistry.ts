/**
 * PetWash Actor Registry — CEO 2026-08-27 §4 "First Important Model — Actors".
 *
 * STOP ASSUMING EVERY TRANSACTION HAS A "PROVIDER".
 * Different platforms have different fulfiller kinds. This registry is
 * the ONE place that names them.
 *
 * These are TYPES ONLY. Auth still comes from Firebase; provider
 * identity still comes from provider_applications / provider_services.
 * This file names what those authorities MEAN in the JobPassport read
 * model.
 */

/**
 * Who is acting or being acted upon. Every actor slot in a JobPassport
 * (customer, fulfiller, actor of an audit event) picks one of these.
 *
 *   CUSTOMER          — pet parent / washer / purchaser / eGift buyer.
 *   PROVIDER          — an approved external fulfiller (sitter, walker,
 *                       trainer, driver). Identified by a Firebase UID.
 *   PETWASH_STAFF     — an internal PetWash employee (shop pickup,
 *                       admin actions). Identified by a Firebase UID
 *                       + role claims.
 *   PETWASH_MERCHANT  — PetWash-the-seller (SHOP, EGIFT). Not a person;
 *                       a legal entity slot for accounting/receipts.
 *   MACHINE           — a K9000 station+bay pair, a Nayax terminal, or
 *                       any automated fulfiller. Identified by
 *                       stationId + bayId + terminalId.
 *   SYSTEM            — automated cron / reconciliation / webhook
 *                       actor. No human. Used for audit events like
 *                       "auto-resolved (cron)".
 */
export const ACTOR_KINDS = [
  'CUSTOMER',
  'PROVIDER',
  'PETWASH_STAFF',
  'PETWASH_MERCHANT',
  'MACHINE',
  'SYSTEM',
] as const;

export type ActorKind = (typeof ACTOR_KINDS)[number];

/**
 * A human-readable ActorKind. Server never trusts the client for the
 * kind of the caller — the resolver derives it from the Firebase token
 * + role claims + provider_services membership. This helper is for
 * documentation / display, not authorisation.
 */
export function isProviderKind(kind: ActorKind): boolean {
  return kind === 'PROVIDER';
}

export function isCustomerKind(kind: ActorKind): boolean {
  return kind === 'CUSTOMER';
}

export function isMachineKind(kind: ActorKind): boolean {
  return kind === 'MACHINE';
}

/**
 * The two things that identify a human actor when we resolve them for
 * the JobPassport. Never trusted from client input — always resolved
 * server-side. Kept optional for MACHINE/SYSTEM/MERCHANT slots that
 * have no Firebase UID.
 */
export interface ActorIdentity {
  kind: ActorKind;
  /** Firebase UID when the actor is a human. */
  uid?: string;
  /**
   * Public identifier for display / cross-reference (walker.walkerId,
   * sitter.id, station+bay for MACHINE, 'petwash' for MERCHANT/SYSTEM).
   * NEVER used for authorisation — display only.
   */
  publicId?: string;
  /** Short display name; server-derived, never PII-heavy. */
  displayName?: string;
}

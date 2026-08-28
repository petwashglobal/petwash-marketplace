/**
 * JobPassport DTO — CEO 2026-08-27 §6.
 *
 * ONE operational object per real-world PetWash job. The client MUST
 * NOT construct this by joining 7 APIs; the server composes it.
 *
 * READ MODEL. Not a new table — a projection over existing authorities
 * (§60: Phase 1 is READ-ONLY adapters). Server composer lives at
 * server/services/jobPassport/composer.ts.
 *
 * §19 discipline: booking state ≠ fulfillment state ≠ money state.
 * Each has its own enum. The composer resolves each from the correct
 * authority — money.state comes from financial authority (payment
 * intent / wallet ledger / SUMIT / Nayax), never inferred from
 * booking.status.
 */

import type { ActorIdentity, ActorKind } from './actorRegistry';
import type { PlatformCode } from './platformRegistry';

// ─── Booking state (§19) ────────────────────────────────────────────

export const BOOKING_STATES = [
  'REQUESTED',
  'ACCEPTED',
  'CONFIRMED',
  'CANCELLED',
  'COMPLETED',
] as const;
export type BookingState = (typeof BOOKING_STATES)[number];

// ─── Fulfillment state (§19) ────────────────────────────────────────

export const FULFILLMENT_STATES = [
  'NOT_STARTED',
  'ARRIVED',
  'IN_PROGRESS',
  'PROVIDER_COMPLETED',
  'CUSTOMER_CONFIRMED',
] as const;
export type FulfillmentState = (typeof FULFILLMENT_STATES)[number];

// ─── Money state (§19, §20) ─────────────────────────────────────────

export const MONEY_STATES = [
  'NOT_REQUIRED',       // e.g. eGift redemption where the value was pre-paid
  'PAYMENT_REQUIRED',   // customer must act
  'PAYMENT_PENDING',    // capture in flight (webhook not yet confirmed)
  'PAID',               // financial authority confirms funds captured
  'REFUND_PENDING',
  'REFUNDED',
  'PAYOUT_PENDING',     // provider-side: earnings held in escrow
  'PAYOUT_AVAILABLE',
  'PAYOUT_PAID',
] as const;
export type MoneyState = (typeof MONEY_STATES)[number];

// ─── Allowed action (§23) ───────────────────────────────────────────

export const ACTION_CODES = [
  'RESPOND',                // provider accepts/declines request
  'PAY',                    // customer completes payment
  'SHOW_PICKUP_CODE',       // shop: reveal handoff code
  'ENTER_HANDOFF_PIN',      // walk/sitter first entry
  'SCAN_STATION_QR',        // K9000
  'START_SERVICE',          // provider slides to start
  'TRACK',                  // customer views live tracking
  'FINISH_SERVICE',         // provider slides to finish
  'CONFIRM_COMPLETION',     // customer confirms provider is done
  'REVIEW',                 // customer leaves review
  'CANCEL',
  'MESSAGE',
  'VIEW_DETAILS',
  'WAIT_FOR_PAYMENT',       // display-only — enabled:false
  'WAIT_FOR_PROVIDER',      // display-only
  'WAIT_FOR_CUSTOMER',      // display-only
] as const;
export type ActionCode = (typeof ACTION_CODES)[number];

/** §14 verification method a specific action requires. */
export const VERIFICATION_METHODS = [
  'NONE',
  'SERVER_STATE',
  'PIN',
  'QR',
  'GEOFENCE',
  'CUSTOMER_CONFIRMATION',
  'STAFF_CONFIRMATION',
  'MACHINE_BINDING',
] as const;
export type VerificationMethod = (typeof VERIFICATION_METHODS)[number];

export interface AllowedAction {
  code: ActionCode;
  enabled: boolean;
  /** True when the action MUST pass an extra verification (§14). */
  requiresVerification: boolean;
  verificationMethod?: VerificationMethod;
  /** Localised, ready-to-render primary label. */
  label: string;
  /** Optional secondary explanation for the "WAIT_FOR_*" display forms. */
  hint?: string;
}

// ─── Money summary (§21) ────────────────────────────────────────────

export interface MoneyLeg {
  kind: 'PRESTIGE_BENEFIT' | 'EGIFT' | 'WALLET' | 'CARD' | 'CASH' | 'REFUND';
  amountCents: number;
  currency: 'ILS';
  label: string;
}

export interface JobMoney {
  state: MoneyState;
  currency: 'ILS';
  totalCents: number;
  amountPaidCents: number;
  amountDueCents: number;
  /**
   * Provider-side money slots. Only populated when the actor is the
   * PROVIDER on this job. §22: provider must never see PAID because
   * the booking says complete — only real payout authority can.
   */
  providerExpectedCents?: number;
  providerAvailableCents?: number;
  providerPaidCents?: number;
  /**
   * Detailed legs the customer's card can render — never invented, only
   * populated with legs the composer has real evidence for.
   */
  legs: MoneyLeg[];
}

// ─── Verification summary (§14, §16) ────────────────────────────────

export interface JobVerification {
  /** Method policy expects for START. Read-only view of the registry. */
  startMethod: VerificationMethod;
  /** Method policy expects for COMPLETION. */
  completionMethod: VerificationMethod;
  /** Handoff / pickup / entry credential state today. */
  handoffState: 'NONE' | 'ISSUED' | 'CONSUMED' | 'EXPIRED' | 'REVOKED';
  /** ISO expiry when a live handoff credential exists (never the raw code). */
  handoffExpiresAt?: string;
}

// ─── Location + schedule + fulfiller + pets ─────────────────────────

export interface JobLocation {
  type: 'CUSTOMER_HOME' | 'PROVIDER_HOME' | 'K9000_STATION' | 'SHOP_PICKUP' | 'WALK_START' | 'UNKNOWN';
  /** Server-composed display string (redacted per privacy policy). */
  display: string;
  lat?: number;
  lng?: number;
}

export interface JobSchedule {
  startsAt: string;   // ISO
  endsAt?: string;    // ISO
  timezone: string;   // 'Asia/Jerusalem' default
}

export interface JobFulfiller {
  kind: ActorKind;
  providerUid?: string;         // for PROVIDER kind
  providerPublicId?: string;    // display id
  providerServiceId?: string;   // §35 provenance
  displayName?: string;
  verifiedBadge?: boolean;      // §7 approved for THIS service
  serviceApproved?: boolean;    // provider_services membership check
  suspended?: boolean;          // §36 current safety check
}

export interface JobPet {
  petId: string;         // canonical PET_ID
  displayName: string;   // "Bruno"
  breed?: string;
  /** Snapshot flag: TRUE when the pet's important care instructions
   *  differ from the historical booking-time snapshot (§37). */
  careNotesSnapshotStale?: boolean;
}

export interface JobBookingRef {
  canonicalId: string;         // e.g. 'BR-...' or 'W-42'
  source: 'booking_requests' | 'sitter_bookings' | 'walk_bookings' | 'trainer_bookings' | 'pettrek_bookings' | 'shop_orders' | 'k9000_redemptions' | 'egift_orders';
  sourceId: string;
  status: BookingState;
}

export interface JobFulfillment {
  state: FulfillmentState;
  startedAt?: string;
  completedAt?: string;
}

export interface JobAuditRef {
  eventType: string;
  timestamp: string;
  actorKind: ActorKind;
  /** Truncated for display; the full uid stays in the audit_events row. */
  actorUidTail?: string;
}

// ─── The passport itself ────────────────────────────────────────────

export interface JobPassport {
  /** §2 human-readable, safe to display anywhere. */
  jobRef: string;
  /** §3 spine linking booking / payment / SUMIT / Nayax / calendar. */
  correlationId: string;

  platform: PlatformCode;
  serviceType: string;

  customer: {
    userId: string;
    displayName?: string;
  };

  fulfiller: JobFulfiller;
  pets: JobPet[];
  location: JobLocation;
  schedule: JobSchedule;

  booking: JobBookingRef;
  fulfillment: JobFulfillment;
  money: JobMoney;
  verification: JobVerification;

  /** §23 — server owns this. Client never invents allowed actions. */
  allowedActions: AllowedAction[];

  /** §30 — recent transitions, most-recent first. Bounded. */
  auditRefs: JobAuditRef[];

  /** ISO timestamp when this passport was composed. */
  composedAt: string;
}

/**
 * A slim actor identity payload the composer attaches so the caller
 * (client / admin explorer) knows who this passport was composed FOR.
 * The passport itself is neutral; the "view" is per-actor.
 */
export interface JobPassportViewFor {
  actor: ActorIdentity;
  /** Whether the actor may see money.provider* slots. */
  showsProviderMoney: boolean;
  /** Whether the actor may see live tracking. */
  showsLiveTracking: boolean;
}

export interface JobPassportEnvelope {
  passport: JobPassport;
  viewFor: JobPassportViewFor;
}

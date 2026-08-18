/**
 * Canonical PetWash domain vocabulary.
 *
 * Per CEO 2026-08-18 WhatIDog + Rover/Mad Paws benchmark directive:
 *   - ONE HUMAN IDENTITY.
 *   - ONE PET PROFILE.
 *   - ONE BOOKING AUTHORITY.
 *   - ONE SERVICE SESSION.
 *   - ONE PROVIDER PROFILE.
 *   - ONE CALENDAR.
 *   - ONE LOCATION SESSION.
 *   - ONE NOTIFICATION EVENT MODEL.
 *   - ONE MONEY/LEDGER SYSTEM.
 *
 * Different UI modes are VIEWS of the same backend state.
 *
 * ─── Scope of THIS file ────────────────────────────────────────────────────
 * Pure TypeScript type definitions — no runtime code, no schema migrations,
 * no side effects. Future PRs migrate service-specific tables/routes to use
 * these types instead of inventing per-surface vocabulary.
 *
 * The BookingStatus state machine already lives at
 * `shared/lib/bookingStateMachine.ts` — that is the AUTHORITY on legal
 * transitions. This file adds the surrounding domain vocabulary that CEO's
 * benchmark directive asks us to canonize.
 *
 * ─── What this file does NOT do ────────────────────────────────────────────
 * - Does NOT create new tables.
 * - Does NOT modify existing enums.
 * - Does NOT run any code at import time.
 * - Does NOT change any money math, receipt/VAT/payout, or auth policy.
 */

import type { BookingStatus } from './bookingStateMachine';

// ─── User capabilities (CEO §"ONE IDENTITY / MULTIPLE CAPABILITIES") ──────
//
// A human has ONE canonical account (Firebase UID + users.id). Capabilities
// are ADDITIVE — never replace another. Rover-style multi-role is the target.
//
// Provider approval ADDS a capability; it never removes the customer
// capability. Provider rejection leaves customer intact. Prestige is an
// entitlement attached to the same canonical account, not a separate user.

export type UserCapability =
  | 'customer'
  | 'prestige_member'
  | 'provider_applicant'
  | 'provider_sitter'
  | 'provider_walker'
  | 'provider_trainer'
  | 'provider_boarding'
  | 'provider_transport'
  | 'provider_station_operator'
  | 'staff'
  | 'admin'
  | 'super_admin';

export interface CanonicalIdentity {
  /** Firebase UID — the immutable primary key of a human. */
  uid: string;
  /** All capabilities this human currently holds, additive. */
  capabilities: UserCapability[];
  /** Server-verified email. Null when signup used mobile-only. */
  email: string | null;
  emailVerified: boolean;
  /** Server-normalized E.164. Null when signup used email-only. */
  mobileE164: string | null;
  mobileVerified: boolean;
  displayName: string | null;
  photoUrl: string | null;
}

// ─── Provider application lifecycle (CEO §9 benchmark directive) ──────────
//
// Independent of role='provider' scalar. The provider_applications table
// carries this state; the users table carries the resulting capabilities
// (or lack thereof).

export type ProviderApplicationState =
  | 'draft'
  | 'ready_to_submit'
  | 'submitted'
  | 'under_review'
  | 'more_info_required'
  | 'approved'
  | 'rejected'
  | 'suspended';

export type ProviderServiceCapabilityState =
  | 'not_configured'
  | 'draft'
  | 'pending'
  | 'active'
  | 'paused'
  | 'suspended';

// ─── Pet profile (CEO §"PET PROFILE AS THE CENTER") ────────────────────────
//
// One canonical pet profile per pet. Each booking takes a snapshot of the
// subset it needs — the pet profile itself remains the single source of
// truth and can be edited without mutating past bookings.

export interface PetProfile {
  petId: string;
  ownerUid: string;
  name: string;
  species: 'dog' | 'cat' | 'bird' | 'reptile' | 'small_mammal' | 'other';
  breed: string | null;
  dob: string | null; // ISO date
  sex: 'male' | 'female' | 'unknown';
  weightKg: number | null;
  photoUrl: string | null;
  feedingNotes: string | null;
  medicationNotes: string | null;
  allergies: string | null;
  behaviorNotes: string | null;
  vetContact: string | null;
  vaccinations: string | null;
  emergencyInstructions: string | null;
  archivedAt: string | null;
}

/**
 * The snapshot copied INTO a booking at request time. Immutable per booking.
 * Fields are a subset — never take fields the service does not need.
 */
export interface PetSnapshot {
  petId: string;
  name: string;
  species: PetProfile['species'];
  breed: string | null;
  sex: PetProfile['sex'];
  weightKg: number | null;
  // Service-relevant only. Never snapshot vet PII / emergency contact unless
  // the service actually needs it (boarding/sitting yes; a wash NO).
  feedingNotesSnapshot: string | null;
  medicationNotesSnapshot: string | null;
  allergiesSnapshot: string | null;
  behaviorNotesSnapshot: string | null;
  emergencyInstructionsSnapshot: string | null;
}

// ─── Service session (CEO §"SERVICE SESSION" — the emotional peak) ─────────
//
// Booking and live activity are DIFFERENT concepts:
//   - Booking = commercial agreement / scheduled service
//   - ServiceSession = actual execution of that booking
//
// When provider presses "Start Walk", backend atomically opens a session.
// Only booking participants (owner OR assigned provider) may subscribe.
// Server derives access from booking membership — NEVER trust a
// client-supplied providerId or bookingId on the SSE/WS subscribe.

export type ServiceSessionStatus =
  | 'not_started'
  | 'active'
  | 'paused'
  | 'provider_completed'
  | 'completed'
  | 'abandoned'
  | 'cancelled';

export interface ServiceSession {
  sessionId: string;
  bookingId: string;
  providerId: string;
  customerId: string;
  petIds: string[];
  serviceType: 'dog_walk' | 'pet_sitting' | 'boarding' | 'drop_in' | 'training' | 'pet_transport' | 'k9000_wash';
  status: ServiceSessionStatus;
  startedAt: string | null;
  endedAt: string | null;
  startedLatLng: { lat: number; lng: number } | null;
  endedLatLng: { lat: number; lng: number } | null;
  distanceMeters: number | null;
  durationSeconds: number | null;
  /** Last GPS ping timestamp; UI shows "last updated Xs ago" from this. */
  lastLocationAt: string | null;
  /**
   * Only when the service type includes background GPS. Values other than
   * 'live' MUST make the customer live-map render a "not sharing location"
   * card instead of a stale marker (CEO §"Connection loss").
   */
  locationTrackingPolicy: 'none' | 'live' | 'summary_only';
}

export interface ServiceLocationPoint {
  sessionId: string;
  sequence: number;
  timestampMs: number;
  lat: number;
  lng: number;
  accuracyMeters: number | null;
  speedMps: number | null;
  headingDeg: number | null;
}

// ─── Service report (CEO §"PHOTO REPORT" & §"FINISH WALK") ────────────────

export interface ServiceReport {
  sessionId: string;
  bookingId: string;
  providerId: string;
  submittedAt: string;
  /** Free-form provider notes. Sanitized before display. */
  notes: string | null;
  /** Storage refs (opaque IDs); never raw signed URLs in shared types. */
  photoRefs: string[];
  /** Species-appropriate care checklist entries (dog: pee/poop/water/food/mood). */
  careChecklist: Record<string, 'yes' | 'no' | 'na' | null>;
}

// ─── Canonical booking event (CEO §"NOTIFICATIONS") ────────────────────────
//
// Every meaningful domain transition emits ONE canonical event. Notification
// engine then decides push / email / SMS / in-app fan-out. Route files
// MUST NOT independently send four messages.

export type CanonicalDomainEventType =
  | 'BOOKING_REQUESTED'
  | 'BOOKING_ACCEPTED'
  | 'BOOKING_DECLINED'
  | 'BOOKING_PAYMENT_CONFIRMED'
  | 'BOOKING_CANCELLED'
  | 'MEET_GREET_REQUESTED'
  | 'MEET_GREET_SCHEDULED'
  | 'MEET_GREET_COMPLETED'
  | 'SERVICE_STARTING'
  | 'SERVICE_STARTED'
  | 'SERVICE_LOCATION_STALE'
  | 'SERVICE_COMPLETED'
  | 'REPORT_READY'
  | 'REVIEW_REQUESTED'
  | 'REFUND_ISSUED';

export interface CanonicalDomainEvent<T = Record<string, unknown>> {
  eventId: string;
  eventType: CanonicalDomainEventType;
  emittedAt: string;
  bookingId: string | null;
  sessionId: string | null;
  actorUid: string | null;
  payload: T;
  /** Idempotency key — repeat firings with the same key are dropped. */
  idempotencyKey: string;
}

// ─── Availability (CEO §"ONE CALENDAR" / §21 benchmark directive) ─────────
//
// Same availability record powers:
//   - marketplace search filters
//   - provider dashboard calendar
//   - booking-slot claim
//   - reschedule
// Every service surface reads from THIS shape. No independent
// service-specific availability engine.

export interface AvailabilityWindow {
  providerId: string;
  serviceType: ServiceSession['serviceType'];
  startAt: string; // ISO
  endAt: string;   // ISO
  capacity: number; // e.g., a boarding host may take 2 concurrent dogs
  claimed: number;
  isBlocked: boolean;
  isRecurring: boolean;
  updatedAt: string;
}

// ─── Convenience helpers (pure, no side effects) ──────────────────────────

/**
 * Returns true if a booking status permits transition to an active
 * ServiceSession. Wraps the existing bookingStateMachine — do not duplicate
 * the transition table here.
 */
export function bookingStatusPermitsServiceStart(status: BookingStatus): boolean {
  return status === 'confirmed' || status === 'in_progress';
}

/**
 * Server-derived access check for a live ServiceSession. Both booking party
 * roles (owner OR assigned provider) may subscribe; anyone else MUST be
 * rejected at the WS/SSE boundary (see server/routes/matching-ws.ts and
 * server/routes/prestige-pass.ts pattern).
 */
export function canSubscribeToSession(
  session: Pick<ServiceSession, 'customerId' | 'providerId'>,
  uid: string,
): boolean {
  if (!uid) return false;
  return uid === session.customerId || uid === session.providerId;
}

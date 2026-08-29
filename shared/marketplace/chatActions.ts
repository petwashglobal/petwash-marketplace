/**
 * Structured chat actions — CEO Business Doctrine §10.9 / §57 / §58 / §62
 * + Integrity Doctrine §10.
 *
 * Chat text like "I'll do it for ₪220" or "sure, see you tomorrow" MUST
 * NOT change a booking. Only STRUCTURED ACTIONS do. This module defines
 * the shared contract every chat surface (booking chat + chat_threads +
 * Meet & Greet) uses when it renders inline business actions.
 *
 * The contract is:
 *   1. Every action has a stable `kind`.
 *   2. Each action carries its own tightly-typed payload.
 *   3. Availability is decided by (participantRole, bookingPhase, threadType) —
 *      not by "which button was clicked in the UI".
 *   4. Dispatch turns the action into a call to the domain endpoint. Chat
 *      text is never mutated by the action; the domain state is.
 *
 * The RENDER LAYER (React component library) is a separate concern —
 * this file is the SHARED TYPES + AVAILABILITY RULES both server and
 * client consume, so a regression to which actions surface where fails
 * in vitest before it ships to Playwright.
 */
import type { ServiceType } from './actors';
import type { BookingPhase, ParticipantRole, ThreadType } from './policyEngine';

export type ChatActionKind =
  | 'REQUEST_BOOKING'
  | 'ACCEPT_BOOKING'
  | 'SUGGEST_CHANGE'
  | 'SEND_REVISED_QUOTE'
  | 'EXTEND_BOOKING'
  | 'ADD_PET'
  | 'SCHEDULE_MEET_AND_GREET'
  | 'CALL'
  | 'REPORT'
  | 'CANCEL'
  | 'CONTACT_SUPPORT'
  | 'KEEP_ON_PETWASH';

/** Discriminated union of chat action payloads. */
export type ChatAction =
  | { kind: 'REQUEST_BOOKING'; serviceType: ServiceType }
  | { kind: 'ACCEPT_BOOKING'; bookingId: string }
  | { kind: 'SUGGEST_CHANGE'; bookingId: string; description: string }
  | {
      kind: 'SEND_REVISED_QUOTE';
      bookingId: string;
      newTotalCents: number;
      currency: 'ILS';
    }
  | {
      kind: 'EXTEND_BOOKING';
      bookingId: string;
      additionalUnits: number; // nights / days / walks etc — service unit
    }
  | { kind: 'ADD_PET'; bookingId: string; petId: string }
  | {
      kind: 'SCHEDULE_MEET_AND_GREET';
      customerUid: string;
      providerUid: string;
      serviceType: ServiceType;
      scheduledAt: string;
    }
  | { kind: 'CALL'; bookingId: string }
  | { kind: 'REPORT'; threadId: string; reason: string }
  | { kind: 'CANCEL'; bookingId: string }
  | { kind: 'CONTACT_SUPPORT'; contextEntityId: string }
  | { kind: 'KEEP_ON_PETWASH'; threadId: string };

export interface AvailabilityContext {
  threadType: ThreadType;
  participantRole: ParticipantRole;
  bookingPhase?: BookingPhase;
}

/**
 * Availability decision. `visible` decides render; `enabled` decides
 * click-through. A CANCEL action, for instance, is VISIBLE on a
 * CONFIRMED booking chat but ENABLED only for the party who owns the
 * cancellation right at this phase (§14.6).
 */
export interface AvailabilityResult {
  visible: boolean;
  enabled: boolean;
  reason?: string;
}

/**
 * Doctrine §11.1 progressive contact reveal — CALL button availability
 * ladder. Kept in one function so all render sites agree.
 */
function callAvailability(ctx: AvailabilityContext): AvailabilityResult {
  if (ctx.threadType !== 'BOOKING' && ctx.threadType !== 'MEET_AND_GREET') {
    return { visible: false, enabled: false };
  }
  switch (ctx.bookingPhase) {
    case 'CONFIRMED':
    case 'ACCEPTED':
      return { visible: true, enabled: true };
    case 'IN_PROGRESS':
      return { visible: true, enabled: true, reason: 'prominent-during-service' };
    case 'COMPLETED':
      return { visible: true, enabled: false, reason: 'call-window-expired' };
    default:
      return { visible: false, enabled: false, reason: 'pre-confirmation-no-call' };
  }
}

/**
 * Doctrine §7.4 booking status ↔ action mapping. This function is the
 * SINGLE source of truth for "which action is available in which phase
 * to which participant". Do not re-derive this at call sites.
 */
export function availabilityFor(
  action: ChatActionKind,
  ctx: AvailabilityContext,
): AvailabilityResult {
  switch (action) {
    case 'CALL':
      return callAvailability(ctx);

    case 'ACCEPT_BOOKING':
      // Only PROVIDER can accept, and only while the booking is REQUESTED
      // or QUOTED. Once ACCEPTED / CONFIRMED, no further accept.
      if (ctx.threadType !== 'BOOKING') return { visible: false, enabled: false };
      if (ctx.participantRole !== 'PROVIDER') return { visible: false, enabled: false };
      if (ctx.bookingPhase === 'REQUESTED' || ctx.bookingPhase === 'QUOTED') {
        return { visible: true, enabled: true };
      }
      return { visible: false, enabled: false };

    case 'SEND_REVISED_QUOTE':
      if (ctx.threadType !== 'BOOKING') return { visible: false, enabled: false };
      if (ctx.participantRole !== 'PROVIDER') return { visible: false, enabled: false };
      // Provider can revise up until the customer has accepted the
      // canonical quote (i.e. before CONFIRMED).
      if (
        ctx.bookingPhase === 'REQUESTED' ||
        ctx.bookingPhase === 'QUOTED' ||
        ctx.bookingPhase === 'ACCEPTED'
      ) {
        return { visible: true, enabled: true };
      }
      return { visible: false, enabled: false };

    case 'SUGGEST_CHANGE':
    case 'ADD_PET':
    case 'EXTEND_BOOKING':
      if (ctx.threadType !== 'BOOKING') return { visible: false, enabled: false };
      // Either party proposes; the OTHER accepts the resulting change.
      // Doctrine §32–§34 — structured request during confirmed/in-progress.
      if (ctx.bookingPhase === 'CONFIRMED' || ctx.bookingPhase === 'IN_PROGRESS') {
        return { visible: true, enabled: true };
      }
      return { visible: false, enabled: false };

    case 'CANCEL':
      if (ctx.threadType !== 'BOOKING') return { visible: false, enabled: false };
      // Both parties can request cancel from REQUESTED through IN_PROGRESS.
      // COMPLETED / CANCELLED / DISPUTED are terminal or already-processed.
      switch (ctx.bookingPhase) {
        case 'REQUESTED':
        case 'QUOTED':
        case 'ACCEPTED':
        case 'CONFIRMED':
        case 'IN_PROGRESS':
          return { visible: true, enabled: true };
        default:
          return { visible: false, enabled: false };
      }

    case 'SCHEDULE_MEET_AND_GREET':
      // Only meaningful before a confirmed booking. After CONFIRMED, use
      // Extend / Add Pet / Suggest Change instead.
      if (ctx.threadType !== 'BOOKING' && ctx.threadType !== 'MEET_AND_GREET') {
        return { visible: false, enabled: false };
      }
      if (
        ctx.bookingPhase === undefined ||
        ctx.bookingPhase === 'PRE_REQUEST' ||
        ctx.bookingPhase === 'REQUESTED' ||
        ctx.bookingPhase === 'QUOTED'
      ) {
        return { visible: true, enabled: true };
      }
      return { visible: false, enabled: false };

    case 'REPORT':
    case 'CONTACT_SUPPORT':
      // Always visible — safety escape hatch (integrity §6.13, §66).
      return { visible: true, enabled: true };

    case 'KEEP_ON_PETWASH':
      // Only meaningful on marketplace chats where the other side just
      // solicited off-platform behaviour. UI decides when to surface it;
      // this contract just says it is NEVER disabled once shown.
      if (ctx.threadType !== 'BOOKING' && ctx.threadType !== 'MEET_AND_GREET') {
        return { visible: false, enabled: false };
      }
      return { visible: true, enabled: true };

    case 'REQUEST_BOOKING':
      // Customer opens a booking from a pre-request context. Not available
      // once a booking already exists (use SUGGEST_CHANGE etc. instead).
      if (ctx.participantRole !== 'BOOKER') return { visible: false, enabled: false };
      if (ctx.bookingPhase === undefined || ctx.bookingPhase === 'PRE_REQUEST') {
        return { visible: true, enabled: true };
      }
      return { visible: false, enabled: false };
  }
}

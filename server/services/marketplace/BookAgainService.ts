/**
 * BookAgainService — CEO NEXT-AUTO §4 (Book Again).
 *
 * Rebooking prefill. Takes a prior COMPLETED booking and returns a
 * new booking-request payload that the customer can adjust and
 * submit. The service does NOT create the new booking — it only
 * projects the prefill so the customer's request flow can start
 * one field ahead.
 *
 * Discipline:
 *   §77 — the marketplace introduced the pair (customer, provider);
 *   Book Again goes through PetWash. This service enforces that
 *   the request still routes through the standard request flow.
 *   §79 — self-booking blocked (customer cannot rebook a booking
 *   where they were also the provider).
 *   §11 — one-shot: BOOK_AGAIN is a READ projection; there is no
 *   idempotency concern here.
 */

export type BookAgainOutcomeCode =
  | 'PREFILL_READY'
  | 'NOT_ELIGIBLE'
  | 'ACTOR_NOT_CUSTOMER'
  | 'PROVIDER_NO_LONGER_AVAILABLE'
  | 'SELF_BOOKING_BLOCKED';

export interface PriorBookingSnapshot {
  bookingId: string;
  customerUid: string;
  providerUid: string;
  status: string;
  serviceType: string;
  petIds: string[];
  originalScheduleStart: string;         // ISO
  originalScheduleEnd?: string;
  location: { kind: string; address?: string };
  originalCareNotes?: string;
  originalPriceCents?: number;
}

export interface BookAgainInput {
  actorUid: string;
  prior: PriorBookingSnapshot;
  providerStillActive: boolean;
  suggestedShiftDays?: number;           // default 7 (next week)
  now?: string;                          // ISO
}

export interface BookAgainOutcome {
  code: BookAgainOutcomeCode;
  prefill?: {
    providerUid: string;
    serviceType: string;
    petIds: string[];
    suggestedStart: string;              // ISO
    suggestedEnd?: string;
    location: { kind: string; address?: string };
    careNotes?: string;
    hintPriceCents?: number;
    originBookingId: string;
  };
}

function iso(d: Date): string { return d.toISOString(); }

export function evaluateBookAgain(input: BookAgainInput): BookAgainOutcome {
  const p = input.prior;
  if (input.actorUid !== p.customerUid) return { code: 'ACTOR_NOT_CUSTOMER' };
  if (p.customerUid === p.providerUid) return { code: 'SELF_BOOKING_BLOCKED' };
  if (p.status !== 'COMPLETED') return { code: 'NOT_ELIGIBLE' };
  if (!input.providerStillActive) return { code: 'PROVIDER_NO_LONGER_AVAILABLE' };

  const shiftDays = input.suggestedShiftDays ?? 7;
  const nowIso = input.now ?? new Date().toISOString();
  const originStart = new Date(p.originalScheduleStart).getTime();
  const originEnd = p.originalScheduleEnd ? new Date(p.originalScheduleEnd).getTime() : undefined;
  // Suggest same weekday at same time, N days in the future. If the
  // "N days ahead" landed in the past (very old booking), advance by
  // full weeks until it is > now.
  let suggestedStartMs = originStart + shiftDays * 24 * 60 * 60 * 1000;
  const nowMs = new Date(nowIso).getTime();
  while (suggestedStartMs <= nowMs) suggestedStartMs += 7 * 24 * 60 * 60 * 1000;
  const suggestedEndMs = originEnd ? suggestedStartMs + (originEnd - originStart) : undefined;

  return {
    code: 'PREFILL_READY',
    prefill: {
      providerUid: p.providerUid,
      serviceType: p.serviceType,
      petIds: [...p.petIds],
      suggestedStart: iso(new Date(suggestedStartMs)),
      suggestedEnd: suggestedEndMs ? iso(new Date(suggestedEndMs)) : undefined,
      location: p.location,
      careNotes: p.originalCareNotes,
      hintPriceCents: p.originalPriceCents,
      originBookingId: p.bookingId,
    },
  };
}

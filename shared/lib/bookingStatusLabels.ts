/**
 * bookingStatusLabels — canonical HE/EN labels + badge palette for every
 * booking status in the canonical state machine.
 *
 * Per CEO 2026-08-18 §1 (canonical vocab must not become another state
 * machine) + agent 3 finding (8+ client files each declare their own
 * ad-hoc STATUS_LABEL map, with inconsistent coverage — some pages omit
 * meet_greet_*_completed, payment_pending, provider_marked_complete,
 * reviewed, disputed):
 *
 *   ONE mapping. Every UI reads from here. When a new canonical status
 *   is added to shared/lib/bookingStateMachine.ts, TypeScript will
 *   FAIL the build here until this file also covers it — a hard gate
 *   against future divergence.
 *
 * Non-canonical strings (uppercase 'DRAFT', 'pending_provider',
 * 'scheduled', etc. that sitter-suite / walk-my-pet currently write) are
 * NOT covered here on purpose. Callers that receive one should fix the
 * writer, not extend this map.
 *
 * Callers migrate one file at a time:
 *   const label = bookingStatusLabel(booking.status, language);
 *   const cls   = bookingStatusBadgeClasses(booking.status);
 */

import type { BookingStatus } from './bookingStateMachine';
import { ALL_BOOKING_STATUSES } from './bookingStateMachine';

type LabelPair = { en: string; he: string };

/**
 * Full HE/EN label per canonical status. Uses Record<BookingStatus, …>
 * so any future BookingStatus addition fails typechecking here.
 */
export const BOOKING_STATUS_LABELS: Record<BookingStatus, LabelPair> = {
  pending:                  { en: 'Pending',                    he: 'ממתין' },
  accepted:                 { en: 'Accepted',                   he: 'התקבל' },
  declined:                 { en: 'Declined',                   he: 'סורב' },
  meet_greet_requested:     { en: 'Meet & Greet requested',     he: 'בקשת פגישת היכרות' },
  meet_greet_scheduled:     { en: 'Meet & Greet scheduled',     he: 'פגישת היכרות מתוכננת' },
  meet_greet_completed:     { en: 'Meet & Greet completed',     he: 'פגישת היכרות הושלמה' },
  payment_pending:          { en: 'Payment pending',            he: 'ממתין לתשלום' },
  confirmed:                { en: 'Confirmed',                  he: 'מאושר' },
  in_progress:              { en: 'In progress',                he: 'בתהליך' },
  provider_marked_complete: { en: 'Awaiting your confirmation', he: 'ממתין לאישורך' },
  completed:                { en: 'Completed',                  he: 'הושלם' },
  reviewed:                 { en: 'Reviewed',                   he: 'נבדק' },
  cancelled:                { en: 'Cancelled',                  he: 'בוטל' },
  disputed:                 { en: 'Disputed',                   he: 'במחלוקת' },
};

/**
 * Semantic bucket for consistent badge coloring / iconography across the
 * whole app. Do NOT re-invent per page.
 */
export type BookingStatusTone = 'neutral' | 'positive' | 'warning' | 'negative' | 'inflight';

export const BOOKING_STATUS_TONE: Record<BookingStatus, BookingStatusTone> = {
  pending:                  'warning',
  accepted:                 'positive',
  declined:                 'negative',
  meet_greet_requested:     'warning',
  meet_greet_scheduled:     'warning',
  meet_greet_completed:     'positive',
  payment_pending:          'warning',
  confirmed:                'positive',
  in_progress:              'inflight',
  provider_marked_complete: 'inflight',
  completed:                'positive',
  reviewed:                 'neutral',
  cancelled:                'negative',
  disputed:                 'negative',
};

/**
 * Tailwind class strings — the exact classes every page should use for
 * status badges. Callers pick one place to display them and pass the
 * output straight to className. No colors invented per file.
 */
export const BOOKING_STATUS_BADGE_CLASSES: Record<BookingStatusTone, string> = {
  neutral:  'bg-gray-100  text-gray-800  border-gray-200',
  positive: 'bg-green-100 text-green-800 border-green-200',
  warning:  'bg-amber-100 text-amber-900 border-amber-200',
  negative: 'bg-red-100   text-red-800   border-red-200',
  inflight: 'bg-blue-100  text-blue-800  border-blue-200',
};

export type Language = 'he' | 'en' | string;

function isCanonicalStatus(v: unknown): v is BookingStatus {
  return typeof v === 'string' && (ALL_BOOKING_STATUSES as ReadonlyArray<string>).includes(v);
}

/**
 * Best-effort label lookup. Non-canonical inputs fall back to the raw
 * string (uppercased for visibility) so bad data is visible rather than
 * silently swallowed.
 */
export function bookingStatusLabel(status: unknown, language: Language): string {
  const isHe = language === 'he';
  if (isCanonicalStatus(status)) {
    const pair = BOOKING_STATUS_LABELS[status];
    return isHe ? pair.he : pair.en;
  }
  const raw = typeof status === 'string' ? status : '';
  return raw ? raw.replace(/_/g, ' ').toUpperCase() : (isHe ? '—' : '—');
}

export function bookingStatusTone(status: unknown): BookingStatusTone {
  return isCanonicalStatus(status) ? BOOKING_STATUS_TONE[status] : 'neutral';
}

export function bookingStatusBadgeClasses(status: unknown): string {
  return BOOKING_STATUS_BADGE_CLASSES[bookingStatusTone(status)];
}

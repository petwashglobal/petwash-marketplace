/**
 * inboxSmartStatus — the brain of the smart inbox.
 *
 * Pure, deterministic. Given a thread + its real backend context, it returns the
 * status BADGE the row shows and the single next ACTION button. This is what makes
 * the inbox "show what needs action" instead of a dead list. No DB, no side effects
 * — the feed endpoint gathers context and calls this; the UI just renders the keys.
 *
 * Labels are bilingual (he/en). Action `key` is stable for deep-linking; the UI maps
 * it to a route/handler.
 */
import type { ChatThreadType } from '@shared/schema-chat';

export type InboxBadgeKey =
  | 'WAITING_FOR_PROVIDER' | 'PROVIDER_ACCEPTED' | 'PAYMENT_REQUIRED'
  | 'BOOKING_CONFIRMED' | 'STARTS_SOON' | 'ACTIVE_NOW' | 'COMPLETED'
  | 'CANCELLED' | 'INCIDENT_OPEN' | 'SUPPORT_WAITING' | 'ARCHIVED' | 'OPEN';

export type InboxActionKey =
  | 'CONTACT_MORE_PROVIDERS' | 'CONFIRM_AND_PAY' | 'TRY_PAYMENT_AGAIN'
  | 'COMPLETE_PET_PROFILE' | 'VIEW_CARE_NOTES' | 'REVIEW_TIP' | 'VIEW_CASE'
  | 'UPLOAD_EVIDENCE' | 'VIEW_BOOKING' | 'OPEN_CHAT';

export interface InboxContext {
  threadType: ChatThreadType;
  threadStatus?: string | null;       // 'active' | 'archived'
  bookingStatus?: string | null;      // pending|accepted|confirmed|in_progress|completed|cancelled...
  paymentStatus?: string | null;      // unpaid|paid|failed|pending
  providerReplied?: boolean;
  petProfileComplete?: boolean;
  startsSoon?: boolean;               // confirmed booking within the soon-window
  incidentOpen?: boolean;
  supportWaitingOnUser?: boolean;     // support is waiting for the user (e.g. evidence)
}

export interface InboxRowStatus {
  badge: InboxBadgeKey;
  badgeLabel: { en: string; he: string };
  action: InboxActionKey;
  actionLabel: { en: string; he: string };
}

const BADGE_LABELS: Record<InboxBadgeKey, { en: string; he: string }> = {
  WAITING_FOR_PROVIDER: { en: 'Waiting for provider', he: 'ממתין לספק' },
  PROVIDER_ACCEPTED: { en: 'Provider accepted', he: 'הספק אישר' },
  PAYMENT_REQUIRED: { en: 'Payment required', he: 'נדרש תשלום' },
  BOOKING_CONFIRMED: { en: 'Booking confirmed', he: 'ההזמנה אושרה' },
  STARTS_SOON: { en: 'Starts soon', he: 'מתחיל בקרוב' },
  ACTIVE_NOW: { en: 'Active now', he: 'פעיל כעת' },
  COMPLETED: { en: 'Completed', he: 'הושלם' },
  CANCELLED: { en: 'Cancelled', he: 'בוטל' },
  INCIDENT_OPEN: { en: 'Incident open', he: 'אירוע פתוח' },
  SUPPORT_WAITING: { en: 'Support waiting', he: 'התמיכה ממתינה' },
  ARCHIVED: { en: 'Archived', he: 'בארכיון' },
  OPEN: { en: 'Open', he: 'פתוח' },
};

const ACTION_LABELS: Record<InboxActionKey, { en: string; he: string }> = {
  CONTACT_MORE_PROVIDERS: { en: 'Contact more providers', he: 'פנו לספקים נוספים' },
  CONFIRM_AND_PAY: { en: 'Confirm & Pay', he: 'אישור ותשלום' },
  TRY_PAYMENT_AGAIN: { en: 'Try payment again', he: 'נסו לשלם שוב' },
  COMPLETE_PET_PROFILE: { en: 'Complete pet profile', he: 'השלימו פרופיל חיה' },
  VIEW_CARE_NOTES: { en: 'View care notes', he: 'צפו בהוראות טיפול' },
  REVIEW_TIP: { en: 'Review / Tip', he: 'ביקורת / טיפ' },
  VIEW_CASE: { en: 'View case', he: 'צפו בתיק' },
  UPLOAD_EVIDENCE: { en: 'Upload evidence', he: 'העלו ראיות' },
  VIEW_BOOKING: { en: 'View booking', he: 'צפו בהזמנה' },
  OPEN_CHAT: { en: 'Open chat', he: 'פתחו צ׳אט' },
};

function row(badge: InboxBadgeKey, action: InboxActionKey): InboxRowStatus {
  return { badge, badgeLabel: BADGE_LABELS[badge], action, actionLabel: ACTION_LABELS[action] };
}

const COMPLETED_BOOKING = new Set(['completed', 'service_completed', 'confirmed_complete']);
const ACTIVE_BOOKING = new Set(['in_progress', 'active', 'started']);
const CONFIRMED_BOOKING = new Set(['confirmed', 'paid', 'booking_confirmed']);
const ACCEPTED_BOOKING = new Set(['accepted', 'provider_accepted', 'awaiting_payment']);
const PENDING_BOOKING = new Set(['pending', 'requested', 'enquiry', 'sent', 'awaiting_provider']);
const CANCELLED_BOOKING = new Set(['cancelled', 'declined', 'expired', 'withdrawn']);

/**
 * Compute the badge + next action for one inbox row. Order matters: archived and
 * incidents win, then the booking lifecycle, then support, then a sane default.
 */
export function computeInboxRowStatus(ctx: InboxContext): InboxRowStatus {
  // Archived hides from the main inbox but stays readable.
  if (String(ctx.threadStatus) === 'archived') return row('ARCHIVED', 'OPEN_CHAT');

  // Incidents are always surfaced first.
  if (ctx.threadType === 'INCIDENT' || ctx.incidentOpen) return row('INCIDENT_OPEN', 'VIEW_CASE');

  // Support waiting on the user (e.g. evidence) — actionable.
  if ((ctx.threadType === 'SUPPORT' || ctx.threadType === 'K9000') && ctx.supportWaitingOnUser) {
    return row('SUPPORT_WAITING', 'UPLOAD_EVIDENCE');
  }

  // Booking lifecycle — the heart of the smart inbox rules.
  if (ctx.threadType === 'BOOKING') {
    const s = String(ctx.bookingStatus ?? '').toLowerCase();
    const pay = String(ctx.paymentStatus ?? '').toLowerCase();

    if (CANCELLED_BOOKING.has(s)) return row('CANCELLED', 'OPEN_CHAT');
    if (COMPLETED_BOOKING.has(s)) return row('COMPLETED', 'REVIEW_TIP');
    if (ACTIVE_BOOKING.has(s)) return row('ACTIVE_NOW', 'VIEW_BOOKING');

    if (CONFIRMED_BOOKING.has(s)) {
      if (ctx.petProfileComplete === false) return row('BOOKING_CONFIRMED', 'COMPLETE_PET_PROFILE');
      if (ctx.startsSoon) return row('STARTS_SOON', 'VIEW_CARE_NOTES');
      return row('BOOKING_CONFIRMED', 'VIEW_BOOKING');
    }

    if (ACCEPTED_BOOKING.has(s)) {
      if (pay === 'failed') return row('PAYMENT_REQUIRED', 'TRY_PAYMENT_AGAIN');
      return row('PAYMENT_REQUIRED', 'CONFIRM_AND_PAY'); // accepted + unpaid
    }

    if (pay === 'failed') return row('PAYMENT_REQUIRED', 'TRY_PAYMENT_AGAIN');

    if (PENDING_BOOKING.has(s) || s === '') {
      return ctx.providerReplied
        ? row('PROVIDER_ACCEPTED', 'OPEN_CHAT')
        : row('WAITING_FOR_PROVIDER', 'CONTACT_MORE_PROVIDERS');
    }
  }

  // Support / franchise / public / admin default.
  if (ctx.threadType === 'SUPPORT' || ctx.threadType === 'FRANCHISE' || ctx.threadType === 'ADMIN') {
    return row('SUPPORT_WAITING', 'OPEN_CHAT');
  }

  return row('OPEN', 'OPEN_CHAT');
}

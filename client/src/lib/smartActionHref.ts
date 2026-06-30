/**
 * smartActionHref — maps a smart-inbox next-action key (from the shared
 * inboxSmartStatus engine) to a REAL, existing client route.
 *
 * Every action button in the Communication Hub (inbox rows, chat header)
 * uses this so the label and the destination always agree — no dead clicks,
 * no links to routes that don't exist. If an action has no dedicated screen
 * yet, it falls back to the customer bookings list (`/bookings`), which is
 * always a safe, real destination.
 *
 * Action keys mirror InboxActionKey in server/services/inboxSmartStatus.ts.
 */
export type SmartActionKey =
  | 'CONTACT_MORE_PROVIDERS' | 'CONFIRM_AND_PAY' | 'TRY_PAYMENT_AGAIN'
  | 'COMPLETE_PET_PROFILE' | 'VIEW_CARE_NOTES' | 'REVIEW_TIP' | 'VIEW_CASE'
  | 'UPLOAD_EVIDENCE' | 'VIEW_BOOKING' | 'OPEN_CHAT';

export function smartActionHref(action: string, bookingId?: string | null): string {
  switch (action) {
    // Find / contact other providers → the booking funnel.
    case 'CONTACT_MORE_PROVIDERS':
      return '/booking';

    // Pet profile lives under /pets.
    case 'COMPLETE_PET_PROFILE':
      return '/pets';

    // Incident / evidence → support desk.
    case 'VIEW_CASE':
    case 'UPLOAD_EVIDENCE':
      return '/support';

    // Open the conversation itself when we have a booking anchor.
    case 'OPEN_CHAT':
      return bookingId ? `/booking-chat/${bookingId}` : '/booking-chat/inbox';

    // Pay / confirm / review / view-booking / care-notes all resolve on the
    // customer bookings list, where the per-booking actions live.
    case 'CONFIRM_AND_PAY':
    case 'TRY_PAYMENT_AGAIN':
    case 'REVIEW_TIP':
    case 'VIEW_CARE_NOTES':
    case 'VIEW_BOOKING':
    default:
      return '/bookings';
  }
}

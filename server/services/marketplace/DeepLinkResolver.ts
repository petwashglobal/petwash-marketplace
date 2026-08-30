/**
 * DeepLinkResolver — CEO PROGRAM 33 (Notifications open the exact entity).
 *
 * Pure evaluator. Given a notification kind + entityRef, returns the
 * canonical client route that should open when the notification is
 * tapped. Both server (push payload builder) and client (in-app
 * router) consume this so a notification and its landing surface
 * never drift.
 *
 * Doctrine (§ Program 33): every notification MUST open the exact
 * entity. "Provider proposed new price" → the proposal review, not
 * the generic Inbox. "Shop order ready" → the pickup details.
 * "Refund complete" → the refund detail.
 */
import type { NotificationKind } from './NotificationPriorityService';

export interface EntityRef {
  kind: string;
  id: string;
}

/** All routes are RELATIVE (start with "/") — client / native router prepends origin. */
export function resolveDeepLink(kind: NotificationKind, entity: EntityRef): string {
  switch (kind) {
    case 'BOOKING_REQUEST_NEW':
      return `/provider/requests/${encodeURIComponent(entity.id)}`;
    case 'BOOKING_ACCEPTED':
      return `/bookings/${encodeURIComponent(entity.id)}`;
    case 'BOOKING_CHANGE_PROPOSED':
      return `/bookings/${encodeURIComponent(entity.id)}/proposal`;
    case 'BOOKING_CANCELLED':
      return `/bookings/${encodeURIComponent(entity.id)}`;
    case 'BOOKING_STARTING_SOON':
      return `/bookings/${encodeURIComponent(entity.id)}`;
    case 'PAYMENT_REQUIRED':
      return `/bookings/${encodeURIComponent(entity.id)}/pay`;
    case 'PAYMENT_UNCERTAIN':
      // §12 — never send them to "pay again"; send them to STATUS.
      return `/bookings/${encodeURIComponent(entity.id)}/payment-status`;
    case 'REFUND_STATUS_CHANGED':
      return `/refunds/${encodeURIComponent(entity.id)}`;
    case 'MESSAGE_NEW':
      return `/inbox/threads/${encodeURIComponent(entity.id)}`;
    case 'DOCUMENT_READY':
      return `/documents/${encodeURIComponent(entity.id)}`;
    case 'PROVIDER_KYC_MISSING':
      return `/provider/application`;
    case 'PET_KYA_STALE':
      return `/pets/${encodeURIComponent(entity.id)}`;
    case 'INCIDENT_UPDATE':
      return `/support/${encodeURIComponent(entity.id)}`;
    case 'SAFETY_ALERT':
      return `/support/${encodeURIComponent(entity.id)}`;
    case 'MARKETING_OFFER':
      return `/offers/${encodeURIComponent(entity.id)}`;
    case 'PRESTIGE_MILESTONE':
      return `/prestige-club`;
    case 'K9000_SESSION_UPDATE':
      return `/k9000/sessions/${encodeURIComponent(entity.id)}`;
    case 'WALLET_TOPUP_STATUS':
      // §12 — always the STATUS surface, not "top up again".
      return `/wallet/topup/${encodeURIComponent(entity.id)}/status`;
    default:
      // §72 discipline: never invent a deep link for an unknown kind.
      return '/inbox';
  }
}

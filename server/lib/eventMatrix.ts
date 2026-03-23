/**
 * PetWash™ — Frozen Event Matrix & Document Prefix Registry
 *
 * THIS FILE IS THE CANONICAL SOURCE OF TRUTH.
 * Do not add new events or prefixes without a deliberate architecture decision.
 * Last locked: 2026-03-24, commit 0f35fa91 / 101a55ae
 *
 * Events listed here bypass user notification preferences (transactional comms).
 * Every event maps to exactly one document type and one idempotency key format.
 */

export const DOCUMENT_PREFIXES = {
  booking_receipt:           'PW-RCP',
  booking_earnings_notice:   'PW-ERN',
  egift_receipt:             'PW-EGF',
  egift_redemption_receipt:  'PW-EGR',
  loyalty_redemption_receipt:'PW-LRR',
  membership_receipt:        'PW-MBR',
  provider_payout_statement: 'PW-PAY',
  refund_receipt:            'PW-RFD',
  cancellation_notice:       'PW-CAN',
  provider_rejection_notice: 'PW-REJ',
} as const;

export type DocumentType = keyof typeof DOCUMENT_PREFIXES;
export type DocumentPrefix = (typeof DOCUMENT_PREFIXES)[DocumentType];

export interface EventMatrixEntry {
  event: string;
  triggerPoint: string;
  documentType: DocumentType;
  documentPrefix: DocumentPrefix;
  channels: ('sms' | 'push' | 'email')[];
  idempotencyKeyFormat: string;
  dbTablesTouched: string[];
  transactional: boolean;
  notes?: string;
}

export const EVENT_MATRIX: EventMatrixEntry[] = [
  {
    event: 'booking_confirmed',
    triggerPoint: 'POST /:platformId/bookings (super-app-bookings.ts)',
    documentType: 'booking_receipt',
    documentPrefix: 'PW-RCP',
    channels: ['sms', 'push'],
    idempotencyKeyFormat: 'booking_receipt:{bookingId}:{userId}',
    dbTablesTouched: ['financial_documents', 'notification_logs', 'bookings'],
    transactional: true,
  },
  {
    event: 'booking_cancelled',
    triggerPoint: 'POST /:platformId/bookings/:bookingId/cancel (super-app-bookings.ts)',
    documentType: 'cancellation_notice',
    documentPrefix: 'PW-CAN',
    channels: ['sms', 'push'],
    idempotencyKeyFormat: 'booking_cancelled:{bookingId}:{userId}',
    dbTablesTouched: ['financial_documents', 'notification_logs', 'bookings'],
    transactional: true,
  },
  {
    event: 'refund_issued',
    triggerPoint: 'Same cancel handler — only when payout was in escrow',
    documentType: 'refund_receipt',
    documentPrefix: 'PW-RFD',
    channels: ['sms', 'push'],
    idempotencyKeyFormat: 'refund_receipt:{bookingId}:{userId}',
    dbTablesTouched: ['financial_documents', 'notification_logs'],
    transactional: true,
    notes: 'Co-fires with booking_cancelled. Skipped if no escrow payout.',
  },
  {
    event: 'payout_issued',
    triggerPoint: 'Payout processing flow',
    documentType: 'provider_payout_statement',
    documentPrefix: 'PW-PAY',
    channels: ['sms', 'push'],
    idempotencyKeyFormat: 'provider_payout_statement:{payoutId}:{providerId}',
    dbTablesTouched: ['financial_documents', 'notification_logs'],
    transactional: true,
  },
  {
    event: 'provider_approved',
    triggerPoint: 'AdminProviderReviewService.approve()',
    documentType: 'booking_earnings_notice',
    documentPrefix: 'PW-ERN',
    channels: ['sms', 'push'],
    idempotencyKeyFormat: 'provider_approved:{applicationId}:{firebaseUid}',
    dbTablesTouched: ['financial_documents', 'notification_logs'],
    transactional: true,
  },
  {
    event: 'provider_rejected',
    triggerPoint: 'AdminProviderReviewService.reject()',
    documentType: 'provider_rejection_notice',
    documentPrefix: 'PW-REJ',
    channels: ['sms', 'push'],
    idempotencyKeyFormat: 'provider_rejection_notice:{applicationId}:{firebaseUid}',
    dbTablesTouched: ['financial_documents', 'notification_logs'],
    transactional: true,
    notes: 'Provider channels only. Watch: silent skip if Firebase UID cannot be resolved.',
  },
  {
    event: 'egift_purchased',
    triggerPoint: 'POST /v1/egift/purchase (octopus-engine.ts)',
    documentType: 'egift_receipt',
    documentPrefix: 'PW-EGF',
    channels: ['sms', 'push'],
    idempotencyKeyFormat: 'egift_receipt:{egiftId}:{buyerUserId}',
    dbTablesTouched: ['financial_documents', 'notification_logs'],
    transactional: true,
  },
  {
    event: 'egift_redeemed',
    triggerPoint: 'POST /v1/brain/redeem (octopus-engine.ts)',
    documentType: 'egift_redemption_receipt',
    documentPrefix: 'PW-EGR',
    channels: ['sms', 'push'],
    idempotencyKeyFormat: 'egift_redemption_receipt:{egiftId}:{userId}',
    dbTablesTouched: ['financial_documents', 'notification_logs', 'k9000_wash_events'],
    transactional: true,
    notes: 'SMS at 139 chars — watch for segment creep on long station IDs.',
  },
  {
    event: 'points_redeemed',
    triggerPoint: 'POST /api/loyalty/rewards/redeem (loyalty.ts)',
    documentType: 'loyalty_redemption_receipt',
    documentPrefix: 'PW-LRR',
    channels: ['sms', 'push'],
    idempotencyKeyFormat: 'loyalty_redemption_receipt:{redemptionId}:{userId}',
    dbTablesTouched: ['financial_documents', 'notification_logs'],
    transactional: true,
    notes: 'SMS at 141 chars — highest segment risk. Monitor closely.',
  },
  {
    event: 'prestige_joined',
    triggerPoint: 'POST /api/loyalty/membership/join (loyalty.ts)',
    documentType: 'membership_receipt',
    documentPrefix: 'PW-MBR',
    channels: ['sms', 'push'],
    idempotencyKeyFormat: 'prestige_joined:{userId}:{joinDate}',
    dbTablesTouched: ['financial_documents', 'notification_logs'],
    transactional: true,
  },
  {
    event: 'membership_renewed',
    triggerPoint: 'POST /api/loyalty/membership/renew — admin only (loyalty.ts)',
    documentType: 'membership_receipt',
    documentPrefix: 'PW-MBR',
    channels: ['sms', 'push'],
    idempotencyKeyFormat: 'membership_renewed:{userId}:{renewedUntil}',
    dbTablesTouched: ['financial_documents', 'notification_logs'],
    transactional: true,
  },
  {
    event: 'membership_cancelled',
    triggerPoint: 'POST /api/loyalty/membership/cancel — admin only (loyalty.ts)',
    documentType: 'cancellation_notice',
    documentPrefix: 'PW-CAN',
    channels: ['sms', 'push'],
    idempotencyKeyFormat: 'membership_cancelled:{userId}:{effectiveDate}',
    dbTablesTouched: ['financial_documents', 'notification_logs'],
    transactional: true,
  },
];

export const EVENT_MATRIX_LOCKED_AT = '2026-03-24T00:00:00.000Z';
export const EVENT_MATRIX_COMMIT = '0f35fa91';
export const TOTAL_DOCUMENT_TYPES = Object.keys(DOCUMENT_PREFIXES).length;
export const TOTAL_EVENTS = EVENT_MATRIX.length;

/**
 * AdminSearchDescriptor — CEO PROGRAM 50 (Admin Operations).
 *
 * Pure evaluator. Given a raw admin search string, decides which
 * search "channel" it targets and returns a structured descriptor.
 *
 * Doctrine: admin can search by user / provider / booking / jobRef /
 * transaction / refund / order / gift / thread. The descriptor
 * chooses ONE — no fuzzy scoring at this layer — so downstream
 * search runners stay narrow.
 */

export type SearchChannel =
  | 'BOOKING'
  | 'JOB_REF'
  | 'REFUND'
  | 'SHOP_ORDER'
  | 'GIFT'
  | 'THREAD'
  | 'TRANSACTION'
  | 'USER_EMAIL'
  | 'USER_PHONE'
  | 'PROVIDER_ID'
  | 'FREE_TEXT'
  | 'UNKNOWN';

export interface AdminSearchDescriptor {
  channel: SearchChannel;
  normalized: string;                       // channel-specific normalization
  reasonCode: string;
}

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_PHONE_IL = /^\+?(972|0)[-\s]?5\d[-\s]?\d{3}[-\s]?\d{4}$/;
const RE_BOOKING_ID = /^B-[A-Za-z0-9_-]+$/i;
const RE_JOB_REF = /^JOB-[A-Za-z0-9_-]+$/i;
const RE_REFUND = /^R-[A-Za-z0-9_-]+$/i;
const RE_SHOP = /^S-[A-Za-z0-9_-]+$/i;
const RE_GIFT = /^G-[A-Za-z0-9_-]+$/i;
const RE_THREAD = /^T-[A-Za-z0-9_-]+$/i;
const RE_TX = /^TX-[A-Za-z0-9_-]+$/i;
const RE_PROVIDER = /^PROV-[A-Za-z0-9_-]+$/i;

export function describeAdminSearch(raw: string): AdminSearchDescriptor {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return { channel: 'UNKNOWN', normalized: '', reasonCode: 'EMPTY_QUERY' };

  if (RE_EMAIL.test(trimmed)) return { channel: 'USER_EMAIL', normalized: trimmed.toLowerCase(), reasonCode: 'MATCHED_EMAIL_PATTERN' };
  if (RE_PHONE_IL.test(trimmed)) return { channel: 'USER_PHONE', normalized: trimmed.replace(/\s|-/g, ''), reasonCode: 'MATCHED_IL_PHONE' };
  if (RE_BOOKING_ID.test(trimmed)) return { channel: 'BOOKING', normalized: trimmed.toUpperCase(), reasonCode: 'MATCHED_BOOKING_ID' };
  if (RE_JOB_REF.test(trimmed)) return { channel: 'JOB_REF', normalized: trimmed.toUpperCase(), reasonCode: 'MATCHED_JOB_REF' };
  if (RE_REFUND.test(trimmed)) return { channel: 'REFUND', normalized: trimmed.toUpperCase(), reasonCode: 'MATCHED_REFUND_ID' };
  if (RE_SHOP.test(trimmed)) return { channel: 'SHOP_ORDER', normalized: trimmed.toUpperCase(), reasonCode: 'MATCHED_SHOP_ORDER_ID' };
  if (RE_GIFT.test(trimmed)) return { channel: 'GIFT', normalized: trimmed.toUpperCase(), reasonCode: 'MATCHED_GIFT_ID' };
  if (RE_THREAD.test(trimmed)) return { channel: 'THREAD', normalized: trimmed.toUpperCase(), reasonCode: 'MATCHED_THREAD_ID' };
  if (RE_TX.test(trimmed)) return { channel: 'TRANSACTION', normalized: trimmed.toUpperCase(), reasonCode: 'MATCHED_TRANSACTION_ID' };
  if (RE_PROVIDER.test(trimmed)) return { channel: 'PROVIDER_ID', normalized: trimmed.toUpperCase(), reasonCode: 'MATCHED_PROVIDER_ID' };

  return { channel: 'FREE_TEXT', normalized: trimmed, reasonCode: 'NO_PATTERN_MATCH' };
}

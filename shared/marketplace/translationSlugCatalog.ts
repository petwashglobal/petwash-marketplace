/**
 * TranslationSlugCatalog — CEO doctrine §84 (every string is a slug).
 *
 * The single authoritative source for every JourneyState / Inbox /
 * Action / Notification slug the marketplace ever emits. Client
 * and server both import this so a slug missing from a translation
 * table is caught at build time, not at runtime.
 *
 * The catalog IS the contract:
 *   • Adding a new slug ANYWHERE in the codebase must add it here.
 *   • Translation tables (he.json / en.json) must cover every key.
 *   • The doctrine forbids inventing user-facing copy at render
 *     time — if a slug has no translation, the client shows the
 *     slug itself (visible bug, never invented copy).
 *
 * The catalog is SPLIT by kind so lookups can stay narrow, and
 * exhaustive-check helpers are exported per kind.
 */

// ── Slug kinds ────────────────────────────────────────────────────

export const REASON_CODES = [
  // Booking journey
  'REQUESTED', 'QUOTED', 'PROVIDER_PROPOSED_CHANGE', 'ACCEPTED', 'CONFIRMED',
  'READY_TO_START', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DECLINED', 'EXPIRED',
  'BOOKING_ACCEPTED', 'BOOKING_DECLINED', 'CHANGE_PROPOSED', 'CHANGE_ACCEPTED', 'CHANGE_DECLINED',
  'BOOKING_CANCELLED_UNPAID', 'USE_PAID_CANCEL_FLOW',
  // Refund
  'REFUND_IN_REVIEW', 'REFUND_ISSUED', 'REFUNDED', 'REFUND_DECLINED', 'REFUND_DISPUTED', 'REFUND_EXPECTED',
  // Payment
  'PAYMENT_PENDING', 'PAYMENT_CAPTURED', 'PAYMENT_FAILED',
  // Prestige
  'JOIN_ELIGIBLE', 'VERIFY_CONTACT', 'PRESTIGE_ACTIVE',
  // KYA / pet
  'POLICY_NOT_CONFIGURED', 'PET_NOTES_MISSING', 'PET_NOTES_STALE', 'PET_NOTES_FRESH',
  'MEDICAL_DOC_EXPIRES',
  // Provider application
  'DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED', 'SUSPENDED',
  'MISSING_ID', 'MISSING_BANK_ACCOUNT', 'MISSING_INSURANCE',
  'MISSING_VET_CERTIFICATE', 'MISSING_BACKGROUND_CHECK', 'MISSING_TAX_STATUS',
  'INSURANCE_EXPIRES',
  // Support
  'AWAITING_TRIAGE', 'AWAITING_STAFF', 'AWAITING_CUSTOMER',
  'CONFIRM_RESOLVED', 'CLOSED', 'AWAITING_CONFIRMATION', 'SUPPORT_SLA_BREACH',
  // K9000
  'STATION_VEND_PENDING', 'STATION_VEND_SUCCESS', 'STATION_FAILED',
  // Wallet
  'TOPUP_PENDING', 'TOPUP_CAPTURED', 'TOPUP_FAILED', 'TOPUP_RETRY_ELIGIBLE',
  // eGift
  'GIFT_CREATED', 'GIFT_PAID', 'GIFT_DELIVERED', 'GIFT_REDEEMED', 'GIFT_EXPIRES',
  // Payout
  'PAYOUT_HOLD_RELEASES', 'PAYOUT_TRANSFERRING', 'PAYOUT_FAILED_CONTACT_SUPPORT',
  // Meet & Greet / Handoff / Modification
  'PROPOSED', 'ACKNOWLEDGED', 'BOTH_ACKNOWLEDGED',
  'HANDOFF_CODE_ISSUED', 'HANDOFF_VERIFIED', 'HANDOFF_REQUIRED',
  'JOB_STARTED', 'JOB_COMPLETED',
  'CALL_AUTHORIZED',
  // Multi-actor guards
  'ACCEPTED_BY_OTHER_PARTY', 'DECLINED_BY_OTHER_PARTY', 'CANCELLED_BY_PROPOSER',
] as const;

export type ReasonCode = typeof REASON_CODES[number];

export const TITLE_CODES = [
  'DOCUMENT_RECEIPT', 'DOCUMENT_INVOICE', 'DOCUMENT_REFUND_CONFIRMATION',
  'DOCUMENT_TAX', 'DOCUMENT_PAYOUT', 'DOCUMENT_VOIDED',
] as const;
export type TitleCode = typeof TITLE_CODES[number];

export const MONEY_LABEL_CODES = [
  'AMOUNT_DUE', 'AMOUNT_PAID', 'AMOUNT_YOU_WILL_RECEIVE', 'AMOUNT_REFUND',
  'REFUND_AMOUNT', 'GIFT_AMOUNT', 'TOPUP_AMOUNT', 'PAYOUT_AMOUNT',
] as const;
export type MoneyLabelCode = typeof MONEY_LABEL_CODES[number];

export const SUBTITLE_CODES = [
  'ISSUER_SUMIT', 'ISSUER_PW',
] as const;
export type SubtitleCode = typeof SUBTITLE_CODES[number];

export const ATTENTION_DOMAIN_CODES = [
  'BOOKING', 'SHOP', 'PET', 'PROVIDER', 'PRESTIGE', 'K9000', 'EGIFT',
  'WALLET', 'PAYOUT', 'SUPPORT', 'DOCUMENT', 'MARKETING',
] as const;
export type AttentionDomainCode = typeof ATTENTION_DOMAIN_CODES[number];

// ── Membership guards ─────────────────────────────────────────────

const REASON_SET = new Set<string>(REASON_CODES);
const TITLE_SET = new Set<string>(TITLE_CODES);
const MONEY_SET = new Set<string>(MONEY_LABEL_CODES);
const SUBTITLE_SET = new Set<string>(SUBTITLE_CODES);
const ATTENTION_SET = new Set<string>(ATTENTION_DOMAIN_CODES);

export function isKnownReasonCode(s: string): s is ReasonCode { return REASON_SET.has(s); }
export function isKnownTitleCode(s: string): s is TitleCode { return TITLE_SET.has(s); }
export function isKnownMoneyLabelCode(s: string): s is MoneyLabelCode { return MONEY_SET.has(s); }
export function isKnownSubtitleCode(s: string): s is SubtitleCode { return SUBTITLE_SET.has(s); }
export function isKnownAttentionDomainCode(s: string): s is AttentionDomainCode { return ATTENTION_SET.has(s); }

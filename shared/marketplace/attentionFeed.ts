/**
 * AttentionFeedItem — CEO Business Doctrine §85, §93; Action Brain §85.
 *
 * The Attention engine (already in the repo as `attentionFeed`) drives
 * the home-screen "things that need your attention" strip. Every
 * category has a stable slug + severity + a suggested next action from
 * the doctrine's action catalog.
 *
 * Rules:
 *   • Categories are stable slugs (§93 discipline); translations are
 *     display-only.
 *   • Every item has a severity for stack-ranking; a P0 provider
 *     compliance blocker beats an "unread message" item.
 *   • Every item has a `primaryAction` from the ActionCatalog — the
 *     UI never invents its own next step.
 */
import type { ActionDomain } from './action';

export type AttentionCategory =
  // Money
  | 'PAYMENT_STILL_PROCESSING'
  | 'REFUND_IN_PROGRESS'
  | 'WALLET_TOPUP_PENDING'
  | 'EGIFT_DELIVERY_PENDING'
  // Bookings
  | 'PROVIDER_PROPOSED_CHANGE'
  | 'PROVIDER_REQUEST_INCOMING'
  | 'BOOKING_STARTS_SOON'
  | 'BOOKING_REQUEST_AWAITING_PROVIDER'
  | 'PROVIDER_REQUEST_EXPIRES_SOON'
  // Pets / KYA
  | 'PET_PROFILE_STALE'
  | 'PET_MEDICAL_SHARE_REQUESTED'
  // Provider surface
  | 'PROVIDER_KYC_MISSING'
  | 'PROVIDER_INSURANCE_EXPIRING'
  | 'PROVIDER_AGREEMENT_REACCEPTANCE_REQUIRED'
  // Prestige
  | 'PRESTIGE_JOIN_ELIGIBLE'
  // Support
  | 'SUPPORT_REPLY_AWAITING'
  // Documents
  | 'RECEIPT_AVAILABLE';

export type AttentionSeverity = 'INFO' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface AttentionFeedItem {
  itemId: string;
  category: AttentionCategory;
  domain: ActionDomain;
  severity: AttentionSeverity;
  title: string;                       // short imperative — "Update Bruno's profile"
  subtitle?: string;                   // one-liner context
  entityRef?: { kind: string; id: string };
  primaryActionType: string;           // ActionCatalog slug
  dismissable: boolean;                // user can hide (§60)
  createdAt: string;                   // ISO
  expiresAt?: string;                  // ISO — auto-hide after this
}

// ── Severity ordering (§85 stack-ranking) ─────────────────────────────

const SEVERITY_RANK: Record<AttentionSeverity, number> = {
  INFO: 0,
  MEDIUM: 1,
  HIGH: 2,
  URGENT: 3,
};

/**
 * Rank items highest-severity first. Same-severity ordering is stable
 * so paginated views stay deterministic.
 */
export function rankBySeverity(items: AttentionFeedItem[]): AttentionFeedItem[] {
  return [...items].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
}

/**
 * Auto-drop expired items — the caller should filter with `now` from
 * server time (never trust client clock for expiry).
 */
export function dropExpired(items: AttentionFeedItem[], now: string): AttentionFeedItem[] {
  return items.filter((i) => !i.expiresAt || i.expiresAt > now);
}

/**
 * Category → default severity table. Callers can override per item, but
 * this ensures "provider agreement needs reacceptance" always outranks
 * "receipt available" on the same screen.
 */
export const DEFAULT_SEVERITY: Record<AttentionCategory, AttentionSeverity> = {
  // URGENT — blocks safety / money / marketplace access
  PROVIDER_AGREEMENT_REACCEPTANCE_REQUIRED: 'URGENT',
  PAYMENT_STILL_PROCESSING: 'URGENT',
  PROVIDER_KYC_MISSING: 'URGENT',
  PROVIDER_INSURANCE_EXPIRING: 'URGENT',

  // HIGH — time-sensitive commercial state
  PROVIDER_REQUEST_INCOMING: 'HIGH',
  PROVIDER_REQUEST_EXPIRES_SOON: 'HIGH',
  PROVIDER_PROPOSED_CHANGE: 'HIGH',
  BOOKING_STARTS_SOON: 'HIGH',
  PET_MEDICAL_SHARE_REQUESTED: 'HIGH',

  // MEDIUM — awaiting response, useful nudges
  BOOKING_REQUEST_AWAITING_PROVIDER: 'MEDIUM',
  REFUND_IN_PROGRESS: 'MEDIUM',
  WALLET_TOPUP_PENDING: 'MEDIUM',
  EGIFT_DELIVERY_PENDING: 'MEDIUM',
  PET_PROFILE_STALE: 'MEDIUM',
  SUPPORT_REPLY_AWAITING: 'MEDIUM',

  // INFO — friendly nudges, not gates
  PRESTIGE_JOIN_ELIGIBLE: 'INFO',
  RECEIPT_AVAILABLE: 'INFO',
};

/**
 * Category → doctrine action type. The Attention engine surfaces the
 * suggested next step from the shared action catalog — never a
 * home-grown button.
 */
export const CATEGORY_PRIMARY_ACTION: Record<AttentionCategory, string> = {
  PAYMENT_STILL_PROCESSING: 'SUPPORT_CONTACT_OPEN',
  REFUND_IN_PROGRESS: 'SUPPORT_CONTACT_OPEN',
  WALLET_TOPUP_PENDING: 'SUPPORT_CONTACT_OPEN',
  EGIFT_DELIVERY_PENDING: 'SUPPORT_CONTACT_OPEN',
  PROVIDER_PROPOSED_CHANGE: 'BOOKING_ACCEPT_PROPOSED_CHANGE',
  PROVIDER_REQUEST_INCOMING: 'BOOKING_ACCEPT',
  BOOKING_STARTS_SOON: 'MESSAGE_SEND',
  BOOKING_REQUEST_AWAITING_PROVIDER: 'MESSAGE_SEND',
  PROVIDER_REQUEST_EXPIRES_SOON: 'BOOKING_ACCEPT',
  PET_PROFILE_STALE: 'PET_UPDATE',
  PET_MEDICAL_SHARE_REQUESTED: 'KYA_SHARE_MEDICAL_FOR_BOOKING',
  PROVIDER_KYC_MISSING: 'PROVIDER_APPLICATION_UPLOAD_ID',
  PROVIDER_INSURANCE_EXPIRING: 'PROVIDER_APPLICATION_UPLOAD_ID',
  PROVIDER_AGREEMENT_REACCEPTANCE_REQUIRED: 'PROVIDER_AGREEMENT_ACCEPT',
  PRESTIGE_JOIN_ELIGIBLE: 'PRESTIGE_JOIN',
  SUPPORT_REPLY_AWAITING: 'SUPPORT_CONTACT_OPEN',
  RECEIPT_AVAILABLE: 'SUPPORT_CONTACT_OPEN',
};

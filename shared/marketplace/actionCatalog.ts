/**
 * PetWash Action Catalog — CEO Action + Confirmation Brain Doctrine
 * §14, §71, §74, §75.
 *
 * The 60-plus canonical mutating actions PetWash currently supports. The
 * doctrine documents the top ~100 (§74); this file is the SINGLE
 * REGISTRY the deterministic brain + AI concierge + client render layer
 * all consult. New actions land here — never in a switch statement
 * elsewhere.
 */
import type { ActionDomain, ConfirmationLevel, RiskLevel } from './action';

export interface CatalogEntry {
  actionType: string;
  domain: ActionDomain;
  riskLevel: RiskLevel;
  confirmationLevel: ConfirmationLevel;
  /** Short human-readable label — the imperative verb the UI button carries (§79). */
  label: string;
  /** Machine-readable slug the client uses to identify the icon / colour. */
  visualKind?: 'primary' | 'secondary' | 'destructive' | 'safety';
}

/**
 * The registry. Grouped by domain per §71.
 *
 * INVARIANTS enforced by the accompanying behavior pins:
 *   • Every entry has a domain.
 *   • Destructive / irreversible actions carry visualKind: 'destructive'
 *     or 'safety' and confirmationLevel of at least EXPLICIT_CONFIRM.
 *   • Payment / bank / account-delete actions are REAUTH_AND_CONFIRM.
 *   • Button labels are specific verbs — no bare "Continue" / "OK".
 */
export const ACTION_CATALOG: CatalogEntry[] = [
  // AUTH + PROFILE
  { actionType: 'AUTH_SIGN_IN', domain: 'AUTH', riskLevel: 'L2', confirmationLevel: 'REVIEW_SCREEN', label: 'Sign in', visualKind: 'primary' },
  { actionType: 'AUTH_SIGN_OUT', domain: 'AUTH', riskLevel: 'L1', confirmationLevel: 'LIGHT_CONFIRM', label: 'Sign out' },
  { actionType: 'PROFILE_UPDATE_NAME', domain: 'PROFILE', riskLevel: 'L1', confirmationLevel: 'NONE', label: 'Save name' },
  { actionType: 'PROFILE_UPDATE_LANGUAGE', domain: 'PROFILE', riskLevel: 'L1', confirmationLevel: 'NONE', label: 'Save language' },
  { actionType: 'PROFILE_UPDATE_MARKETING_CONSENT', domain: 'PROFILE', riskLevel: 'L1', confirmationLevel: 'LIGHT_CONFIRM', label: 'Save marketing preference' },
  { actionType: 'ACCOUNT_DELETE', domain: 'PROFILE', riskLevel: 'L4', confirmationLevel: 'REAUTH_AND_CONFIRM', label: 'Delete account', visualKind: 'destructive' },

  // PET / KYA
  { actionType: 'PET_CREATE', domain: 'PET', riskLevel: 'L2', confirmationLevel: 'REVIEW_SCREEN', label: 'Add pet', visualKind: 'primary' },
  { actionType: 'PET_UPDATE', domain: 'PET', riskLevel: 'L2', confirmationLevel: 'LIGHT_CONFIRM', label: 'Save changes' },
  { actionType: 'PET_ARCHIVE', domain: 'PET', riskLevel: 'L2', confirmationLevel: 'EXPLICIT_CONFIRM', label: 'Archive pet', visualKind: 'destructive' },
  { actionType: 'PET_DELETE_NO_HISTORY', domain: 'PET', riskLevel: 'L3', confirmationLevel: 'EXPLICIT_CONFIRM', label: 'Delete pet', visualKind: 'destructive' },
  { actionType: 'KYA_SHARE_MEDICAL_FOR_BOOKING', domain: 'PET', riskLevel: 'L2', confirmationLevel: 'LIGHT_CONFIRM', label: 'Share for this booking' },
  { actionType: 'KYA_REVIEW_TIMESTAMP_TOUCH', domain: 'PET', riskLevel: 'L1', confirmationLevel: 'NONE', label: 'Everything is still correct' },

  // PRESTIGE
  { actionType: 'PRESTIGE_JOIN', domain: 'PRESTIGE', riskLevel: 'L3', confirmationLevel: 'REVIEW_SCREEN', label: 'Join Prestige', visualKind: 'primary' },
  { actionType: 'PRESTIGE_CANCEL_MEMBERSHIP', domain: 'PRESTIGE', riskLevel: 'L3', confirmationLevel: 'EXPLICIT_CONFIRM', label: 'Cancel Prestige membership', visualKind: 'destructive' },

  // BOOKING lifecycle
  { actionType: 'BOOKING_REQUEST_SUBMIT', domain: 'BOOKING', riskLevel: 'L2', confirmationLevel: 'REVIEW_SCREEN', label: 'Send booking request', visualKind: 'primary' },
  { actionType: 'BOOKING_ACCEPT', domain: 'BOOKING', riskLevel: 'L2', confirmationLevel: 'REVIEW_SCREEN', label: 'Accept booking', visualKind: 'primary' },
  { actionType: 'BOOKING_DECLINE', domain: 'BOOKING', riskLevel: 'L2', confirmationLevel: 'LIGHT_CONFIRM', label: 'Decline booking' },
  { actionType: 'BOOKING_PROPOSE_CHANGE', domain: 'BOOKING', riskLevel: 'L2', confirmationLevel: 'REVIEW_SCREEN', label: 'Propose changes' },
  { actionType: 'BOOKING_ACCEPT_PROPOSED_CHANGE', domain: 'BOOKING', riskLevel: 'L3', confirmationLevel: 'REVIEW_SCREEN', label: 'Accept changes' },
  { actionType: 'BOOKING_ADD_PET', domain: 'BOOKING', riskLevel: 'L2', confirmationLevel: 'REVIEW_SCREEN', label: 'Add pet to booking' },
  { actionType: 'BOOKING_EXTEND', domain: 'BOOKING', riskLevel: 'L3', confirmationLevel: 'REVIEW_SCREEN', label: 'Extend booking' },
  { actionType: 'BOOKING_CANCEL_UNPAID', domain: 'BOOKING', riskLevel: 'L2', confirmationLevel: 'LIGHT_CONFIRM', label: 'Cancel request' },
  { actionType: 'BOOKING_CANCEL_PAID', domain: 'BOOKING', riskLevel: 'L3', confirmationLevel: 'EXPLICIT_CONFIRM', label: 'Cancel booking', visualKind: 'destructive' },
  { actionType: 'BOOKING_START_JOB', domain: 'BOOKING', riskLevel: 'L2', confirmationLevel: 'LIGHT_CONFIRM', label: 'Start job', visualKind: 'primary' },
  { actionType: 'BOOKING_COMPLETE_JOB', domain: 'BOOKING', riskLevel: 'L3', confirmationLevel: 'REVIEW_SCREEN', label: 'Complete job', visualKind: 'primary' },
  { actionType: 'BOOKING_PET_HANDOFF', domain: 'BOOKING', riskLevel: 'L3', confirmationLevel: 'REVIEW_SCREEN', label: 'Confirm handoff', visualKind: 'safety' },
  { actionType: 'BOOKING_PET_RETURN', domain: 'BOOKING', riskLevel: 'L3', confirmationLevel: 'REVIEW_SCREEN', label: 'Confirm return', visualKind: 'safety' },
  { actionType: 'BOOKING_REVIEW_SUBMIT', domain: 'BOOKING', riskLevel: 'L2', confirmationLevel: 'NONE', label: 'Publish review' },

  // MEET & GREET
  { actionType: 'MEET_GREET_REQUEST', domain: 'MEET_AND_GREET', riskLevel: 'L2', confirmationLevel: 'REVIEW_SCREEN', label: 'Request Meet & Greet' },
  { actionType: 'MEET_GREET_ACCEPT', domain: 'MEET_AND_GREET', riskLevel: 'L2', confirmationLevel: 'REVIEW_SCREEN', label: 'Accept Meet & Greet' },
  { actionType: 'MEET_GREET_SUGGEST_TIME', domain: 'MEET_AND_GREET', riskLevel: 'L2', confirmationLevel: 'REVIEW_SCREEN', label: 'Suggest a different time' },
  { actionType: 'MEET_GREET_DECLINE', domain: 'MEET_AND_GREET', riskLevel: 'L2', confirmationLevel: 'LIGHT_CONFIRM', label: 'Decline Meet & Greet' },
  { actionType: 'MEET_GREET_COMPLETE', domain: 'MEET_AND_GREET', riskLevel: 'L2', confirmationLevel: 'LIGHT_CONFIRM', label: 'Meeting completed' },
  { actionType: 'MEET_GREET_ACKNOWLEDGE', domain: 'MEET_AND_GREET', riskLevel: 'L2', confirmationLevel: 'REVIEW_SCREEN', label: 'I understand — keep it on PetWash' },

  // COMMUNICATION
  { actionType: 'MESSAGE_SEND', domain: 'COMMUNICATION', riskLevel: 'L2', confirmationLevel: 'NONE', label: 'Send' },
  { actionType: 'MESSAGE_KEEP_ON_PETWASH_REPLY', domain: 'COMMUNICATION', riskLevel: 'L1', confirmationLevel: 'NONE', label: 'Keep on PetWash' },
  { actionType: 'MESSAGE_REPORT', domain: 'COMMUNICATION', riskLevel: 'L2', confirmationLevel: 'LIGHT_CONFIRM', label: 'Report message', visualKind: 'safety' },
  { actionType: 'THREAD_BLOCK_USER', domain: 'COMMUNICATION', riskLevel: 'L3', confirmationLevel: 'EXPLICIT_CONFIRM', label: 'Block user', visualKind: 'destructive' },
  { actionType: 'CALL_PROVIDER', domain: 'COMMUNICATION', riskLevel: 'L2', confirmationLevel: 'LIGHT_CONFIRM', label: 'Call provider' },
  { actionType: 'CALL_OWNER', domain: 'COMMUNICATION', riskLevel: 'L2', confirmationLevel: 'LIGHT_CONFIRM', label: 'Call owner' },

  // PROVIDER surface
  { actionType: 'PROVIDER_APPLICATION_SAVE_DRAFT', domain: 'PROVIDER', riskLevel: 'L1', confirmationLevel: 'NONE', label: 'Save draft' },
  { actionType: 'PROVIDER_APPLICATION_UPLOAD_ID', domain: 'PROVIDER', riskLevel: 'L2', confirmationLevel: 'REVIEW_SCREEN', label: 'Upload ID' },
  { actionType: 'PROVIDER_APPLICATION_ADD_SERVICE', domain: 'PROVIDER', riskLevel: 'L2', confirmationLevel: 'REVIEW_SCREEN', label: 'Add service' },
  { actionType: 'PROVIDER_APPLICATION_REMOVE_SERVICE', domain: 'PROVIDER', riskLevel: 'L2', confirmationLevel: 'LIGHT_CONFIRM', label: 'Remove service' },
  { actionType: 'PROVIDER_APPLICATION_SUBMIT', domain: 'PROVIDER', riskLevel: 'L3', confirmationLevel: 'REVIEW_SCREEN', label: 'Submit application', visualKind: 'primary' },
  { actionType: 'PROVIDER_AGREEMENT_ACCEPT', domain: 'PROVIDER', riskLevel: 'L3', confirmationLevel: 'REVIEW_SCREEN', label: 'I agree & continue' },
  { actionType: 'PROVIDER_APPLICATION_WITHDRAW', domain: 'PROVIDER', riskLevel: 'L3', confirmationLevel: 'EXPLICIT_CONFIRM', label: 'Withdraw application', visualKind: 'destructive' },
  { actionType: 'PROVIDER_SERVICE_ENABLE', domain: 'PROVIDER', riskLevel: 'L2', confirmationLevel: 'LIGHT_CONFIRM', label: 'Enable service' },
  { actionType: 'PROVIDER_SERVICE_DISABLE', domain: 'PROVIDER', riskLevel: 'L2', confirmationLevel: 'LIGHT_CONFIRM', label: 'Disable service' },
  { actionType: 'PROVIDER_PRICE_UPDATE', domain: 'PROVIDER', riskLevel: 'L3', confirmationLevel: 'REVIEW_SCREEN', label: 'Save new rate' },
  { actionType: 'PROVIDER_AVAILABILITY_UPDATE', domain: 'PROVIDER', riskLevel: 'L2', confirmationLevel: 'REVIEW_SCREEN', label: 'Save availability' },
  { actionType: 'PROVIDER_PAYOUT_BANK_CHANGE', domain: 'PROVIDER', riskLevel: 'L4', confirmationLevel: 'REAUTH_AND_CONFIRM', label: 'Confirm bank account change', visualKind: 'destructive' },

  // MONEY
  { actionType: 'WALLET_TOPUP', domain: 'MONEY', riskLevel: 'L3', confirmationLevel: 'EXPLICIT_CONFIRM', label: 'Pay ₪', visualKind: 'primary' },
  { actionType: 'EGIFT_SEND', domain: 'MONEY', riskLevel: 'L3', confirmationLevel: 'EXPLICIT_CONFIRM', label: 'Pay & send gift', visualKind: 'primary' },
  { actionType: 'EGIFT_REDEEM', domain: 'MONEY', riskLevel: 'L3', confirmationLevel: 'REVIEW_SCREEN', label: 'Redeem gift' },
  { actionType: 'REFUND_REQUEST', domain: 'MONEY', riskLevel: 'L3', confirmationLevel: 'REVIEW_SCREEN', label: 'Request refund' },

  // SHOP
  { actionType: 'SHOP_CHECKOUT', domain: 'SHOP', riskLevel: 'L3', confirmationLevel: 'EXPLICIT_CONFIRM', label: 'Pay ₪', visualKind: 'primary' },
  { actionType: 'SHOP_CANCEL_ORDER', domain: 'SHOP', riskLevel: 'L3', confirmationLevel: 'EXPLICIT_CONFIRM', label: 'Cancel order', visualKind: 'destructive' },
  { actionType: 'SHOP_PICKUP_VERIFY', domain: 'SHOP', riskLevel: 'L2', confirmationLevel: 'REVIEW_SCREEN', label: 'Confirm pickup' },

  // SUPPORT + SAFETY
  { actionType: 'SUPPORT_CONTACT_OPEN', domain: 'SUPPORT', riskLevel: 'L1', confirmationLevel: 'NONE', label: 'Contact support' },
  { actionType: 'SUPPORT_ATTACH_EVIDENCE', domain: 'SUPPORT', riskLevel: 'L2', confirmationLevel: 'REVIEW_SCREEN', label: 'Attach evidence' },
  { actionType: 'SAFETY_REPORT_SUBMIT', domain: 'SUPPORT', riskLevel: 'L3', confirmationLevel: 'REVIEW_SCREEN', label: 'Send report to Trust & Safety', visualKind: 'safety' },
  { actionType: 'INCIDENT_REPORT_ACTIVE_JOB', domain: 'SUPPORT', riskLevel: 'L3', confirmationLevel: 'REVIEW_SCREEN', label: 'Report incident', visualKind: 'safety' },

  // ADMIN
  { actionType: 'ADMIN_SUSPEND_PROVIDER', domain: 'ADMIN', riskLevel: 'L4', confirmationLevel: 'REAUTH_AND_CONFIRM', label: 'Suspend provider', visualKind: 'destructive' },
  { actionType: 'ADMIN_REINSTATE_PROVIDER', domain: 'ADMIN', riskLevel: 'L3', confirmationLevel: 'EXPLICIT_CONFIRM', label: 'Reinstate provider' },
  { actionType: 'ADMIN_ISSUE_REFUND_LARGE', domain: 'ADMIN', riskLevel: 'L4', confirmationLevel: 'REAUTH_AND_CONFIRM', label: 'Issue refund', visualKind: 'destructive' },
  { actionType: 'ADMIN_BULK_MESSAGE', domain: 'ADMIN', riskLevel: 'L3', confirmationLevel: 'EXPLICIT_CONFIRM', label: 'Send bulk message' },
  { actionType: 'ADMIN_BULK_SUSPEND', domain: 'ADMIN', riskLevel: 'L4', confirmationLevel: 'REAUTH_AND_CONFIRM', label: 'Bulk suspend', visualKind: 'destructive' },
];

/**
 * O(1) lookup, built once at import time so callers don't rebuild a Map
 * per request.
 */
const BY_TYPE: Map<string, CatalogEntry> = new Map(
  ACTION_CATALOG.map((entry) => [entry.actionType, entry]),
);

export function getCatalogEntry(actionType: string): CatalogEntry | undefined {
  return BY_TYPE.get(actionType);
}

export function listByDomain(domain: ActionDomain): CatalogEntry[] {
  return ACTION_CATALOG.filter((e) => e.domain === domain);
}

/**
 * Bad-labels blocklist. §79 says never use "Continue", "Submit", "OK",
 * "Yes". This helper is used by the catalog pin to enforce the rule
 * across the registry.
 */
const BAD_LABELS = new Set(['continue', 'submit', 'ok', 'yes']);

export function hasBadLabel(entry: CatalogEntry): boolean {
  return BAD_LABELS.has(entry.label.trim().toLowerCase());
}

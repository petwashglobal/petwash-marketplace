/**
 * MessageModerationAudit + MarketplaceIntegritySignal — CEO Integrity
 * Doctrine §6.12, §7.
 *
 * Append-only records the server writes when the MessagePolicyEngine has
 * evaluated a message. Retention + storage location need a privacy review
 * before production activation; these types are the shape.
 *
 * Blocked-message BODY is stored only when the outcome mandates evidence
 * capture for safety / dispute / legal (BLOCK_AND_REVIEW / SAFETY_ESCALATION).
 * The helper `shouldRetainBody()` centralises this rule so callers don't
 * fork the retention policy across sites.
 */
import type {
  PolicyCategory,
  PolicyOutcome,
  ThreadType,
} from './policyEngine';

export interface MessageModerationAudit {
  messageAttemptId: string;
  senderUid: string;
  threadId: string;
  threadType: ThreadType;
  bookingId?: string;
  policyVersion: string;
  decision: PolicyOutcome;
  primaryCategory?: PolicyCategory;
  confidence: number; // 0..1 — highest category confidence
  timestamp: string;  // ISO
  reviewStatus?: 'pending' | 'reviewed' | 'closed';
  // Set ONLY when the retention rule applies. Storing every blocked body
  // long-term is a privacy defect, not a safety win.
  retainedBody?: string;
}

export type IntegritySignalType =
  | 'OFF_PLATFORM_MESSAGE_ATTEMPT'
  | 'PAYMENT_DETAIL_ATTEMPT'
  | 'CONTACT_EXCHANGE_ATTEMPT'
  | 'REPEATED_CANCEL_AFTER_CONTACT'
  | 'EXTERNAL_LINK_ATTEMPT'
  | 'DIRECT_SOLICITATION';

export type IntegrityResolution =
  | 'AUTO_BLOCK'
  | 'WARN'
  | 'PENDING_REVIEW'
  | 'DISMISSED'
  | 'ACTIONED';

export interface MarketplaceIntegritySignal {
  signalId: string;
  signalType: IntegritySignalType;
  customerUid: string;
  providerUid: string;
  bookingId?: string;
  threadId?: string;
  confidence: number;
  detectedAt: string;
  resolution?: IntegrityResolution;
}

/**
 * Doctrine §6.12: raw blocked-message body is stored ONLY as long as needed
 * for safety / dispute / legal evidence. `shouldRetainBody` centralises the
 * retention decision — never inline this check at call sites (drift risk).
 */
export function shouldRetainBody(decision: PolicyOutcome): boolean {
  return decision === 'BLOCK_AND_REVIEW' || decision === 'SAFETY_ESCALATION';
}

/**
 * Map a PolicyCategory → integrity signal (§7.1). Not every category yields
 * an integrity signal — hate/threat/sexual are safety events (audit only).
 * The signal engine tracks marketplace-integrity patterns specifically.
 */
export function integritySignalFor(category?: PolicyCategory): IntegritySignalType | null {
  switch (category) {
    case 'OFF_PLATFORM_BOOKING':
      return 'DIRECT_SOLICITATION';
    case 'OFF_PLATFORM_PAYMENT':
      return 'PAYMENT_DETAIL_ATTEMPT';
    case 'CONTACT_EXCHANGE':
      return 'CONTACT_EXCHANGE_ATTEMPT';
    case 'EXTERNAL_MESSAGING_APP':
      return 'OFF_PLATFORM_MESSAGE_ATTEMPT';
    case 'EXTERNAL_LINK':
      return 'EXTERNAL_LINK_ATTEMPT';
    default:
      return null;
  }
}

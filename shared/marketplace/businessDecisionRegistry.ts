/**
 * Business Decision Registry — CEO §48, §20.
 *
 * The smart system MUST know what it DOESN'T know. Engineer assumptions
 * about business policy (fee amounts, thresholds, expiry windows,
 * cancellation consequences) are NEVER production behavior — they are
 * either configured by an actual business decision or marked
 * UNDECIDED here.
 *
 * When a caller consults an unresolved decision, the surface responds
 * with `POLICY_NOT_CONFIGURED` (§20) — action unavailable, reason
 * traceable to this registry, decision queued for CEO/business.
 */

export type DecisionStatus = 'UNDECIDED' | 'DRAFT' | 'APPROVED';

export interface BusinessDecision {
  key: string;
  status: DecisionStatus;
  question: string;
  decidedBy?: string;                  // e.g. "CEO 2026-08-30"
  decidedAt?: string;                  // ISO
  approvedValue?: unknown;             // opaque — call site knows the shape
  notes?: string;
}

/**
 * The registry — every entry is either UNDECIDED (no engineer default
 * allowed) or APPROVED (with a decidedBy + decidedAt evidence trail).
 */
export const BUSINESS_DECISIONS: BusinessDecision[] = [
  {
    key: 'PRESTIGE_CANCEL_POLICY',
    status: 'UNDECIDED',
    question: 'What happens to points / tier / wallet / member history / marketing / reactivation when a Prestige membership is cancelled?',
  },
  {
    key: 'KYA_DEFAULT_REVIEW_INTERVAL',
    status: 'UNDECIDED',
    question: 'What is the default freshness window before a pet profile enters REVIEW_SOON / STALE? Dimensions: species, age band, service type, medical relevance, active bookings.',
    notes: 'Prior engineer-invented defaults (adult 150/210 days, young 45/90 days) removed — those were placeholders, not policy.',
  },
  {
    key: 'PROVIDER_CANCELLATION_FEE',
    status: 'UNDECIDED',
    question: 'When a provider cancels a confirmed booking, what fee applies to them and what refund the customer receives? Differentiated by lead time + repeat behaviour?',
  },
  {
    key: 'MEET_GREET_CONTACT_UNLOCK',
    status: 'UNDECIDED',
    question: 'When (if ever) is masked contact info unlocked after a Meet & Greet is confirmed but before booking is confirmed? Different by service type?',
  },
  {
    key: 'POST_BOOKING_MASKED_PHONE_EXPIRY',
    status: 'UNDECIDED',
    question: 'How long after COMPLETED does the masked call route stay open? Different by service type / repeat customer status?',
  },
  {
    key: 'NON_CIRCUMVENTION_DURATION',
    status: 'UNDECIDED',
    question: 'The exact duration and enforcement stance of the Provider Agreement non-circumvention clause. Israeli-counsel approval required.',
    notes: 'Prior engineer-invented 12/24-month restrictions explicitly forbidden (integrity doctrine §1).',
  },
  {
    key: 'PAYOUT_HOLD_WINDOW',
    status: 'UNDECIDED',
    question: 'How long is a provider payout HELD after a completed booking to allow for dispute? Different by service type / provider tenure?',
  },
  {
    key: 'REVIEW_MODERATION_WINDOW',
    status: 'UNDECIDED',
    question: 'How long does the customer have to submit a review after COMPLETED? Is the review moderated before it appears publicly?',
  },
];

const BY_KEY = new Map<string, BusinessDecision>(BUSINESS_DECISIONS.map((d) => [d.key, d]));

export function getBusinessDecision(key: string): BusinessDecision | undefined {
  return BY_KEY.get(key);
}

export function isPolicyConfigured(key: string): boolean {
  return BY_KEY.get(key)?.status === 'APPROVED';
}

export function listUndecided(): BusinessDecision[] {
  return BUSINESS_DECISIONS.filter((d) => d.status !== 'APPROVED');
}

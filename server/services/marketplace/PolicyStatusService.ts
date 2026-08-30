/**
 * PolicyStatusService — CEO DOCTRINE §21-§22 status roll-up.
 *
 * Pure evaluator that reads the BusinessDecisionRegistry and returns
 * a domain-grouped view of undecided vs decided policies. Admin
 * surfaces consume this to answer "what does the CEO still need to
 * decide before we can lift POLICY_NOT_CONFIGURED off surfaces X,
 * Y, Z?"
 *
 * The evaluator NEVER invents a value or a domain mapping — every
 * decision is classified from its declared key by prefix / substring
 * rules that live in this file alone.
 */
import {
  BUSINESS_DECISIONS,
  type BusinessDecision,
  type DecisionStatus,
} from '@shared/marketplace/businessDecisionRegistry';

export type PolicyDomain =
  | 'PRESTIGE'
  | 'KYA'
  | 'CANCELLATION'
  | 'REVIEW'
  | 'PAYOUT'
  | 'OTHER';

export interface DomainStatus {
  domain: PolicyDomain;
  approved: string[];                       // decision keys
  draft: string[];
  undecided: string[];
}

function classify(key: string): PolicyDomain {
  const k = key.toUpperCase();
  if (k.includes('PRESTIGE')) return 'PRESTIGE';
  if (k.includes('KYA')) return 'KYA';
  if (k.includes('CANCEL')) return 'CANCELLATION';
  if (k.includes('REVIEW')) return 'REVIEW';
  if (k.includes('PAYOUT') || k.includes('SETTLEMENT')) return 'PAYOUT';
  return 'OTHER';
}

const DOMAINS: PolicyDomain[] = ['PRESTIGE', 'KYA', 'CANCELLATION', 'REVIEW', 'PAYOUT', 'OTHER'];

export function policyStatusByDomain(decisions: readonly BusinessDecision[] = BUSINESS_DECISIONS): DomainStatus[] {
  const buckets = Object.fromEntries(
    DOMAINS.map((d) => [d, { domain: d, approved: [] as string[], draft: [] as string[], undecided: [] as string[] }])
  ) as unknown as Record<PolicyDomain, DomainStatus>;

  for (const d of decisions) {
    const dom = classify(d.key);
    const bucket = buckets[dom];
    switch (d.status as DecisionStatus) {
      case 'APPROVED': bucket.approved.push(d.key); break;
      case 'DRAFT':    bucket.draft.push(d.key); break;
      case 'UNDECIDED':
      default:         bucket.undecided.push(d.key); break;
    }
  }

  return DOMAINS.map((d) => buckets[d]);
}

/** Fast summary — how many policies are still undecided in total. */
export function countUndecided(decisions: readonly BusinessDecision[] = BUSINESS_DECISIONS): number {
  return decisions.filter((d) => d.status !== 'APPROVED').length;
}

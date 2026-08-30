/**
 * ProviderServiceApprovalEvaluator — CEO PROGRAM 21 (Provider Application).
 *
 * Pure evaluator. Doctrine: "Service approval independent. Walker
 * approved, Sitter approved, Daycare pending." Search only exposes
 * approved/bookable services — never a provider's pending service.
 *
 * Given a set of per-service approval records, the evaluator returns:
 *   • bookableServices — the ones a customer may see + book right now,
 *   • pendingServices — under-review, provider sees but customer does not,
 *   • rejectedServices — declined; provider may re-apply per policy.
 */

export type ServiceApprovalStatus = 'DRAFT' | 'SUBMITTED' | 'IN_REVIEW' | 'CHANGES_REQUESTED' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export interface ProviderServiceApproval {
  providerId: string;
  serviceCode: string;                                 // 'DOG_WALK', 'DAYCARE', ...
  status: ServiceApprovalStatus;
  reasonCode?: string;
}

export interface EvaluatorInput {
  providerId: string;
  approvals: ProviderServiceApproval[];
  /** True when the caller is the provider themselves (they may see PENDING / REJECTED); false when it's a customer search context. */
  viewerIsProvider: boolean;
}

export interface EvaluatorOutcome {
  bookableServices: string[];
  pendingServices: string[];        // populated only if viewerIsProvider === true
  rejectedServices: string[];       // populated only if viewerIsProvider === true
}

export function evaluateProviderServiceApprovals(input: EvaluatorInput): EvaluatorOutcome {
  const bookable: string[] = [];
  const pending: string[] = [];
  const rejected: string[] = [];
  for (const a of input.approvals) {
    if (a.providerId !== input.providerId) continue;
    if (a.status === 'APPROVED') bookable.push(a.serviceCode);
    else if (a.status === 'REJECTED') { if (input.viewerIsProvider) rejected.push(a.serviceCode); }
    else if (a.status === 'SUSPENDED') { if (input.viewerIsProvider) rejected.push(a.serviceCode); }
    else if (input.viewerIsProvider) pending.push(a.serviceCode);
  }
  return { bookableServices: bookable, pendingServices: pending, rejectedServices: rejected };
}

/** Ask "is this specific service bookable for this provider RIGHT NOW?" */
export function isServiceBookable(input: { providerId: string; serviceCode: string; approvals: ProviderServiceApproval[] }): boolean {
  return input.approvals.some((a) =>
    a.providerId === input.providerId
    && a.serviceCode === input.serviceCode
    && a.status === 'APPROVED',
  );
}

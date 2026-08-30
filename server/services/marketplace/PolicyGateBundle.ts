/**
 * PolicyGateBundle — CEO §21-§22 aggregate gate.
 *
 * Pure evaluator. Given the actor context + a set of policy keys
 * the caller cares about, returns a single {allow, blockers[]} shape
 * so surfaces can gate a critical action on multiple policies with
 * one call. If ANY named policy is undecided, allow=false and the
 * blockers list carries every undecided key.
 */
import {
  isPolicyConfigured,
  getBusinessDecision,
} from '@shared/marketplace/businessDecisionRegistry';

export interface GateInput {
  requiredPolicyKeys: string[];
}

export interface Blocker {
  policyKey: string;
  question: string;
}

export interface GateOutcome {
  allow: boolean;
  blockers: Blocker[];
}

export function evaluatePolicyGate(input: GateInput): GateOutcome {
  const blockers: Blocker[] = [];
  for (const key of input.requiredPolicyKeys) {
    if (!isPolicyConfigured(key)) {
      const decision = getBusinessDecision(key);
      blockers.push({
        policyKey: key,
        question: decision?.question ?? 'POLICY_NOT_CONFIGURED',
      });
    }
  }
  return { allow: blockers.length === 0, blockers };
}

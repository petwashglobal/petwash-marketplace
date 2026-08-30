/**
 * PolicyGateBundle — aggregate policy gate.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@shared/marketplace/businessDecisionRegistry', () => ({
  isPolicyConfigured: (key: string) => key === 'APPROVED_ONE',
  getBusinessDecision: (key: string) => ({ key, status: 'UNDECIDED', question: `q for ${key}` }),
}));

const { evaluatePolicyGate } = await import('../services/marketplace/PolicyGateBundle');

describe('PolicyGateBundle', () => {
  it('empty required list → allow=true', () => {
    expect(evaluatePolicyGate({ requiredPolicyKeys: [] })).toEqual({ allow: true, blockers: [] });
  });

  it('all keys approved → allow=true', () => {
    const out = evaluatePolicyGate({ requiredPolicyKeys: ['APPROVED_ONE'] });
    expect(out.allow).toBe(true);
    expect(out.blockers).toEqual([]);
  });

  it('any single undecided key → allow=false', () => {
    const out = evaluatePolicyGate({ requiredPolicyKeys: ['APPROVED_ONE', 'PENDING_ONE'] });
    expect(out.allow).toBe(false);
    expect(out.blockers).toHaveLength(1);
    expect(out.blockers[0].policyKey).toBe('PENDING_ONE');
    expect(out.blockers[0].question).toContain('q for PENDING_ONE');
  });

  it('multiple undecided keys are all surfaced', () => {
    const out = evaluatePolicyGate({ requiredPolicyKeys: ['P1', 'P2', 'P3'] });
    expect(out.allow).toBe(false);
    expect(out.blockers.map((b) => b.policyKey)).toEqual(['P1', 'P2', 'P3']);
  });
});

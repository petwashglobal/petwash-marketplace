/**
 * Regression pin — the 5 Nayax UNDECIDED entries stay UNDECIDED
 * until a real business decision resolves them. Source-anchored so
 * an engineer cannot silently flip an entry to APPROVED without a
 * decidedBy + decidedAt record.
 */
import { describe, it, expect } from 'vitest';
import {
  BUSINESS_DECISIONS,
  isPolicyConfigured,
  policyStatusByDomain as _psbd,
} from '@shared/marketplace/businessDecisionRegistry';
import { policyStatusByDomain } from '../services/marketplace/PolicyStatusService';

const NAYAX_KEYS = [
  'NAYAX_FISCAL_ENGINE_IDENTITY',
  'NAYAX_ERECEIPT_MODULE_ENABLED',
  'NAYAX_DYNAMIC_RECEIPT_ENABLED',
  'NAYAX_SCHEDULED_REPORTS_ENABLED',
  'NAYAX_MCC_CORRECT',
] as const;

describe('Nayax BusinessDecisionRegistry entries', () => {
  it('every Nayax key exists in the registry', () => {
    const keys = new Set(BUSINESS_DECISIONS.map((d) => d.key));
    for (const k of NAYAX_KEYS) expect(keys.has(k)).toBe(true);
  });

  it('every Nayax key is UNDECIDED (no engineer default allowed)', () => {
    for (const k of NAYAX_KEYS) expect(isPolicyConfigured(k)).toBe(false);
  });

  it('every Nayax key carries a non-empty question (surfaced to CEO)', () => {
    for (const k of NAYAX_KEYS) {
      const entry = BUSINESS_DECISIONS.find((d) => d.key === k)!;
      expect(entry.question.length).toBeGreaterThan(20);
    }
  });

  it('PolicyStatusService groups the Nayax keys under OTHER (no NAYAX domain yet)', () => {
    // The domain classifier lives in PolicyStatusService; this test
    // pins that all 5 Nayax entries surface somewhere (currently
    // OTHER) so the admin roll-up doesn't drop them.
    const buckets = policyStatusByDomain();
    const flat = buckets.flatMap((b) => [...b.approved, ...b.draft, ...b.undecided]);
    for (const k of NAYAX_KEYS) expect(flat).toContain(k);
  });

  it('any APPROVED promotion requires a decidedBy + decidedAt record', () => {
    // If a key ever flips to APPROVED without evidence, the audit
    // trail is missing and this pin catches it.
    for (const k of NAYAX_KEYS) {
      const entry = BUSINESS_DECISIONS.find((d) => d.key === k)!;
      if ((entry.status as string) === 'APPROVED') {
        expect(entry.decidedBy).toBeTruthy();
        expect(entry.decidedAt).toBeTruthy();
      }
    }
  });
});

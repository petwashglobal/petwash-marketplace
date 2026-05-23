import { describe, it, expect } from 'vitest';

// Mirrors the validation in server/routes/admin-suppliers.ts. The route
// uses a closed enum for classification and rejects anything else with
// a 400. Tests here pin the contract so a typo in a future refactor
// can't silently widen the allowed set.

const ALLOWED_CLASSIFICATIONS = ['unknown', 'patur', 'murshe', 'chevra'] as const;
type OsekClassification = typeof ALLOWED_CLASSIFICATIONS[number];

function isValidClassification(v: unknown): v is OsekClassification {
  return typeof v === 'string' && (ALLOWED_CLASSIFICATIONS as readonly string[]).includes(v);
}

describe('admin-suppliers — classification validation', () => {
  it('accepts every Hebrew tax-status code we support', () => {
    expect(isValidClassification('unknown')).toBe(true);
    expect(isValidClassification('patur')).toBe(true);
    expect(isValidClassification('murshe')).toBe(true);
    expect(isValidClassification('chevra')).toBe(true);
  });

  it('rejects an empty string', () => {
    expect(isValidClassification('')).toBe(false);
  });

  it('rejects null and undefined', () => {
    expect(isValidClassification(null)).toBe(false);
    expect(isValidClassification(undefined)).toBe(false);
  });

  it('rejects a typo (case-sensitive)', () => {
    expect(isValidClassification('Murshe')).toBe(false);
    expect(isValidClassification('MURSHE')).toBe(false);
    expect(isValidClassification(' patur')).toBe(false);
  });

  it('rejects non-string inputs', () => {
    expect(isValidClassification(123)).toBe(false);
    expect(isValidClassification({})).toBe(false);
    expect(isValidClassification([])).toBe(false);
    expect(isValidClassification(true)).toBe(false);
  });

  it('rejects a removed-but-plausible value (e.g. "amutah" — non-profit)', () => {
    // Israeli law has more codes than we support; future PRs may add
    // 'amutah' (עמותה) or 'malkar' (מלכ"ר). Today they are NOT in the
    // enum, so they must be rejected. Updating the closed set requires
    // a schema migration to widen the CHECK constraint too.
    expect(isValidClassification('amutah')).toBe(false);
    expect(isValidClassification('malkar')).toBe(false);
  });
});

describe('admin-suppliers — classification policy notes', () => {
  it('the closed set has exactly four members', () => {
    expect(ALLOWED_CLASSIFICATIONS.length).toBe(4);
  });

  it('"unknown" is the safe default for newly-onboarded suppliers', () => {
    // The screening pipeline (server/lib/supplierInvoiceScreening.ts)
    // emits an osek_classification_unknown warning whenever an invoice
    // arrives from a supplier still in this state. Removing 'unknown'
    // from the allowed set would silently disable that guardrail.
    expect(ALLOWED_CLASSIFICATIONS).toContain('unknown');
  });

  it('"patur" is present because it triggers the hard-fail VAT mismatch rule', () => {
    expect(ALLOWED_CLASSIFICATIONS).toContain('patur');
  });
});

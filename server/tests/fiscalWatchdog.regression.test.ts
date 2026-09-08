/**
 * Fiscal watchdog invariants — regression pin (2026-09-08).
 *
 * evaluateClaimLedger() is PURE over the rows it is given, so every rule is
 * tested for real rather than asserted by reading source. Each case is a
 * deliberate fixture of the exact state that must be caught — the point of a
 * control is that it FIRES, so each one is proven to.
 */
import { describe, it, expect } from 'vitest';
import { evaluateClaimLedger, resolveRecipients } from '../services/FiscalWatchdogService';

type Row = Parameters<typeof evaluateClaimLedger>[0][number];
const row = (o: Partial<Row> = {}): Row => ({
  nayax_transaction_id: '2207959160',
  machine_id: '182443',
  amount_minor: 4800,
  currency: 'ILS',
  settled_at: new Date(Date.now() - 3600_000),
  state: 'ISSUED',
  external_reference: 'nayax-bay:182443:2207959160',
  sumit_document_id: 'doc-1',
  sumit_document_number: '10482',
  attempt_count: 1,
  last_error: null,
  ...o,
});
const checks = (rows: Row[]) => {
  const r = evaluateClaimLedger(rows);
  return {
    crit: r.exceptions.map((e) => e.check),
    warn: r.warnings.map((e) => e.check),
    documented: r.documented,
    minor: r.documentedMinor,
  };
};

describe('a clean ledger passes', () => {
  it('one ISSUED claim with a document is documented and raises nothing', () => {
    const r = checks([row()]);
    expect(r.crit).toEqual([]);
    expect(r.documented).toBe(1);
    expect(r.minor).toBe(4800);
  });
});

describe('the states that must be CRITICAL', () => {
  it('ISSUED with no document id — says done, nothing proves it', () => {
    expect(checks([row({ sumit_document_id: null })]).crit).toContain('ISSUED_WITHOUT_DOCUMENT');
  });

  it('a claim stuck mid-flight for over a day', () => {
    const old = new Date(Date.now() - 30 * 3600_000);
    expect(checks([row({ state: 'CLAIMED', settled_at: old, sumit_document_id: null })]).crit)
      .toContain('CLAIM_STUCK');
  });

  it('two claims for the same machine + transaction', () => {
    expect(checks([row(), row({ sumit_document_id: 'doc-2', external_reference: 'other' })]).crit)
      .toContain('DUPLICATE_CLAIM');
  });

  it('two claims sharing one external reference', () => {
    expect(checks([
      row({ nayax_transaction_id: 'A' }),
      row({ nayax_transaction_id: 'B', sumit_document_id: 'doc-2' }),
    ]).crit).toContain('DUPLICATE_EXTERNAL_REFERENCE');
  });

  it('one SUMIT document backing two different claims', () => {
    expect(checks([
      row({ nayax_transaction_id: 'A', external_reference: 'ref-a' }),
      row({ nayax_transaction_id: 'B', external_reference: 'ref-b' }),
    ]).crit).toContain('DOCUMENT_REUSED');
  });

  it('a foreign-currency sale that carries a document — must be withheld', () => {
    expect(checks([row({ currency: 'AUD' })]).crit).toContain('CURRENCY_MISMATCH');
  });

  it('a non-positive amount that carries a document', () => {
    expect(checks([row({ amount_minor: 0 })]).crit).toContain('NON_POSITIVE_DOCUMENTED');
  });
});

describe('the states that are WARN, not FAIL', () => {
  it('a claim in flight for under a day is not yet a failure', () => {
    const r = checks([row({ state: 'CLAIMED', settled_at: new Date(Date.now() - 3600_000), sumit_document_id: null })]);
    expect(r.warn).toContain('CLAIM_IN_FLIGHT');
    expect(r.crit).not.toContain('CLAIM_STUCK');
  });

  it('a withheld row is reported, never treated as an error', () => {
    // Foreign currency and unknown machines are SUPPOSED to be withheld. If
    // that raised CRITICAL the control would fail permanently on correct
    // behaviour, and would then be switched off.
    const r = checks([row({ state: 'NEEDS_REVIEW', sumit_document_id: null, sumit_document_number: null })]);
    expect(r.warn).toContain('WITHHELD_FOR_REVIEW');
    expect(r.crit).toEqual([]);
  });

  it('repeated attempts short of success', () => {
    expect(checks([row({ state: 'PENDING_FISCAL', attempt_count: 9, sumit_document_id: null })]).warn)
      .toContain('REPEATED_ATTEMPTS');
  });
});

describe('recipients are resolved, never invented', () => {
  it('uses the configured group when set', () => {
    process.env.FISCAL_WATCHDOG_RECIPIENTS = 'a@petwash.co.il, b@kuperberg.co.il';
    const r = resolveRecipients();
    expect(r.to).toEqual(['a@petwash.co.il', 'b@kuperberg.co.il']);
    expect(r.unresolved).toEqual([]);
    delete process.env.FISCAL_WATCHDOG_RECIPIENTS;
  });

  it('reports a malformed address as unresolved instead of sending to it', () => {
    process.env.FISCAL_WATCHDOG_RECIPIENTS = 'good@petwash.co.il, not-an-email';
    const r = resolveRecipients();
    expect(r.to).toEqual(['good@petwash.co.il']);
    expect(r.unresolved).toContain('not-an-email');
    delete process.env.FISCAL_WATCHDOG_RECIPIENTS;
  });

  it('unset: names the bookkeeper as UNRESOLVED rather than guessing her address', () => {
    delete process.env.FISCAL_WATCHDOG_RECIPIENTS;
    const r = resolveRecipients();
    expect(r.to).toContain('nir.h@petwash.co.il');
    expect(r.unresolved.join(' ')).toMatch(/bookkeeper/i);
    // Guessing a bookkeeper's address to send her fiscal reports would be worse
    // than leaving it unset: the report would go nowhere, or somewhere wrong.
    expect(r.to.some((e) => /michal|kuperberg/i.test(e))).toBe(false);
  });
});

describe('reports carry no cardholder or customer data', () => {
  it('an exception exposes only an identifier, an amount and a reason', () => {
    const r = evaluateClaimLedger([row({ sumit_document_id: null })]);
    const e = r.exceptions[0];
    expect(Object.keys(e).sort()).toEqual(['amountMinor', 'check', 'detail', 'ref'].sort());
    // The identifier is transaction@machine — no PAN, no name, no contact.
    expect(e.ref).toBe('2207959160@182443');
    expect(JSON.stringify(e)).not.toMatch(/\b\d{13,19}\b/);
  });
});

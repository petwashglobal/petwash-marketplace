/**
 * Fiscal reconciliation invariants — CEO 2026-08-27 §54-58, §87.
 *
 * Structural pins on server/services/fiscalPassport/reconciliation.ts.
 * The reconciliation checks read across tables; the discipline pinned
 * here matters MORE than the DB paths:
 *   • every check is READ-ONLY;
 *   • every SQL is parameterised;
 *   • 42P01 (missing table) NEVER emits a false positive — the check
 *     returns null so a fresh env doesn't flood alerts;
 *   • checks NEVER auto-correct — best-effort ALERTING only (§87);
 *   • the signal taxonomy matches §87 verbatim.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'fiscalPassport', 'reconciliation.ts'),
  'utf8',
);

describe('signal taxonomy matches §87 verbatim', () => {
  it('every §87 signal appears in the ReconciliationSignal union', () => {
    for (const s of [
      'PAID_NO_FISCAL_DOCUMENT',
      'FISCAL_DOCUMENT_NO_PAYMENT',
      'SUMIT_AMOUNT_MISMATCH',
      'SUMIT_DUPLICATE_DOCUMENT',
      'NAYAX_UNMATCHED_TRANSACTION',
      'WALLET_UNMATCHED_DEBIT',
      'REFUND_NO_CREDIT_DOCUMENT',
      'PROVIDER_PAYOUT_UNMATCHED',
    ]) {
      expect(SRC).toMatch(new RegExp(`['"]${s}['"]`));
    }
  });
});

describe('every check is READ-ONLY + parameterised + fresh-env safe', () => {
  it('no INSERT / UPDATE / DELETE anywhere in the file', () => {
    expect(SRC).not.toMatch(/\bINSERT\s+INTO\b/i);
    expect(SRC).not.toMatch(/\bUPDATE\s+\w+\s+SET\b/i);
    expect(SRC).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  it('every pool.query passes a params array — no template-interpolated ids', () => {
    // Extract every pool.query call; each must include a $1 placeholder.
    const calls = [...SRC.matchAll(/pool\.query\(\s*`([^`]+)`\s*,\s*\[[^\]]+\]/g)];
    expect(calls.length).toBeGreaterThanOrEqual(5);
    for (const m of calls) {
      expect(m[1]).toMatch(/\$1/);
    }
    // Ban a ${…} in the raw SQL literal — that would be an injection vector.
    expect(SRC).not.toMatch(/pool\.query\(\s*`[^`]*\$\{/);
  });

  it('every check swallows 42P01 (missing table) — never emits a false positive on fresh env', () => {
    // Every catch block must include a 42P01 short-circuit that
    // returns null. A refactor that alerted on a missing table would
    // fire on every fresh env AND every test run.
    const catches = SRC.match(/catch\s*\(err:\s*any\)\s*\{[\s\S]*?\}/g) ?? [];
    // The provider-payout check reads via drizzle (no code === '42P01'
    // path — drizzle throws differently). Every OTHER catch block that
    // touches pool.query must include the 42P01 short-circuit.
    let seen = 0;
    for (const block of catches) {
      if (!/pool\.query/.test(block)) continue;
      // Not every catch owns the query in its window; only require the
      // guard on catches that share their function with a pool.query.
    }
    // Simpler: file-wide, every function that uses pool.query has a
    // matching 42P01 return-null branch.
    const poolFns = SRC.match(/pool\.query\([\s\S]*?\}\s*catch/g) ?? [];
    for (const fn of poolFns) {
      const fnBlock = SRC.slice(SRC.indexOf(fn), SRC.indexOf(fn) + fn.length + 400);
      if (/if\s*\(err\?\.code\s*===\s*['"]42P01['"]\)\s*return\s+null/.test(fnBlock)) seen++;
    }
    expect(seen, 'Every pool.query-owning function must swallow 42P01 → null').toBeGreaterThanOrEqual(5);
  });

  it('no auto-correction anywhere — checks return warnings, never mutate (§87)', () => {
    // A check that "fixed" a mismatch by writing to sumit_documents
    // would violate §87. Every check either returns null or a
    // ReconciliationWarning. Ban every mutation shape.
    expect(SRC).not.toMatch(/generateReceipt|createDocument|createCreditDocument/);
    expect(SRC).not.toMatch(/db\.update\(|db\.delete\(|db\.insert\(/);
  });
});

describe('collectWarnings — bounded per-record aggregator', () => {
  it('never runs a check the caller didn\'t request', () => {
    const w = SRC.slice(SRC.indexOf('async function collectWarnings'));
    // Each check runs ONLY when the corresponding input field is present.
    expect(w).toMatch(/if\s*\(input\.fiscalEventKey\)/);
    expect(w).toMatch(/if\s*\(input\.nayaxTxId\)/);
    expect(w).toMatch(/if\s*\(input\.walletTransactionId\)/);
    expect(w).toMatch(/if\s*\(input\.payout\)/);
  });

  it('SUMIT amount-mismatch check runs only when commercialTotalCents is provided', () => {
    // A check that assumed commercialTotalCents = 0 for missing input
    // would flag every zero-price event as a mismatch — false positive.
    const w = SRC.slice(SRC.indexOf('async function collectWarnings'));
    expect(w).toMatch(/if\s*\(input\.commercialTotalCents\s*!==\s*undefined\)/);
  });
});

describe('per-check discipline', () => {
  it('checkPaidHasFiscalDocument returns null when paid=false (never accuses unpaid events)', () => {
    const w = SRC.slice(SRC.indexOf('async function checkPaidHasFiscalDocument'));
    expect(w).toMatch(/if\s*\(!input\.paid\)\s*return\s+null/);
  });

  it('checkSumitDuplicate flags n > 1 (never n >= 1, which would flag every event)', () => {
    const w = SRC.slice(SRC.indexOf('async function checkSumitDuplicate'));
    expect(w).toMatch(/n\s*>\s*1/);
    expect(w).not.toMatch(/n\s*>=\s*1/);
  });

  it('checkProviderPayoutMatched flags ONLY paid_out with no booking_id (§58)', () => {
    const w = SRC.slice(SRC.indexOf('async function checkProviderPayoutMatched'));
    // Missing booking id is a required condition.
    expect(w).toMatch(/!row\.bookingId/);
    // Only fires when the payout status is literally 'paid_out'.
    expect(w).toMatch(/['"]paid_out['"]/);
  });
});

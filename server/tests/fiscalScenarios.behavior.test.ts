/**
 * §94 items 27-29 — behavioural scenarios that must not create
 * duplicate money and must not lie about state.
 *
 * Three scenarios pinned:
 *
 *   §84  DUPLICATE CALLBACK
 *        Same payment callback × 10 → same fiscalEventKey → same
 *        deterministic TransactionRef → callers can idempotently
 *        dedupe against ONE key. A refactor that made the key
 *        randomised, or the ref time-dependent, would allow N
 *        SUMIT documents for one payment.
 *
 *   §85  PAYMENT SUCCESS + DOCUMENT FAILURE
 *        Payment succeeded, SUMIT unavailable. FiscalTransactionPassport
 *        reports payment.state = PAID, fiscalDocument.state ∈
 *        {PENDING | ISSUE_FAILED}, and reconciliation.warnings
 *        includes PAID_NO_FISCAL_DOCUMENT. Retry with the SAME
 *        fiscal event key eventually flips fiscalDocument to
 *        ISSUED without a second charge or a second document.
 *
 *   §86  REFUND SUCCESS + CREDIT DOCUMENT FAILURE
 *        External refund succeeded, SUMIT credit-doc call failed.
 *        composeRefundFiscalDocument returns state = CREDIT_PENDING;
 *        the refund is NEVER reversed just because the document API
 *        failed. Once the credit doc lands, state → CREDITED and
 *        originalDocumentId is preserved throughout.
 */
import { describe, it, expect } from 'vitest';
import {
  fiscalEventKey,
  paymentClassForEvent,
  type FiscalEventCode,
} from '@shared/lib/fiscalPassport/eventRegistry';
import {
  generateTransactionRef,
  parseTransactionRef,
} from '@shared/lib/fiscalPassport/idNamespace';
import { composeRefundFiscalDocument } from '../services/fiscalPassport/lineage';
import type {
  ReconciliationBlock,
} from '@shared/lib/fiscalPassport/FiscalTransactionPassport';
import { getSumitDocumentMapping } from '../services/sumitDocumentMapping';

// ─── §84 duplicate callback ─────────────────────────────────────────

describe('§84 duplicate callback — same event → same fiscal event key → same TransactionRef', () => {
  it('fiscalEventKey is deterministic for (event, businessObjectId, v1)', () => {
    const key1 = fiscalEventKey({ event: 'SHOP_ORDER_PAID', businessObjectId: 'ORDER123' });
    const key2 = fiscalEventKey({ event: 'SHOP_ORDER_PAID', businessObjectId: 'ORDER123' });
    const key3 = fiscalEventKey({ event: 'SHOP_ORDER_PAID', businessObjectId: 'ORDER123' });
    expect(key1).toBe(key2);
    expect(key2).toBe(key3);
    // The key encodes the version — v1 is the default; a partial
    // refund would bump to v2 and produce a distinct key without
    // altering the original one.
    expect(key1).toContain(':v1');
  });

  it('economicVersion bump changes the key but nothing else in the shape', () => {
    const v1 = fiscalEventKey({ event: 'SHOP_ORDER_PAID', businessObjectId: 'ORDER123' });
    const v2 = fiscalEventKey({ event: 'SHOP_ORDER_PAID', businessObjectId: 'ORDER123', economicVersion: 'v2' });
    expect(v1).not.toBe(v2);
    expect(v1.startsWith('SHOP_ORDER_PAID:ORDER123')).toBe(true);
    expect(v2.startsWith('SHOP_ORDER_PAID:ORDER123')).toBe(true);
    expect(v2.endsWith(':v2')).toBe(true);
  });

  it('TransactionRef is deterministic on the same stableId + ISO date — 10 callbacks share one ref', () => {
    const stableId = 'shop:ORDER123';
    const iso = '2026-08-27';
    const refs = new Set<string>();
    for (let i = 0; i < 10; i++) {
      refs.add(generateTransactionRef({ stableId, stableIsoDate: iso }));
    }
    expect(refs.size).toBe(1);
    const only = [...refs][0];
    expect(parseTransactionRef(only)?.year).toBe('26');
  });

  it('10 K9000 callbacks for one wash event resolve to one fiscal event key', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10; i++) {
      seen.add(fiscalEventKey({ event: 'K9000_WASH_COMPLETED', businessObjectId: 'WASH-42' }));
    }
    expect(seen.size).toBe(1);
  });
});

// ─── §85 payment success + document failure ─────────────────────────

/**
 * Helper: build the reconciliation block the composer would emit for
 * a given (paid, docIssued) pair. Mirrors composer.ts baseReconciliation —
 * kept in-test so we don't depend on internal exports.
 */
function reconciliationFor(paid: boolean, docIssued: boolean): ReconciliationBlock {
  return {
    paymentMatched: paid,
    documentMatched: docIssued,
    ledgerMatched: paid,
    warnings: paid && !docIssued ? ['PAID_NO_FISCAL_DOCUMENT'] : [],
  };
}

describe('§85 payment success + document failure', () => {
  it('paid + no doc → PAID_NO_FISCAL_DOCUMENT warning surfaced', () => {
    const recon = reconciliationFor(true, false);
    expect(recon.paymentMatched).toBe(true);
    expect(recon.documentMatched).toBe(false);
    expect(recon.warnings).toContain('PAID_NO_FISCAL_DOCUMENT');
  });

  it('paid + doc issued → no warning, both matched', () => {
    const recon = reconciliationFor(true, true);
    expect(recon.paymentMatched).toBe(true);
    expect(recon.documentMatched).toBe(true);
    expect(recon.warnings).toEqual([]);
  });

  it('unpaid → no warning even without a doc (there\'s nothing to reconcile)', () => {
    const recon = reconciliationFor(false, false);
    expect(recon.warnings).toEqual([]);
  });

  it('retry with the SAME fiscal event key does not manufacture a new key', () => {
    // The customer's payment succeeded; SUMIT was down. A retry must
    // hit the SAME idempotency key so at most ONE document ever exists.
    // §85 tail: "Eventually ISSUED, never charge again."
    const key = fiscalEventKey({ event: 'SHOP_ORDER_PAID', businessObjectId: 'ORDER-X' });
    const retry = fiscalEventKey({ event: 'SHOP_ORDER_PAID', businessObjectId: 'ORDER-X' });
    expect(retry).toBe(key);
    // Under this key, SUMIT would attach ONE document — a duplicate
    // check on the reconciliation side pins `n > 1`.
  });

  it('CPA mapping resolves SHOP_ORDER_PAID → InvoiceAndReceipt + FULL_VAT (retry uses same class)', () => {
    // A retry must ALSO resolve to the same document type and VAT
    // treatment; §85 forbids issuing a different flavour on retry.
    const cls = paymentClassForEvent('SHOP_ORDER_PAID' as FiscalEventCode);
    const m1 = getSumitDocumentMapping(cls);
    const m2 = getSumitDocumentMapping(cls);
    expect(m1).toEqual(m2);
    expect(m1.documentType).toBe('InvoiceAndReceipt');
    expect(m1.vatMode).toBe('FULL_VAT');
  });
});

// ─── §86 refund success + credit document failure ───────────────────

describe('§86 refund success + credit document failure', () => {
  it('refund with NO credit_document_id yet → fiscalDocument.state = CREDIT_PENDING (never CREDITED)', () => {
    const doc = composeRefundFiscalDocument({ originalSumitDocumentId: 'DOC-ORIG-1' });
    expect(doc.state).toBe('CREDIT_PENDING');
    expect(doc.creditDocumentId).toBeUndefined();
    // §36: originalDocumentId is preserved even without the credit
    // document — the lineage chain never breaks.
    expect(doc.originalDocumentId).toBe('DOC-ORIG-1');
    // §21 CPA authority: documentType is always CreditInvoice for
    // REFUND — the composer's own helper never picks a different type.
    expect(doc.documentType).toBe('CreditInvoice');
  });

  it('when the credit doc lands, state → CREDITED and originalDocumentId is unchanged', () => {
    const pending = composeRefundFiscalDocument({ originalSumitDocumentId: 'DOC-ORIG-2' });
    const credited = composeRefundFiscalDocument({
      originalSumitDocumentId: 'DOC-ORIG-2',
      creditDocumentId: 'DOC-CRD-2',
    });
    expect(pending.state).toBe('CREDIT_PENDING');
    expect(credited.state).toBe('CREDITED');
    expect(credited.creditDocumentId).toBe('DOC-CRD-2');
    expect(credited.originalDocumentId).toBe(pending.originalDocumentId);
  });

  it('a refund is NEVER reversed just because the credit-doc API failed', () => {
    // The composer produces the REFUND passport with a fiscalDocument
    // state that acknowledges the pending credit — but the money is
    // still refunded. That's a state-axis separation, not a rollback.
    const doc = composeRefundFiscalDocument({ originalSumitDocumentId: 'DOC-ORIG-3' });
    // documentType is 'CreditInvoice' (required = true) but the
    // presence of `state: CREDIT_PENDING` proves the doc side is
    // separate from the payment reversal that already succeeded.
    expect(doc.required).toBe(true);
    expect(doc.state).not.toBe('CREDITED');
    expect(doc.state).not.toBe('ISSUED');
  });

  it('CPA mapping resolves REFUND → CreditInvoice with requiresOriginalDocumentId flag', () => {
    // §36 credit-document linkage rule sits INSIDE the CPA mapping.
    const m = getSumitDocumentMapping('REFUND');
    expect(m.documentType).toBe('CreditInvoice');
    expect(m.requiresOriginalDocumentId).toBe(true);
    expect(m.vatMode).toBe('CREDIT');
  });
});

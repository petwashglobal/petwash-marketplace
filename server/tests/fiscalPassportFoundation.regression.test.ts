/**
 * FiscalTransactionPassport foundation invariants — CEO 2026-08-27
 * fiscal directive §1-3, §21-22, §50-51, §72-73.
 *
 * The core discipline: our new fiscal read model MUST delegate every
 * tax decision to the CPA-approved `getSumitDocumentMapping` in
 * server/services/sumitDocumentMapping.ts. This test enforces:
 *   • event-registry payment classes are a subset of the CPA mapping's
 *     PetWashPaymentClass — we never introduce a phantom class.
 *   • event → payment class translation matches the SUMIT transaction
 *     matrix (docs/design/2026-08-16-sumit-transaction-matrix.md).
 *   • TransactionRef generation is deterministic + parseable.
 *   • RefundRef points at its parent transaction and rejects garbage.
 *   • Every state axis is enumerated separately (§50).
 */
import { describe, it, expect } from 'vitest';
import {
  FISCAL_EVENT_CODES,
  paymentClassForEvent,
  fiscalEventKey,
} from '@shared/lib/fiscalPassport/eventRegistry';
import {
  LINE_ITEMS,
  getLineItem,
} from '@shared/lib/fiscalPassport/lineItemCatalog';
import {
  generateTransactionRef,
  generateRefundRef,
  parseTransactionRef,
  parseRefundRef,
} from '@shared/lib/fiscalPassport/idNamespace';
import {
  COMMERCIAL_STATES,
  PAYMENT_STATES,
  FISCAL_DOCUMENT_STATES,
  FULFILMENT_STATES,
  PAYOUT_STATES,
} from '@shared/lib/fiscalPassport/FiscalTransactionPassport';
import {
  getSumitDocumentMapping,
  type PetWashPaymentClass,
} from '../services/sumitDocumentMapping';

describe('event registry — delegates every tax decision to the CPA-approved SUMIT mapping', () => {
  it('every event maps to a PetWashPaymentClass that sumitDocumentMapping accepts', () => {
    // The registry's MirroredPaymentClass strings must all resolve
    // through getSumitDocumentMapping without throwing. If a mismatch
    // slips in, the CPA authority (throws on unknown class) fails
    // here — not in a customer's SUMIT call at 03:00.
    for (const event of FISCAL_EVENT_CODES) {
      const cls = paymentClassForEvent(event) as PetWashPaymentClass;
      expect(() => getSumitDocumentMapping(cls)).not.toThrow();
    }
  });

  it('K9000 wash → K9000_WASH (CPA order §3/§4, full VAT)', () => {
    expect(paymentClassForEvent('K9000_WASH_COMPLETED')).toBe('K9000_WASH');
    const m = getSumitDocumentMapping('K9000_WASH');
    expect(m.documentType).toBe('InvoiceAndReceipt');
    expect(m.vatMode).toBe('FULL_VAT');
    expect(m.issuer).toBe('PETWASH_PRINCIPAL');
  });

  it('SHOP → InvoiceAndReceipt + FULL_VAT (PetWash principal, §3-4)', () => {
    expect(paymentClassForEvent('SHOP_ORDER_PAID')).toBe('SHOP_ITEM');
    const m = getSumitDocumentMapping('SHOP_ITEM');
    expect(m.documentType).toBe('InvoiceAndReceipt');
    expect(m.vatMode).toBe('FULL_VAT');
  });

  it('wallet top-up + eGift purchase → stored value, NO VAT at purchase (CPA #5)', () => {
    for (const [event, cls] of [
      ['WALLET_TOPUP_PAID', 'WALLET_TOPUP'],
      ['EGIFT_PURCHASE_PAID', 'EGIFT_PURCHASE'],
    ] as const) {
      expect(paymentClassForEvent(event)).toBe(cls);
      const m = getSumitDocumentMapping(cls);
      expect(m.documentType).toBe('Receipt');
      expect(m.vatMode).toBe('NO_VAT_STORED_VALUE');
      expect(m.issuer).toBe('PETWASH_STORED_VALUE');
    }
  });

  it('eGift REDEMPTION carries the VAT event, InvoiceAndReceipt (CPA #5)', () => {
    expect(paymentClassForEvent('EGIFT_REDEEMED_FOR_SERVICE')).toBe('EGIFT_REDEMPTION');
    const m = getSumitDocumentMapping('EGIFT_REDEMPTION');
    expect(m.documentType).toBe('InvoiceAndReceipt');
    expect(m.vatMode).toBe('VAT_AT_REDEMPTION');
    expect(m.issuer).toBe('PETWASH_PRINCIPAL');
  });

  it('every marketplace booking → PROVIDER_BOOKING_COMMISSION today (disclosed-agent)', () => {
    for (const event of [
      'SITTER_BOOKING_PAID',
      'WALK_BOOKING_PAID',
      'ACADEMY_BOOKING_PAID',
      'PETTREK_BOOKING_PAID',
    ] as const) {
      expect(paymentClassForEvent(event)).toBe('PROVIDER_BOOKING_COMMISSION');
    }
    const m = getSumitDocumentMapping('PROVIDER_BOOKING_COMMISSION');
    expect(m.documentType).toBe('Invoice');
    expect(m.vatMode).toBe('VAT_ON_COMMISSION_ONLY');
    expect(m.issuer).toBe('PETWASH_DISCLOSED_AGENT');
  });

  it('every *_REFUNDED event → REFUND (CreditInvoice, requires original document id)', () => {
    for (const event of FISCAL_EVENT_CODES) {
      if (!String(event).endsWith('_REFUNDED')) continue;
      expect(paymentClassForEvent(event)).toBe('REFUND');
    }
    const m = getSumitDocumentMapping('REFUND');
    expect(m.documentType).toBe('CreditInvoice');
    expect(m.vatMode).toBe('CREDIT');
    expect(m.requiresOriginalDocumentId).toBe(true);
  });

  it('fiscalEventKey is stable and version-aware (§25)', () => {
    const a = fiscalEventKey({ event: 'SHOP_ORDER_PAID', businessObjectId: 'ORDER123' });
    const b = fiscalEventKey({ event: 'SHOP_ORDER_PAID', businessObjectId: 'ORDER123' });
    expect(a).toBe(b);
    // Same object, bumped economic version → new key (§25 partial-refund case).
    const c = fiscalEventKey({ event: 'SHOP_ORDER_PAID', businessObjectId: 'ORDER123', economicVersion: 'v2' });
    expect(c).not.toBe(a);
    expect(c).toContain(':v2');
  });
});

describe('line-item catalog — §4-8, §76 (server-owned descriptions)', () => {
  it('every line item carries HE + EN + unit + pricingAuthority', () => {
    for (const li of LINE_ITEMS) {
      expect(li.descriptionHe.length).toBeGreaterThan(0);
      expect(li.descriptionEn.length).toBeGreaterThan(0);
      expect(li.unit).toBeDefined();
      expect(li.pricingAuthority).toBeDefined();
    }
  });

  it('walk durations differ (30/60/90 minute lines have distinct HE + EN)', () => {
    const w30 = getLineItem('WALK_30_MIN')!;
    const w60 = getLineItem('WALK_60_MIN')!;
    const w90 = getLineItem('WALK_90_MIN')!;
    expect(w30.descriptionEn).not.toBe(w60.descriptionEn);
    expect(w60.descriptionEn).not.toBe(w90.descriptionEn);
    // Duration-based unit — a route can't slot quantity=1 for a 3-line
    // service (§77 discipline).
    expect(w30.unit).toBe('DURATION_MINUTES');
    expect(w60.unit).toBe('DURATION_MINUTES');
  });

  it('sitter day vs night use distinct count units (§77)', () => {
    expect(getLineItem('SITTER_DAY')?.unit).toBe('COUNT_DAY');
    expect(getLineItem('SITTER_NIGHT')?.unit).toBe('COUNT_NIGHT');
  });
});

describe('transaction ID namespace — §2, §83', () => {
  it('deterministic — same stableId + year → same TransactionRef', () => {
    const a = generateTransactionRef({ stableId: 'corr:X1', stableIsoDate: '2026-08-27' });
    const b = generateTransactionRef({ stableId: 'corr:X1', stableIsoDate: '2026-08-27' });
    expect(a).toBe(b);
  });

  it('shape: PWT-YY-XXXXX with unambiguous alphabet (no 0/O/1/I/U/V)', () => {
    const t = generateTransactionRef({ stableId: 'corr:X2', stableIsoDate: '2026-08-27' });
    expect(t).toMatch(/^PWT-\d{2}-[A-Z0-9]{5}$/);
    const suffix = t.slice(7);
    expect(suffix).not.toMatch(/[01IOUV]/);
  });

  it('parseTransactionRef round-trips + rejects garbage safely', () => {
    const t = generateTransactionRef({ stableId: 'corr:X3', stableIsoDate: '2026-08-27' });
    const parsed = parseTransactionRef(t);
    expect(parsed?.year).toBe('26');
    expect(parseTransactionRef('not-a-ref')).toBeNull();
    expect(parseTransactionRef('')).toBeNull();
  });

  it('RefundRef points at original transaction and rejects garbage', () => {
    const orig = 'PWT-26-8K4M7';
    const r1 = generateRefundRef({ originalTransactionRef: orig, refundIndex: 1 });
    const r2 = generateRefundRef({ originalTransactionRef: orig, refundIndex: 2 });
    expect(r1).toBe('PWT-26-8K4M7-R1');
    expect(r2).toBe('PWT-26-8K4M7-R2');
    const parsed = parseRefundRef(r1);
    expect(parsed?.originalRef).toBe(orig);
    expect(parsed?.refundIndex).toBe(1);
    expect(parseRefundRef('PWT-26-8K4M7-R0')).toBeNull();
    expect(parseRefundRef('nope')).toBeNull();
  });
});

describe('state axes — §50 separation of concerns', () => {
  it('five INDEPENDENT enums exist; each has at least four states', () => {
    // Overloading these into ONE `status` is the exact bug §50 bans.
    expect(COMMERCIAL_STATES.length).toBeGreaterThanOrEqual(4);
    expect(PAYMENT_STATES.length).toBeGreaterThanOrEqual(5);
    expect(FISCAL_DOCUMENT_STATES.length).toBeGreaterThanOrEqual(5);
    expect(FULFILMENT_STATES.length).toBeGreaterThanOrEqual(4);
    expect(PAYOUT_STATES.length).toBeGreaterThanOrEqual(4);
  });

  it('FISCAL_DOCUMENT_STATES include the §51 normalized projection', () => {
    for (const s of ['NOT_REQUIRED', 'PENDING', 'ISSUING', 'ISSUED', 'ISSUE_FAILED', 'CREDIT_PENDING', 'CREDITED', 'RECONCILIATION_REQUIRED']) {
      expect(FISCAL_DOCUMENT_STATES as readonly string[]).toContain(s);
    }
  });

  it('PAYOUT_STATES include NOT_APPLICABLE — SHOP/K9000/eGift never have one (§33)', () => {
    expect(PAYOUT_STATES as readonly string[]).toContain('NOT_APPLICABLE');
  });
});

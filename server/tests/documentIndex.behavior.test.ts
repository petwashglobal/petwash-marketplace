/**
 * DocumentIndex — behavior pins (business §12, §46, §47).
 */
import { describe, it, expect } from 'vitest';
import {
  categoryForCustomer,
  filterCustomerDocuments,
  filterProviderDocuments,
  isReceiptAvailable,
  labelForStatus,
  isPersistable,
  type DocumentIndexEntry,
} from '../../shared/marketplace/documentIndex';

function entry(o: Partial<DocumentIndexEntry> = {}): DocumentIndexEntry {
  return {
    documentId: 'doc_1',
    transactionId: 'tx_1',
    jobRef: 'PW-BKG-ABCD',
    domain: 'BOOKING',
    ownerUid: 'sarah',
    documentStatus: 'ISSUED',
    issuedAt: '2026-08-30T00:00:00Z',
    amountCents: 50000,
    currency: 'ILS',
    officialProvider: 'SUMIT',
    externalDocumentRef: 'sumit-xyz',
    externalDocumentUrl: 'https://sumit.co.il/…',
    ...o,
  };
}

describe('categoryForCustomer', () => {
  it('maps BOOKING → BOOKINGS, SHOP → SHOP, K9000 → K9000, EGIFT → EGIFT, REFUND → REFUNDS', () => {
    expect(categoryForCustomer('BOOKING')).toBe('BOOKINGS');
    expect(categoryForCustomer('SHOP')).toBe('SHOP');
    expect(categoryForCustomer('K9000')).toBe('K9000');
    expect(categoryForCustomer('EGIFT')).toBe('EGIFT');
    expect(categoryForCustomer('REFUND')).toBe('REFUNDS');
  });
});

describe('filterCustomerDocuments (§47 discipline)', () => {
  const docs: DocumentIndexEntry[] = [
    entry({ documentId: 'a', ownerUid: 'sarah', domain: 'BOOKING' }),
    entry({ documentId: 'b', ownerUid: 'sarah', domain: 'SHOP' }),
    entry({ documentId: 'c', ownerUid: 'sarah', domain: 'PROVIDER_EARNINGS' }),
    entry({ documentId: 'd', ownerUid: 'other', domain: 'BOOKING' }),
  ];

  it('ALL returns Sarah\'s customer docs; NEVER her provider-earnings even when same UID', () => {
    const out = filterCustomerDocuments(docs, 'sarah', 'ALL');
    expect(out.map((d) => d.documentId).sort()).toEqual(['a', 'b']);
  });

  it('SHOP returns only Sarah\'s SHOP entry', () => {
    const out = filterCustomerDocuments(docs, 'sarah', 'SHOP');
    expect(out.map((d) => d.documentId)).toEqual(['b']);
  });

  it('another user\'s docs never leak into Sarah\'s results', () => {
    const out = filterCustomerDocuments(docs, 'sarah', 'BOOKINGS');
    expect(out.some((d) => d.documentId === 'd')).toBe(false);
  });
});

describe('filterProviderDocuments (§12.3)', () => {
  const docs: DocumentIndexEntry[] = [
    entry({ documentId: 'a', ownerUid: 'nir', domain: 'PROVIDER_EARNINGS' }),
    entry({ documentId: 'b', ownerUid: 'nir', domain: 'BOOKING' }),         // customer receipt for Nir as customer
    entry({ documentId: 'c', ownerUid: 'nir', domain: 'SHOP' }),
    entry({ documentId: 'd', ownerUid: 'maya', domain: 'PROVIDER_EARNINGS' }),
  ];

  it('returns ONLY provider-earnings entries owned by the actor', () => {
    const out = filterProviderDocuments(docs, 'nir');
    expect(out.map((d) => d.documentId)).toEqual(['a']);
  });

  it('never leaks another provider\'s earnings', () => {
    const out = filterProviderDocuments(docs, 'nir');
    expect(out.some((d) => d.documentId === 'd')).toBe(false);
  });
});

describe('isReceiptAvailable + labelForStatus (§12.2 UI gate)', () => {
  it('ISSUED with externalRef → available', () => {
    expect(isReceiptAvailable(entry())).toBe(true);
  });

  it('ISSUED WITHOUT externalRef → NOT available (placeholder receipts are a defect §46)', () => {
    expect(isReceiptAvailable(entry({ externalDocumentRef: undefined }))).toBe(false);
  });

  it('PENDING → not available', () => {
    expect(isReceiptAvailable(entry({ documentStatus: 'PENDING', externalDocumentRef: undefined }))).toBe(false);
  });

  it('CREDIT_ISSUED with externalRef → available', () => {
    expect(isReceiptAvailable(entry({ documentStatus: 'CREDIT_ISSUED' }))).toBe(true);
  });

  it('labelForStatus covers every status with a friendly string', () => {
    for (const s of ['NOT_REQUIRED', 'PENDING', 'ISSUED', 'FAILED', 'CREDIT_PENDING', 'CREDIT_ISSUED'] as const) {
      expect(labelForStatus(s).length).toBeGreaterThan(0);
    }
  });
});

describe('isPersistable (§46 no placeholder receipts)', () => {
  it('ISSUED without externalDocumentRef → refuse to persist', () => {
    expect(isPersistable(entry({ externalDocumentRef: undefined }))).toBe(false);
  });

  it('CREDIT_ISSUED without externalDocumentRef → refuse', () => {
    expect(isPersistable(entry({ documentStatus: 'CREDIT_ISSUED', externalDocumentRef: undefined }))).toBe(false);
  });

  it('PENDING without externalDocumentRef → OK (waiting on fiscal engine)', () => {
    expect(isPersistable(entry({ documentStatus: 'PENDING', externalDocumentRef: undefined }))).toBe(true);
  });

  it('NOT_REQUIRED without externalDocumentRef → OK (free booking)', () => {
    expect(isPersistable(entry({ documentStatus: 'NOT_REQUIRED', externalDocumentRef: undefined }))).toBe(true);
  });
});

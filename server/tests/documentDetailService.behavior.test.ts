/**
 * DocumentDetailService behavior — CEO NEXT-AUTO §11.
 *
 * Covers the ownership check (customer email match OR provider uid),
 * the issuer discrimination (SUMIT vs PW self-issued), the voided
 * title code, and NOT_FOUND for missing rows.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({
  receipts: [] as Array<{
    id: number;
    receiptNumber: string | null;
    receiptType: string;
    platform: string;
    bookingId: string | null;
    totalAmount: string;
    currency: string;
    issuedAt: Date;
    sumitDocumentUrl: string | null;
    sumitDocumentId: string | null;
    isVoided: boolean;
    customerEmail: string | null;
    providerId: string | null;
  }>,
  users: [] as Array<{ id: string; email: string }>,
  lastPredicateVal: null as any,
  lastPredicateColumn: '' as string,
}));

vi.mock('@shared/schema', () => ({
  digitalReceipts: {
    id: { name: 'id' },
    receiptNumber: { name: 'receiptNumber' },
    receiptType: { name: 'receiptType' },
    platform: { name: 'platform' },
    bookingId: { name: 'bookingId' },
    totalAmount: { name: 'totalAmount' },
    currency: { name: 'currency' },
    issuedAt: { name: 'issuedAt' },
    sumitDocumentUrl: { name: 'sumitDocumentUrl' },
    sumitDocumentId: { name: 'sumitDocumentId' },
    isVoided: { name: 'isVoided' },
    customerEmail: { name: 'customerEmail' },
    providerId: { name: 'providerId' },
  },
  users: { id: { name: 'user_id' }, email: { name: 'email' } },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: (col: any, val: any) => {
      state.lastPredicateColumn = col?.name ?? '';
      state.lastPredicateVal = val;
      return { col, val };
    },
    and: (a: any) => a,
    or: (a: any) => a,
  };
});

vi.mock('../db', () => ({
  db: {
    select: (projection?: any) => ({
      from: (table: any) => ({
        where: (predicate: any) => ({
          limit: async (_n: number) => {
            const val = predicate?.val ?? state.lastPredicateVal;
            // Route by the table's shape — receipts have receiptType, users don't.
            if (table && ('receiptType' in table || 'sumitDocumentUrl' in table)) {
              return state.receipts.filter((r) => r.id === val);
            }
            return state.users.filter((u) => u.id === val).map((u) => ({ email: u.email }));
          },
        }),
      }),
    }),
  },
}));

const { loadDocumentDetail } = await import('../services/marketplace/DocumentDetailService');

beforeEach(() => {
  state.receipts.length = 0;
  state.users.length = 0;
});

const baseReceipt = {
  id: 42,
  receiptNumber: 'R-2026-000042',
  receiptType: 'receipt',
  platform: 'shop',
  bookingId: null as string | null,
  totalAmount: '150.00',
  currency: 'ILS',
  issuedAt: new Date('2026-08-30T09:00:00Z'),
  sumitDocumentUrl: null as string | null,
  sumitDocumentId: null as string | null,
  isVoided: false,
  customerEmail: 'sarah@example.com' as string | null,
  providerId: null as string | null,
};

describe('DocumentDetailService', () => {
  it('non-numeric id → NOT_FOUND', async () => {
    const out = await loadDocumentDetail({ documentId: 'not-a-number', actorUid: 'sarah' });
    expect(out.code).toBe('NOT_FOUND');
  });

  it('missing row → NOT_FOUND', async () => {
    const out = await loadDocumentDetail({ documentId: '999', actorUid: 'sarah', actorEmail: 'sarah@example.com' });
    expect(out.code).toBe('NOT_FOUND');
  });

  it('actor whose email does not match and who is not the provider → NOT_A_PARTY', async () => {
    state.receipts.push({ ...baseReceipt, customerEmail: 'someone-else@example.com', providerId: 'agent-9' });
    const out = await loadDocumentDetail({ documentId: '42', actorUid: 'sarah', actorEmail: 'sarah@example.com' });
    expect(out.code).toBe('NOT_A_PARTY');
  });

  it('customer email match → OK with ISSUER_PW when no SUMIT link', async () => {
    state.receipts.push({ ...baseReceipt });
    const out = await loadDocumentDetail({ documentId: '42', actorUid: 'sarah', actorEmail: 'sarah@example.com' });
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.document.issuer.code).toBe('ISSUER_PW');
    expect(out.document.titleCode).toBe('DOCUMENT_RECEIPT');
  });

  it('SUMIT document URL → ISSUER_SUMIT + subtitleCode ISSUER_SUMIT', async () => {
    state.receipts.push({
      ...baseReceipt,
      sumitDocumentUrl: 'https://sumit.co.il/doc/xyz',
      sumitDocumentId: 'SUMIT-999',
    });
    const out = await loadDocumentDetail({ documentId: '42', actorUid: 'sarah', actorEmail: 'sarah@example.com' });
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.document.issuer.code).toBe('ISSUER_SUMIT');
    expect(out.document.issuer.externalDocumentUrl).toBe('https://sumit.co.il/doc/xyz');
    expect(out.document.subtitleCode).toBe('ISSUER_SUMIT');
  });

  it('voided document → titleCode DOCUMENT_VOIDED', async () => {
    state.receipts.push({ ...baseReceipt, isVoided: true });
    const out = await loadDocumentDetail({ documentId: '42', actorUid: 'sarah', actorEmail: 'sarah@example.com' });
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.document.titleCode).toBe('DOCUMENT_VOIDED');
  });

  it('provider uid match without email → OK', async () => {
    state.receipts.push({ ...baseReceipt, customerEmail: null, providerId: 'provider-1' });
    const out = await loadDocumentDetail({ documentId: '42', actorUid: 'provider-1' });
    expect(out.code).toBe('OK');
  });

  it('refund receiptType maps to REFUND_CONFIRMATION kind', async () => {
    state.receipts.push({ ...baseReceipt, receiptType: 'refund' });
    const out = await loadDocumentDetail({ documentId: '42', actorUid: 'sarah', actorEmail: 'sarah@example.com' });
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.document.kind).toBe('REFUND_CONFIRMATION');
    expect(out.document.titleCode).toBe('DOCUMENT_REFUND_CONFIRMATION');
  });
});

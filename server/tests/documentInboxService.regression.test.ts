/**
 * DocumentInboxService — CEO NEXT-AUTO §11 + Doctrine §27.
 *
 * Documents project as DOCUMENT itemKind on the correct domain, never
 * SUPPORT.
 */
import { describe, it, expect } from 'vitest';
import {
  listDocumentInboxItems,
  createStubDocumentSource,
  type DocumentRow,
} from '../services/marketplace/DocumentInboxService';

function row(over: Partial<DocumentRow> = {}): DocumentRow {
  return {
    documentId: 'doc-1',
    kind: 'RECEIPT',
    entityRef: { kind: 'booking', id: 'B-1' },
    titleCode: 'RECEIPT_TITLE',
    subtitleCode: 'RECEIPT_SUBTITLE',
    issuedAt: '2026-08-30T00:00:00Z',
    workspaceContext: 'PET_PARENT',
    ...over,
  };
}

describe('shape', () => {
  it('emits itemKind=DOCUMENT and domain per entity kind', async () => {
    const rows: DocumentRow[] = [
      row({ documentId: 'r-booking',  entityRef: { kind: 'booking', id: 'B-1' } }),
      row({ documentId: 'r-shop',     entityRef: { kind: 'shop_order', id: 'O-1' } }),
      row({ documentId: 'r-gift',     entityRef: { kind: 'gift', id: 'G-1' } }),
      row({ documentId: 'r-wallet',   entityRef: { kind: 'wallet_topup', id: 'W-1' } }),
      row({ documentId: 'r-payout',   entityRef: { kind: 'payout', id: 'P-1' } }),
    ];
    const out = await listDocumentInboxItems('sarah', 'PET_PARENT', createStubDocumentSource(rows));
    expect(out.every((i) => i.itemKind === 'DOCUMENT')).toBe(true);
    expect(out.map((i) => i.domain)).toEqual(['BOOKING', 'SHOP', 'EGIFT', 'WALLET', 'PAYOUT']);
  });

  it('threadId is prefixed doc: so a document never collides with a real thread', async () => {
    const rows = [row({ documentId: 'r-42' })];
    const out = await listDocumentInboxItems('sarah', 'PET_PARENT', createStubDocumentSource(rows));
    expect(out[0].threadId).toBe('doc:r-42');
  });

  it('respects workspace scoping — filters by workspaceContext', async () => {
    const rows: DocumentRow[] = [
      row({ documentId: 'pp', workspaceContext: 'PET_PARENT' }),
      row({ documentId: 'pv', workspaceContext: 'PROVIDER' }),
    ];
    const outPP = await listDocumentInboxItems('sarah', 'PET_PARENT', createStubDocumentSource(rows));
    expect(outPP.map((i) => i.threadId)).toEqual(['doc:pp']);
    const outPV = await listDocumentInboxItems('sarah', 'PROVIDER', createStubDocumentSource(rows));
    expect(outPV.map((i) => i.threadId)).toEqual(['doc:pv']);
  });
});

describe('doctrine §27 — receipts NEVER land under SUPPORT domain', () => {
  it('booking receipt → domain BOOKING', async () => {
    const r = row({ entityRef: { kind: 'booking', id: 'B-1' } });
    const [item] = await listDocumentInboxItems('sarah', 'PET_PARENT', createStubDocumentSource([r]));
    expect(item.domain).toBe('BOOKING');
    expect(item.domain).not.toBe('SUPPORT');
  });
});

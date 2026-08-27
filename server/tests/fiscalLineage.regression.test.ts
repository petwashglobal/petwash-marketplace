/**
 * Fiscal lineage invariants — CEO 2026-08-27 §32-36, §55, §87, §94.19.
 *
 * Structural pins on server/services/fiscalPassport/lineage.ts.
 * The composer helpers here decide the ProviderMoneyBlock and the
 * CreditInvoice lineage that end up on the FiscalTransactionPassport;
 * a refactor cannot silently:
 *   • widen the paid-out gate (§22 literal-equality rule);
 *   • claim a refund is CREDITED when no credit document id exists;
 *   • drop the originalDocumentId from a credit doc (§36).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { composeRefundFiscalDocument } from '../services/fiscalPassport/lineage';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'fiscalPassport', 'lineage.ts'),
  'utf8',
);

describe('provider commission lineage — §22 literal-equality gates', () => {
  it('PAID gate is a strict === to the literal "paid_out" (never startsWith / includes)', () => {
    expect(SRC).toMatch(/status\s*===\s*['"]paid_out['"]/);
    expect(SRC).not.toMatch(/startsWith\(['"]paid/i);
    expect(SRC).not.toMatch(/includes\(['"]paid/i);
  });

  it('AVAILABLE gate is a strict === to the literal "released"', () => {
    expect(SRC).toMatch(/status\s*===\s*['"]released['"]/);
    expect(SRC).not.toMatch(/startsWith\(['"]released/i);
  });

  it('PENDING covers only the two documented statuses (in_escrow / pending)', () => {
    expect(SRC).toMatch(/status\s*===\s*['"]in_escrow['"]\s*\|\|\s*status\s*===\s*['"]pending['"]/);
  });

  it('every branch reads from contractor_earnings via drizzle — never invented totals', () => {
    expect(SRC).toMatch(/from\(contractorEarnings\)/);
    expect(SRC).toMatch(/eq\(contractorEarnings\.bookingId,\s*bookingId\)/);
    expect(SRC).toMatch(/eq\(contractorEarnings\.contractorId,\s*input\.providerUid\)/);
  });

  it('DB failure falls back to zero pending/paid (fail-safe, never faked)', () => {
    // A DB failure that returned "paid = expected" would silently
    // promote a provider to PAID with no evidence. Ban that shape.
    expect(SRC).toMatch(/catch\s*\(err:\s*any\)[\s\S]*?logger\.error\(/);
    // The fallback path does NOT set paid = expected.
    expect(SRC).not.toMatch(/paid\s*=\s*expected/);
  });
});

describe('refund lineage — §36 credit-document linkage', () => {
  it('SQL is parameterised on (source_type, source_id) — matches the real refund_transactions columns', () => {
    // 2026-08-27 fix: refund_transactions actually stores source_type +
    // source_id as separate columns (per shared/schema.ts line ~14394).
    // Composer parses the correlationId ('shop:X') and passes both.
    expect(SRC).toMatch(/WHERE source_type = \$1 AND source_id = \$2/);
    expect(SRC).toMatch(/pool\.query\([\s\S]*?,\s*\[sourceType,\s*sourceId\]/);
    // Ban template interpolation of the parsed values.
    expect(SRC).not.toMatch(/WHERE source_type = \$\{/);
    expect(SRC).not.toMatch(/WHERE source_id = \$\{/);
  });

  it('correlationKindToSourceType maps every composer branch — no invented source types', () => {
    // Every kind prefix the composer emits (shop:, k9000:, egift-purchase:,
    // wallet-topup:, sitter:, academy:) must map to a real refund_transactions
    // source_type value. Walk intentionally has no rail (§24) so it's absent.
    expect(SRC).toMatch(/case 'shop':\s*return 'shop_orders'/);
    expect(SRC).toMatch(/case 'k9000':\s*return 'k9000_wash_events'/);
    expect(SRC).toMatch(/case 'egift-purchase':\s*return 'egift_guest_orders'/);
    expect(SRC).toMatch(/case 'sitter':\s*return 'sitter_bookings'/);
    expect(SRC).toMatch(/case 'academy':\s*return 'trainer_bookings'/);
  });

  it('42P01 (table missing) returns an empty projection — no 500 in fresh envs', () => {
    expect(SRC).toMatch(/if\s*\(err\?\.code\s*===\s*['"]42P01['"]\)/);
    expect(SRC).toMatch(/return\s+empty/);
  });

  it('a refund without a credit_document_id is flagged as orphan (§87 REFUND_NO_CREDIT_DOCUMENT)', () => {
    expect(SRC).toMatch(/if\s*\(!r\.credit_document_id\)\s*orphan\s*=\s*true/);
    expect(SRC).toMatch(/hasOrphanRefundWarning:\s*orphan/);
  });

  it('refund refs use the generateRefundRef helper — never hand-composed', () => {
    expect(SRC).toMatch(/generateRefundRef\(\{/);
    // Ban a hand-composed refund ref that could drift from the parser.
    expect(SRC).not.toMatch(/`\${input\.originalTransactionRef}-R\${/);
  });
});

describe('composeRefundFiscalDocument — behavioural (§36)', () => {
  it('always returns documentType: CreditInvoice — CPA mapping owns this', () => {
    const doc = composeRefundFiscalDocument({ originalSumitDocumentId: 'DOC-1', creditDocumentId: 'CRD-1' });
    expect(doc.documentType).toBe('CreditInvoice');
    expect(doc.required).toBe(true);
    expect(doc.originalDocumentId).toBe('DOC-1');
    expect(doc.creditDocumentId).toBe('CRD-1');
    expect(doc.state).toBe('CREDITED');
  });

  it('missing credit document → CREDIT_PENDING (never claims CREDITED without evidence)', () => {
    const doc = composeRefundFiscalDocument({ originalSumitDocumentId: 'DOC-2' });
    expect(doc.state).toBe('CREDIT_PENDING');
    expect(doc.creditDocumentId).toBeUndefined();
    // originalDocumentId is preserved even without the credit yet —
    // §36 lineage rule holds at every intermediate state.
    expect(doc.originalDocumentId).toBe('DOC-2');
  });

  it('never silently drops the original document id from a refund fiscal doc (§36)', () => {
    for (const orig of ['DOC-A', 'DOC-B', 'DOC-C']) {
      const doc = composeRefundFiscalDocument({ originalSumitDocumentId: orig });
      expect(doc.originalDocumentId).toBe(orig);
    }
  });
});

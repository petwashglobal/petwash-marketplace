/**
 * SUMIT issuer-of-record foundation — regression pin (2026-07-09).
 *
 * CPA-approved (order #6): when SUMIT is wired it is the SINGLE issuer of record
 * and owns the document numbering, so the local PW- receipt becomes an internal
 * ledger reference rather than a second official tax invoice. This first, safe
 * increment RECORDS which system issued each doc (digital_receipts.issuer_of_record
 * = 'sumit' when SUMIT issues; NULL/self = self-issued PW-), written best-effort
 * next to sumitDocumentId. No VAT/email/behaviour change — the demote's enforcement
 * (per-class doc types, reporting) is built on this and sandbox-verified next.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const repo = path.resolve(__dirname, '..', '..');
const SCHEMA = fs.readFileSync(path.join(repo, 'shared', 'schema.ts'), 'utf8');
const SVC = fs.readFileSync(path.join(repo, 'server', 'services', 'IsraeliDigitalReceiptService.ts'), 'utf8');
const MIG = path.join(repo, 'migrations', '0090_digital_receipts_issuer_of_record.sql');

describe('SUMIT issuer-of-record is recorded (2026-07-09)', () => {
  it('schema + migration add the nullable issuer_of_record column', () => {
    expect(SCHEMA).toMatch(/issuerOfRecord: varchar\("issuer_of_record"/);
    expect(fs.existsSync(MIG)).toBe(true);
    expect(fs.readFileSync(MIG, 'utf8')).toMatch(/ADD COLUMN IF NOT EXISTS issuer_of_record/);
  });

  it("marks 'sumit' on both the receipt and credit-note SUMIT writes", () => {
    const hits = SVC.match(/issuerOfRecord: 'sumit'/g) || [];
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });

  it('is written alongside sumitDocumentId (best-effort, dormant-safe)', () => {
    expect(SVC).toMatch(/sumitDocumentId: sumitResult\.sumitDocumentId, issuerOfRecord: 'sumit'/);
  });
});

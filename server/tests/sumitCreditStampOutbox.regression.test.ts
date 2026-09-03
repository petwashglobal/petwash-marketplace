/**
 * Post-release 2026-09-03 (backlog P1): SUMIT credit-note stamp is now
 * durable via the fiscal_document_outbox. Prior code logged CRITICAL
 * on failure and moved on, leaving the local credit-note row with no
 * sumitDocumentId reference — inviting ops to re-issue in SUMIT and
 * produce the double-credit scenario the source comment already warns
 * about. This regression pin locks the wire in place.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), 'utf8');
}

describe('SUMIT credit-note stamp — fiscal outbox wire', () => {
  it('fiscalDocumentOutbox declares the sumit_credit_stamp kind', () => {
    const src = read('server/services/fiscalDocumentOutbox.ts');
    expect(src).toMatch(/'sumit_credit_stamp'/);
  });

  it('IsraeliDigitalReceiptService routes the stamp through runFiscalDocumentAndPersistOnFailure', () => {
    const src = read('server/services/IsraeliDigitalReceiptService.ts');
    // Import present
    expect(src).toMatch(/runFiscalDocumentAndPersistOnFailure/);
    // Kind used at the stamp call site
    expect(src).toMatch(/kind:\s*'sumit_credit_stamp'/);
    // Idempotency key is the credit_note id
    expect(src).toMatch(/sourceKey:\s*`credit_note:\$\{[^}]+\.id\}`/);
    // FiscalOutboxUnavailableError is the fatal branch the caller escalates
    expect(src).toMatch(/FiscalOutboxUnavailableError/);
    // The old silent CRITICAL-only path is gone (we still log on double-failure
    // but only after both inline + outbox insert failed)
    expect(src).not.toMatch(
      /CRITICAL: SUMIT credit issued but local sumitDocumentId stamp FAILED — reconcile manually/,
    );
  });

  it('drainer boot registers a handler for sumit_credit_stamp', () => {
    const src = read('server/index.ts');
    expect(src).toMatch(/sumit_credit_stamp:\s*async/);
    // Handler must actually execute the UPDATE (idempotent by (id, doc-id))
    expect(src).toMatch(/db\.update\(digitalReceipts\)/);
    expect(src).toMatch(/sumitDocumentId:\s*p\.sumitDocumentId/);
  });
});

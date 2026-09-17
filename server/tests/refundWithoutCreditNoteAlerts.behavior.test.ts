/**
 * A REFUND WHOSE CREDIT NOTE COULD NOT BE WRITTEN MUST NOT PASS QUIETLY
 * (2026-09-17).
 *
 * refundBookingWallet called issueCreditNoteForBooking and never read the
 * result. That function reports failure in its return value — it does not
 * throw — so a refund could complete while the original tax document still
 * stood for money already given back, with nothing but a log line (or none).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const alerts: any[] = [];
vi.mock('../db', () => ({ db: {}, pool: {} }));
vi.mock('../lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../services/walletPassSync', () => ({ schedulePassSync: vi.fn() }));
vi.mock('../services/AlertEngine', () => ({
  createOrUpdateAlert: vi.fn(async (a: any) => { alerts.push(a); }),
}));

import { raiseMissingCreditNoteAlert } from '../services/WalletService';

beforeEach(() => { alerts.length = 0; });

describe('the alert', () => {
  it('one critical finance alert per booking, with the amount and the reason', async () => {
    await raiseMissingCreditNoteAlert({ bookingId: 'BR-77', amountCents: 115000, error: 'Original receipt 9 not found' });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      dedupeKey: 'credit_note_missing:BR-77',
      category: 'finance_doc',
      severity: 'critical',
      linkedEntityId: 'BR-77',
    });
    expect(alerts[0].message).toContain('₪1150.00');
    expect(alerts[0].message).toContain('Original receipt 9 not found');
  });

  it('never throws, even when the alert store is down', async () => {
    const { createOrUpdateAlert } = await import('../services/AlertEngine');
    (createOrUpdateAlert as any).mockRejectedValueOnce(new Error('db down'));
    await expect(raiseMissingCreditNoteAlert({ bookingId: 'BR-1', amountCents: 1, error: 'x' })).resolves.toBeUndefined();
  });
});

describe('when refundBookingWallet raises it', () => {
  const src = readFileSync(join(__dirname, '../services/WalletService.ts'), 'utf8');
  const i = src.indexOf('let creditFailure: string | null = null;');
  const block = src.slice(i, i + 1400);

  it('reads the result instead of ignoring it', () => {
    expect(block).toContain('const credit = await IsraeliDigitalReceiptService.issueCreditNoteForBooking({');
    expect(block).toContain("if (!credit.success && credit.error !== 'no_original_receipt')");
  });

  it('a booking that was never receipted needs no credit and raises nothing', () => {
    expect(block).toContain("credit.error !== 'no_original_receipt'");
  });

  it('a thrown error raises it too', () => {
    expect(block).toMatch(/catch \(creditErr: any\) \{\s*creditFailure = creditErr\?\.message \?\? 'unknown';/);
    expect(block).toContain('await raiseMissingCreditNoteAlert({');
  });

  it('there is no automatic retry — a second credit note is worse than a person checking', () => {
    expect(block).not.toMatch(/runFiscalDocumentAndPersistOnFailure|issueCreditNoteForBooking\([\s\S]*issueCreditNoteForBooking\(/);
  });
});

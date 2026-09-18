/**
 * Behavioural test — BookingLifecycleService.settleEscrowTerminal (2026-09-19).
 *
 * Cancelling a marketplace booking wrote this to escrow_holdings:
 *
 *   status:             'refunded'
 *   refundProcessedAt:  now          ← a claim that the money had gone back
 *   refundAmountCents:  grossAmountCents
 *
 * …and that was the whole of it. There is no automated card-refund rail, so
 * nothing left the account. No queue, cron or screen listed the debt, and no
 * alert reached a human — the row simply said a refund had been PROCESSED. The
 * Firestore escrow rail has raised a "do this by hand" alert since 2026-09-17;
 * this SQL rail was silent.
 *
 * The row must now say what is true — settled, not processed — and a human must
 * be told the exact amount to put back on the card.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ESCROW = {
  id: 7,
  escrowId: 'ESC-2026-1',
  bookingId: 'MB-1',
  status: 'held',
  grossAmountCents: 42500,
};

let escrowRow: any = { ...ESCROW };
let updatePayload: any = null;

vi.mock('../db', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => (escrowRow ? [escrowRow] : []) }) }) }),
    update: () => ({ set: (patch: any) => { updatePayload = patch; return { where: async () => undefined }; } }),
  },
  pool: { query: async () => ({ rows: [] }) },
}));

const alerts: any[] = [];
vi.mock('../services/AlertEngine', () => ({
  createOrUpdateAlert: async (a: any) => { alerts.push(a); },
}));

const auditRows: any[] = [];
vi.mock('../middleware/auditLog', () => ({
  logAuditEvent: async (r: any) => { auditRows.push(r); },
}));

vi.mock('../lib/logger', () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
}));
vi.mock('./googleSheetsIntegration', () => ({ GoogleSheetsService: { appendToSheet: async () => {} } }));
vi.mock('../services/googleSheetsIntegration', () => ({ GoogleSheetsService: { appendToSheet: async () => {} } }));

// Imported ONCE. Re-importing this module per test costs seconds (it pulls the
// whole schema graph) and blew vitest's 5s budget under parallel load, which
// surfaced as assertion failures that had nothing to do with the assertions.
// The service holds no state between calls — the mocked row is the state.
const mod = await import('../services/BookingLifecycleService');
const svc: any = mod.bookingLifecycleService;

const settle = async (over: Partial<typeof ESCROW> = {}, reason?: string) => {
  escrowRow = { ...ESCROW, ...over };
  await svc.settleEscrowTerminal('MB-1', 'cust-1', 'customer', reason);
};

beforeEach(() => {
  updatePayload = null;
  alerts.length = 0;
  auditRows.length = 0;
  escrowRow = { ...ESCROW };
});

describe('the row stops claiming the money went back', () => {
  it('the escrow is settled, not "processed"', async () => {
    await settle();
    expect(updatePayload.status).toBe('refunded');
    expect(updatePayload.refundProcessedAt).toBeNull();
  });

  it('the amount owed is still recorded', async () => {
    await settle();
    expect(updatePayload.refundAmountCents).toBe(42500);
  });

  it('the audit row says plainly that no card money moved', async () => {
    await settle();
    expect(auditRows[0].metadata.cardMoneyMoved).toBe(false);
    expect(auditRows[0].metadata.refundAmountCents).toBe(42500);
  });
});

describe('a human is told what to refund', () => {
  it('an alert carries the exact amount and the booking', async () => {
    await settle({}, 'Customer cancelled');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].message).toContain('₪425.00');
    expect(alerts[0].message).toContain('MB-1');
    expect(alerts[0].message).toContain('Customer cancelled');
    expect(alerts[0].severity).toBe('warning');
  });

  it('it is deduped per escrow, so a retried cancel does not pile up alerts', async () => {
    await settle();
    expect(alerts[0].dedupeKey).toBe('marketplace_escrow_card_refund:ESC-2026-1');
  });

  it('a failing alert never breaks the cancellation', async () => {
    const mod = await import('../services/AlertEngine');
    vi.spyOn(mod, 'createOrUpdateAlert').mockRejectedValueOnce(new Error('alert engine down'));
    await expect(settle()).resolves.toBeUndefined();
    expect(updatePayload.status).toBe('refunded');
  });
});

describe('what must not change', () => {
  it('an escrow that is already terminal is left alone', async () => {
    await settle({ status: 'refunded' });
    expect(updatePayload).toBeNull();
    expect(alerts).toEqual([]);
  });

  it('a booking with no escrow does nothing at all', async () => {
    escrowRow = null;
    await svc.settleEscrowTerminal('MB-none', 'cust-1', 'customer');
    expect(updatePayload).toBeNull();
    expect(alerts).toEqual([]);
  });
});

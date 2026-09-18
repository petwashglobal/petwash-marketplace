/**
 * Behavioural test — EscrowService.refundEscrowPayment (2026-09-18).
 *
 * THE BUG: the cancellation policy decides how much comes back. A late cancel
 * on a ₪500 booking returns ₪250; booking-requests.ts computed that, wrote it
 * onto the booking row — and then called refundEscrowPayment(escrowId, reason,
 * by). The method had no amount parameter at all, so it used the HELD amount
 * for everything it said afterwards:
 *
 *   • the customer was told "Your refund of ₪500 is being processed"
 *   • the admin alert said ₪500 "was marked refunded — refund it with the card
 *     provider", and that alert is the instruction a human types into Upay
 *   • the audit row recorded ₪500
 *
 * So the customer was promised, and the business was instructed to pay out,
 * twice what the policy gives. This pins the refunded amount to the number the
 * caller passes, with the hold as the ceiling.
 *
 * The service is exercised for real; firestore, notifications, audit and the
 * alert engine are the seams.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const HELD_ILS = 500;
const ESCROW_ID = 'escrow-1';

let stored: Record<string, any> = {};
let updated: Record<string, any> = {};

const escrowDoc = () => ({
  id: ESCROW_ID,
  bookingId: 'BR-2026-x',
  customerId: 'cust-1',
  providerId: 'prov-1',
  amount: HELD_ILS,
  currency: 'ILS',
  status: 'held',
  ...stored,
});

vi.mock('../lib/firebase-admin', () => ({
  default: {
    firestore: () => ({
      collection: () => ({
        doc: (id: string) => ({ id }),
      }),
      runTransaction: async (fn: any) => fn({
        get: async () => ({ exists: true, data: () => escrowDoc() }),
        update: (_ref: any, patch: any) => { updated = { ...updated, ...patch }; },
      }),
    }),
  },
}));

const notifications: any[] = [];
vi.mock('./NotificationService', () => ({}));
vi.mock('../services/NotificationService', () => ({
  default: { sendNotification: async (n: any) => { notifications.push(n); } },
}));

const auditRows: any[] = [];
vi.mock('../middleware/auditLog', () => ({
  logAuditEvent: async (row: any) => { auditRows.push(row); },
}));

const alerts: any[] = [];
vi.mock('../services/AlertEngine', () => ({
  createOrUpdateAlert: async (a: any) => { alerts.push(a); },
}));

vi.mock('../services/payoutGate', () => ({ checkPayoutGates: async () => ({ ok: true }) }));

// Imported ONCE (2026-09-19). Re-importing EscrowService per test pulls a big
// graph and, run alongside the rest of the suite, exceeded vitest's 5s budget —
// failures that looked like assertion failures and were not. The service holds
// no state between calls; the mocked document is the state.
const svc = (await import('../services/EscrowService')).default;
const load = async () => svc;

beforeEach(() => {
  stored = {};
  updated = {};
  notifications.length = 0;
  auditRows.length = 0;
  alerts.length = 0;
});

describe('a partial refund refunds the partial amount', () => {
  it('the customer is promised what the policy gives, not the whole hold', async () => {
    const svc = await load();
    await svc.refundEscrowPayment(ESCROW_ID, 'Tier: moderate', 'cust-1', 25000);
    const toCustomer = notifications.find(n => n.userId === 'cust-1');
    expect(toCustomer.message).toContain('₪250.00');
    expect(toCustomer.message).not.toContain('₪500.00');
  });

  it('the card instruction an admin follows carries the partial amount', async () => {
    const svc = await load();
    await svc.refundEscrowPayment(ESCROW_ID, 'Tier: moderate', 'cust-1', 25000);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].message).toContain('₪250.00');
    expect(alerts[0].title).toMatch(/PARTIAL/);
    expect(alerts[0].metadata.refundAmountCents).toBe(25000);
    expect(alerts[0].metadata.heldAmountCents).toBe(50000);
  });

  it('the escrow row records what was refunded and that it was partial', async () => {
    const svc = await load();
    await svc.refundEscrowPayment(ESCROW_ID, 'Tier: moderate', 'cust-1', 25000);
    expect(updated.status).toBe('refunded');
    expect(updated.refundedAmountCents).toBe(25000);
    expect(updated.partialRefund).toBe(true);
  });

  it('the audit row keeps both numbers', async () => {
    const svc = await load();
    await svc.refundEscrowPayment(ESCROW_ID, 'Tier: moderate', 'cust-1', 25000);
    expect(auditRows[0].metadata.refundedAmountCents).toBe(25000);
    expect(auditRows[0].metadata.heldAmountCents).toBe(50000);
    expect(auditRows[0].metadata.partialRefund).toBe(true);
  });
});

describe('a full refund is unchanged', () => {
  it('passing the full amount says the full amount, and is not flagged partial', async () => {
    const svc = await load();
    await svc.refundEscrowPayment(ESCROW_ID, 'Emergency cancel', 'admin-1', 50000);
    expect(notifications.find(n => n.userId === 'cust-1').message).toContain('₪500.00');
    expect(alerts[0].title).not.toMatch(/PARTIAL/);
    expect(updated.partialRefund).toBe(false);
  });

  it('passing nothing still means the whole hold (admin refund, dispute closure)', async () => {
    const svc = await load();
    await svc.refundEscrowPayment(ESCROW_ID, 'Dispute closure: customer_favor', 'admin-1');
    expect(updated.refundedAmountCents).toBe(50000);
    expect(updated.partialRefund).toBe(false);
    expect(notifications.find(n => n.userId === 'cust-1').message).toContain('₪500.00');
  });
});

describe('it can never instruct a refund larger than the money held', () => {
  it('an amount above the hold is clamped to the hold', async () => {
    const svc = await load();
    await svc.refundEscrowPayment(ESCROW_ID, 'bad input', 'admin-1', 99999999);
    expect(updated.refundedAmountCents).toBe(50000);
    expect(alerts[0].message).toContain('₪500.00');
  });

  it('a negative amount is clamped to zero', async () => {
    const svc = await load();
    await svc.refundEscrowPayment(ESCROW_ID, 'bad input', 'admin-1', -1);
    expect(updated.refundedAmountCents).toBe(0);
  });

  it('a non-numeric amount falls back to the whole hold, never to NaN', async () => {
    const svc = await load();
    await svc.refundEscrowPayment(ESCROW_ID, 'bad input', 'admin-1', Number.NaN);
    expect(updated.refundedAmountCents).toBe(50000);
    expect(notifications.find(n => n.userId === 'cust-1').message).not.toContain('NaN');
  });
});

describe('an escrow that is not held is still refused', () => {
  it('a second refund of the same escrow throws', async () => {
    stored = { status: 'refunded' };
    const svc = await load();
    await expect(svc.refundEscrowPayment(ESCROW_ID, 'again', 'admin-1', 100)).rejects.toThrow(/Cannot refund/);
  });
});

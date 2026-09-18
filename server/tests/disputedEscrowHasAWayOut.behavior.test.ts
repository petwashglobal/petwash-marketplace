/**
 * Behavioural test — EscrowService dispute resolution (2026-09-19).
 *
 * THE BUG: filing a dispute put the money beyond every rail in the product,
 * permanently.
 *
 *   POST /api/escrow/:id/dispute  → status 'disputed'   (either party may call it)
 *   refundEscrowPayment           → requires 'held' → throws
 *   releaseEscrowPayment          → requires 'held' → throws
 *   dispute closure (case-actions) → filtered to status === 'held' → skipped it
 *
 * So the one action that was supposed to decide where the money goes could not
 * touch the money the dispute had frozen. Nobody could be paid and nobody could
 * be refunded, for good.
 *
 * A disputed escrow is now refundable, and releasable ONLY when the caller says
 * it is resolving the dispute — so no cron, sweep or ordinary release path can
 * quietly pay out money that is under dispute.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ESCROW_ID = 'escrow-d1';
let status = 'disputed';
let updated: Record<string, any> = {};

const escrowDoc = () => ({
  id: ESCROW_ID,
  bookingId: 'BR-2026-d',
  customerId: 'cust-1',
  providerId: 'prov-1',
  amount: 300,
  currency: 'ILS',
  status,
  platformCommissionCents: 4500,
  providerPayoutCents: 25500,
});

vi.mock('../lib/firebase-admin', () => ({
  default: {
    firestore: () => ({
      collection: () => ({ doc: (id: string) => ({ id, get: async () => ({ exists: true, data: () => escrowDoc() }) }) }),
      runTransaction: async (fn: any) => fn({
        get: async () => ({ exists: true, data: () => escrowDoc() }),
        update: (_r: any, patch: any) => { updated = { ...updated, ...patch }; },
      }),
    }),
  },
}));

const notifications: any[] = [];
vi.mock('../services/NotificationService', () => ({
  default: { sendNotification: async (n: any) => { notifications.push(n); } },
}));
const auditRows: any[] = [];
vi.mock('../middleware/auditLog', () => ({ logAuditEvent: async (r: any) => { auditRows.push(r); } }));
vi.mock('../services/AlertEngine', () => ({ createOrUpdateAlert: async () => {} }));
vi.mock('../services/payoutGate', () => ({ checkPayoutGates: async () => ({ ok: true }) }));
vi.mock('../lib/payoutHumanApproval', () => ({
  isSystemPayoutActor: (uid: string) => uid === 'system' || uid === 'cron',
  HumanPayoutApprovalRequired: class extends Error {},
}));

const load = async () => (await import('../services/EscrowService')).default;

beforeEach(() => {
  status = 'disputed';
  updated = {};
  notifications.length = 0;
  auditRows.length = 0;
  vi.resetModules();
});

describe('a dispute decided for the customer', () => {
  it('refunds the money the dispute froze', async () => {
    const svc = await load();
    await svc.refundEscrowPayment(ESCROW_ID, 'Dispute closure: customer_favor', 'admin-1');
    expect(updated.status).toBe('refunded');
  });

  it('the audit row records where it came from, not a hardcoded "held"', async () => {
    const svc = await load();
    await svc.refundEscrowPayment(ESCROW_ID, 'Dispute closure: customer_favor', 'admin-1');
    expect(auditRows[0].metadata.prevStatus).toBe('disputed');
  });

  it('a partial amount still applies to a disputed escrow', async () => {
    const svc = await load();
    await svc.refundEscrowPayment(ESCROW_ID, 'Dispute closure: partial', 'admin-1', 10000);
    expect(updated.refundedAmountCents).toBe(10000);
    expect(updated.partialRefund).toBe(true);
  });
});

describe('a dispute decided for the provider', () => {
  it('releases only when the caller says it is resolving the dispute', async () => {
    const svc = await load();
    await svc.releaseEscrowPayment(ESCROW_ID, 'admin-1', { resolvingDispute: true });
    expect(updated.status).toBe('released');
  });

  it('an ordinary release still refuses a disputed escrow', async () => {
    const svc = await load();
    await expect(svc.releaseEscrowPayment(ESCROW_ID, 'admin-1')).rejects.toThrow(/Cannot release escrow with status: disputed/);
  });

  it('the flag does not let a system actor pay out', async () => {
    const svc = await load();
    await expect(
      svc.releaseEscrowPayment(ESCROW_ID, 'system', { resolvingDispute: true }),
    ).rejects.toThrow();
    expect(updated.status).toBeUndefined();
  });
});

describe('what must not change', () => {
  it('a held escrow still releases normally, with no flag', async () => {
    status = 'held';
    const svc = await load();
    await svc.releaseEscrowPayment(ESCROW_ID, 'admin-1');
    expect(updated.status).toBe('released');
  });

  it('an already-released escrow is still refused in both directions', async () => {
    status = 'released';
    const svc = await load();
    await expect(svc.refundEscrowPayment(ESCROW_ID, 'x', 'admin-1')).rejects.toThrow(/Cannot refund/);
    await expect(svc.releaseEscrowPayment(ESCROW_ID, 'admin-1', { resolvingDispute: true })).rejects.toThrow(/Cannot release/);
  });

  it('a refunded escrow cannot be released by calling it a dispute', async () => {
    status = 'refunded';
    const svc = await load();
    await expect(svc.releaseEscrowPayment(ESCROW_ID, 'admin-1', { resolvingDispute: true })).rejects.toThrow(/Cannot release/);
  });
});

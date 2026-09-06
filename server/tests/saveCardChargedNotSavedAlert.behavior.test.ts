/**
 * /save-card/return — money alerts must follow PAYMENT EVIDENCE, and the
 * vault-write failure must not be silent.
 *
 * Two defects this pins, both found in review of the first draft of this
 * alerting (2026-09-06):
 *
 * 1. The draft alerted "customer was charged ₪1 — refund manually" on EVERY
 *    failure exit. But /save-card/return is publicly reachable: a bot, a
 *    malformed link, an expired handoff or a random txnId all reach it having
 *    paid nothing. That would emit false refund instructions from
 *    unauthenticated traffic — and a money alert that cries wolf trains the
 *    reader to dismiss the real one. Alerts now require SUMIT to have
 *    positively confirmed the transaction.
 *
 * 2. The draft MISSED the terminal case. After a confirmed charge and a
 *    consumed one-shot handoff, the handler ended with
 *        card=${saved.saved ? 'saved' : 'unsaved'}
 *    so a failed vault write sent the customer away with `unsaved`, no alert,
 *    and no way to retry — they paid ₪1 and hold nothing. The old test counted
 *    literal `return res.redirect(...card=failed)` branches, and a ternary is
 *    not one, so it passed while the worst case went unhandled.
 *
 * These tests drive the real route through supertest with the vault, SUMIT
 * client and Redis mocked, so they assert BEHAVIOUR rather than source shape.
 */
import express from 'express';
import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const alerts: Array<Record<string, any>> = [];
const vaultSave = vi.fn();
const getTransaction = vi.fn();
const store = new Map<string, string>();

vi.mock('../monitoring', () => ({
  sendAlert: vi.fn(async (a: any) => { alerts.push(a); }),
}));
vi.mock('../services/redis', () => ({
  redis: {
    set: vi.fn(async (k: string, v: any) => { store.set(k, JSON.stringify(v)); return true; }),
    get: vi.fn(async (k: string) => { const r = store.get(k); return r ? JSON.parse(r) : null; }),
    getDel: vi.fn(async (k: string) => { const r = store.get(k) ?? null; store.delete(k); return r; }),
    del: vi.fn(async (k: string) => { store.delete(k); return true; }),
  },
}));
vi.mock('../services/SumitClient', () => ({
  sumitClient: { getTransaction: (...a: any[]) => getTransaction(...a) },
}));
vi.mock('../services/SumitCardVault', () => ({
  SumitCardVault: { saveCard: (...a: any[]) => vaultSave(...a) },
  isCardVaultEnabled: () => true,
}));
vi.mock('../middleware/firebase-auth', () => ({
  validateFirebaseToken: (req: any, _res: any, next: any) => { req.firebaseUser = { uid: 'u1' }; next(); },
}));
vi.mock('../lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const routes = await import('../routes/save-card');

const EXT = 'savecard_deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
const KEY = `savecard:pending:${EXT}`;
const TXN = 'txn-999';

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api/payments', routes.default);
  return a;
}

/** A transaction SUMIT positively confirms, whose external ref matches EXT. */
function confirmedTxn() {
  return {
    wired: true,
    valid: true,
    raw: { ExternalReference: EXT, CustomerID: 'cus_1', PaymentMethodID: 'pm_1' },
  };
}

const moneyAlerts = () => alerts.filter((a) => /CONFIRMED/i.test(a.message ?? ''));

beforeEach(() => {
  alerts.length = 0; store.clear();
  vaultSave.mockReset(); getTransaction.mockReset();
  store.set(KEY, JSON.stringify({ uid: 'u1', createdAt: Date.now() }));
});

describe('no payment evidence → no money alert', () => {
  it('a bare callback with no txnId/ext does NOT claim a charge', async () => {
    await request(app()).get('/api/payments/save-card/return');
    expect(moneyAlerts()).toHaveLength(0);
  });

  it('an unknown/expired handoff does NOT claim a charge', async () => {
    store.clear();
    await request(app()).get(`/api/payments/save-card/return?ID=${TXN}&ext=${EXT}`);
    expect(moneyAlerts()).toHaveLength(0);
  });

  it('a SUMIT verification failure does NOT claim a charge', async () => {
    getTransaction.mockResolvedValue({ wired: true, valid: false, reason: 'declined' });
    await request(app()).get(`/api/payments/save-card/return?ID=${TXN}&ext=${EXT}`);
    expect(moneyAlerts()).toHaveLength(0);
    expect(vaultSave).not.toHaveBeenCalled();
  });

  it('no alert body ever carries raw provider text', () => {
    // reason codes are a fixed enum; provider detail goes to the logger only
    for (const a of alerts) expect(JSON.stringify(a)).not.toMatch(/declined/i);
  });
});

describe('THE MISSED CASE: confirmed charge but the vault write fails', () => {
  it('saved:false fires a high-severity money alert and still redirects unsaved', async () => {
    getTransaction.mockResolvedValue(confirmedTxn());
    vaultSave.mockResolvedValue({ saved: false, reason: 'db_write_failed' });

    const res = await request(app()).get(`/api/payments/save-card/return?ID=${TXN}&ext=${EXT}`);

    const money = moneyAlerts();
    expect(money, 'a confirmed charge with no saved card must alert').toHaveLength(1);
    expect(money[0].severity).toBe('high');
    expect(money[0].details).toContain('vault_save_failed');
    expect(res.headers.location).toContain('card=unsaved');
  });

  it('a THROWN vault error is handled, not left as an untracked 500', async () => {
    getTransaction.mockResolvedValue(confirmedTxn());
    vaultSave.mockRejectedValue(new Error('connection reset'));

    const res = await request(app()).get(`/api/payments/save-card/return?ID=${TXN}&ext=${EXT}`);

    const money = moneyAlerts();
    expect(money).toHaveLength(1);
    expect(money[0].details).toContain('vault_save_threw');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('card=unsaved');
    // the thrown provider message must not ride along in the alert
    expect(JSON.stringify(money[0])).not.toContain('connection reset');
  });

  it('the alert carries txn/uid/ext correlation and NO card data', async () => {
    getTransaction.mockResolvedValue(confirmedTxn());
    vaultSave.mockResolvedValue({ saved: false });

    await request(app()).get(`/api/payments/save-card/return?ID=${TXN}&ext=${EXT}`);

    const body = JSON.stringify(moneyAlerts()[0]);
    expect(body).toContain(TXN);
    expect(body).toContain('u1');
    expect(body).toContain(EXT);
    for (const forbidden of ['cardNumber', 'cvv', 'pm_1', '4111']) {
      expect(body.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it('a failed save does not attempt a second vault write', async () => {
    getTransaction.mockResolvedValue(confirmedTxn());
    vaultSave.mockResolvedValue({ saved: false });
    await request(app()).get(`/api/payments/save-card/return?ID=${TXN}&ext=${EXT}`);
    expect(vaultSave).toHaveBeenCalledTimes(1);
  });
});

describe('the success path stays quiet', () => {
  it('a saved card redirects card=saved and raises no money alert', async () => {
    getTransaction.mockResolvedValue(confirmedTxn());
    vaultSave.mockResolvedValue({ saved: true });

    const res = await request(app()).get(`/api/payments/save-card/return?ID=${TXN}&ext=${EXT}`);

    expect(res.headers.location).toContain('card=saved');
    expect(moneyAlerts()).toHaveLength(0);
  });

  it('a replayed handoff raises no money alert — no second charge occurred', async () => {
    getTransaction.mockResolvedValue(confirmedTxn());
    vaultSave.mockResolvedValue({ saved: true });
    await request(app()).get(`/api/payments/save-card/return?ID=${TXN}&ext=${EXT}`); // consumes
    alerts.length = 0;
    const res = await request(app()).get(`/api/payments/save-card/return?ID=${TXN}&ext=${EXT}`);
    expect(moneyAlerts()).toHaveLength(0);
    expect(res.headers.location).toContain('card=failed');
  });
});

/**
 * A provider cannot request the same earned money twice (2026-09-13 deep audit).
 *
 * POST /api/provider-dashboard/v2/payout-request checked the amount against
 * "completed bookings not paid_out" — but nothing ever sets payout_status =
 * 'paid_out', and requests already filed (Firestore payout_requests) were never
 * subtracted. ₪850 earned → five ₪850 requests accepted (₪4,250), including two
 * submitted at the same instant, and the same money again after it was paid.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const store = new Map<string, Record<string, any>>();
let earnedCents = 85000;
let lock: Promise<void> = Promise.resolve();

vi.mock('../lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../db', () => ({
  db: {},
  pool: { query: async () => ({ rows: [{ available_cents: String(earnedCents) }] }) },
}));
vi.mock('../lib/firebase-admin', () => ({
  auth: { verifyIdToken: async (t: string) => ({ uid: t }) },
  db: {},
}));
vi.mock('../services/providerServiceApproval', () => ({ assertServiceApproved: vi.fn(), providerHasAnyServiceRows: vi.fn() }));
vi.mock('../jobs/rebook-scheduler', () => ({ scheduleRebookTrigger: vi.fn() }));
vi.mock('../lib/marketplaceSlotLock', () => ({ releaseSlotLock: vi.fn() }));
vi.mock('../lib/notificationDispatcher', () => ({ dispatchNotification: vi.fn() }));
vi.mock('../services/WalletService', () => ({ walletService: {} }));

// In-memory Firestore with REAL transaction isolation for this test: a
// transaction that reads the per-provider lock doc runs exclusively.
vi.mock('firebase-admin/firestore', () => {
  let seq = 0;
  const collection = (name: string) => ({
    doc: (id?: string) => ({ path: `${name}/${id ?? `auto${++seq}`}` }),
    where: (field: string, _op: string, value: unknown) => ({ name, field, value }),
  });
  const firestore = {
    collection,
    runTransaction: async (fn: (tx: any) => Promise<any>) => {
      const prev = lock;
      let release!: () => void;
      lock = new Promise<void>((r) => { release = r; });
      await prev;
      try {
        const writes: Array<[string, any]> = [];
        const tx = {
          get: async (ref: any) => {
            if (ref.path) return { exists: store.has(ref.path), data: () => store.get(ref.path) };
            const docs = [...store.entries()]
              .filter(([k, v]) => k.startsWith(`${ref.name}/`) && v[ref.field] === ref.value)
              .map(([, v]) => ({ data: () => v }));
            return { forEach: (cb: any) => docs.forEach(cb) };
          },
          set: (ref: any, data: any) => { writes.push([ref.path, data]); },
        };
        const out = await fn(tx);
        for (const [k, v] of writes) store.set(k, { ...(store.get(k) ?? {}), ...v });
        return out;
      } finally {
        release();
      }
    },
  };
  return { getFirestore: () => firestore };
});

async function app() {
  const { default: router } = await import('../routes/provider-dashboard-v2');
  const a = express();
  a.use(express.json());
  a.use('/api/provider-dashboard/v2', router);
  return a;
}

const ask = (a: express.Express, amountIls: number, uid = 'prov-1') =>
  request(a).post('/api/provider-dashboard/v2/payout-request')
    .set('Authorization', `Bearer ${uid}`)
    .send({ amountIls, iban: 'IL000000000000000000000' });

const requestsFor = (uid: string) => [...store.entries()].filter(([k, v]) => k.startsWith('payout_requests/') && v.providerId === uid);

beforeEach(() => { store.clear(); earnedCents = 85000; });

describe('payout requests count against the earned balance', () => {
  it('₪850 earned: the first ₪850 request is accepted, the second is refused', async () => {
    const a = await app();
    expect((await ask(a, 850)).status).toBe(200);
    const second = await ask(a, 850);
    expect(second.status).toBe(400);
    expect(second.body.availableIls).toBe(0);
    expect(requestsFor('prov-1')).toHaveLength(1);
  });

  it('five concurrent ₪850 requests → exactly one accepted', async () => {
    const a = await app();
    const results = await Promise.all(Array.from({ length: 5 }, () => ask(a, 850)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(requestsFor('prov-1')).toHaveLength(1);
  });

  it('partial requests add up to the balance and no further', async () => {
    const a = await app();
    expect((await ask(a, 500)).status).toBe(200);
    expect((await ask(a, 350)).status).toBe(200);
    expect((await ask(a, 1)).status).toBe(400);
  });

  it('a paid request still counts (paid money cannot be requested again)', async () => {
    const a = await app();
    await ask(a, 850);
    const [key] = requestsFor('prov-1')[0];
    store.set(key, { ...store.get(key), status: 'paid' });
    expect((await ask(a, 850)).status).toBe(400);
  });

  it('a rejected request releases its amount', async () => {
    const a = await app();
    await ask(a, 850);
    const [key] = requestsFor('prov-1')[0];
    store.set(key, { ...store.get(key), status: 'rejected' });
    expect((await ask(a, 850)).status).toBe(200);
  });

  it('another provider’s requests do not reduce this provider’s balance', async () => {
    const a = await app();
    expect((await ask(a, 850, 'prov-2')).status).toBe(200);
    expect((await ask(a, 850, 'prov-1')).status).toBe(200);
  });
});

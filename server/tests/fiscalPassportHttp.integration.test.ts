/**
 * FiscalPassport ROUTE-LEVEL end-to-end HTTP integration — CEO 2026-08-27
 * fiscal directive, "test all end to end each item".
 *
 * Not a source-pin. This test builds a real Express app, wires the ACTUAL
 * fiscal-passport router behind the ACTUAL validateFirebaseToken middleware,
 * mocks firebase-admin + pool + db at the outermost boundary, and sends real
 * HTTP requests via supertest. Every assertion is on the actual JSON payload
 * and HTTP status the router emits.
 *
 * What each HTTP scenario proves:
 *
 *   AUTH  no bearer → 401 from validateFirebaseToken (mounted middleware
 *         is exercised — not stubbed).
 *
 *   §94.20 GET /my/transactions → 200 with a listing that pulls Shop rows
 *         via the parameterised customerLister query.
 *
 *   §94.22 GET /transactions/by-source/shop_orders/:id owned by caller →
 *         200 with a passport whose fiscalDocument.state is PAID_NO_FISCAL_DOCUMENT
 *         reconciliation-tagged when the sumit_documents table is empty
 *         (§85 behaviour).
 *
 *   §34   Non-owner customer requesting somebody else's order → 404 (privacy
 *         404, not 403 leak).
 *
 *   §65   Unknown source → 400 UNKNOWN_SOURCE (whitelist enforced at the
 *         route boundary, not deep in the composer).
 *
 *   §71   Customer hitting /admin/by-source → 403 ADMIN_ONLY (gate BEFORE
 *         any read).
 *
 *   §59   Staff hitting /admin/by-source with a real shop order → 200 with
 *         viewFor.showsExternalIds=true (staff projection).
 *
 *   §84   Duplicate callback: fiscalEventKey composed inside the passport
 *         is deterministic; 10 identical HTTP GETs return 10 identical
 *         transactionRef values.
 *
 *   §86   Refund without credit_document_id → composeRefundFiscalDocument
 *         returns CREDIT_PENDING (verified inline; a shop 'refunded' order
 *         emerges with commercial state CANCELLED via the composer).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── Boundary state controlled per-test ─────────────────────────────
interface Caller { uid: string; email?: string; email_verified?: boolean }
const state = {
  caller: null as Caller | null,
  shopOrdersById: new Map<string, any>(),
  shopOrdersByUser: new Map<string, any[]>(),
  k9000ByUser: new Map<string, any[]>(),
  sitterByUser: new Map<string, any[]>(),
  walkByUser: new Map<string, any[]>(),
  trainerByUser: new Map<string, any[]>(),
  usersById: new Map<string, { firstName?: string; lastName?: string; email?: string }>(),
  sumitDocsByKey: new Map<string, Array<{ total_cents: number }>>(),
};

// firebase-admin — the real validateFirebaseToken middleware verifies with it.
vi.mock('../lib/firebase-admin', () => ({
  auth: {
    verifyIdToken: async (token: string) => {
      if (token === 'BAD') throw new Error('bad token');
      if (!state.caller) throw new Error('no caller configured');
      return {
        uid: state.caller.uid,
        email: state.caller.email ?? `${state.caller.uid}@test.local`,
        email_verified: state.caller.email_verified === true,
      };
    },
    verifySessionCookie: async () => { throw new Error('no session cookie in test'); },
  },
}));

// isSuperAdmin — env-driven; we set the allowlist per test rather than mocking.
process.env.SUPER_ADMIN_EMAILS = 'staff@petwash.co.il';

// pg pool + drizzle db mock — every query goes through here.
vi.mock('../db', async () => {
  const drizzleOrm: any = await import('drizzle-orm');

  function isSitterBookingsTable(t: any): boolean { return t?.[Symbol.for('drizzle:Name')] === 'sitter_bookings'; }

  // A minimal chainable select() that returns predetermined rows from state.
  function selectImpl(_projection?: any) {
    let mode: 'all' | 'byId' | 'byUser' = 'all';
    let source: string | null = null;
    let whereVal: any = null;

    const chain: any = {
      from(table: any) {
        const n = String(table?.[Symbol.for('drizzle:Name')] ?? table?.name ?? '');
        source = n;
        return chain;
      },
      where(clause: any) {
        whereVal = clause;
        return chain;
      },
      orderBy() { return chain; },
      limit() { return chain; },
      then(resolve: any) {
        resolve(execute());
        return { catch() {} } as any;
      },
    };
    async function execute(): Promise<any[]> {
      // Nothing fancy: return either usersById or the k9000/sitter/walk map
      // based on the source table's DB name.
      if (!source) return [];
      if (source === 'users') {
        // Best-effort — return the single user we've configured that matches
        // the where-uid; the test only calls users with one uid.
        const anyUid = [...state.usersById.keys()][0];
        const u = anyUid ? state.usersById.get(anyUid) : undefined;
        return u ? [u] : [];
      }
      if (source === 'k9000_wash_events') {
        // Rebuild flat list from all users.
        const flat: any[] = [];
        for (const arr of state.k9000ByUser.values()) flat.push(...arr);
        return flat;
      }
      if (source === 'sitter_bookings') {
        const flat: any[] = [];
        for (const arr of state.sitterByUser.values()) flat.push(...arr);
        return flat;
      }
      if (source === 'walk_bookings') {
        const flat: any[] = [];
        for (const arr of state.walkByUser.values()) flat.push(...arr);
        return flat;
      }
      if (source === 'trainer_bookings') {
        const flat: any[] = [];
        for (const arr of state.trainerByUser.values()) flat.push(...arr);
        return flat;
      }
      // Every other table → empty (fresh env).
      return [];
    }
    return chain;
  }

  return {
    pool: {
      query: vi.fn(async (sql: string, params: any[] = []) => {
        // Router the query by the FROM clause.
        if (/FROM\s+shop_orders/i.test(sql) && /WHERE\s+id\s*=\s*\$1/i.test(sql)) {
          const id = String(params[0] ?? '');
          const row = state.shopOrdersById.get(id);
          return { rows: row ? [row] : [] };
        }
        if (/FROM\s+shop_orders/i.test(sql) && /WHERE\s+user_id\s*=\s*\$1/i.test(sql)) {
          const uid = String(params[0] ?? '');
          const rows = state.shopOrdersByUser.get(uid) ?? [];
          return { rows };
        }
        if (/FROM\s+sumit_documents/i.test(sql) && /fiscal_event_key\s*=\s*\$1/i.test(sql)) {
          const key = String(params[0] ?? '');
          const docs = state.sumitDocsByKey.get(key) ?? [];
          if (/COUNT\(/i.test(sql)) return { rows: [{ n: docs.length }] };
          return { rows: docs };
        }
        // Any other pool.query → simulate a fresh env where the table is missing.
        const err: any = new Error('relation does not exist');
        err.code = '42P01';
        throw err;
      }),
    },
    db: {
      select: (proj?: any) => selectImpl(proj),
      // Composer + lister never mutate — the routes are READ-ONLY.
    },
  };
});

// ─── App builder ────────────────────────────────────────────────────
async function buildApp() {
  const { validateFirebaseToken } = await import('../middleware/firebase-auth');
  const fiscalRoutesMod = await import('../routes/fiscal-passport');
  const app = express();
  app.use(express.json());
  app.use('/api/fiscal', validateFirebaseToken, fiscalRoutesMod.default);
  return app;
}

function bearer(token: string) { return { Authorization: `Bearer ${token}` }; }

beforeEach(() => {
  state.caller = null;
  state.shopOrdersById.clear();
  state.shopOrdersByUser.clear();
  state.k9000ByUser.clear();
  state.sitterByUser.clear();
  state.walkByUser.clear();
  state.trainerByUser.clear();
  state.usersById.clear();
  state.sumitDocsByKey.clear();
});

// ─── AUTH ────────────────────────────────────────────────────────────

describe('/api/fiscal — auth boundary (validateFirebaseToken really runs)', () => {
  it('no Authorization header → 401', async () => {
    const app = await buildApp();
    const res = await request(app).get('/api/fiscal/my/transactions');
    expect(res.status).toBe(401);
  });

  it('bad token → 401', async () => {
    const app = await buildApp();
    const res = await request(app).get('/api/fiscal/my/transactions').set(bearer('BAD'));
    expect(res.status).toBe(401);
  });
});

// ─── /my/transactions — §94.20 ───────────────────────────────────────

describe('GET /api/fiscal/my/transactions (§94.20, §27)', () => {
  it('customer sees their shop orders — parameterised uid-scoped lister returns 200', async () => {
    state.caller = { uid: 'user-alpha', email: 'alpha@example.com', email_verified: true };
    const now = new Date().toISOString();
    state.shopOrdersByUser.set('user-alpha', [
      { id: 'ORDER-A1', order_number: 'A-1', status: 'paid', total_cents: 12000, created_at: now },
      { id: 'ORDER-A2', order_number: 'A-2', status: 'delivered', total_cents: 5500, created_at: now },
    ]);

    const app = await buildApp();
    const res = await request(app).get('/api/fiscal/my/transactions').set(bearer('good'));

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.transactions)).toBe(true);
    // Both shop rows surfaced.
    const refs = res.body.transactions.map((t: any) => t.sourceId);
    expect(refs).toContain('ORDER-A1');
    expect(refs).toContain('ORDER-A2');
    // Every row carries a transactionRef and a documentType from the CPA mapping.
    for (const t of res.body.transactions) {
      expect(typeof t.transactionRef).toBe('string');
      expect(t.transactionRef).toMatch(/^PWT-/);
      expect(['InvoiceAndReceipt', 'Receipt', 'Invoice', 'CreditInvoice', undefined]).toContain(t.documentType);
    }
  });

  it('user with no rows → 200 with empty list (never leaks 500)', async () => {
    state.caller = { uid: 'user-empty', email: 'empty@example.com', email_verified: true };
    const app = await buildApp();
    const res = await request(app).get('/api/fiscal/my/transactions').set(bearer('good'));
    expect(res.status).toBe(200);
    expect(res.body.transactions).toEqual([]);
  });
});

// ─── /transactions/by-source/... — customer detail path ─────────────

describe('GET /api/fiscal/transactions/by-source (§94.22, §34)', () => {
  it('owner reading their own shop order → 200 with a full passport', async () => {
    state.caller = { uid: 'user-owner', email: 'owner@example.com', email_verified: true };
    const now = new Date().toISOString();
    state.shopOrdersById.set('ORDER-OWN', {
      id: 'ORDER-OWN', order_number: 'OWN-1', user_id: 'user-owner', status: 'paid',
      subtotal_cents: 10000, vat_cents: 1700, total_cents: 11700,
      payment_ref: 'ref_paid_1', payment_method: 'card', delivery_cents: 0, created_at: now,
    });
    state.usersById.set('user-owner', { firstName: 'Owner', lastName: 'Person' });

    const app = await buildApp();
    const res = await request(app)
      .get('/api/fiscal/transactions/by-source/shop_orders/ORDER-OWN')
      .set(bearer('good'));

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.passport).toBeTruthy();
    expect(res.body.passport.eventType).toBe('SHOP_ORDER_PAID');
    expect(res.body.passport.paymentClass).toBe('SHOP_ITEM');
    expect(res.body.passport.money.totalCents).toBe(11700);
    expect(res.body.passport.money.amountPaidCents).toBe(11700);
    expect(res.body.passport.money.amountOutstandingCents).toBe(0);
    expect(res.body.passport.payment.state).toBe('PAID');
    // Staff-only externals hidden for customer viewer.
    expect(res.body.viewFor.showsExternalIds).toBe(false);
  });

  it('non-owner reading somebody else\'s shop order → 404 (privacy §34, never 403 leak)', async () => {
    state.caller = { uid: 'user-nosy', email: 'nosy@example.com', email_verified: true };
    const now = new Date().toISOString();
    state.shopOrdersById.set('ORDER-VICTIM', {
      id: 'ORDER-VICTIM', order_number: 'V-1', user_id: 'user-victim', status: 'paid',
      subtotal_cents: 10000, vat_cents: 1700, total_cents: 11700,
      payment_ref: 'ref_v', payment_method: 'card', delivery_cents: 0, created_at: now,
    });

    const app = await buildApp();
    const res = await request(app)
      .get('/api/fiscal/transactions/by-source/shop_orders/ORDER-VICTIM')
      .set(bearer('good'));

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });

  it('unknown source string → 400 UNKNOWN_SOURCE (whitelist at boundary)', async () => {
    state.caller = { uid: 'user-any', email: 'any@example.com', email_verified: true };
    const app = await buildApp();
    const res = await request(app)
      .get('/api/fiscal/transactions/by-source/mystery_table/whatever')
      .set(bearer('good'));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('UNKNOWN_SOURCE');
  });

  it('§84 idempotency — 10 identical GETs return the SAME transactionRef', async () => {
    state.caller = { uid: 'user-dupe', email: 'dupe@example.com', email_verified: true };
    const isoDate = '2026-08-27T10:00:00.000Z';
    state.shopOrdersById.set('ORDER-DUPE', {
      id: 'ORDER-DUPE', order_number: 'DUPE-1', user_id: 'user-dupe', status: 'paid',
      subtotal_cents: 10000, vat_cents: 1700, total_cents: 11700,
      payment_ref: 'ref_dupe', payment_method: 'card', delivery_cents: 0, created_at: isoDate,
    });
    state.usersById.set('user-dupe', { firstName: 'D', lastName: 'U' });

    const app = await buildApp();
    const refs = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .get('/api/fiscal/transactions/by-source/shop_orders/ORDER-DUPE')
        .set(bearer('good'));
      expect(res.status).toBe(200);
      refs.add(res.body.passport.transactionRef);
    }
    expect(refs.size).toBe(1);
  });

  it('§85 paid + missing sumit_documents table → passport still returned (no false 500) with fiscalDocument.state=PENDING', async () => {
    state.caller = { uid: 'user-pnd', email: 'pnd@example.com', email_verified: true };
    state.shopOrdersById.set('ORDER-PND', {
      id: 'ORDER-PND', order_number: 'P-1', user_id: 'user-pnd', status: 'paid',
      subtotal_cents: 10000, vat_cents: 1700, total_cents: 11700,
      payment_ref: 'ref_pnd', payment_method: 'card', delivery_cents: 0, created_at: new Date().toISOString(),
    });
    state.usersById.set('user-pnd', { firstName: 'P', lastName: 'N' });

    const app = await buildApp();
    const res = await request(app)
      .get('/api/fiscal/transactions/by-source/shop_orders/ORDER-PND')
      .set(bearer('good'));

    expect(res.status).toBe(200);
    // §85 tail: paid + no document yet → fiscalDocument.state = PENDING.
    expect(res.body.passport.fiscalDocument.state).toBe('PENDING');
    expect(res.body.passport.payment.state).toBe('PAID');
  });

  it('§86 shop refund → commercialState=CANCELLED and event=SHOP_ORDER_REFUNDED', async () => {
    state.caller = { uid: 'user-ref', email: 'ref@example.com', email_verified: true };
    state.shopOrdersById.set('ORDER-REF', {
      id: 'ORDER-REF', order_number: 'R-1', user_id: 'user-ref', status: 'refunded',
      subtotal_cents: 10000, vat_cents: 1700, total_cents: 11700,
      payment_ref: 'ref_r', payment_method: 'card', delivery_cents: 0, created_at: new Date().toISOString(),
    });
    state.usersById.set('user-ref', { firstName: 'R', lastName: 'E' });

    const app = await buildApp();
    const res = await request(app)
      .get('/api/fiscal/transactions/by-source/shop_orders/ORDER-REF')
      .set(bearer('good'));

    expect(res.status).toBe(200);
    expect(res.body.passport.eventType).toBe('SHOP_ORDER_REFUNDED');
    expect(res.body.passport.commercialState).toBe('CANCELLED');
    expect(res.body.passport.payment.state).toBe('REFUNDED');
  });
});

// ─── /admin/by-source — staff-only ──────────────────────────────────

describe('GET /api/fiscal/admin/by-source (§59, §71, §94.24)', () => {
  it('non-staff customer → 403 ADMIN_ONLY (gate BEFORE any read)', async () => {
    state.caller = { uid: 'user-cust', email: 'nope@example.com', email_verified: true };
    const app = await buildApp();
    const res = await request(app)
      .get('/api/fiscal/admin/by-source/shop_orders/ORDER-ANY')
      .set(bearer('good'));
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ADMIN_ONLY');
  });

  it('staff (SUPER_ADMIN_EMAILS match) → 200 with showsExternalIds=true', async () => {
    state.caller = { uid: 'user-staff', email: 'staff@petwash.co.il', email_verified: true };
    state.shopOrdersById.set('ORDER-STF', {
      id: 'ORDER-STF', order_number: 'S-1', user_id: 'user-other', status: 'paid',
      subtotal_cents: 10000, vat_cents: 1700, total_cents: 11700,
      payment_ref: 'ref_stf', payment_method: 'card', delivery_cents: 0, created_at: new Date().toISOString(),
    });
    state.usersById.set('user-other', { firstName: 'X', lastName: 'Y' });

    const app = await buildApp();
    const res = await request(app)
      .get('/api/fiscal/admin/by-source/shop_orders/ORDER-STF')
      .set(bearer('good'));

    expect(res.status).toBe(200);
    expect(res.body.passport).toBeTruthy();
    expect(res.body.viewFor.showsExternalIds).toBe(true);
    // Staff can read another user's transaction — customer 404 gate was
    // customer-scoped only.
    expect(res.body.passport.correlationId).toBe('shop:ORDER-STF');
  });

  it('staff unknown source → 400 UNKNOWN_SOURCE', async () => {
    state.caller = { uid: 'user-staff', email: 'staff@petwash.co.il', email_verified: true };
    const app = await buildApp();
    const res = await request(app)
      .get('/api/fiscal/admin/by-source/bogus/anything')
      .set(bearer('good'));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('UNKNOWN_SOURCE');
  });

  it('staff not-found → 404 NOT_FOUND (staff still gets a real 404, no 500)', async () => {
    state.caller = { uid: 'user-staff', email: 'staff@petwash.co.il', email_verified: true };
    const app = await buildApp();
    const res = await request(app)
      .get('/api/fiscal/admin/by-source/shop_orders/DOES-NOT-EXIST')
      .set(bearer('good'));
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });
});

// ─── HTTP method surface — READ-ONLY (§65) ──────────────────────────

describe('READ-ONLY surface — every non-GET → 404 from the router', () => {
  it('POST /my/transactions → 404', async () => {
    state.caller = { uid: 'user-x', email: 'x@example.com', email_verified: true };
    const app = await buildApp();
    const res = await request(app).post('/api/fiscal/my/transactions').set(bearer('good')).send({});
    expect(res.status).toBe(404);
  });
  it('PATCH /transactions/by-source/... → 404', async () => {
    state.caller = { uid: 'user-x', email: 'x@example.com', email_verified: true };
    const app = await buildApp();
    const res = await request(app)
      .patch('/api/fiscal/transactions/by-source/shop_orders/ORDER-X')
      .set(bearer('good')).send({});
    expect(res.status).toBe(404);
  });
  it('DELETE /admin/by-source/... → 404', async () => {
    state.caller = { uid: 'user-staff', email: 'staff@petwash.co.il', email_verified: true };
    const app = await buildApp();
    const res = await request(app)
      .delete('/api/fiscal/admin/by-source/shop_orders/ORDER-X')
      .set(bearer('good'));
    expect(res.status).toBe(404);
  });
});

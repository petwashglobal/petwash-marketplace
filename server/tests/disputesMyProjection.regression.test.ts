/**
 * PR-DISPUTES-MY-PROJECTION — fire-order item 101.
 *
 * GET /api/disputes/my returned the full booking_disputes row via bare
 * db.select(), exposing `adminNotes` (internal reviewer commentary)
 * and `resolvedBy` (admin uid) to the customer. Replaced with an
 * explicit allow-list projection matching PR #1760's StaffPending
 * pattern (AUTH IDENTITY → OWNERSHIP → EXPLICIT PROJECTION).
 *
 * Source-pin section for the projection + behavioral section (mocked
 * db + firebase-admin) exercising:
 *   - unauthenticated → 401
 *   - own resource → returned
 *   - other user's resource → not returned
 *   - query/body identity spoof → ignored
 *   - forbidden internal fields absent from response
 */

// ─── vi.mock hoisted ───────────────────────────────────────────────────────
import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { PgDialect } from 'drizzle-orm/pg-core';

interface Caller {
  uid: string;
  email?: string;
  emailVerified?: boolean;
}

interface DisputeRow {
  id: string;
  bookingId: string;
  bookingType: string;
  customerId: string;
  reason: string;
  description: string | null;
  status: string;
  adminNotes: string | null;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
}

const state = {
  caller: null as Caller | null,
  rows: [] as DisputeRow[],
};

// Mock the Firebase admin the requireAuth helper uses.
vi.mock('../lib/firebase-admin', () => ({
  auth: {
    verifyIdToken: async (token: string) => {
      const caller = state.caller;
      if (!caller) throw new Error('no caller');
      if (token === 'BAD') throw new Error('bad token');
      return { uid: caller.uid, email: caller.email, email_verified: caller.emailVerified === true };
    },
  },
}));

// Mock db (drizzle-shaped) — supports select({...}).from(t).where(c).orderBy(o).limit(n)
vi.mock('../db', () => {
  const dialect = new PgDialect();

  function serializeClause(clause: any): string {
    const { sql: sqlText, params } = dialect.sqlToQuery(clause);
    let out = String(sqlText);
    params.forEach((p, i) => {
      const placeholder = new RegExp('\\$' + (i + 1) + '\\b', 'g');
      const rendered = typeof p === 'string' ? `'${String(p).replace(/'/g, "''")}'` : String(p);
      out = out.replace(placeholder, rendered);
    });
    return out;
  }

  function rowMatches(row: DisputeRow, clauseSql: string): boolean {
    // The /my handler generates ONE shape:
    //   "booking_disputes"."customer_id" = 'me_uid'
    const m = clauseSql.match(/"?booking_disputes"?\."?customer_id"?\s*=\s*'([^']*)'/i);
    if (!m) return false;
    return row.customerId === m[1];
  }

  function project(row: DisputeRow, shape: Record<string, any> | null): any {
    if (!shape) return row;
    const out: any = {};
    for (const k of Object.keys(shape)) out[k] = (row as any)[k] ?? null;
    return out;
  }

  function makeBuilder(shape: Record<string, any> | null) {
    let capturedWhere: any = null;
    const chain: any = {
      from(_t: any) { return chain; },
      where(clause: any) { capturedWhere = clause; return chain; },
      orderBy(_o: any) { return chain; },
      async limit(_n: number) {
        if (!capturedWhere) return [];
        const sql = serializeClause(capturedWhere);
        return state.rows.filter((r) => rowMatches(r, sql)).map((r) => project(r, shape));
      },
    };
    return chain;
  }

  return {
    db: {
      select(shape?: Record<string, any>) { return makeBuilder(shape ?? null); },
    },
    pool: {},
  };
});

// Import the router AFTER mocks are hoisted.
import router from '../routes/disputes';

// ─── helpers ───────────────────────────────────────────────────────────────
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/disputes', router);
  return app;
}

const app = buildApp();
const ME_UID = 'me_uid_101';
const OTHER_UID = 'other_uid_101';

function baseRow(overrides: Partial<DisputeRow> = {}): DisputeRow {
  return {
    id: 'D-001',
    bookingId: 'B-001',
    bookingType: 'marketplace',
    customerId: ME_UID,
    reason: 'no_show',
    description: 'Provider did not arrive',
    status: 'open',
    adminNotes: 'internal reviewer note — DO NOT SHOW TO CUSTOMER',
    resolvedBy: 'admin_uid_secret',
    resolvedAt: null,
    createdAt: new Date('2026-08-10T00:00:00Z'),
    ...overrides,
  };
}

beforeEach(() => {
  state.caller = null;
  state.rows = [];
});

// ─── A. source pin — projection present, no bare db.select() ───────────────
describe('PR-DISPUTES-MY-PROJECTION — A. source pin', () => {
  it('A1. handler uses explicit projection (no bare db.select())', () => {
    const { readFileSync } = require('fs');
    const { resolve } = require('path');
    const src = readFileSync(resolve(__dirname, '..', 'routes', 'disputes.ts'), 'utf8');
    const myBlock = src.match(/router\.get\(\s*['"]\/my['"][\s\S]*?^\}\s*\)\s*;/m)?.[0] || '';
    expect(myBlock.length).toBeGreaterThan(0);
    // Projection must be present.
    expect(/db\.select\(\{[\s\S]*?bookingDisputes\.id/.test(myBlock)).toBe(true);
    // Bare select must be gone.
    expect(/db\.select\(\)\.from\(\s*bookingDisputes\s*\)/.test(myBlock)).toBe(false);
  });

  it('A2. projection allow-list matches expected 8 fields exactly', () => {
    const { readFileSync } = require('fs');
    const { resolve } = require('path');
    const src = readFileSync(resolve(__dirname, '..', 'routes', 'disputes.ts'), 'utf8');
    const shape = src.match(/db\s*\.select\(\s*(\{[\s\S]*?\})\s*\)\s*\.from\(\s*bookingDisputes\s*\)/)?.[1] || '';
    const keys = Array.from(shape.matchAll(/^\s*(\w+)\s*:\s*bookingDisputes\./gm)).map(m => m[1]);
    const allowed = new Set(['id', 'bookingId', 'bookingType', 'reason', 'description', 'status', 'resolvedAt', 'createdAt']);
    expect(new Set(keys)).toEqual(allowed);
  });
});

// ─── B. behavioral ────────────────────────────────────────────────────────
describe('PR-DISPUTES-MY-PROJECTION — B. behavioral', () => {
  it('B1. unauthenticated → 401', async () => {
    state.caller = null; // even if a Bearer is sent, verifyIdToken throws
    const res = await request(app).get('/api/disputes/my');
    expect(res.status).toBe(401);
  });

  it('B2. own resource → returned', async () => {
    state.caller = { uid: ME_UID };
    state.rows = [baseRow({ id: 'D-mine', customerId: ME_UID })];
    const res = await request(app).get('/api/disputes/my').set('Authorization', 'Bearer XYZ');
    expect(res.status).toBe(200);
    expect(res.body.disputes).toHaveLength(1);
    expect(res.body.disputes[0].id).toBe('D-mine');
  });

  it("B3. other user's resource → not returned", async () => {
    state.caller = { uid: ME_UID };
    state.rows = [baseRow({ id: 'D-other', customerId: OTHER_UID })];
    const res = await request(app).get('/api/disputes/my').set('Authorization', 'Bearer XYZ');
    expect(res.status).toBe(200);
    expect(res.body.disputes).toEqual([]);
  });

  it('B4. query/body identity spoof is ignored', async () => {
    state.caller = { uid: ME_UID };
    state.rows = [
      baseRow({ id: 'D-mine', customerId: ME_UID }),
      baseRow({ id: 'D-other', customerId: OTHER_UID }),
    ];
    const res = await request(app)
      .get('/api/disputes/my')
      .query({ userId: OTHER_UID, uid: OTHER_UID, customerId: OTHER_UID })
      .set('X-Impersonate-Uid', OTHER_UID)
      .set('Authorization', 'Bearer XYZ');
    expect(res.status).toBe(200);
    expect(res.body.disputes).toHaveLength(1);
    expect(res.body.disputes[0].id).toBe('D-mine');
  });

  it('B5. forbidden internal fields absent from response', async () => {
    state.caller = { uid: ME_UID };
    state.rows = [baseRow({ id: 'D-mine', customerId: ME_UID })];
    const res = await request(app).get('/api/disputes/my').set('Authorization', 'Bearer XYZ');
    expect(res.status).toBe(200);
    const row = res.body.disputes[0];
    for (const forbidden of ['adminNotes', 'resolvedBy', 'customerId']) {
      expect(row).not.toHaveProperty(forbidden);
    }
    // Positive: expected keys are exactly the allow-list.
    const returnedKeys = new Set(Object.keys(row));
    expect(returnedKeys).toEqual(new Set(['id', 'bookingId', 'bookingType', 'reason', 'description', 'status', 'resolvedAt', 'createdAt']));
  });
});

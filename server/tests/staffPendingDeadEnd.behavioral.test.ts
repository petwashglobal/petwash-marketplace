/**
 * PR-AUTH-FIX-STAFFPENDING-DEADEND — behavioral (runtime) tests for
 * GET /api/staff/applications/mine.
 *
 * Complements server/tests/staffPendingDeadEnd.regression.test.ts (the
 * source-pin suite). Source pins prove "the guard is in the source and
 * cannot be silently removed"; these behavioral tests prove "the
 * endpoint actually behaves the way it looks like it does" by running
 * the real route handler against a mocked auth layer + mocked drizzle
 * db, and hitting it with supertest.
 *
 * The six required runtime cases (per review):
 *
 *   1. AUTHENTICATED UID MATCH — DB row.userId = caller uid (email can
 *      differ): caller receives that application.
 *   2. VERIFIED EMAIL FALLBACK — DB row.userId = null / different legacy
 *      value, row.email = caller email in a different case; caller
 *      email_verified = true → caller receives application.
 *   3. UNVERIFIED EMAIL MUST NOT FALL BACK — DB row.userId != caller uid,
 *      row.email = caller email; caller email_verified = false → null.
 *   4. CROSS-USER LEAK GUARD — DB row belongs to another uid AND another
 *      email → null.
 *   5. RESPONSE PROJECTION — row contains sensitive/internal fields;
 *      JSON.application contains ONLY id/applicationType/status/
 *      rejectionReason/submittedAt/reviewedAt/approvedAt.
 *   6. NO IDENTITY OVERRIDE — query/body pretending to be another
 *      uid/email; authenticated Firebase identity stays authoritative.
 *
 * How the mocks work (kept small — this file's job is behavior, not
 * infra):
 *   - vi.mock('../customAuth', ...) replaces requireAuth with a stub
 *     that reads the current test's declared identity from a shared
 *     `currentCaller` variable and sets req.firebaseUser + req.user
 *     accordingly. next() is called; the real /mine handler runs
 *     unmodified.
 *   - vi.mock('../db', ...) replaces `db` with an in-memory fake that
 *     supports the drizzle fluent chain used by /mine:
 *       db.select(shape).from(table).where(clause).orderBy(x).limit(n)
 *     The mock:
 *       - captures the .select() shape (so projection is honored — a
 *         real DB only returns the selected columns)
 *       - captures the .where(clause) predicate and evaluates it
 *         against the seeded row(s) via drizzle's own PgDialect
 *         sqlToQuery serializer (so the exact SQL the handler generates
 *         is what we filter on — no bypass of the sql`lower(...) =
 *         lower(...)` shape)
 *   Everything else (orderBy / limit) is passthrough — the test seeds
 *   at most one row so ordering is irrelevant.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { PgDialect } from 'drizzle-orm/pg-core';

// ─── Test-scoped mutable state, shared with the mocks ──────────────────────
// These are set per-test to describe the caller and the DB rows.

interface TestCaller {
  uid: string;
  email: string | null;
  emailVerified: boolean;
}
interface StaffAppRow {
  id: number;
  userId: string | null;
  email: string;
  applicationType: string;
  status: string;
  rejectionReason: string | null;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  approvedAt: Date | null;
  // Sensitive / internal fields that MUST NOT leak via /mine:
  dateOfBirth?: string;
  address?: string;
  taxId?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankRoutingNumber?: string;
  notes?: string;
  reviewerNotes?: string;
  fraudRiskScore?: number;
  criminalRecord?: string;
  references?: string;
  formData?: any;
}

// Shared with mocks (mocks read these when a request comes in).
const state = {
  caller: null as TestCaller | null,
  rows: [] as StaffAppRow[],
};

// ─── Mock: ../customAuth.requireAuth ───────────────────────────────────────
// A minimal stand-in that populates req.firebaseUser / req.user from
// `state.caller` and hands off to next(). Verifies the ONLY thing that
// matters for these tests: the handler downstream must use whatever
// identity Firebase decided, never anything the caller sends in
// query/body/params.
vi.mock('../customAuth', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    const caller = state.caller;
    if (!caller) return res.status(401).json({ success: false, error: 'Test: no caller set' });
    req.firebaseUser = {
      uid: caller.uid,
      email: caller.email ?? undefined,
      email_verified: caller.emailVerified,
    };
    req.user = { uid: caller.uid, email: caller.email ?? undefined };
    (req as any).userId = caller.uid;
    return next();
  },
  // The rest of customAuth is not touched by /mine but export placeholders
  // so any incidental imports don't blow up module resolution.
  setupCustomAuth: () => {},
}));

// ─── Mock: ../adminAuth ────────────────────────────────────────────────────
// The routes file imports { requireAdmin } from '../adminAuth' for other
// routes we're not exercising. Provide a stub so the module loads cleanly.
vi.mock('../adminAuth', () => ({
  requireAdmin: (_req: any, _res: any, next: any) => next(),
  requireAuthenticatedRole: () => (_req: any, _res: any, next: any) => next(),
}));

// ─── Mock: ../db ───────────────────────────────────────────────────────────
// A drizzle-shaped fake. Supports exactly the chain /mine uses:
//   db.select(shape).from(table).where(clause).orderBy(...).limit(n)
// The .where() step uses PgDialect.sqlToQuery to serialize the caller's
// clause into an actual SQL string with the interpolated literals — so
// we're filtering rows against the exact SQL the handler generates.
vi.mock('../db', () => {
  const dialect = new PgDialect();

  function serializeClause(clause: any): string {
    // drizzle SQL instances have a .toQuery(dialect) method in some
    // versions; the portable path is dialect.sqlToQuery(clause) → { sql, params }.
    // Substitute $1, $2, ... with the actual param values so the returned
    // string is a self-contained matcher.
    const { sql: sqlText, params } = dialect.sqlToQuery(clause);
    let out = String(sqlText);
    params.forEach((p, i) => {
      const placeholder = new RegExp('\\$' + (i + 1) + '\\b', 'g');
      const rendered = typeof p === 'string' ? `'${String(p).replace(/'/g, "''")}'` : String(p);
      out = out.replace(placeholder, rendered);
    });
    return out;
  }

  function rowMatchesClause(row: StaffAppRow, sqlString: string): boolean {
    // The handler only ever generates ONE of two shapes:
    //   (A) `"staff_applications"."user_id" = 'me_uid'`
    //   (B) `("staff_applications"."user_id" = 'me_uid' or lower("staff_applications"."email") = lower('me@x.com'))`
    // Test both arms independently against the row.
    const uidLiteralMatch = sqlString.match(/"?staff_applications"?\."?user_id"?\s*=\s*'([^']*)'/i);
    const emailLiteralMatch = sqlString.match(/lower\("?staff_applications"?\."?email"?\)\s*=\s*lower\('([^']*)'\)/i);

    const uidArmActive = !!uidLiteralMatch;
    const emailArmActive = !!emailLiteralMatch;

    const uidMatches =
      uidArmActive && row.userId != null && String(row.userId) === uidLiteralMatch![1];
    const emailMatches =
      emailArmActive &&
      typeof row.email === 'string' &&
      row.email.toLowerCase() === emailLiteralMatch![1].toLowerCase();

    return uidMatches || emailMatches;
  }

  function projectRow(row: StaffAppRow, shape: Record<string, any>): Record<string, any> {
    // shape is the object literal from db.select({...}). The KEYS are
    // what the handler wants back; we map each key to the same-named
    // field on our row. Anything not in the shape is dropped — which
    // is precisely what a real Postgres SELECT does.
    const out: Record<string, any> = {};
    for (const key of Object.keys(shape)) {
      out[key] = (row as any)[key] ?? null;
    }
    return out;
  }

  function makeBuilder(shape: Record<string, any> | null) {
    let capturedClause: any = null;
    const chain: any = {
      from(_table: any) {
        return chain;
      },
      where(clause: any) {
        capturedClause = clause;
        return chain;
      },
      orderBy(_order: any) {
        return chain;
      },
      async limit(_n: number) {
        if (!capturedClause) return [];
        const sqlString = serializeClause(capturedClause);
        const matches = state.rows.filter((row) => rowMatchesClause(row, sqlString));
        return matches.map((row) => (shape ? projectRow(row, shape) : row));
      },
    };
    return chain;
  }

  return {
    db: {
      select(shape?: Record<string, any>) {
        return makeBuilder(shape ?? null);
      },
    },
  };
});

// ─── Import the routes AFTER mocks are hoisted ─────────────────────────────
// vi.mock() calls are hoisted to the top of the file, so this import
// resolves the mocked modules. The real /mine handler runs.
import { registerStaffOnboardingRoutes } from '../routes/staff-onboarding';

// ─── Fresh app per test suite ──────────────────────────────────────────────
function buildTestApp() {
  const app = express();
  app.use(express.json());
  registerStaffOnboardingRoutes(app);
  return app;
}

const app = buildTestApp();
const ME_UID = 'me_uid_abc';
const ME_EMAIL = 'me@example.com';
const OTHER_UID = 'other_uid_xyz';
const OTHER_EMAIL = 'other@example.com';

function baseRow(overrides: Partial<StaffAppRow> = {}): StaffAppRow {
  return {
    id: 42,
    userId: null,
    email: 'placeholder@example.com',
    applicationType: 'sitter',
    status: 'pending',
    rejectionReason: null,
    submittedAt: new Date('2026-08-01T00:00:00Z'),
    reviewedAt: null,
    approvedAt: null,
    // Sensitive / internal — the projection MUST strip these:
    dateOfBirth: '1990-01-01',
    address: '1 Main St',
    taxId: 'IL-999-999-999',
    bankAccountName: 'Me',
    bankAccountNumber: '00-000-0000000',
    bankRoutingNumber: '123456',
    notes: 'internal note',
    reviewerNotes: 'reviewer said no',
    fraudRiskScore: 42,
    criminalRecord: 'confidential',
    references: 'private ref list',
    formData: { secret: 'stuff' },
    ...overrides,
  };
}

beforeEach(() => {
  state.caller = null;
  state.rows = [];
});

// ─────────────────────────────────────────────────────────────────────────
// Runtime cases
// ─────────────────────────────────────────────────────────────────────────
describe('PR-AUTH-FIX-STAFFPENDING-DEADEND — behavioral GET /api/staff/applications/mine', () => {
  it('1. AUTHENTICATED UID MATCH — caller receives their own row even if row.email differs', async () => {
    state.caller = { uid: ME_UID, email: ME_EMAIL, emailVerified: true };
    state.rows = [baseRow({ id: 100, userId: ME_UID, email: 'legacy-different@example.com', status: 'under_review' })];
    const res = await request(app).get('/api/staff/applications/mine');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.application).not.toBeNull();
    expect(res.body.application.id).toBe(100);
    expect(res.body.application.status).toBe('under_review');
  });

  it('2. VERIFIED EMAIL FALLBACK — pre-signup row (userId=null) matches by email regardless of case', async () => {
    state.caller = { uid: ME_UID, email: 'Me@Example.COM', emailVerified: true }; // caller uses mixed case
    state.rows = [baseRow({ id: 200, userId: null, email: 'ME@example.com', status: 'pending' })]; // stored differently
    const res = await request(app).get('/api/staff/applications/mine');
    expect(res.status).toBe(200);
    expect(res.body.application).not.toBeNull();
    expect(res.body.application.id).toBe(200);
  });

  it('2b. VERIFIED EMAIL FALLBACK — legacy userId (different from caller) with matching email still works', async () => {
    // Real-world case: application submitted under a legacy userId, then
    // the user signs up again with a fresh Firebase account under the
    // same verified email. Email fallback reconnects them.
    state.caller = { uid: ME_UID, email: ME_EMAIL, emailVerified: true };
    state.rows = [baseRow({ id: 201, userId: 'legacy_uid_from_before', email: ME_EMAIL })];
    const res = await request(app).get('/api/staff/applications/mine');
    expect(res.status).toBe(200);
    expect(res.body.application).not.toBeNull();
    expect(res.body.application.id).toBe(201);
  });

  it('3. UNVERIFIED EMAIL MUST NOT FALL BACK — squatting sign-up cannot read pre-signup application', async () => {
    // Attacker registers an unverified Firebase account matching the
    // victim's email. Row belongs to a different uid but same email.
    state.caller = { uid: 'squatter_uid', email: ME_EMAIL, emailVerified: false };
    state.rows = [baseRow({ id: 300, userId: OTHER_UID, email: ME_EMAIL })];
    const res = await request(app).get('/api/staff/applications/mine');
    expect(res.status).toBe(200);
    expect(res.body.application).toBeNull();
  });

  it('3b. UNVERIFIED EMAIL MUST NOT FALL BACK — even a pre-signup (null userId) application stays hidden', async () => {
    state.caller = { uid: 'squatter_uid', email: ME_EMAIL, emailVerified: false };
    state.rows = [baseRow({ id: 301, userId: null, email: ME_EMAIL })];
    const res = await request(app).get('/api/staff/applications/mine');
    expect(res.status).toBe(200);
    expect(res.body.application).toBeNull();
  });

  it('4. CROSS-USER LEAK GUARD — row belongs to another uid AND another email returns null', async () => {
    state.caller = { uid: ME_UID, email: ME_EMAIL, emailVerified: true };
    state.rows = [baseRow({ id: 400, userId: OTHER_UID, email: OTHER_EMAIL })];
    const res = await request(app).get('/api/staff/applications/mine');
    expect(res.status).toBe(200);
    expect(res.body.application).toBeNull();
  });

  it('5. RESPONSE PROJECTION — sensitive/internal fields are stripped', async () => {
    state.caller = { uid: ME_UID, email: ME_EMAIL, emailVerified: true };
    // Row carries the whole reviewer-listed set of forbidden fields.
    state.rows = [baseRow({ id: 500, userId: ME_UID, status: 'approved', approvedAt: new Date('2026-08-10T00:00:00Z') })];
    const res = await request(app).get('/api/staff/applications/mine');
    expect(res.status).toBe(200);
    expect(res.body.application).not.toBeNull();

    // Positive: exactly the 7 allowed fields (no more, no fewer)
    const allowed = new Set([
      'id',
      'applicationType',
      'status',
      'rejectionReason',
      'submittedAt',
      'reviewedAt',
      'approvedAt',
    ]);
    const returnedKeys = Object.keys(res.body.application);
    expect(new Set(returnedKeys)).toEqual(allowed);

    // Negative: every forbidden field is absent
    const forbidden = [
      'dateOfBirth',
      'address',
      'taxId',
      'bankAccountName',
      'bankAccountNumber',
      'bankRoutingNumber',
      'notes',
      'reviewerNotes',
      'fraudRiskScore',
      'criminalRecord',
      'references',
      'formData',
      'userId',
      'email',
    ];
    for (const f of forbidden) {
      expect(res.body.application).not.toHaveProperty(f);
    }
  });

  it('6. NO IDENTITY OVERRIDE — query/body claiming to be another user is ignored', async () => {
    // Only the row belonging to the ACTUAL authenticated caller should
    // be returned, no matter what the caller sends in body / query.
    state.caller = { uid: ME_UID, email: ME_EMAIL, emailVerified: true };
    state.rows = [
      baseRow({ id: 600, userId: ME_UID, email: ME_EMAIL, status: 'pending' }),
      baseRow({ id: 601, userId: OTHER_UID, email: OTHER_EMAIL, status: 'approved' }),
    ];
    const res = await request(app)
      .get('/api/staff/applications/mine')
      .query({ userId: OTHER_UID, email: OTHER_EMAIL, uid: OTHER_UID })
      .set('X-Test-Bearer-Claim-UID', OTHER_UID) // arbitrary header — must not affect ownership
      .send({ userId: OTHER_UID, email: OTHER_EMAIL });
    expect(res.status).toBe(200);
    expect(res.body.application).not.toBeNull();
    expect(res.body.application.id).toBe(600); // NOT 601
    expect(res.body.application.status).toBe('pending');
  });

  it('7. shape contract — response is { success, application } (null when no owned row)', async () => {
    state.caller = { uid: ME_UID, email: ME_EMAIL, emailVerified: true };
    state.rows = []; // caller has no application
    const res = await request(app).get('/api/staff/applications/mine');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, application: null });
  });
});

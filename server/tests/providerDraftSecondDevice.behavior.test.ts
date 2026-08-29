/**
 * CEO FLY MODE II §31 (2026-08-29) — server-side provider-draft
 * second-device behavioural test.
 *
 * A Playwright E2E already exercises the two-device UX
 * (tests/e2e/provider-second-device.e2e.spec.ts). This suite covers
 * the same invariants at the server unit level, DB-mocked so the
 * test is deterministic and does not require a running app.
 *
 * Scenarios (CEO §31 wording — "server-side test"):
 *   1. Device A does POST /draft with no prior row → INSERT (action:'created').
 *   2. Device B does POST /draft with the SAME userId + extended fields
 *      → UPDATE the same row (action:'updated'), never a second INSERT.
 *   3. Device B does GET /draft after A's save → hydrates every field A wrote.
 *   4. Device B GET returns { draft: null } when the applicant has moved
 *      past 'draft' (submitted/approved) — no partial state resurfaces.
 *   5. POST /draft refuses (409) when the applicant already has a
 *      non-draft (live) application.
 *   6. requireAuth: no firebaseUser → 401.
 *   7. Draft payload preserves draftStep2Step3 (step-2/3 blob), which is
 *      the exact round-trip §31 promises for a mid-form device swap.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db', () => {
  const chain: any = {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve([])),
    orderBy: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    values: vi.fn(() => chain),
    returning: vi.fn(() => Promise.resolve([])),
    update: vi.fn(() => chain),
    set: vi.fn(() => chain),
  };
  return { db: chain };
});

vi.mock('../../shared/schema-enterprise', () => ({
  providerApplicants: {
    id:                'pa.id',
    userId:            'pa.user_id',
    status:            'pa.status',
    firstName:         'pa.first_name',
    lastName:          'pa.last_name',
    email:             'pa.email',
    phoneNumber:       'pa.phone_number',
    dateOfBirth:       'pa.date_of_birth',
    streetAddress:     'pa.street_address',
    city:              'pa.city',
    postalCode:        'pa.postal_code',
    countryCode:       'pa.country_code',
    serviceTypes:      'pa.service_types',
    biography:         'pa.biography',
    yearsExperience:   'pa.years_experience',
    languages:         'pa.languages',
    serviceRadius:     'pa.service_radius',
    maxPetsAtOnce:     'pa.max_pets_at_once',
    petTypesAccepted:  'pa.pet_types_accepted',
    hasOwnVehicle:     'pa.has_own_vehicle',
    hasHomeSpace:      'pa.has_home_space',
    emergencyContactName:     'pa.emergency_contact_name',
    emergencyContactPhone:    'pa.emergency_contact_phone',
    emergencyContactRelation: 'pa.emergency_contact_relation',
    draftStep2Step3:   'pa.draft_step2_step3',
    lastUpdatedAt:     'pa.last_updated_at',
    stage:             'pa.stage',
  },
  providerApplications: {
    id: 'p2.id',
    userId: 'p2.user_id',
    status: 'p2.status',
    applicationId: 'p2.application_id',
    firstName: 'p2.first_name',
    lastName: 'p2.last_name',
    providerType: 'p2.provider_type',
    submittedAt: 'p2.submitted_at',
    rejectionReason: 'p2.rejection_reason',
    createdAt: 'p2.created_at',
    updatedAt: 'p2.updated_at',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: (a: any, b: any) => ({ __eq: [a, b] }),
  and: (...args: any[]) => ({ __and: args }),
  desc: (a: any) => a,
  or: (...args: any[]) => ({ __or: args }),
  inArray: (a: any, b: any) => ({ __inArray: [a, b] }),
  isNull: (a: any) => ({ __isNull: a }),
  gte: (a: any, b: any) => ({ __gte: [a, b] }),
  lte: (a: any, b: any) => ({ __lte: [a, b] }),
  sql: (strings: TemplateStringsArray) => ({ __sql: strings.raw.join('?') }),
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import router from '../routes/provider-applications';
import { db } from '../db';

function makeReq(overrides: any = {}) {
  return {
    firebaseUser: overrides.firebaseUser ?? { uid: 'test-uid' },
    body: overrides.body ?? {},
    params: overrides.params ?? {},
    query: overrides.query ?? {},
    headers: {},
    ...overrides,
  };
}

function makeRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) { this.statusCode = code; return this; },
    json(payload: any) { this.body = payload; return this; },
    send(payload: any) { this.body = payload; return this; },
  };
  return res;
}

function findRoute(method: string, path: string): Function[] {
  const layer = (router as any).stack.find(
    (l: any) => l.route?.path === path && l.route?.methods[method.toLowerCase()],
  );
  if (!layer) throw new Error(`route not found: ${method} ${path}`);
  return layer.route.stack.map((s: any) => s.handle);
}

async function run(handlers: Function[], req: any, res: any) {
  for (const h of handlers) {
    let called = false;
    const next = () => { called = true; };
    // eslint-disable-next-line no-await-in-loop
    await h(req, res, next);
    if (!called) return;
  }
}

/** Stage a sequence of thenable-chain reads / inserts / updates. */
function stage(...stages: Array<{ kind: 'read' | 'insert' | 'update'; rows?: any[]; capture?: (v: any) => void; throw?: boolean }>) {
  let idx = 0;
  const nextRead = () => {
    const s = stages[idx];
    if (!s || s.kind !== 'read') return { rows: [] };
    idx++;
    return s;
  };
  const nextInsert = () => {
    const s = stages[idx];
    if (!s || s.kind !== 'insert') return { rows: [] };
    idx++;
    return s;
  };
  const nextUpdate = () => {
    const s = stages[idx];
    if (!s || s.kind !== 'update') return { rows: [] };
    idx++;
    return s;
  };

  (db as any).select.mockImplementation(() => {
    const s = nextRead();
    const chain: any = {
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      then: (onF: any) => Promise.resolve(s.rows ?? []).then(onF),
    };
    return chain;
  });

  (db as any).insert.mockImplementation(() => {
    const s = nextInsert();
    const chain: any = {
      values: (v: any) => { s.capture?.(v); return chain; },
      returning: () => Promise.resolve(s.rows ?? []),
      then: (onF: any) => Promise.resolve(s.rows ?? []).then(onF),
    };
    return chain;
  });

  (db as any).update.mockImplementation(() => {
    const s = nextUpdate();
    const chain: any = {
      set: (v: any) => { s.capture?.(v); return chain; },
      where: () => chain,
      then: (onF: any) => Promise.resolve(s.rows ?? []).then(onF),
    };
    return chain;
  });
}

describe('CEO FLY MODE II §31 — provider draft second-device server-side', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('1. Device A first save → INSERT with action:"created"-shape', async () => {
    let inserted: any = null;
    stage(
      { kind: 'read', rows: [] }, // no existing applicant
      { kind: 'insert', rows: [{ id: 42 }], capture: (v) => { inserted = v; } },
    );
    const req = makeReq({
      firebaseUser: { uid: 'device-a-uid' },
      body: {
        firstName: 'Alex',
        lastName:  'Ali',
        email:     'alex@x.com',
        phoneNumber: '+972501234567',
        streetAddress: '1 King George',
        city: 'Tel Aviv',
        country: 'IL',
        serviceTypes: ['pet_sitting'],
      },
    });
    const res = makeRes();
    await run(findRoute('post', '/draft'), req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(res.body?.action).toBe('created');
    // The write went with status='draft'.
    expect(inserted?.userId).toBe('device-a-uid');
    expect(inserted?.status).toBe('draft');
  });

  it('2. Device B second save with same uid → UPDATE (never a second INSERT)', async () => {
    let updated: any = null;
    stage(
      { kind: 'read', rows: [{ id: 42, status: 'draft' }] },
      { kind: 'update', rows: [{ id: 42 }], capture: (v) => { updated = v; } },
    );
    const req = makeReq({
      firebaseUser: { uid: 'device-a-uid' },
      body: {
        // Device B adds fields A hadn't filled yet.
        biography: 'I love pets.',
        yearsExperience: 3,
        languages: ['en', 'he'],
      },
    });
    const res = makeRes();
    await run(findRoute('post', '/draft'), req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(res.body?.action).toBe('updated');
    expect(res.body?.applicationId).toBe(42);
    // The db.insert path was NEVER touched — same-uid device-B save
    // must not race in a duplicate row.
    expect((db as any).insert).not.toHaveBeenCalled();
    // The captured update payload includes the new fields.
    expect(updated?.biography).toBe('I love pets.');
    expect(updated?.yearsExperience).toBe(3);
    expect(updated?.languages).toEqual(['en', 'he']);
  });

  it('3. Device B GET /draft after A\'s save → hydrates the row A wrote', async () => {
    stage({
      kind: 'read',
      rows: [{
        id: 42,
        status: 'draft',
        firstName: 'Alex',
        lastName: 'Ali',
        phoneNumber: '+972501234567',
        dateOfBirth: '1990-01-01',
        streetAddress: '1 King George',
        city: 'Tel Aviv',
        postalCode: '6000000',
        countryCode: 'IL',
        draftStep2Step3: { hasInsurance: true },
        updatedAt: new Date('2026-08-29T00:00:00Z'),
      }],
    });
    const req = makeReq({ firebaseUser: { uid: 'device-a-uid' } });
    const res = makeRes();
    await run(findRoute('get', '/draft'), req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body?.draft?.firstName).toBe('Alex');
    expect(res.body?.draft?.city).toBe('Tel Aviv');
    expect(res.body?.draft?.country).toBe('IL');
    expect(res.body?.draft?.dateOfBirth).toBe('1990-01-01');
  });

  it('4. GET /draft returns null when applicant has moved past draft (no partial leak)', async () => {
    stage({
      kind: 'read',
      rows: [{ id: 42, status: 'pending_review', firstName: 'Alex' }],
    });
    const req = makeReq({ firebaseUser: { uid: 'device-a-uid' } });
    const res = makeRes();
    await run(findRoute('get', '/draft'), req, res);
    expect(res.body?.draft).toBeNull();
  });

  it('5. POST /draft refuses (409) when applicant has a non-draft live row', async () => {
    stage({ kind: 'read', rows: [{ id: 42, status: 'approved' }] });
    const req = makeReq({
      firebaseUser: { uid: 'device-a-uid' },
      body: { firstName: 'Alex' },
    });
    const res = makeRes();
    await run(findRoute('post', '/draft'), req, res);
    expect(res.statusCode).toBe(409);
    expect(res.body?.status).toBe('approved');
    // No insert / update happened on the approved row.
    expect((db as any).insert).not.toHaveBeenCalled();
    expect((db as any).update).not.toHaveBeenCalled();
  });

  it('6. Unauthenticated → 401 on both /draft handlers', async () => {
    // POST
    const postReq = makeReq({ firebaseUser: undefined, body: { firstName: 'X' } });
    const postRes = makeRes();
    await run(findRoute('post', '/draft'), postReq, postRes);
    expect(postRes.statusCode).toBe(401);
    // GET
    const getReq = makeReq({ firebaseUser: undefined });
    const getRes = makeRes();
    await run(findRoute('get', '/draft'), getReq, getRes);
    expect(getRes.statusCode).toBe(401);
  });

  it('7. draftStep2Step3 round-trips faithfully device-A → device-B', async () => {
    // Device A writes an opaque step-2/3 blob.
    let captured: any = null;
    stage(
      { kind: 'read', rows: [{ id: 42, status: 'draft' }] },
      { kind: 'update', rows: [{ id: 42 }], capture: (v) => { captured = v; } },
    );
    const blob = {
      insurance: { hasInsurance: true, provider: 'MegaSafe' },
      firstAid:  { holdsFirstAid: true, expiresOn: '2027-01-01' },
      declarations: { criminalHistory: false },
    };
    const req = makeReq({
      firebaseUser: { uid: 'device-a-uid' },
      body: { draftStep2Step3: blob },
    });
    const res = makeRes();
    await run(findRoute('post', '/draft'), req, res);
    expect(res.statusCode).toBe(200);
    expect(captured?.draftStep2Step3).toEqual(blob);
  });
});

/**
 * CEO FLY MODE II §PR-2174 (2026-08-29) — chat-history authorisation
 * behavioural tests.
 *
 * PR #2174 renames `'superadmin'` → `'super_admin'` on three lines
 * (server/routes/chat-history.ts:47, :59, :136) so the role string
 * matches the canonical name used everywhere else in the codebase
 * (see e.g. server/middleware/rbac.ts, mode picker, admin promotion).
 * The rename alone doesn't prove behaviour — this suite pins the five
 * CEO-listed scenarios:
 *
 *   1. super_admin CAN access an admin conversation operation.
 *   2. admin CAN access the same.
 *   3. ordinary user CANNOT access another user's conversation.
 *   4. franchise-scoped user CANNOT cross a franchise boundary.
 *   5. unauthenticated user is rejected (401 from the auth middleware).
 *
 * We drive the exported route handlers directly with a stubbed
 * request/response so the tests are deterministic and don't need
 * Firebase / DB up.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock heavy deps BEFORE importing the module under test ─────────────
vi.mock('../db', () => {
  const chain: any = {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve([])),
    orderBy: vi.fn(() => chain),
    offset: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    values: vi.fn(() => chain),
    returning: vi.fn(() => Promise.resolve([])),
    update: vi.fn(() => chain),
    set: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
  };
  return { db: chain };
});

vi.mock('@shared/schema-chat', () => ({
  chatConversations: {
    conversationId: 'cc.conversationId',
    userId: 'cc.userId',
    franchiseId: 'cc.franchiseId',
    status: 'cc.status',
    lastMessageAt: 'cc.lastMessageAt',
    stationId: 'cc.stationId',
    deletedAt: 'cc.deletedAt',
    deletedBy: 'cc.deletedBy',
    updatedAt: 'cc.updatedAt',
  },
  chatMessages: {
    messageId: 'cm.messageId',
    conversationId: 'cm.conversationId',
    createdAt: 'cm.createdAt',
    content: 'cm.content',
    readAt: 'cm.readAt',
    updatedAt: 'cm.updatedAt',
  },
  chatAttachments: {
    conversationId: 'ca.conversationId',
    messageId: 'ca.messageId',
    createdAt: 'ca.createdAt',
  },
  chatAnalytics: {
    conversationId: 'cn.conversationId',
    eventType: 'cn.eventType',
    timestamp: 'cn.timestamp',
  },
  insertChatConversationSchema: { parse: (v: any) => v },
  insertChatMessageSchema: { parse: (v: any) => v },
  insertChatAttachmentSchema: { parse: (v: any) => v },
  insertChatAnalyticsSchema: { parse: (v: any) => v },
}));

vi.mock('drizzle-orm', () => ({
  eq: (a: any, b: any) => ({ __eq: [a, b] }),
  desc: (a: any) => a,
  and: (...args: any[]) => ({ __and: args }),
  gte: (a: any, b: any) => ({ __gte: [a, b] }),
  lte: (a: any, b: any) => ({ __lte: [a, b] }),
  like: (a: any, b: any) => ({ __like: [a, b] }),
  or: (...args: any[]) => ({ __or: args }),
}));

vi.mock('nanoid', () => ({ nanoid: () => 'test-nanoid' }));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// The auth middleware calls validateFirebaseToken — stub it to inject
// whatever req.user the test sets on the fake request object.
vi.mock('../middleware/firebase-auth', () => ({
  validateFirebaseToken: async (req: any, _res: any, next: any) => {
    // A shim: the outer test attaches req.__preAuthUser before calling
    // requireAuth. If nothing was attached, treat as unauthenticated —
    // return 401 without calling next().
    if (req.__preAuthUser) {
      req.user = req.__preAuthUser;
      return next();
    }
    // Match production behaviour: no user → 401.
    if (typeof _res?.status === 'function') {
      _res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }
    throw new Error('unauth');
  },
}));

import router from '../routes/chat-history';
import { db } from '../db';

function makeReq(overrides: any = {}) {
  return {
    __preAuthUser: overrides.user ?? null,
    params: overrides.params ?? {},
    query: overrides.query ?? {},
    body: overrides.body ?? {},
    headers: overrides.headers ?? {},
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

// Route resolver: pull a handler chain off the router by method+path.
function findRoute(method: string, path: string): Function[] {
  const layer = (router as any).stack.find(
    (l: any) => l.route?.path === path && l.route?.methods[method.toLowerCase()],
  );
  if (!layer) throw new Error(`route not found: ${method} ${path}`);
  return layer.route.stack.map((s: any) => s.handle);
}

// Run a handler chain sequentially like Express does. Any handler that
// writes a response short-circuits.
async function run(handlers: Function[], req: any, res: any) {
  for (const h of handlers) {
    let called = false;
    const next = () => { called = true; };
    // eslint-disable-next-line no-await-in-loop
    await h(req, res, next);
    if (!called) return; // response written (or 401 returned)
  }
}

/**
 * Stage a sequence of db reads.
 */
function stageReads(...rows: any[][]) {
  let idx = 0;
  (db as any).select.mockImplementation(() => {
    const stage = rows[idx++] ?? [];
    // Thenable chain — every method returns `chain`, and `then`
    // resolves to the staged rows. This lets the source code await
    // whichever method it happens to terminate on (.limit or .offset).
    const chain: any = {
      from: () => chain,
      where: () => chain,
      limit: () => chain,
      orderBy: () => chain,
      offset: () => chain,
      innerJoin: () => chain,
      then: (onFulfilled: any) => Promise.resolve(stage).then(onFulfilled),
    };
    return chain;
  });
}

describe('CEO FLY MODE II §PR-2174 — chat-history authz', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. super_admin CAN access an admin-owned conversation operation', async () => {
    stageReads([
      { conversationId: 'c-1', userId: 'someone-else', franchiseId: 42 },
    ]);
    const req = makeReq({
      user: { uid: 'sa-uid', role: 'super_admin' },
      params: { conversationId: 'c-1' },
    });
    const res = makeRes();
    await run(findRoute('get', '/conversations/:conversationId'), req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.conversation?.conversationId).toBe('c-1');
  });

  it('2. admin CAN access another user\'s conversation', async () => {
    stageReads([
      { conversationId: 'c-2', userId: 'customer-uid', franchiseId: 7 },
    ]);
    const req = makeReq({
      user: { uid: 'admin-uid', role: 'admin' },
      params: { conversationId: 'c-2' },
    });
    const res = makeRes();
    await run(findRoute('get', '/conversations/:conversationId'), req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body?.success).toBe(true);
  });

  it('3. ordinary user CANNOT access another user\'s conversation (403)', async () => {
    stageReads([
      { conversationId: 'c-3', userId: 'other-customer', franchiseId: null },
    ]);
    const req = makeReq({
      user: { uid: 'me', role: 'customer' },
      params: { conversationId: 'c-3' },
    });
    const res = makeRes();
    await run(findRoute('get', '/conversations/:conversationId'), req, res);
    expect(res.statusCode).toBe(403);
    expect(res.body?.success).toBe(false);
  });

  it('4. franchise-scoped user CANNOT cross a franchise boundary (403)', async () => {
    stageReads([
      { conversationId: 'c-4', userId: 'x', franchiseId: 99 },
    ]);
    const req = makeReq({
      user: { uid: 'fm-uid', role: 'franchise_manager', franchiseId: 42 },
      params: { conversationId: 'c-4' },
    });
    const res = makeRes();
    await run(findRoute('get', '/conversations/:conversationId'), req, res);
    expect(res.statusCode).toBe(403);
    expect(res.body?.success).toBe(false);
  });

  it('5. unauthenticated user is rejected (401 from requireAuth)', async () => {
    const req = makeReq({
      user: null,
      params: { conversationId: 'c-5' },
    });
    const res = makeRes();
    await run(findRoute('get', '/conversations/:conversationId'), req, res);
    expect(res.statusCode).toBe(401);
    expect(res.body?.success).toBe(false);
  });

  // ── Regression pins for the specific rename fix ──────────────────────

  it('PR-2174 regression — `superadmin` (no underscore) is no longer treated as privileged', async () => {
    // A user whose role string is the OLD spelling must be handled as
    // an ordinary user — accessing another user's conversation → 403.
    stageReads([
      { conversationId: 'c-old', userId: 'someone-else', franchiseId: null },
    ]);
    const req = makeReq({
      user: { uid: 'legacy-uid', role: 'superadmin' },
      params: { conversationId: 'c-old' },
    });
    const res = makeRes();
    await run(findRoute('get', '/conversations/:conversationId'), req, res);
    expect(res.statusCode).toBe(403);
  });

  it('PR-2174 regression — same rename fixed in the requireAdmin gate', async () => {
    // /conversations/franchise/:franchiseId gates via
    //   `role !== 'admin' && role !== 'super_admin'` — a super_admin
    // hitting a franchise they DO NOT belong to must still succeed.
    stageReads([]);  // franchise conversations list — empty is fine
    const req = makeReq({
      user: { uid: 'sa', role: 'super_admin', franchiseId: 1 },
      params: { franchiseId: '999' },
    });
    const res = makeRes();
    await run(findRoute('get', '/conversations/franchise/:franchiseId'), req, res);
    expect(res.statusCode).toBe(200);
  });
});

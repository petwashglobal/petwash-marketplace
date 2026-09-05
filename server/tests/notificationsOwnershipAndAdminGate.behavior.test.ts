/**
 * Behavioural test — server/routes/notifications.ts
 * (cross-tenant / IDOR sweep, 2026-09-05).
 *
 * Two P0s fixed in this file:
 *
 *   1. POST /api/notifications/send required only requireAuth (any logged-in
 *      user), while every sibling management route (templates/logs/stats)
 *      was requireAdmin. It let ANY authenticated user trigger a real
 *      email/SMS/WhatsApp/push send to an arbitrary userId/email/phone with
 *      arbitrary template variables — a paid-channel spam/impersonation
 *      vector. Now requireAdmin.
 *
 *   2. POST /api/notifications/:logId/read updated notification_logs by `id`
 *      ALONE — no predicate tying the row to the caller. Any authenticated
 *      user could mark ANY other user's notification as read by walking
 *      small integer ids. Now the WHERE also requires
 *      recipientUserId = caller uid, and a non-owned/nonexistent id both
 *      return the same 404 (no existence oracle).
 *
 * Real supertest against the router mounted in a fresh express app; auth
 * middleware, the DB, and drizzle's eq/and are faked with a tiny in-memory
 * evaluator so the WHERE-clause behaviour is actually exercised, not just
 * grepped for.
 */
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Auth middleware fakes ──────────────────────────────────────────────────
let injectUid: string | null = null;
let injectIsAdmin = false;

vi.mock('../customAuth', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!injectUid) return res.status(401).json({ message: 'Authentication required' });
    req.user = { uid: injectUid };
    return next();
  },
}));

vi.mock('../adminAuth', () => ({
  requireAdmin: (req: any, res: any, next: any) => {
    if (!injectUid) return res.status(401).json({ message: 'Authentication required' });
    if (!injectIsAdmin) return res.status(403).json({ message: 'Admin access required' });
    req.user = { uid: injectUid };
    return next();
  },
}));

vi.mock('../services/NotificationService', () => ({
  default: {
    sendNotification: vi.fn(async () => ({ success: true, logIds: [999], errors: [] })),
    getNotificationLogs: vi.fn(async () => []),
  },
}));

// ── drizzle-orm: real module, but eq/and become simple, evaluable markers ──
vi.mock('drizzle-orm', () => ({
  eq: (field: string, value: any) => ({ __op: 'eq', field, value }),
  and: (...conds: any[]) => ({ __op: 'and', conds }),
  count: () => ({ __op: 'count' }),
  desc: (field: string) => ({ __op: 'desc', field }),
}));

vi.mock('@shared/schema', () => ({
  notificationLogs: {
    id: 'id',
    recipientUserId: 'recipientUserId',
    isRead: 'isRead',
    readAt: 'readAt',
    channel: 'channel',
  },
  insertNotificationTemplateSchema: { parse: (x: any) => x },
}));

// ── Fake DB: in-memory rows + a predicate evaluator for eq/and markers ─────
let rows: Array<{ id: number; recipientUserId: string; isRead: boolean; readAt: Date | null }> = [];

function evalCond(cond: any, row: any): boolean {
  if (!cond) return true;
  if (cond.__op === 'eq') return row[cond.field] === cond.value;
  if (cond.__op === 'and') return cond.conds.every((c: any) => evalCond(c, row));
  return true;
}

vi.mock('../db', () => ({
  db: {
    update: (_table: any) => ({
      set: (setObj: any) => ({
        where: (cond: any) => ({
          returning: (projection: Record<string, string>) => {
            const matched = rows.filter((r) => evalCond(cond, r));
            matched.forEach((r) => Object.assign(r, setObj));
            return Promise.resolve(
              matched.map((r) => {
                const out: any = {};
                for (const key of Object.keys(projection)) out[key] = (r as any)[projection[key]];
                return out;
              }),
            );
          },
        }),
      }),
    }),
  },
}));

async function makeApp() {
  const app = express();
  app.use(express.json());
  const router = (await import('../routes/notifications')).default;
  app.use('/api/notifications', router);
  return app;
}

beforeEach(() => {
  injectUid = null;
  injectIsAdmin = false;
  rows = [
    { id: 1, recipientUserId: 'owner_uid', isRead: false, readAt: null },
    { id: 2, recipientUserId: 'other_uid', isRead: false, readAt: null },
  ];
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/notifications/send · admin-gated (was any authenticated user)', () => {
  it('403 for a plain authenticated (non-admin) user', async () => {
    injectUid = 'regular_user';
    injectIsAdmin = false;
    const app = await makeApp();
    const res = await request(app)
      .post('/api/notifications/send')
      .send({ templateKey: 'welcome', userId: 'some_victim' });
    expect(res.status).toBe(403);
  });

  it('401 for an anonymous caller', async () => {
    injectUid = null;
    const app = await makeApp();
    const res = await request(app)
      .post('/api/notifications/send')
      .send({ templateKey: 'welcome', userId: 'some_victim' });
    expect(res.status).toBe(401);
  });

  it('200 for an admin caller', async () => {
    injectUid = 'admin_uid';
    injectIsAdmin = true;
    const app = await makeApp();
    const res = await request(app)
      .post('/api/notifications/send')
      .send({ templateKey: 'welcome', userId: 'some_target' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('POST /api/notifications/:logId/read · ownership enforced (was id-only)', () => {
  it("marks the CALLER's own notification as read", async () => {
    injectUid = 'owner_uid';
    const app = await makeApp();
    const res = await request(app).post('/api/notifications/1/read');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(rows.find((r) => r.id === 1)!.isRead).toBe(true);
  });

  it("404s (not 200) when the id belongs to a DIFFERENT user — and does not mark it read", async () => {
    injectUid = 'owner_uid';
    const app = await makeApp();
    const res = await request(app).post('/api/notifications/2/read'); // owned by other_uid
    expect(res.status).toBe(404);
    expect(rows.find((r) => r.id === 2)!.isRead).toBe(false);
  });

  it('404s for a nonexistent id with the SAME shape as "not yours" (no existence oracle)', async () => {
    injectUid = 'owner_uid';
    const app = await makeApp();
    const notYours = await request(app).post('/api/notifications/2/read');
    const nonexistent = await request(app).post('/api/notifications/999999/read');
    expect(notYours.status).toBe(nonexistent.status);
    expect(notYours.body).toEqual(nonexistent.body);
  });

  it('401 for an anonymous caller', async () => {
    injectUid = null;
    const app = await makeApp();
    const res = await request(app).post('/api/notifications/1/read');
    expect(res.status).toBe(401);
  });
});

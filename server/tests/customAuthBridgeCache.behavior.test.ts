/**
 * customAuth.requireAuth — the Firebase→Postgres bridge runs once per uid,
 * not once per request.
 *
 * The old cache lived on req.session, which Firebase Hosting never returns
 * (only `__session` survives), so the Firestore read + customers lookup ran
 * on EVERY authenticated request. Pins: second request for the same uid
 * skips the bridge; a different uid bridges; the cache expires; and
 * req.session.customerId is still populated for same-request readers.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({
  firestoreGet: vi.fn(async () => ({ data: () => ({ email: 'a@petwash.invalid', firstName: 'A', lastName: 'B' }) })),
  getCustomerByEmail: vi.fn(async () => ({ id: 42 })),
  verifySessionCookie: vi.fn(async () => ({ uid: 'uid_a', email: 'a@petwash.invalid' })),
}));

vi.mock('../lib/sessionCookies', () => ({ verifySessionCookie: h.verifySessionCookie, SESSION_COOKIE_NAME: '__session' }));
vi.mock('../lib/firebase-admin', () => ({
  db: { collection: () => ({ doc: () => ({ get: h.firestoreGet }) }) },
  auth: { verifyIdToken: vi.fn() },
  adminAuth: { verifyIdToken: vi.fn() },
  default: {},
}));
vi.mock('../storage', () => ({ storage: { getCustomerByEmail: h.getCustomerByEmail, createCustomer: vi.fn() } }));
vi.mock('../db', () => ({ pool: {} }));
vi.mock('../lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { requireAuth, _resetBridgeCacheForTests } from '../customAuth';

function call() {
  const req: any = { headers: {}, cookies: { __session: 'cookie' }, session: {} };
  const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const next = vi.fn();
  return requireAuth(req, res, next).then(() => ({ req, res, next }));
}

describe('customAuth.requireAuth bridge cache', () => {
  beforeEach(() => {
    _resetBridgeCacheForTests();
    h.firestoreGet.mockClear(); h.getCustomerByEmail.mockClear();
    h.verifySessionCookie.mockResolvedValue({ uid: 'uid_a', email: 'a@petwash.invalid' });
    vi.useRealTimers();
  });

  it('bridges once per uid, and later requests reuse the id', async () => {
    const first = await call();
    const second = await call();
    expect(first.next).toHaveBeenCalledTimes(1);
    expect(second.next).toHaveBeenCalledTimes(1);
    expect(h.firestoreGet).toHaveBeenCalledTimes(1);
    expect(h.getCustomerByEmail).toHaveBeenCalledTimes(1);
    expect(first.req.session.customerId).toBe(42);
    expect(second.req.session.customerId).toBe(42);   // same-request readers still see it
  });

  it('a different uid is bridged on its own', async () => {
    await call();
    h.verifySessionCookie.mockResolvedValue({ uid: 'uid_b', email: 'b@petwash.invalid' });
    await call();
    expect(h.firestoreGet).toHaveBeenCalledTimes(2);
  });

  it('the cached id expires', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-09T10:00:00Z'));
    await call();
    vi.setSystemTime(new Date('2026-09-09T10:11:00Z'));   // > 10 min TTL
    await call();
    expect(h.firestoreGet).toHaveBeenCalledTimes(2);
  });

  it('never depends on req.session to remember the bridge', async () => {
    const req: any = { headers: {}, cookies: { __session: 'cookie' } };  // no session object at all
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();
    await requireAuth(req, res, next);
    await requireAuth({ ...req }, res, next);
    expect(next).toHaveBeenCalledTimes(2);
    expect(h.firestoreGet).toHaveBeenCalledTimes(1);
  });
});

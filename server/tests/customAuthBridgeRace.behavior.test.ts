/**
 * The Firebase→customer bridge must survive the first-screen race.
 *
 * 2026-09-10 07:10Z (CEO, phone sign-in): five guarded requests raced to
 * create the same customers row. Postgres rejected the duplicates (23505) —
 * but Drizzle wraps the error, `err.code` is undefined on the wrapper, and
 * the bridge's race handler never fired: "CRITICAL: Failed to bridge" → 500.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isUniqueViolation, pgErrorCode } from '../lib/dbErrors';

const h = vi.hoisted(() => ({
  firestoreGet: vi.fn(async () => ({ data: () => ({ email: 'race@petwash.invalid' }) })),
  getCustomerByEmail: vi.fn(),
  createCustomer: vi.fn(),
  verifySessionCookie: vi.fn(async () => ({ uid: 'uid_race', email: 'race@petwash.invalid' })),
}));
vi.mock('../lib/sessionCookies', () => ({ verifySessionCookie: h.verifySessionCookie, SESSION_COOKIE_NAME: '__session' }));
vi.mock('../lib/firebase-admin', () => ({ db: { collection: () => ({ doc: () => ({ get: h.firestoreGet }) }) }, auth: { verifyIdToken: vi.fn() }, adminAuth: { verifyIdToken: vi.fn() }, default: {} }));
vi.mock('../storage', () => ({ storage: { getCustomerByEmail: h.getCustomerByEmail, createCustomer: h.createCustomer } }));
vi.mock('../db', () => ({ pool: {} }));
vi.mock('../lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('bcrypt', () => ({ default: { hash: async () => 'hashed' } }));

import { requireAuth, _resetBridgeCacheForTests } from '../customAuth';

function drizzleWrapped(code: string, detail: string) {
  const cause: any = new Error(detail); cause.code = code;
  const err: any = new Error('Failed query: insert into "customers" ("id", "first_name", …) values (…)');
  err.cause = cause;
  return err;
}

describe('dbErrors', () => {
  it('reads the pg code through the Drizzle wrapper', () => {
    expect(pgErrorCode(drizzleWrapped('23505', 'duplicate key value violates unique constraint "customers_email_unique"'))).toBe('23505');
    expect(isUniqueViolation(drizzleWrapped('23505', 'dup'))).toBe(true);
    expect(isUniqueViolation(drizzleWrapped('23502', 'null value'))).toBe(false);
    expect(isUniqueViolation(new Error('random'))).toBe(false);
  });
});

describe('customAuth bridge under a duplicate-row race', () => {
  beforeEach(() => { _resetBridgeCacheForTests(); h.getCustomerByEmail.mockReset(); h.createCustomer.mockReset(); });

  it('a Drizzle-wrapped 23505 is treated as "someone else created it" — re-lookup, no 500', async () => {
    h.getCustomerByEmail.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 77 });
    h.createCustomer.mockRejectedValueOnce(drizzleWrapped('23505', 'duplicate key value violates unique constraint "customers_email_unique"'));
    const req: any = { headers: {}, cookies: { __session: 'c' }, session: {} };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();
    await requireAuth(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(req.session.customerId).toBe(77);
  });

  it('a genuine insert failure still fails the request', async () => {
    h.getCustomerByEmail.mockResolvedValue(null);
    h.createCustomer.mockRejectedValueOnce(drizzleWrapped('23502', 'null value in column "first_name"'));
    const req: any = { headers: {}, cookies: { __session: 'c' }, session: {} };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();
    await requireAuth(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

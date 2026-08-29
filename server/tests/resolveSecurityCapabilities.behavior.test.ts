/**
 * CEO FLY MODE II §1–§3 (2026-08-29) — behavioural tests for the
 * tri-state security capability resolver.
 *
 * The old hasAdminOrStaffCapability() → getUserCapabilities()
 * indirection swallowed every DB error and defaulted to
 * admin=false. This meant `onError:true` was a fiction: a
 * capability-DB outage silently returned false, MFA gates
 * concluded "no MFA required", and a stale-claim admin walked
 * through.
 *
 * These tests pin the NEW contract:
 *   • Resolved + privileged → true
 *   • Resolved + ordinary  → false
 *   • Unavailable          → opts.onError (fail-CLOSED / fail-DENY per gate)
 * and lock the three individual DB-failure branches so a refactor
 * cannot re-introduce swallow-then-default.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db', () => {
  const chain: any = {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve([])),
  };
  return { db: chain };
});

vi.mock('../../shared/schema', () => ({
  users: { id: 'users.id', email: 'users.email', emailVerified: 'users.emailVerified', phoneVerified: 'users.phoneVerified' },
  providerApplications: { userId: 'pa.userId', status: 'pa.status' },
  staffAccessRequests: { userId: 'sar.userId', status: 'sar.status' },
  adminUsers: { id: 'au.id', email: 'au.email' },
  privilegeMembers: { email: 'pm.email', memberId: 'pm.memberId', tier: 'pm.tier', status: 'pm.status' },
}));

vi.mock('../../shared/schema-provider-services', () => ({
  providerServices: { providerId: 'ps.providerId', serviceType: 'ps.serviceType', serviceStatus: 'ps.serviceStatus' },
}));

vi.mock('drizzle-orm', () => ({
  and: (...args: any[]) => ({ __and: args }),
  eq: (a: any, b: any) => ({ __eq: [a, b] }),
  inArray: (a: any, b: any) => ({ __inArray: [a, b] }),
}));

vi.mock('./logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

// The module under test — imported AFTER vi.mock() calls above.
import {
  hasAdminOrStaffCapability,
  resolveSecurityCapabilities,
} from '../lib/userCapabilities';
import { db } from '../db';

// Helper — stage one full walk of the resolver's 4 lookups
// (user row, admin row, staff row; super-admin allowlist is
// env-driven, no DB call). Each stage is the value the final
// `.limit(1)` resolves to. `throw:true` makes that stage reject.
type Stage = { rows?: any[]; throw?: boolean };
function stageQueries(...stages: Stage[]) {
  let call = 0;
  (db as any).select.mockImplementation(() => {
    const stage = stages[call++] ?? { rows: [] };
    const chain: any = {
      from: () => chain,
      where: () => chain,
      limit: () => (stage.throw ? Promise.reject(new Error('mock db failure')) : Promise.resolve(stage.rows ?? [])),
    };
    return chain;
  });
}

describe('CEO FLY MODE II §1 — resolveSecurityCapabilities tri-state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SUPER_ADMIN_EMAILS;
  });

  it('MISSING_UID branch — undefined uid resolves to ok:false MISSING_UID', async () => {
    const res = await resolveSecurityCapabilities(undefined);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('MISSING_UID');
  });

  it('resolved + ordinary user → ok:true with admin=false + staff.active=false', async () => {
    stageQueries(
      { rows: [{ email: 'x@x.com', emailVerified: true, phoneVerified: true }] },  // user row
      { rows: [] },  // admin row — none
      { rows: [{ status: 'pending' }] },  // staff row — pending, not approved
    );
    const res = await resolveSecurityCapabilities('uid-1');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.capabilities.admin.admin).toBe(false);
      expect(res.capabilities.staff.active).toBe(false);
    }
  });

  it('resolved + admin row present → admin.admin=true', async () => {
    stageQueries(
      { rows: [{ email: 'admin@petwash.co.il', emailVerified: true, phoneVerified: true }] },
      { rows: [{ id: 42 }] },
      { rows: [] },
    );
    const res = await resolveSecurityCapabilities('uid-2');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.capabilities.admin.admin).toBe(true);
  });

  it('resolved + super-admin allowlist match → admin.admin=true', async () => {
    process.env.SUPER_ADMIN_EMAILS = 'ceo@petwash.co.il,other@x.com';
    stageQueries(
      { rows: [{ email: 'ceo@petwash.co.il', emailVerified: true, phoneVerified: true }] },
      { rows: [] },
      { rows: [] },
    );
    const res = await resolveSecurityCapabilities('uid-3');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.capabilities.admin.admin).toBe(true);
  });

  it('resolved + staff approved → staff.active=true', async () => {
    stageQueries(
      { rows: [{ email: 'staff@x.com', emailVerified: true, phoneVerified: true }] },
      { rows: [] },
      { rows: [{ status: 'approved' }] },
    );
    const res = await resolveSecurityCapabilities('uid-4');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.capabilities.staff.active).toBe(true);
  });

  it('user-row DB failure → ok:false LOOKUP_FAILED (fail-CLOSED)', async () => {
    stageQueries({ throw: true });
    const res = await resolveSecurityCapabilities('uid-5');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('LOOKUP_FAILED');
  });

  it('admin-row DB failure → ok:false LOOKUP_FAILED (fail-CLOSED)', async () => {
    stageQueries(
      { rows: [{ email: 'x@x.com', emailVerified: true, phoneVerified: true }] },
      { throw: true },
    );
    const res = await resolveSecurityCapabilities('uid-6');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('LOOKUP_FAILED');
  });

  it('staff-row DB failure → ok:false LOOKUP_FAILED (fail-CLOSED)', async () => {
    stageQueries(
      { rows: [{ email: 'x@x.com', emailVerified: true, phoneVerified: true }] },
      { rows: [] },
      { throw: true },
    );
    const res = await resolveSecurityCapabilities('uid-7');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('LOOKUP_FAILED');
  });
});

describe('CEO FLY MODE II §2–§3 — hasAdminOrStaffCapability contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SUPER_ADMIN_EMAILS;
  });

  it('unavailable (DB failure) + onError:true → returns true (fail-CLOSED for MFA gate)', async () => {
    stageQueries({ throw: true });
    const out = await hasAdminOrStaffCapability('uid-a', { onError: true });
    expect(out).toBe(true);
  });

  it('unavailable (DB failure) + onError:false → returns false (fail-DENY for admin gate)', async () => {
    stageQueries({ throw: true });
    const out = await hasAdminOrStaffCapability('uid-b', { onError: false });
    expect(out).toBe(false);
  });

  it('unavailable + no opts → defaults to false', async () => {
    stageQueries({ throw: true });
    const out = await hasAdminOrStaffCapability('uid-c');
    expect(out).toBe(false);
  });

  it('missing uid + onError:true → still returns true (unauth call fails CLOSED for MFA)', async () => {
    const out = await hasAdminOrStaffCapability(null, { onError: true });
    expect(out).toBe(true);
  });

  it('resolved ordinary user → returns false regardless of onError', async () => {
    stageQueries(
      { rows: [{ email: 'ordinary@x.com', emailVerified: true, phoneVerified: true }] },
      { rows: [] },
      { rows: [] },
    );
    expect(await hasAdminOrStaffCapability('uid-d', { onError: true })).toBe(false);
    stageQueries(
      { rows: [{ email: 'ordinary@x.com', emailVerified: true, phoneVerified: true }] },
      { rows: [] },
      { rows: [] },
    );
    expect(await hasAdminOrStaffCapability('uid-d', { onError: false })).toBe(false);
  });

  it('resolved admin → returns true regardless of onError', async () => {
    stageQueries(
      { rows: [{ email: 'admin@x.com', emailVerified: true, phoneVerified: true }] },
      { rows: [{ id: 1 }] },
      { rows: [] },
    );
    expect(await hasAdminOrStaffCapability('uid-e', { onError: false })).toBe(true);
  });

  it('resolved approved staff → returns true (CEO caught: old code checked staff.approved which never existed)', async () => {
    stageQueries(
      { rows: [{ email: 'staff@x.com', emailVerified: true, phoneVerified: true }] },
      { rows: [] },
      { rows: [{ status: 'approved' }] },
    );
    expect(await hasAdminOrStaffCapability('uid-f', { onError: false })).toBe(true);
  });
});

/**
 * BEHAVIORAL test — the super-admin BYPASSES in server/middleware/gates.ts.
 *
 * gates.ts kept its own SUPER_ADMINS list, parsed independently of
 * server/middleware/rbac.ts, and every bypass cleared on the email string
 * alone. Those bypasses are the most powerful branches in the file: they
 * skip the role check, the staff-approval check, the MFA-enrolled check,
 * and the read-only-viewer write block.
 *
 * The bypasses now delegate to rbac.isSuperAdminVerified(req), so they
 * require the allowlist AND Firebase email_verified === true.
 *
 * DELIBERATELY UNCHANGED: the read-only 'viewer' role semantics. A viewer
 * still passes every read and is still blocked on every mutation — only
 * the super-admin *override* of that block was tightened.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ALLOWLISTED = 'ceo@petwash.co.il';

process.env.SUPER_ADMIN_EMAILS = ALLOWLISTED;

let gates: typeof import('../middleware/gates');
let rbac: typeof import('../middleware/rbac');

beforeEach(async () => {
  process.env.SUPER_ADMIN_EMAILS = ALLOWLISTED;
  gates = await import('../middleware/gates');
  rbac = await import('../middleware/rbac');
  rbac.invalidateSuperAdminCache();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mkRes() {
  const res: any = { statusCode: 0, body: undefined };
  res.status = (c: number) => {
    res.statusCode = c;
    return res;
  };
  res.json = (b: unknown) => {
    res.body = b;
    return res;
  };
  return res;
}

function mkReq(firebaseUser: Record<string, unknown> | undefined, extra: Record<string, unknown> = {}) {
  return {
    firebaseUser,
    method: 'GET',
    headers: {},
    params: {},
    query: {},
    body: {},
    originalUrl: '/api/admin/test',
    ...extra,
  } as any;
}

const VERIFIED_ADMIN = { uid: 'u-admin', email: ALLOWLISTED, email_verified: true, claims: { role: 'super_admin' } };
const UNVERIFIED_ADMIN = { uid: 'u-attacker', email: ALLOWLISTED, email_verified: false, claims: { role: 'public' } };
const VERIFIED_CUSTOMER = { uid: 'u-cust', email: 'c@example.com', email_verified: true, claims: { role: 'customer' } };
const VERIFIED_PROVIDER = { uid: 'u-prov', email: 'p@example.com', email_verified: true, claims: { role: 'provider' } };
const VIEWER = { uid: 'u-view', email: 'accountant@example.com', email_verified: true, claims: { role: 'viewer' } };

describe('gates.requireRole — super-admin bypass', () => {
  it('ALLOWS a verified allowlisted admin to bypass the role floor', async () => {
    const next = vi.fn();
    const res = mkRes();
    await gates.requireRole('staff')(mkReq(VERIFIED_ADMIN), res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('DENIES an UNVERIFIED allowlisted email — it falls through to the claims role check', async () => {
    const next = vi.fn();
    const res = mkRes();
    await gates.requireRole('staff')(mkReq(UNVERIFIED_ADMIN), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body?.error).toBe('ROLE_REQUIRED');
  });

  it('DENIES a normal verified customer', async () => {
    const next = vi.fn();
    const res = mkRes();
    await gates.requireRole('staff')(mkReq(VERIFIED_CUSTOMER), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('DENIES a provider asking for a staff-only route', async () => {
    const next = vi.fn();
    const res = mkRes();
    await gates.requireRole('staff')(mkReq(VERIFIED_PROVIDER), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('DENIES 401 an unauthenticated request', async () => {
    const next = vi.fn();
    const res = mkRes();
    await gates.requireRole('staff')(mkReq(undefined), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });
});

describe('gates.enforceReadOnlyMutations — viewer semantics preserved, override tightened', () => {
  const POST = { method: 'POST' };

  it('still ALLOWS a viewer to READ (unchanged)', () => {
    const next = vi.fn();
    const res = mkRes();
    gates.enforceReadOnlyMutations(mkReq(VIEWER, { method: 'GET' }), res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('still BLOCKS a viewer mutation with READ_ONLY_ACCESS (unchanged)', () => {
    const next = vi.fn();
    const res = mkRes();
    gates.enforceReadOnlyMutations(mkReq(VIEWER, POST), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body?.error).toBe('READ_ONLY_ACCESS');
  });

  it('ALLOWS a VERIFIED super-admin to mutate (override intact)', () => {
    const next = vi.fn();
    const res = mkRes();
    gates.enforceReadOnlyMutations(mkReq(VERIFIED_ADMIN, POST), res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('does NOT hand the super-admin override to an UNVERIFIED allowlisted email', () => {
    const next = vi.fn();
    const res = mkRes();
    // role 'viewer' + allowlisted-but-unverified email: the override must
    // not fire, so the read-only block decides.
    const attacker = { ...UNVERIFIED_ADMIN, claims: { role: 'viewer' } };
    gates.enforceReadOnlyMutations(mkReq(attacker, POST), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body?.error).toBe('READ_ONLY_ACCESS');
  });
});

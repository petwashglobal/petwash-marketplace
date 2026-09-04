/**
 * BEHAVIORAL test — the CEO super-admin invariant, exercised through the
 * real middleware rather than by grepping source.
 *
 * INVARIANT
 *   A super-admin gate clears only when BOTH hold:
 *     (a) the caller's email is on the SUPER_ADMIN_EMAILS allowlist, AND
 *     (b) Firebase reports `email_verified === true`.
 *
 * WHY (a) ALONE IS A DEFECT
 *   Firebase lets anyone create an account under any email address they
 *   type. The address is UNVERIFIED until the confirmation link is
 *   clicked. So as long as the real owner has never claimed the mailbox,
 *   an attacker can register `<admin>@petwash.co.il` and clear a
 *   string-only allowlist check. `email_verified` is what proves the
 *   caller actually controls the allowlisted mailbox.
 *
 * The static pin (superAdminEmailVerifiedInvariant.regression.test.ts)
 * skips server/middleware/rbac.ts, because that file is where the paired
 * shape is *defined*. That exemption meant rbac.ts's OWN five gates could
 * (and did) use the bare allowlist check without the pin noticing. This
 * file closes that hole behaviorally.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ALLOWLISTED = 'ceo@petwash.co.il';
const OUTSIDER = 'customer@example.com';

let rbac: typeof import('../middleware/rbac');

beforeEach(async () => {
  process.env.SUPER_ADMIN_EMAILS = ALLOWLISTED;
  rbac = await import('../middleware/rbac');
  rbac.invalidateSuperAdminCache();
});

afterEach(() => {
  delete process.env.SUPER_ADMIN_EMAILS;
});

/** Minimal Express double — records what the middleware did. */
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
  return { firebaseUser, params: {}, query: {}, body: {}, ...extra } as any;
}

const VERIFIED_ADMIN = { uid: 'u-admin', email: ALLOWLISTED, email_verified: true };
const UNVERIFIED_ADMIN = { uid: 'u-attacker', email: ALLOWLISTED, email_verified: false };
// Firebase omits the claim entirely for some providers — `undefined` must
// be treated exactly like `false`, never as "probably fine".
const CLAIMLESS_ADMIN = { uid: 'u-attacker2', email: ALLOWLISTED };
const VERIFIED_CUSTOMER = { uid: 'u-cust', email: OUTSIDER, email_verified: true };
const VERIFIED_PROVIDER = { uid: 'u-prov', email: OUTSIDER, email_verified: true, role: 'provider' };

describe('isSuperAdminVerified — the primitive', () => {
  it('ALLOWS a verified allowlisted admin', () => {
    expect(rbac.isSuperAdminVerified(mkReq(VERIFIED_ADMIN))).toBe(true);
  });

  it('DENIES an allowlisted email whose address is NOT verified', () => {
    expect(rbac.isSuperAdminVerified(mkReq(UNVERIFIED_ADMIN))).toBe(false);
  });

  it('DENIES when Firebase omits email_verified entirely (undefined !== true)', () => {
    expect(rbac.isSuperAdminVerified(mkReq(CLAIMLESS_ADMIN))).toBe(false);
  });

  it('DENIES a verified customer who is not on the allowlist', () => {
    expect(rbac.isSuperAdminVerified(mkReq(VERIFIED_CUSTOMER))).toBe(false);
  });

  it('DENIES an unauthenticated request', () => {
    expect(rbac.isSuperAdminVerified(mkReq(undefined))).toBe(false);
  });

  it('DENIES the string "true" — only the boolean clears the gate', () => {
    const req = mkReq({ uid: 'x', email: ALLOWLISTED, email_verified: 'true' });
    expect(rbac.isSuperAdminVerified(req)).toBe(false);
  });

  it('fails CLOSED when SUPER_ADMIN_EMAILS is unset', () => {
    delete process.env.SUPER_ADMIN_EMAILS;
    rbac.invalidateSuperAdminCache();
    expect(rbac.isSuperAdminVerified(mkReq(VERIFIED_ADMIN))).toBe(false);
  });

  it('fails CLOSED when SUPER_ADMIN_EMAILS still holds the CI placeholder', () => {
    process.env.SUPER_ADMIN_EMAILS = 'PLACEHOLDER_SET_ME';
    rbac.invalidateSuperAdminCache();
    expect(rbac.isSuperAdminVerified(mkReq({ ...VERIFIED_ADMIN, email: 'PLACEHOLDER_SET_ME' }))).toBe(false);
  });
});

describe('rbac.requireAdmin — the gate the static pin could not see', () => {
  it('ALLOWS a verified allowlisted admin', () => {
    const next = vi.fn();
    const res = mkRes();
    rbac.requireAdmin(mkReq(VERIFIED_ADMIN), res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(0);
  });

  it('DENIES 403 an allowlisted email that is NOT verified', () => {
    const next = vi.fn();
    const res = mkRes();
    rbac.requireAdmin(mkReq(UNVERIFIED_ADMIN), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('DENIES 403 an allowlisted email with no email_verified claim', () => {
    const next = vi.fn();
    const res = mkRes();
    rbac.requireAdmin(mkReq(CLAIMLESS_ADMIN), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('DENIES 403 a normal verified customer', () => {
    const next = vi.fn();
    const res = mkRes();
    rbac.requireAdmin(mkReq(VERIFIED_CUSTOMER), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('DENIES 403 a provider', () => {
    const next = vi.fn();
    const res = mkRes();
    rbac.requireAdmin(mkReq(VERIFIED_PROVIDER), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('DENIES 401 an unauthenticated request', () => {
    const next = vi.fn();
    const res = mkRes();
    rbac.requireAdmin(mkReq(undefined), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });
});

describe('rbac.enforceSelfOnly — the cross-user (IDOR) escape hatch', () => {
  const VICTIM = 'someone-elses-uid';

  it('ALLOWS any caller to read their OWN record', () => {
    const next = vi.fn();
    const res = mkRes();
    rbac.enforceSelfOnly(mkReq(VERIFIED_CUSTOMER, { params: { userId: VERIFIED_CUSTOMER.uid } }), res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('ALLOWS a VERIFIED super-admin to read another user', () => {
    const next = vi.fn();
    const res = mkRes();
    rbac.enforceSelfOnly(mkReq(VERIFIED_ADMIN, { params: { userId: VICTIM } }), res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(0);
  });

  it('DENIES 403 an UNVERIFIED allowlisted email reading another user', () => {
    const next = vi.fn();
    const res = mkRes();
    rbac.enforceSelfOnly(mkReq(UNVERIFIED_ADMIN, { params: { userId: VICTIM } }), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('DENIES 403 a normal customer reading another user', () => {
    const next = vi.fn();
    const res = mkRes();
    rbac.enforceSelfOnly(mkReq(VERIFIED_CUSTOMER, { params: { userId: VICTIM } }), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('DENIES 403 regardless of WHERE the foreign id is smuggled in (body / query / params)', () => {
    for (const carrier of ['body', 'query', 'params'] as const) {
      const next = vi.fn();
      const res = mkRes();
      rbac.enforceSelfOnly(mkReq(UNVERIFIED_ADMIN, { [carrier]: { userId: VICTIM } }), res, next);
      expect(next, `${carrier} must not pass`).not.toHaveBeenCalled();
      expect(res.statusCode, `${carrier} must 403`).toBe(403);
    }
  });
});

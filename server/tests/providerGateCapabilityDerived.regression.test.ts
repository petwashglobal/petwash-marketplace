/**
 * The provider gates must derive authority from the ONE server aggregator.
 *
 * `requireProviderActive` guards /api/provider/* (server/routes.ts:622) and
 * /api/provider-dashboard/v2/* — the provider dashboard, i.e. the last step
 * of the provider journey. It used to require:
 *
 *     users.role === 'provider' && users.userStatus === 'provider_active'
 *
 * Both halves are unsatisfiable in the current data model:
 *
 *  • users.role is deliberately NEVER flipped to 'provider' any more. The
 *    2026-08-20 multi-role contract forbids mutating the scalar, so both
 *    approval paths only `SET role='provider' WHERE role IS NULL` and
 *    otherwise append to users.roles[]; post-login.ts:823 refuses it
 *    outright. An existing customer approved as a provider keeps
 *    role='customer' — and the journey REQUIRES signing up as a customer
 *    first.
 *  • Nothing in the repo ever writes users.user_status='provider_active'.
 *    Staff has that write path (access-requests.ts → 'staff_active'); the
 *    provider equivalent was never built, so the column stays at 'new'.
 *
 * On top of that the gate resolved the caller with `getUserId`, which reads
 * req.userId / req.user.id / req.session.userId — while the Firebase path
 * sets only req.firebaseUser (and customAuth sets req.user.uid, not .id).
 * So on the v2 mount (validateFirebaseToken -> requireProviderActive) an
 * approved provider with a valid token got 401 AUTH_REQUIRED.
 *
 * Net effect: the gate was dead-closed for everyone. Fail-closed, so never
 * an escalation — but the provider dashboard was unreachable.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (...p: string[]) => readFileSync(resolve(__dirname, '..', ...p), 'utf8');
const GATES = read('middleware', 'gates.ts');
const STATE = read('middleware', 'stateGuards.ts');
const ROUTES = read('routes.ts');

/** Body of a top-level `function <name>` (exported or not). */
function fn(src: string, name: string): string {
  const start = src.search(new RegExp(`^(export )?(async )?function ${name}\\b`, 'm'));
  if (start === -1) throw new Error(`function not found: ${name}`);
  const rest = src.slice(start + 10);
  const next = rest.search(/\n(export )?(async )?(function|const) /);
  return src.slice(start, next === -1 ? src.length : start + 10 + next);
}

describe('requireProviderActive derives from getUserCapabilities', () => {
  const F = fn(GATES, 'requireProviderActive');

  it('asks the canonical aggregator for the capability', () => {
    expect(GATES).toMatch(/import \{ getUserCapabilities \} from '\.\.\/lib\/userCapabilities'/);
    expect(GATES).toMatch(/import \{ hasProviderCapability \} from '@shared\/lib\/userCapabilities'/);
    expect(F).toMatch(/await getUserCapabilities\(userId\)/);
    expect(F).toMatch(/hasProviderCapability\(caps\)/);
  });

  it('no longer reads the users.role / users.userStatus legacy cache', () => {
    // CEO D5: users.role is a CACHE of provider_applications.status, never
    // the authority. And user_status='provider_active' is never written.
    expect(F).not.toMatch(/userRole !== 'provider'/);
    expect(F).not.toMatch(/'provider_active'/);
    expect(F).not.toMatch(/getOrLoadUser/);
  });

  it('resolves the caller from req.firebaseUser, which is what the auth path sets', () => {
    expect(GATES).toMatch(/function getProviderGateUserId/);
    const resolver = fn(GATES, 'getProviderGateUserId');
    expect(resolver).toMatch(/r\.firebaseUser\?\.uid/);
    expect(resolver).toMatch(/r\.user\?\.uid/);
    // The shared getUserId helper is left alone — widening it would change
    // requireAuth / requireRole / requireUserStatus outside this lane.
    expect(F).not.toMatch(/getUserId\(req\)/);
  });

  it('still fails CLOSED — 401 without a caller, 403 without the capability', () => {
    expect(F).toMatch(/res\.status\(401\)\.json\(\{ error: 'AUTH_REQUIRED' \}\)/);
    expect(F).toMatch(/res\.status\(403\)\.json\(\{ error: 'PROVIDER_NOT_ACTIVE' \}\)/);
    // catch-all also denies rather than calling next()
    const tail = F.slice(F.lastIndexOf('catch'));
    expect(tail).toMatch(/res\.status\(403\)/);
    expect(tail).not.toMatch(/next\(\)/);
  });

  it('memoises capabilities per request (the gate sits on a hot mount)', () => {
    expect(F).toMatch(/req as any\)\.userCapabilities/);
  });
});

describe('requireProviderCanAcceptBooking derives from getUserCapabilities', () => {
  const F = fn(STATE, 'requireProviderCanAcceptBooking');

  it('uses the aggregator, not the dead role/userStatus predicate', () => {
    expect(F).toMatch(/getUserCapabilities\(userId\)/);
    expect(F).toMatch(/hasProviderCapability\(caps\)/);
    expect(F).not.toMatch(/'provider_active'/);
    expect(F).not.toMatch(/role !== 'provider'/);
  });

  it('reads req.firebaseUser and fails closed', () => {
    expect(F).toMatch(/r\.firebaseUser\?\.uid/);
    expect(F).toMatch(/res\.status\(401\)/);
    expect(F).toMatch(/res\.status\(403\)/);
  });
});

describe('the provider surfaces are still gated', () => {
  it('/api/provider/ keeps its gate', () => {
    expect(ROUTES).toMatch(/app\.use\('\/api\/provider\/', requireProviderActive\)/);
  });

  it('/api/provider-dashboard/v2 keeps its gate', () => {
    const idx = ROUTES.indexOf("'/api/provider-dashboard/v2'");
    expect(idx).toBeGreaterThan(-1);
    expect(ROUTES.slice(idx, idx + 300)).toMatch(/requireProviderActive/);
  });
});

describe('only "approved" satisfies the gate', () => {
  it('hasProviderCapability is true for approved and nothing else', async () => {
    const { emptyCapabilities, hasProviderCapability } =
      await import('../../shared/lib/userCapabilities');
    const caps = (status: string | null, active: boolean) => {
      const c = emptyCapabilities('u1');
      c.provider.applicationStatus = status as any;
      c.provider.active = active;
      return c;
    };
    // The aggregator sets active only for 'approved' (pinned separately in
    // providerCapabilityAuthority.regression.test.ts); the gate must read
    // that boolean and nothing else.
    expect(hasProviderCapability(caps('approved', true))).toBe(true);
    for (const s of ['pending', 'under_review', 'rejected', 'withdrawn', 'draft', null]) {
      expect(hasProviderCapability(caps(s, false)), `status ${s}`).toBe(false);
    }
  });
});

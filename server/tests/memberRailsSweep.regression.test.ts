import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { safeEqual } from '../lib/safeEqual';

/**
 * 2026-09-12 member-rails sweep — the classes behind "little bugs keep escaping":
 *  A. shared react-query keys with divergent cached shapes (/pets crash clone)
 *  B. bare cookie-only fetch POSTs that die at the CSRF gate (client never
 *     sends X-CSRF-Token)
 *  C. secrets compared with `!==` (timing leak)
 *  D. value-moving routes with no rate limiter
 *  E. anonymous crash alerts (no component name) and a shell-blanking boundary
 */
const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('A. shared cache keys are normalised at the consumer', () => {
  it('every /api/pets consumer that maps or counts uses petsList()', () => {
    for (const f of ['client/src/pages/PetCarePlanner.tsx', 'client/src/pages/MarketplaceBookingFlow.tsx', 'client/src/pages/GroomersBook.tsx']) {
      const s = R(f);
      expect(s, f).toContain("import { petsList } from '@/lib/apiShapes';");
      expect(s, f).toMatch(/select: \(d: unknown\) => petsList/);
    }
  });
  it('the social feed reads .posts (server shape), not .data', () => {
    const s = R('client/src/pages/PetWashCircle.tsx');
    expect(s).toContain("select: (d: unknown) => feedPosts<Post>(d)");
    expect(s).not.toMatch(/feed\.data\?\.(map|length)/);
  });
  it('apiShapes tolerates every shape that has ever been cached', async () => {
    const { petsList, feedPosts } = await import('../../client/src/lib/apiShapes');
    expect(petsList([{ id: 1 }])).toEqual([{ id: 1 }]);
    expect(petsList({ pets: [{ id: 2 }] })).toEqual([{ id: 2 }]);
    expect(petsList({ pets: null })).toEqual([]);
    expect(petsList(undefined)).toEqual([]);
    expect(feedPosts({ posts: [1], page: 1, hasMore: false })).toEqual([1]);
    expect(feedPosts({ data: [2] })).toEqual([2]);
    expect(feedPosts(null)).toEqual([]);
  });
});

describe('B. public POSTs the client sends without a Bearer are CSRF-allowlisted or go through apiRequest', () => {
  it('privilege register + marketing unsubscribe are allowlisted', () => {
    const s = R('server/index.ts');
    expect(s).toContain("if (req.path === '/api/privilege/register') return true;");
    expect(s).toContain("if (req.path === '/api/marketing/unsubscribe') return true;");
  });
  it('voucher claim uses apiRequest (Bearer) instead of a bare fetch', () => {
    const s = R('client/src/pages/ClaimVoucher.tsx');
    expect(s).toContain("await apiRequest('POST', '/api/vouchers/claim', { code })");
    expect(s).not.toMatch(/fetch\(getApiUrl\('\/api\/vouchers\/claim'\)/);
  });
});

describe('C. secrets are compared in constant time', () => {
  it('safeEqual is correct and never throws on length mismatch', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual(undefined, 'abc')).toBe(false);
    expect(safeEqual('abc', null)).toBe(false);
  });
  it('no `!==` remains on the nine swept sites', () => {
    const w = R('server/routes/wallet.ts');
    expect(w).not.toMatch(/token !== expectedToken/);
    expect(w).not.toMatch(/authenticationToken !== authToken/);
    expect(w).not.toMatch(/terminalSecret !== NAYAX_TERMINAL_SECRET/);
    expect(w).not.toMatch(/providedSecret !== expectedSecret/);
    expect((w.match(/safeEqual\(/g) || []).length).toBeGreaterThanOrEqual(7);
    expect(R('server/routes/qr-activation.ts')).toContain('safeEqual(session.activationToken, activationToken)');
    const pp = R('server/routes/prestige-pass.ts');
    expect(pp).toContain('if (!safeEqual(expected, sig)) return null;');
    expect(pp).not.toMatch(/if \(expected !== sig\)/);
  });
});

describe('D. value-moving routes carry a limiter', () => {
  it('claim-gift, redeem-online, nayax redeem-loyalty, egift reservations', () => {
    const pp = R('server/routes/prestige-pass.ts');
    expect(pp).toMatch(/router\.post\('\/claim-gift', redeemLimiter,/);
    expect(pp).toMatch(/router\.post\('\/redeem-online', redeemLimiter,/);
    expect(R('server/routes/wallet.ts')).toMatch(/router\.post\('\/nayax\/redeem-loyalty', paymentLimiter,/);
    const eg = R('server/routes/egift-balance.ts');
    expect(eg).toMatch(/router\.post\('\/:egiftId\/reservations', paymentLimiter, async/);
    expect(eg).toMatch(/reservationId\/commit', paymentLimiter, async/);
    expect(eg).toMatch(/reservationId\/release', paymentLimiter, async/);
  });
});

describe('E. crashes are named and contained', () => {
  it('fault alerts carry the React component and dedupe on it', () => {
    const fr = R('server/lib/faultReporter.ts');
    expect(fr).toContain('component?: string;');
    expect(fr).toContain('${ctx.component || faultLine}');
    expect(fr).toContain('Component: ${ctx.component}');
    expect(R('server/routes.ts')).toMatch(/component: String\(errorReport\?\.componentStack \|\| ''\)/);
  });
  it('major routes have their own boundary; the card is bilingual with a reference id', () => {
    const app = R('client/src/App.tsx');
    for (const r of ['/pet-parent/home', '/pets', '/pet-care-planner', '/provider-os', '/my-account']) {
      expect(app, r).toContain(`<RouteErrorBoundary routeName="${r}">`);
    }
    expect(app).toContain('const copy = crashCardCopy(isHebrewCrashLocale(), false);');
    expect(app).toContain('data-testid="route-error-reference"');
    expect(app).toMatch(/referenceId,\s*context: `RouteErrorBoundary:/);
  });
});

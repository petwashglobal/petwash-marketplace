/**
 * Deep-holes batch 1 (2026-09-13). Each pin names the hole it closes; every one
 * was verified in code before fixing. Behaviour tests for the money pieces live
 * in purchaseActivation.test.ts (SUMIT outage ≠ decline) and
 * client/src/lib/queryClient.fetchWithRetry.test.ts (native origin, POST 503).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..');
const R = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

describe('P0 — POST /api/vouchers/purchase minted unpaid vouchers', () => {
  it('is sealed: 410, no createVoucher, no email', () => {
    const src = R('server/routes.ts');
    const at = src.indexOf("app.post('/api/vouchers/purchase'");
    expect(at).toBeGreaterThan(-1);
    const handler = src.slice(at, src.indexOf("// Claim voucher (requires authentication)", at));
    expect(handler).toContain('res.status(410)');
    expect(handler).not.toMatch(/createVoucher|sendVoucherPurchaseEmail/);
  });
});

describe('native apps — terms gate and KYC must authenticate with a Bearer', () => {
  it('AppTermsGate sends Authorization on status AND accept', () => {
    const src = R('client/src/components/AppTermsGate.tsx');
    const status = src.slice(src.indexOf("'/api/consent/status'"), src.indexOf("'/api/consent/status'") + 250);
    expect(status).toMatch(/headers:\s*await authHeaders\(user\)/);
    const accept = src.slice(src.indexOf("'/api/consent/accept'"), src.indexOf("'/api/consent/accept'") + 250);
    expect(accept).toMatch(/\.\.\.authHeaders_/);
  });

  it('/verify KYC status + upload send the Firebase ID token', () => {
    const src = R('client/src/pages/Verify.tsx');
    for (const path of ['/api/kyc/status/', "'/api/kyc/upload'"]) {
      const at = src.indexOf(path);
      expect(at, path).toBeGreaterThan(-1);
      expect(src.slice(at, at + 300), path).toMatch(/Authorization: `Bearer \$\{await firebaseUser\.getIdToken\(\)\}`/);
    }
  });
});

describe('provider onboarding contract', () => {
  it('Withdraw calls the router that reads provider_applications', () => {
    const src = R('client/src/pages/ProviderApplicationStatus.tsx');
    expect(src).toContain("apiRequest('POST', '/api/provider-onboarding/withdraw'");
    expect(src).not.toContain("apiRequest('POST', '/api/provider-applications/withdraw'");
    expect(R('server/routes/provider-onboarding.ts')).toContain("router.post('/withdraw'");
  });

  it('document resubmit (token-in-path credential) is CSRF-exempt — and only that path', () => {
    const src = R('server/index.ts');
    const m = src.match(/if \((\/\^\\\/api\\\/provider-onboarding\\\/resubmit\\\/\[\^\/\]\+\$\/)\.test\(req\.path\)\) return true;/);
    expect(m, 'resubmit CSRF skip missing').toBeTruthy();
    // eslint-disable-next-line no-new-func
    const rx = new Function(`return ${m![1]}`)() as RegExp;
    expect(rx.test('/api/provider-onboarding/resubmit/abcdefghijklmnopqrstuvwxyz')).toBe(true);
    expect(rx.test('/api/provider-onboarding/apply')).toBe(false);
    expect(rx.test('/api/provider-onboarding/resubmit/abc/extra')).toBe(false);
  });
});

describe('links we send land on real pages', () => {
  const app = R('client/src/App.tsx');
  const routes = Array.from(app.matchAll(/<Route\s+path=["']([^"']+)["']/g)).map((m) => m[1]);
  const toRx = (r: string) => new RegExp('^' + r.split('/').filter(Boolean).map((s) =>
    s === '*' ? '(?:/.*)?' : s.startsWith(':') && s.endsWith('?') ? '(?:/[^/]+)?' : s.startsWith(':') ? '/[^/]+' : '/' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  ).join('') + '/?$');
  const rxs = routes.map(toRx);
  const routed = (p: string) => rxs.some((x) => x.test(p));

  it.each([
    ['server/routes/booking-requests.ts', '/provider/jobs/REQ1', "/provider/jobs/${requestId}"],
    ['server/routes/cron-booking-reminders.ts', '/provider/jobs/REQ1', '/provider/jobs/${b.requestId}'],
    ['server/services/nextBestAction.ts', '/checkout', "destination: '/checkout'"],
    ['server/services/nextBestAction.ts', '/buy-gift-card', "destination: '/buy-gift-card'"],
    ['server/routes/prestige-pass.ts', '/prestige-pass', '${appBaseUrl}/prestige-pass`'],
    ['server/routes/prestige-join.ts', '/prestige-pass', '${appBaseUrl}/prestige-pass"'],
    ['server/services/AppleWalletService.ts', '/booking', '${PUBLIC_SITE_URL}/booking`'],
    ['server/services/GoogleWalletService.ts', '/booking', '${PUBLIC_SITE_URL}/booking`'],
    ['server/email/templates/registration-confirmation-2025.ts', '/provider-application/status', 'petwash.co.il/provider-application/status'],
    ['server/backgroundJobs.ts', '/loyalty/birthday', 'petwash.co.il/loyalty/birthday?code='],
    ['client/src/pages/CustomerFavourites.tsx', '/booking/confirmation/REQ1', '/booking/confirmation/${booking.requestId}'],
  ])('%s → %s', (file, samplePath, literal) => {
    expect(R(file)).toContain(literal);
    expect(routed(samplePath), `${samplePath} has no <Route>`).toBe(true);
  });

  it('the old dead targets are gone', () => {
    for (const [file, dead] of [
      ['server/routes/booking-requests.ts', '/provider/bookings/${requestId}'],
      ['server/routes/prestige-pass.ts', '/wallet-download`'],
      ['server/services/AppleWalletService.ts', '${PUBLIC_SITE_URL}/book`'],
      ['server/routes/seo.ts', "'/plush-lab'"],
      ['client/src/pages/EnterpriseHQ.tsx', '"/enterprise/rbac"'],
    ] as const) expect(R(file), `${file} still has ${dead}`).not.toContain(dead);
  });

  it('win-back /w tracking links reach Cloud Run (Hosting forwarded only /api, /auth, /uploads)', () => {
    const cfg = JSON.parse(R('firebase.json'));
    const hosting = Array.isArray(cfg.hosting) ? cfg.hosting[0] : cfg.hosting;
    const rw = hosting.rewrites as Array<{ source: string; run?: { serviceId: string } }>;
    const w = rw.findIndex((r) => r.source === '/w' && r.run?.serviceId === 'petwash-api');
    const spa = rw.findIndex((r) => r.source === '**');
    expect(w).toBeGreaterThan(-1);
    expect(w).toBeLessThan(spa);
  });
});

describe('env switches and webhook secrets parse safely', () => {
  it('an enforcing gate set to "true"/"1" stays ON; only explicit off turns it off', async () => {
    const { enforceSwitch } = await import('../lib/envSwitch');
    for (const v of ['on', 'true', '1', 'yes', 'TRUE', ' On ']) expect(enforceSwitch(v, false), v).toBe(true);
    for (const v of ['off', 'false', '0', 'no']) expect(enforceSwitch(v, true), v).toBe(false);
    expect(enforceSwitch(undefined, true)).toBe(true);
    expect(enforceSwitch(undefined, false)).toBe(false);
    expect(enforceSwitch('garbage', true)).toBe(true);
    for (const f of ['server/routes/booking-requests.ts', 'server/services/payoutGate.ts']) {
      expect(R(f), f).not.toMatch(/_ENFORCE \|\| '(on|off)'\)\.toLowerCase\(\) === 'on'/);
    }
  });

  it('a deploy placeholder is not a signing secret', async () => {
    const { isRealSecret } = await import('../lib/envSwitch');
    expect(isRealSecret('nayax-placeholder-not-active')).toBe(false);
    expect(isRealSecret('')).toBe(false);
    expect(isRealSecret(undefined)).toBe(false);
    expect(isRealSecret('k3y-8f2a91')).toBe(true);
    expect(R('server/routes/nayax-monyx-events.ts')).toMatch(/isRealSecret\(process\.env\.NAYAX_WEBHOOK_SECRET\)/);
    expect(R('server/routes/nayax-payments.ts')).toMatch(/isRealSecret\(process\.env\.NAYAX_WEBHOOK_SECRET\)/);
  });
});

describe('legacy money flows no longer reachable from the main buttons', () => {
  it('walker and trainer Book buttons use the canonical booking engine', () => {
    expect(R('client/src/pages/walk-my-pet/WalkerDetail.tsx')).not.toContain('navigate(`/walk-my-pet/book/');
    expect(R('client/src/pages/walk-my-pet/WalkerDetail.tsx')).toContain('navigate(`/booking/new/dog_walking/${walker.userId}`)');
    expect(R('client/src/pages/academy/TrainerProfile.tsx')).not.toContain('`/academy/book/${trainer.id}`)');
    expect(R('client/src/pages/academy/TrainerProfile.tsx')).toContain('`/booking/new/training/${trainer.id}`');
  });

  it('/packages lists the SUMIT catalog and buys through /checkout, not POST /api/checkout', () => {
    const src = R('client/src/pages/Packages.tsx');
    expect(src).toContain("queryKey: ['/api/payments/sumit/catalog']");
    expect(src).toContain('setLocation(`/checkout?sku=${sku}`)');
    const handler = src.slice(src.indexOf('const handlePurchase'), src.indexOf('const handlePurchase') + 1400);
    expect(handler).not.toContain('purchaseMutation.mutate');
  });
});

describe('Provider OS calendar speaks the server contract', () => {
  it('toServerHours output passes the server .strict() schema; fromServerHours round-trips', async () => {
    const { z } = await import('zod');
    const esbuild = await import('esbuild');
    const src = R('client/src/pages/provider-os/POSCalendar.tsx');
    const pick = (start: string, endMarker: string) => src.slice(src.indexOf(start), src.indexOf(endMarker, src.indexOf(start)));
    const code = [
      pick('const DEFAULT_SCHEDULE', '\n};') + '\n};',
      pick('type UiDay', 'export function toServerHours'),
      pick('export function toServerHours', 'export function fromServerHours'),
      pick('export function fromServerHours', '\n}\n') + '\n}\n',
    ].join('\n').replace(/export function/g, 'function') + '\nmodule.exports = { DEFAULT_SCHEDULE, toServerHours, fromServerHours };';
    const js = esbuild.transformSync(code, { loader: 'ts', format: 'cjs' }).code;
    const mod = { exports: {} as any };
    // eslint-disable-next-line no-new-func
    new Function('module', 'exports', js)(mod, mod.exports);
    const { DEFAULT_SCHEDULE, toServerHours, fromServerHours } = mod.exports;

    // Replica of server/routes/provider-profile.ts dayHoursSchema + workingHours.
    const day = z.object({ active: z.boolean(), from: z.string().regex(/^\d{2}:\d{2}$/).optional(), to: z.string().regex(/^\d{2}:\d{2}$/).optional() }).strict();
    const hours = z.object({ mon: day, tue: day, wed: day, thu: day, fri: day, sat: day, sun: day }).strict();
    const server = toServerHours(DEFAULT_SCHEDULE);
    expect(hours.safeParse(server).success).toBe(true);
    expect(fromServerHours(server)).toEqual(DEFAULT_SCHEDULE);
    // the server schema still has these exact keys (catch drift)
    expect(R('server/routes/provider-profile.ts')).toMatch(/mon: dayHoursSchema, tue: dayHoursSchema/);
    expect(R('server/routes/provider-profile.ts')).toMatch(/AVAILABILITY_WHITELIST = \['online', 'available', 'busy', 'offline'\]/);
    expect(src).toContain("vacationMode ? 'offline' : pauseNewBookings ? 'busy' : 'online'");
  });

  it('Prestige home "latest activity" opens the real transactions page', () => {
    const src = R('client/src/pages/PrestigeHome.tsx');
    expect(src).not.toContain('`/receipt/${lastEvent.transactionId}`');
    expect(src).toContain("'/account/transactions'");
  });
});

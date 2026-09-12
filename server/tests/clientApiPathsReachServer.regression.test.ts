/**
 * The till was closed by a URL prefix (2026-09-13).
 *
 * Firebase Hosting forwards only `/api/**`, `/auth/**` and `/uploads/**` to
 * Cloud Run. Everything else falls through to the SPA — so a client call to a
 * non-forwarded path gets `index.html` with status 200, `res.json()` throws,
 * TanStack Query stores `undefined`, and the component takes its fallback
 * branch with nothing logged.
 *
 * Measured on production this morning:
 *
 *   GET https://petwash.co.il/payment-status
 *     → 200 text/html, body "<!DOCTYPE html>…"
 *     → SyntaxError: Unexpected token '<'
 *     → usePaymentStatus(): data undefined
 *     → `paymentsEnabled = data?.nayax?.enabled ?? false`
 *     → /buy-gift-card rendered "Gift Cards — Coming Soon!"
 *
 * …while NAYAX_API_KEY, NAYAX_MERCHANT_ID, NAYAX_SECRET and
 * NAYAX_WEBHOOK_SECRET were all mounted in Cloud Run and the handler would
 * have answered `{"nayax":{"enabled":true}}`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('payment gateway status reaches the server', () => {
  it('the handler is registered under /api (the prefix Hosting forwards)', () => {
    const src = R('server/routes.ts');
    expect(src).toContain("app.get('/api/payments/gateway-status', paymentGatewayStatus);");
    // the legacy bare path stays registered so nothing that still calls it breaks
    expect(src).toContain("app.get('/payment-status', paymentGatewayStatus);");
  });

  it('the client asks the /api path, not the bare one', () => {
    const hook = R('client/src/hooks/use-payment-status.ts');
    expect(hook).toContain("queryKey: ['/api/payments/gateway-status']");
    expect(hook).not.toContain("queryKey: ['/payment-status']");
  });

  it('Hosting really does forward /api and really does not forward bare paths', () => {
    const cfg = JSON.parse(R('firebase.json'));
    const hosting = Array.isArray(cfg.hosting) ? cfg.hosting[0] : cfg.hosting;
    const forwarded = hosting.rewrites.filter((r: any) => r.run).map((r: any) => r.source);
    expect(forwarded).toContain('/api/**');
    expect(forwarded).not.toContain('/payment-status');
    // the catch-all that turns every other path into the SPA
    expect(hosting.rewrites.some((r: any) => r.source === '**' && !r.run)).toBe(true);
  });

  it('the guard that catches this class is wired into the PR gate', () => {
    const wf = R('.github/workflows/money-safety-gate.yml');
    expect(wf).toContain('scripts/guards/client_api_paths_reach_server.py --fail');
    const baseline = R('scripts/guards/client_api_paths_baseline.txt');
    // the two dead StatusDashboard paths are frozen with a reason, not hidden
    expect(baseline).toContain('/status/uptime');
    expect(baseline).toContain('/status/stations');
    expect(baseline).not.toContain('/payment-status');
  });
});

describe('presence is not configuration', () => {
  it('the gateway-status handler rejects a placeholder credential', () => {
    const src = R('server/routes.ts');
    expect(src).toContain("!/placeholder/i.test(v)");
    expect(src).not.toMatch(/const isNayaxConfigured = !!\(\s*\n\s*process\.env\.NAYAX_API_KEY/);
  });
  it('NayaxOnlinePaymentService DEMO_MODE treats a placeholder as unset', () => {
    const src = R('server/services/NayaxOnlinePaymentService.ts');
    expect(src).toContain('nayaxCredentialConfigured');
    expect(src).not.toContain('const DEMO_MODE = !NAYAX_API_KEY || !NAYAX_MERCHANT_ID;');
  });
  it('payment-provider-mode fails closed and still prints the BOOKING_CARD_RAIL hint', () => {
    const src = R('server/lib/payment-provider-mode.ts');
    expect(src).toContain('const credentialSet = (v: string | undefined): boolean =>');
    expect(src).toContain('const nayaxDark = !credentialSet(env.NAYAX_API_KEY) || !credentialSet(env.NAYAX_MERCHANT_ID);');
  });
  it('the deploy really does write that placeholder (why this matters)', () => {
    expect(R('.github/workflows/petwash-ci.yml')).toContain('nayax-placeholder-not-active');
  });
});

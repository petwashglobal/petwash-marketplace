/**
 * REGRESSION PIN — the orchestrator router is authenticated, and its fiscal
 * endpoint is provider/admin-only.
 *
 * `POST /api/orchestrator/job-complete` issues a real חשבונית מס + קבלה
 * through SUMIT from a CLIENT-SUPPLIED `amountILS` + `customerEmail`, with no
 * booking lookup. It was mounted (server/routes.ts) with `apiLimiter` alone —
 * no `validateFirebaseToken` — so any anonymous caller could mint a tax
 * document. The same file's `/generate-statement` DID carry the middleware,
 * which is what makes the omission an oversight rather than a design choice.
 *
 * `/kyc-submit`, `/kyb-submit`, `/booking-confirmed`, `/esign-complete`,
 * `/onboarding-approved` and `/contract-generated` were equally open.
 *
 * `/health` must stay public (uptime probe), so it is registered ABOVE the gate.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(
  resolve(__dirname, '..', '..', 'server/routes/petwatch-orchestrator.ts'),
  'utf8',
);
const lineOf = (needle: string) => {
  const i = src.indexOf(needle);
  expect(i, `not found: ${needle}`).toBeGreaterThan(-1);
  return src.slice(0, i).split('\n').length;
};

describe('orchestrator auth gate', () => {
  it('applies validateFirebaseToken to the whole router', () => {
    expect(src).toMatch(/router\.use\(validateFirebaseToken\);/);
  });

  it('gates every mutating route behind that router.use', () => {
    const gate = lineOf('router.use(validateFirebaseToken);');
    const mutating = [
      "router.post('/job-complete'",
      "router.post('/calendar/booking'",
      "router.post('/generate-statement'",
      "router.post('/kyc-submit'",
      "router.post('/kyb-submit'",
      "router.post('/booking-confirmed'",
      "router.post('/esign-complete'",
      "router.post('/onboarding-approved'",
      "router.post('/contract-generated'",
    ];
    for (const m of mutating) {
      expect(lineOf(m), `${m} must be registered AFTER the auth gate`).toBeGreaterThan(gate);
    }
  });

  it('keeps /health public — registered before the gate', () => {
    expect(lineOf("router.get('/health'")).toBeLessThan(
      lineOf('router.use(validateFirebaseToken);'),
    );
  });

  it('restricts the fiscal endpoint to an approved provider or verified admin', () => {
    expect(src).toMatch(/router\.post\('\/job-complete',\s*requireProviderOrAdmin/);
    expect(src).toMatch(/hasProviderCapability\(caps\)/);
    expect(src).toMatch(/isSuperAdminVerified\(req\)/);
  });

  it('fails CLOSED when the capability lookup throws', () => {
    const fn = src.slice(src.indexOf('async function requireProviderOrAdmin'));
    const body = fn.slice(0, fn.indexOf('\n}'));
    expect(body).toMatch(/catch[\s\S]*status\(403\)/);
    expect(body).not.toMatch(/catch[\s\S]*next\(\)/);
  });
});

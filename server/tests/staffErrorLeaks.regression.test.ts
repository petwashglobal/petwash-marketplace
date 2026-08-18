/**
 * Staff / careers routes — 4xx and 5xx response bodies must not leak raw
 * `error.message` from bare catch blocks. Every mapped error returns a
 * generic string plus a discriminator `code`.
 *
 * Scope of this pin (Task 4 — CEO fire order 101-140):
 *   - server/routes/staff-onboarding.ts   (the only file with response leaks)
 *   - server/routes/careers.ts            (already clean — pinned)
 *   - server/routes/job-offers.ts         (already clean — pinned)
 *   - server/routes/admin-staff.ts        (already clean — pinned)
 *   - server/routes/admin-staff-academy.ts (already clean — pinned)
 *   - server/routes/employees.ts          (already clean — pinned)
 *   - server/routes/enterprise-hr.ts      (already clean — pinned)
 *
 * Internal logger.error / logger.warn traces (which INTENTIONALLY carry
 * error.message for internal debugging) are explicitly permitted.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');

const FILES = [
  'routes/staff-onboarding.ts',
  'routes/careers.ts',
  'routes/job-offers.ts',
  'routes/admin-staff.ts',
  'routes/admin-staff-academy.ts',
  'routes/employees.ts',
  'routes/enterprise-hr.ts',
];

function extractResponseBodies(src: string): string[] {
  const out: string[] = [];
  const rx = /res\.status\(\d{3}\)\s*\.json\(/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(src)) !== null) {
    const start = m.index + m[0].length;
    let depth = 1;
    let i = start;
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (c === '(') depth++;
      else if (c === ')') depth--;
      i++;
    }
    out.push(src.slice(start, i));
  }
  return out;
}

describe('Staff/careers response bodies never leak error.message', () => {
  for (const rel of FILES) {
    it(`${rel}: every res.status(...).json body is generic`, () => {
      const src = R(rel);
      const bodies = extractResponseBodies(src);
      for (const body of bodies) {
        expect(body).not.toMatch(/\berror\.message\b/);
        expect(body).not.toMatch(/\berr\.message\b/);
        expect(body).not.toMatch(/\berror\.stack\b/);
        expect(body).not.toMatch(/\berr\.stack\b/);
        // The `instanceof Error ? error.message` ternary variant also leaks.
        expect(body).not.toMatch(/instanceof\s+Error\s*\?\s*(error|err|e)\.message/);
      }
    });
  }
});

describe('job-offers.ts declares discriminator codes on touched paths', () => {
  it('6 new JOB_OFFER_* / JOB_DISPATCH_STATUS_500 / OPERATOR_PRESENCE_500 codes present', () => {
    const src = R('routes/job-offers.ts');
    for (const c of [
      "'JOB_OFFER_CREATE_500'",
      "'JOB_OFFER_ACCEPT_500'",
      "'JOB_OFFER_REJECT_500'",
      "'JOB_DISPATCH_STATUS_500'",
      "'JOB_OFFER_LIST_500'",
      "'OPERATOR_PRESENCE_500'",
    ]) expect(src).toContain(c);
  });

  it('job-offers.ts retains its [JobOffers API] logger tags', () => {
    const src = R('routes/job-offers.ts');
    for (const tag of [
      "[JobOffers API] Error creating job offer",
      "[JobOffers API] Error accepting job offer",
      "[JobOffers API] Error rejecting job offer",
      "[JobOffers API] Error getting dispatch status",
      "[JobOffers API] Error getting operator job offers",
      "[JobOffers API] Error updating operator presence",
    ]) expect(src).toContain(tag);
  });
});

describe('staff-onboarding.ts declares discriminator codes on touched paths', () => {
  it('4 new STAFF_*_400 codes present', () => {
    const src = R('routes/staff-onboarding.ts');
    for (const c of [
      "'STAFF_APP_400'",
      "'STAFF_EXPENSE_400'",
      "'STAFF_LOGBOOK_400'",
      "'STAFF_ORDER_400'",
    ]) expect(src).toContain(c);
  });

  it('generic error strings preserved (no error.message fallback pattern)', () => {
    const src = R('routes/staff-onboarding.ts');
    // The old fallback form has been removed everywhere.
    expect(src).not.toMatch(/error:\s*error\.message\s*\|\|/);
    // The generic messages replace them.
    expect(src).toContain("error: 'Failed to submit application'");
    expect(src).toContain("error: 'Failed to submit expense'");
    expect(src).toContain("error: 'Failed to submit logbook entry'");
    expect(src).toContain("error: 'Failed to create order'");
  });
});

describe('staff-onboarding.ts preserves hiring/business surface', () => {
  it('logger.error tags on the four touched catch blocks are still present', () => {
    const src = R('routes/staff-onboarding.ts');
    for (const tag of [
      "[API] Failed to create application",
      "[API] Failed to submit expense",
      "[API] Failed to submit logbook entry",
      "[API] Failed to create franchise order",
    ]) expect(src).toContain(tag);
  });

  it('route + auth guard symbols intact (hiring surface not disturbed)', () => {
    const src = R('routes/staff-onboarding.ts');
    expect(src).toContain('registerStaffOnboardingRoutes');
    expect(src).toContain('requireOwnEmployeeId');
    expect(src).toContain("app.post('/api/staff/applications'");
    expect(src).toContain('insertStaffApplicationSchema');
    expect(src).toContain('staffOnboardingService');
  });
});

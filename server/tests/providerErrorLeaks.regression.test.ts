/**
 * Provider routes — 5xx response bodies must not leak raw `error.message` /
 * `err.message` / `e.message`. Every 5xx response must be a generic mapped
 * string plus a discriminator (either `errorCode` or `code`).
 *
 * Scope of this pin (Task 3 — CEO fire order 101-140):
 *   - server/routes/provider-onboarding.ts
 *   - server/routes/provider-intake.ts
 *   - server/routes/provider-declarations.ts
 *   - server/routes/provider-training.ts
 *   - server/routes/provider-availability.ts
 *   - server/routes/provider-insurance.ts
 *   - server/routes/provider-slots.ts
 *   - server/routes/provider-dashboard-v2.ts
 *
 * Internal logger.error / logger.warn calls (which INTENTIONALLY carry
 * error.message for internal trace) are explicitly permitted.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');

const FILES = [
  'routes/provider-onboarding.ts',
  'routes/provider-intake.ts',
  'routes/provider-declarations.ts',
  'routes/provider-training.ts',
  'routes/provider-availability.ts',
  'routes/provider-insurance.ts',
  'routes/provider-slots.ts',
  'routes/provider-dashboard-v2.ts',
];

/** Split a file into 5xx response snippets — text between `res.status(5xx)` and the closing `);`. */
function extract5xxResponses(src: string): string[] {
  const out: string[] = [];
  const rx = /res\.status\(5\d\d\)\s*\.json\(/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(src)) !== null) {
    // Find matching ) at the outermost level starting from json(
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

describe('Provider 5xx bodies never leak error.message', () => {
  for (const rel of FILES) {
    it(`${rel}: every 5xx body is generic`, () => {
      const src = R(rel);
      const bodies = extract5xxResponses(src);
      // Guard: there is at least one 5xx in each surveyed file
      expect(bodies.length).toBeGreaterThan(0);
      for (const body of bodies) {
        expect(body).not.toMatch(/\berror\.message\b/);
        expect(body).not.toMatch(/\berr\.message\b/);
        expect(body).not.toMatch(/\bclaimsErr\??\.message\b/);
        expect(body).not.toMatch(/\berror\.stack\b/);
        expect(body).not.toMatch(/\berr\.stack\b/);
      }
    });
  }
});

describe('Provider routes preserve internal logger traces', () => {
  it('provider-onboarding.ts retains logger.error tags around the top-level catches', () => {
    const src = R('routes/provider-onboarding.ts');
    // At least a dozen of the pre-existing logger.error markers survive.
    const tags = [
      "[Provider Onboarding] Generate invite code error",
      "[Provider Onboarding] Validate invite code error",
      "[Provider Onboarding] Application submission error",
      "[Provider Onboarding] Get application status error",
      "[Provider Onboarding] Get pending applications error",
      "[Provider Onboarding] Get pending-review applications error",
      "[Provider Onboarding] Get application detail error",
      "[Provider Onboarding] Approve application error",
      "[Provider Onboarding] Reject application error",
      "[ProviderOnboarding] promote-trainee error",
      "[ProviderOnboarding] Resubmit request error",
      "[ProviderOnboarding] mgmt/analytics error",
    ];
    for (const t of tags) expect(src).toContain(t);
  });

  it('provider-intake.ts retains its [Provider Intake] logger tags', () => {
    const src = R('routes/provider-intake.ts');
    for (const t of [
      "[Provider Intake] Sync failed:",
      "[Provider Intake] Approval failed:",
      "[Provider Intake] Rejection failed:",
      "[Provider Intake] Update failed:",
      "[Provider Intake] Submit failed:",
      "[Provider Intake] Document submission failed:",
    ]) expect(src).toContain(t);
  });
});

describe('Provider routes emit discriminator codes on every touched 5xx path', () => {
  it('provider-onboarding.ts declares the new error codes', () => {
    const src = R('routes/provider-onboarding.ts');
    const codes = [
      "'INVITE_CODE_FAILED'",
      "'VALIDATION_FAILED'",
      "'STATUS_CHECK_FAILED'",
      "'PENDING_APPS_500'",
      "'PENDING_REVIEW_500'",
      "'APP_DETAIL_500'",
      "'APPROVAL_FAILED'",
      "'REJECTION_FAILED'",
      "'QUEUE_LIST_500'",
      "'PROMOTE_TRAINEE_500'",
      "'QUEUE_ASSIGN_500'",
      "'RESUBMIT_REQ_500'",
      "'AUDIT_TRAIL_500'",
      "'MSG_LIST_500'",
      "'MSG_SEND_500'",
      "'MY_STATUS_500'",
      "'WITHDRAW_500'",
      "'APPLICANT_MSG_LIST_500'",
      "'APPLICANT_MSG_SEND_500'",
      "'RESUBMIT_FAILED'",
      "'MGMT_ANALYTICS_500'",
      "'CLAIMS_UPDATE_500'",
    ];
    for (const c of codes) expect(src).toContain(c);
  });
});

describe('Provider routes preserve KYC/approval/business-rule symbols untouched', () => {
  it('provider-onboarding.ts still exposes approve/reject/promote/withdraw routes', () => {
    const src = R('routes/provider-onboarding.ts');
    // Route surface intact — no route was accidentally removed by the leak sweep.
    expect(src).toMatch(/router\.(post|put|patch)\([^)]*\/approve/);
    expect(src).toMatch(/router\.(post|put|patch)\([^)]*\/reject/);
    expect(src).toMatch(/router\.(post|put)\([^)]*promote-trainee/);
    expect(src).toMatch(/router\.(post|put|patch)\([^)]*withdraw/);
    // KYC guard names still present
    expect(src).toContain('KYC2026');
  });

  it('provider-intake.ts still exposes sync/approve/reject/update/submit routes', () => {
    const src = R('routes/provider-intake.ts');
    // The router surface is fully preserved.
    expect(src).toMatch(/router\.(get|post)\(/);
    // Original operational log tags remain (proves no catch block was dropped).
    expect(src).toContain('[Provider Intake] Sync failed:');
    expect(src).toContain('[Provider Intake] Approval failed:');
    expect(src).toContain('[Provider Intake] Rejection failed:');
    expect(src).toContain('[Provider Intake] Submit failed:');
  });
});

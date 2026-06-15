/**
 * /api/ai-verification must be admin-guarded.
 *
 * The AI Payout Verification mount (Gemini work-verification gating provider
 * payouts, documented "Admin only") was mounted with only validateFirebaseToken
 * + apiLimiter — so any authenticated customer could reach it, unlike its
 * sibling admin mounts (/api/provider-command-center, /api/provider-review)
 * which carry requireAdminMfa + requireRole + requireStaffApproved +
 * requireMfaEnrolled.
 *
 * Fix: add the same admin chain. Source-introspection so a regression that
 * drops the guard fails CI.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const routesSrc = fs.readFileSync(path.resolve(__dirname, '..', 'routes.ts'), 'utf8');

describe('/api/ai-verification mount — admin guard', () => {
  const line = routesSrc
    .split('\n')
    .find((l) => l.includes("app.use('/api/ai-verification'"));

  it('exists', () => {
    expect(line).toBeTruthy();
  });

  it('carries the full admin guard chain (token + role + staff + MFA)', () => {
    expect(line).toMatch(/validateFirebaseToken/);
    expect(line).toMatch(/requireAdminMfa/);
    expect(line).toMatch(/requireRole\('admin', 'management'\)/);
    expect(line).toMatch(/requireStaffApproved/);
    expect(line).toMatch(/requireMfaEnrolled/);
  });
});

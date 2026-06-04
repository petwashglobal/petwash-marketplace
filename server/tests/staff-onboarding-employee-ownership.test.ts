/**
 * Staff onboarding self-service ownership regression pin.
 *
 * Staff expense and logbook submissions are authenticated self-service routes.
 * They must not trust a caller-supplied employeeId without checking it matches
 * the verified authenticated UID; otherwise one signed-in user can submit staff
 * records against another employee account.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'staff-onboarding.ts'),
  'utf8',
);

describe('staff-onboarding employeeId ownership guard', () => {
  it('defines a shared authenticated employeeId ownership helper', () => {
    const helper = SRC.slice(
      SRC.indexOf('function requireOwnEmployeeId'),
      SRC.indexOf('export function registerStaffOnboardingRoutes'),
    );

    expect(helper).toMatch(/function\s+requireOwnEmployeeId\(\s*req:\s*any,\s*res:\s*any,\s*employeeId:\s*string\s*\):\s*boolean/);
    expect(helper).toMatch(/employeeId\s*!==\s*userId/);
    expect(helper).not.toMatch(/\bisAdmin\b|adminUser/);
    expect(helper).toMatch(/you can only submit staff records for your own employee account/);
  });

  it('checks employeeId ownership before processing staff expense submissions', () => {
    expect(SRC).toMatch(
      /app\.post\(\s*['"]\/api\/staff\/expenses['"]\s*,\s*requireAuth\s*,\s*async[\s\S]*?const\s+data\s*=\s*insertStaffExpenseSchema\.parse\(req\.body\);\s*if\s*\(\s*!requireOwnEmployeeId\(req,\s*res,\s*data\.employeeId\)\s*\)\s*return;[\s\S]*?receiptFraudDetection\.analyzeReceipt/,
    );
  });

  it('checks employeeId ownership before inserting staff logbook entries', () => {
    expect(SRC).toMatch(
      /app\.post\(\s*['"]\/api\/staff\/logbook['"]\s*,\s*requireAuth\s*,\s*async[\s\S]*?const\s+data\s*=\s*insertStaffLogbookSchema\.parse\(req\.body\);\s*if\s*\(\s*!requireOwnEmployeeId\(req,\s*res,\s*data\.employeeId\)\s*\)\s*return;[\s\S]*?db\.insert\(staffLogbook\)/,
    );
  });
});

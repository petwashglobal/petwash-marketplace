/** PR-W34j — enterprise-hr admin audit coverage. */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const text = fs.readFileSync(path.resolve(__dirname, '..', 'routes', 'enterprise-hr.ts'), 'utf8');

describe('PR-W34j — enterprise-hr admin audit', () => {
  it('imports logAuditEvent + declares emitHrAudit', () => {
    expect(text).toMatch(/import\s*\{\s*logAuditEvent\s*\}/);
    expect(text).toMatch(/function emitHrAudit/);
    expect(text).toMatch(/setImmediate\s*\(/);
  });
  const expected = [
    'HR_EMPLOYEE_CREATE', 'HR_EMPLOYEE_UPDATE',
    'HR_PAYROLL_CREATE', 'HR_PAYROLL_STATUS_UPDATE',
    'HR_TIME_CLOCK_IN', 'HR_TIME_CLOCK_OUT', 'HR_TIME_APPROVE',
    'HR_REVIEW_CREATE', 'HR_REVIEW_UPDATE', 'HR_REVIEW_ACKNOWLEDGE',
    'HR_JOB_OPENING_CREATE', 'HR_JOB_OPENING_UPDATE',
    'HR_APPLICATION_CREATE', 'HR_APPLICATION_STATUS_UPDATE',
  ];
  for (const action of expected) {
    it(`emits ${action}`, () => {
      expect(text).toMatch(new RegExp(`actionType:\\s*['"]${action}['"]`));
    });
  }
  it('review acknowledge stores hasSignature, NOT raw signature', () => {
    const idx = text.indexOf('/performance-reviews/:id/acknowledge');
    const block = text.slice(idx, idx + 1500);
    expect(block).toMatch(/hasSignature:/);
    expect(block).not.toMatch(/\bsignature:\s*signature\b/);
  });
});

/**
 * PR-DANGER-2 regression pins — HR admin PATCH endpoints reject any
 * body key that is not on the explicit allowlist.
 *
 * The pre-fix shape at `enterprise-hr.ts:73` was
 *   const updates = req.body;
 *   await storage.updateEmployee(id, updates);
 * which mass-assigned every column on `hr_employees`, including
 * `salary`, `salaryCurrency`, `paymentFrequency`, `bankAccountDetails`,
 * `taxDetails`, `socialInsuranceNumber`, `personalId`, `firebaseUid`,
 * `role`, `permissions`, `franchiseId`, `employeeId`. Any admin token
 * that reached the handler could rewrite compensation, banking, or
 * identity-binding fields by adding one key to the request body.
 *
 * The fix (below) uses a `.strict()` Zod schema so unknown keys are
 * rejected explicitly rather than silently dropped. The payroll status
 * handler now takes a fixed enum instead of any string.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const src = fs.readFileSync(path.join(root, 'server/routes/enterprise-hr.ts'), 'utf8');

describe('PR-DANGER-2 — PATCH /employees/:id explicit allowlist', () => {
  it('no longer mass-assigns req.body into updateEmployee', () => {
    // The exact anti-pattern that shipped: raw body → storage. Regression
    // pins that a future refactor cannot restore this shape.
    const employeeHandler = src.match(
      /router\.patch\("\/employees\/:id"[\s\S]*?\}\);\s*\n/,
    );
    expect(employeeHandler, 'employees PATCH handler missing').toBeTruthy();
    expect(employeeHandler![0]).not.toMatch(/const updates = req\.body;/);
    expect(employeeHandler![0]).not.toMatch(/storage\.updateEmployee\(id,\s*req\.body\)/);
    expect(employeeHandler![0]).not.toMatch(/storage\.updateEmployee\(id,\s*updates\)/);
  });

  it('validates the body through patchHrEmployeeSchema.safeParse', () => {
    // Explicit Zod schema (safeParse, not parse — 400 on validation error,
    // not a thrown exception the client sees as 500).
    expect(src).toMatch(/const patchHrEmployeeSchema = z\.object\(\{/);
    expect(src).toMatch(/patchHrEmployeeSchema\.safeParse\(req\.body\)/);
  });

  it('uses .strict() so unknown keys are REJECTED (not silently dropped)', () => {
    // Without .strict() an admin passing `{ salary: 999999, isActive: true }`
    // would silently drop the salary field and process the request — the
    // caller would see 200 and never learn their money-field write was
    // ignored. .strict() surfaces the rejected key names so ops can route
    // the compensation change through the correct audited flow instead.
    const schemaBlock = src.match(
      /const patchHrEmployeeSchema = z\.object\(\{[\s\S]*?\}\)\.strict\(\);/,
    );
    expect(schemaBlock, 'patchHrEmployeeSchema .strict() shape missing').toBeTruthy();
  });

  it('allowlist DOES NOT include any money / banking / identity / RBAC field', () => {
    // These are the fields that MUST be routed through separate audited
    // endpoints — never a general PATCH. Pin each banned key.
    const schemaBlock = src.match(
      /const patchHrEmployeeSchema = z\.object\(\{[\s\S]*?\}\)\.strict\(\);/,
    );
    expect(schemaBlock, 'schema block missing').toBeTruthy();
    for (const banned of [
      'salary',
      'salaryCurrency',
      'paymentFrequency',
      'bankAccountDetails',
      'taxDetails',
      'socialInsuranceNumber',
      'personalId',
      'firebaseUid',
      'role',
      'permissions',
      'franchiseId',
      'employeeId',
    ]) {
      expect(schemaBlock![0], `banned field '${banned}' must not appear in allowlist`)
        .not.toMatch(new RegExp(`\\b${banned}\\b`));
    }
  });

  it('allowlist DOES include the general-metadata fields an HR admin needs', () => {
    // Sanity-check that we did not over-narrow the schema and lock ops out
    // of legitimate edits (name, contact, employment metadata).
    const schemaBlock = src.match(
      /const patchHrEmployeeSchema = z\.object\(\{[\s\S]*?\}\)\.strict\(\);/,
    );
    expect(schemaBlock, 'schema block missing').toBeTruthy();
    for (const allowed of ['firstName', 'lastName', 'email', 'phone', 'department', 'position', 'isActive']) {
      expect(schemaBlock![0], `expected allowlist field '${allowed}' missing`)
        .toMatch(new RegExp(`\\b${allowed}\\b`));
    }
  });
});

describe('PR-DANGER-2 — PATCH /payroll/:id/status accepts only the known enum', () => {
  it('validates the body through patchPayrollStatusSchema (strict, enum)', () => {
    // Was: `const { status } = req.body; storage.updatePayrollStatus(id, status)`
    // — any string reached the DB. Now: enum check first, or 400.
    expect(src).toMatch(/const patchPayrollStatusSchema = z\.object\(\{/);
    expect(src).toMatch(/patchPayrollStatusSchema\.safeParse\(req\.body\)/);
  });

  it('enum values match the schema comment (pending|processed|paid|failed)', () => {
    // Match the exact enum from shared/schema-hr.ts:88. If the schema adds
    // a new status, the handler and this test both need to change together.
    const enumBlock = src.match(
      /status: z\.enum\(\[[^\]]*'pending'[^\]]*'processed'[^\]]*'paid'[^\]]*'failed'[^\]]*\]\)/,
    );
    expect(enumBlock, 'payroll status enum missing/incomplete').toBeTruthy();
  });

  it('rejects unknown body keys via .strict()', () => {
    // A caller passing `{ status: 'paid', paidAt: '2026-01-01', paymentMethod: 'cash' }`
    // must 400 — not silently drop the extra fields (which would look successful
    // but leave a paid record with no method).
    const schemaBlock = src.match(
      /const patchPayrollStatusSchema = z\.object\(\{[\s\S]*?\}\)\.strict\(\);/,
    );
    expect(schemaBlock, 'payroll status .strict() shape missing').toBeTruthy();
  });
});

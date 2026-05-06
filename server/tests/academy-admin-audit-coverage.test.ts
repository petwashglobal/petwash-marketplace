/** PR-W34m — academy admin audit (3 admin mutators). */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const text = fs.readFileSync(path.resolve(__dirname, '..', 'routes', 'academy.ts'), 'utf8');

describe('PR-W34m — academy admin audit', () => {
  it('imports logAuditEvent + declares emitAcademyAdminAudit', () => {
    expect(text).toMatch(/import\s*\{\s*logAuditEvent\s*\}/);
    expect(text).toMatch(/function emitAcademyAdminAudit/);
    expect(text).toMatch(/setImmediate\s*\(/);
  });
  for (const action of ['ACADEMY_TRAINER_CREATE', 'ACADEMY_TRAINER_VERIFY', 'ACADEMY_TRAINER_DELETE']) {
    it(`emits ${action}`, () => {
      expect(text).toMatch(new RegExp(`actionType:\\s*['"]${action}['"]`));
    });
  }
});

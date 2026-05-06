/** PR-W34r — google-forms admin audit (5 mutators). */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const text = fs.readFileSync(path.resolve(__dirname, '..', 'routes', 'google-forms.ts'), 'utf8');

describe('PR-W34r — google-forms admin audit', () => {
  it('imports + wrapper present', () => {
    expect(text).toMatch(/import\s*\{\s*logAuditEvent\s*\}/);
    expect(text).toMatch(/function emitGoogleFormsAudit/);
    expect(text).toMatch(/setImmediate\s*\(/);
  });
  for (const action of [
    'GOOGLE_FORMS_CREATE_ALL', 'GOOGLE_FORMS_CREATE_SINGLE',
    'GOOGLE_FORMS_CONFIG_CREATE', 'GOOGLE_FORMS_CONFIG_UPDATE',
    'GOOGLE_FORMS_CONFIG_TOGGLE', 'GOOGLE_FORMS_CONFIG_DELETE',
  ]) {
    it(`emits ${action}`, () => {
      expect(text).toMatch(new RegExp(`actionType:\\s*['"]${action}['"]`));
    });
  }
});

/** PR-W34p — kyc admin audit (approve / reject). */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const text = fs.readFileSync(path.resolve(__dirname, '..', 'routes', 'kyc.ts'), 'utf8');

describe('PR-W34p — kyc admin audit', () => {
  it('imports + wrapper present', () => {
    expect(text).toMatch(/import\s*\{\s*logAuditEvent\s*\}/);
    expect(text).toMatch(/function emitKycAdminAudit/);
    expect(text).toMatch(/setImmediate\s*\(/);
  });
  for (const action of ['KYC_APPROVE', 'KYC_REJECT']) {
    it(`emits ${action}`, () => {
      expect(text).toMatch(new RegExp(`actionType:\\s*['"]${action}['"]`));
    });
  }
  it('approve does NOT log raw file paths in metadata (just deletedFileCount)', () => {
    const idx = text.indexOf('KYC_APPROVE');
    const block = text.slice(idx, idx + 600);
    expect(block).toMatch(/deletedFileCount:/);
    expect(block).not.toMatch(/docPathsToDelete:\s*docPathsToDelete\b/);
  });
});

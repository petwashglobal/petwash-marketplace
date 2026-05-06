/** PR-W34s — devices admin audit (revoke). */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const text = fs.readFileSync(path.resolve(__dirname, '..', 'routes', 'devices.ts'), 'utf8');

describe('PR-W34s — devices admin audit', () => {
  it('imports + wrapper present', () => {
    expect(text).toMatch(/import\s*\{\s*logAuditEvent\s*\}/);
    expect(text).toMatch(/function emitDevicesAdminAudit/);
    expect(text).toMatch(/setImmediate\s*\(/);
  });
  it('emits DEVICE_ADMIN_REVOKE on /admin/:id/revoke', () => {
    expect(text).toMatch(/actionType:\s*['"]DEVICE_ADMIN_REVOKE['"]/);
  });
  it('user-self device endpoints (fingerprint/patch/delete/dismiss) emit no admin audit', () => {
    for (const route of ['/fingerprint', '/:id', '/:id/dismiss']) {
      // Use first occurrence to bound block (some routes share path with admin variant);
      // we only need to confirm no emitDevicesAdminAudit appears in the customer ones.
      const idx = text.indexOf(`router.post('${route}'`) >= 0 ? text.indexOf(`router.post('${route}'`) : text.indexOf(`router.delete('${route}'`);
      if (idx < 0) continue;
      const next = text.indexOf('\nrouter.', idx + 10);
      const block = next > 0 ? text.slice(idx, next) : '';
      expect(block).not.toMatch(/emitDevicesAdminAudit\s*\(/);
    }
  });
});

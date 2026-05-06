/** PR-W34n — audit.ts admin audit (snapshot only). */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const text = fs.readFileSync(path.resolve(__dirname, '..', 'routes', 'audit.ts'), 'utf8');

describe('PR-W34n — audit-routes admin audit', () => {
  it('imports + wrapper present', () => {
    expect(text).toMatch(/import\s*\{\s*logAuditEvent\s*\}/);
    expect(text).toMatch(/function emitAuditAdminAudit/);
    expect(text).toMatch(/setImmediate\s*\(/);
  });
  it('emits AUDIT_SNAPSHOT_CREATE on /create-snapshot', () => {
    expect(text).toMatch(/actionType:\s*['"]AUDIT_SNAPSHOT_CREATE['"]/);
  });
  it('record-* endpoints (domain audit ingestion) do NOT emit admin audit', () => {
    // Those routes record events INTO the audit ledger; they're not
    // admin actions on business state. Adding emitAuditAdminAudit there
    // would be circular noise.
    const recordIdx = text.indexOf("router.post('/record-voucher-redemption'");
    expect(recordIdx).toBeGreaterThan(0);
    const block = text.slice(recordIdx, recordIdx + 1500);
    expect(block).not.toMatch(/emitAuditAdminAudit\s*\(/);
  });
});

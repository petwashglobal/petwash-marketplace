/** PR-W34k — enterprise.ts admin audit. */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const text = fs.readFileSync(path.resolve(__dirname, '..', 'routes', 'enterprise.ts'), 'utf8');

describe('PR-W34k — enterprise admin audit', () => {
  it('imports logAuditEvent + declares emitEnterpriseAudit', () => {
    expect(text).toMatch(/import\s*\{\s*logAuditEvent\s*\}/);
    expect(text).toMatch(/function emitEnterpriseAudit/);
    expect(text).toMatch(/setImmediate\s*\(/);
  });
  const expected = [
    'ENTERPRISE_COUNTRY_CREATE',
    'ENTERPRISE_TERRITORY_CREATE',
    'ENTERPRISE_FRANCHISEE_CREATE', 'ENTERPRISE_FRANCHISEE_UPDATE',
    'ENTERPRISE_STATION_CREATE', 'ENTERPRISE_STATION_UPDATE',
    'ENTERPRISE_BILL_CREATE', 'ENTERPRISE_BILL_UPDATE',
    'ENTERPRISE_ASSET_CREATE', 'ENTERPRISE_ASSET_UPDATE',
    'ENTERPRISE_SPAREPART_CREATE', 'ENTERPRISE_SPAREPART_UPDATE',
    'ENTERPRISE_WORKORDER_CREATE', 'ENTERPRISE_WORKORDER_UPDATE',
  ];
  for (const action of expected) {
    it(`emits ${action}`, () => {
      expect(text).toMatch(new RegExp(`actionType:\\s*['"]${action}['"]`));
    });
  }
});

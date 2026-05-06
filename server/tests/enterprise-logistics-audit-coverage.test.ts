/** PR-W34i — enterprise-logistics admin audit coverage. Source-pin only. */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const text = fs.readFileSync(path.resolve(__dirname, '..', 'routes', 'enterprise-logistics.ts'), 'utf8');

describe('PR-W34i — enterprise-logistics admin audit', () => {
  it('imports logAuditEvent', () => {
    expect(text).toMatch(/import\s*\{\s*logAuditEvent\s*\}\s*from\s*['"]\.\.\/middleware\/auditLog['"]/);
  });
  it('declares emitLogisticsAudit with setImmediate + actorRole=admin', () => {
    expect(text).toMatch(/function emitLogisticsAudit/);
    expect(text).toMatch(/setImmediate\s*\(/);
    expect(text).toMatch(/actorRole:\s*['"]admin['"]/);
  });

  const expected: Array<[string, string]> = [
    ['LOGISTICS_WAREHOUSE_CREATE', '/warehouses'],
    ['LOGISTICS_WAREHOUSE_UPDATE', '/warehouses/:id'],
    ['LOGISTICS_WAREHOUSE_DEACTIVATE', '/warehouses/:id/deactivate'],
    ['LOGISTICS_INVENTORY_CREATE', '/inventory'],
    ['LOGISTICS_INVENTORY_UPDATE', '/inventory/:id'],
    ['LOGISTICS_INVENTORY_ADJUST', '/inventory/:id/adjust'],
    ['LOGISTICS_ORDER_CREATE', '/fulfillment-orders'],
    ['LOGISTICS_ORDER_UPDATE', '/fulfillment-orders/:id'],
    ['LOGISTICS_ORDER_SHIP', '/fulfillment-orders/:id/ship'],
    ['LOGISTICS_ORDER_DELIVER', '/fulfillment-orders/:id/deliver'],
    ['LOGISTICS_ORDER_CANCEL', '/fulfillment-orders/:id/cancel'],
  ];
  for (const [action, route] of expected) {
    it(`${route} → ${action}`, () => {
      expect(text).toMatch(new RegExp(`actionType:\\s*['"]${action}['"]`));
    });
  }

  it('ship handler stores trackingLast6, NOT full tracking number', () => {
    const idx = text.indexOf('/fulfillment-orders/:id/ship');
    const block = text.slice(idx, idx + 2000);
    expect(block).toMatch(/trackingLast6:/);
    // Must not bind the full trackingNumber straight into metadata.
    expect(block).not.toMatch(/\btrackingNumber:\s*trackingNumber\b/);
  });
});

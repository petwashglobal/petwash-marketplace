/** PR-W34o — inventory admin audit (5 mutators). */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const text = fs.readFileSync(path.resolve(__dirname, '..', 'routes', 'inventory.ts'), 'utf8');

describe('PR-W34o — inventory admin audit', () => {
  it('imports + wrapper present', () => {
    expect(text).toMatch(/import\s*\{\s*logAuditEvent\s*\}/);
    expect(text).toMatch(/function emitInventoryAudit/);
    expect(text).toMatch(/setImmediate\s*\(/);
  });
  for (const action of [
    'INVENTORY_SUPPLY_CREATE', 'INVENTORY_SUPPLY_UPDATE',
    'INVENTORY_STATION_SUPPLY_ADD', 'INVENTORY_STATION_SUPPLY_LEVEL_UPDATE', 'INVENTORY_STATION_SUPPLY_REFILL',
  ]) {
    it(`emits ${action}`, () => {
      expect(text).toMatch(new RegExp(`actionType:\\s*['"]${action}['"]`));
    });
  }
});

/** PR-W34q — unified-booking admin audit (refund + free-wash). */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const text = fs.readFileSync(path.resolve(__dirname, '..', 'routes', 'unified-booking.ts'), 'utf8');

describe('PR-W34q — unified-booking admin audit', () => {
  it('imports + wrapper present', () => {
    expect(text).toMatch(/import\s*\{\s*logAuditEvent\s*\}/);
    expect(text).toMatch(/function emitUnifiedBookingAdminAudit/);
    expect(text).toMatch(/setImmediate\s*\(/);
  });
  for (const action of ['BOOKING_REFUND', 'BOOKING_ADMIN_FREE_WASH']) {
    it(`emits ${action}`, () => {
      expect(text).toMatch(new RegExp(`actionType:\\s*['"]${action}['"]`));
    });
  }
  it('customer-facing lifecycle endpoints (draft/quote/confirm/start/complete/cancel/flow) emit no admin audit', () => {
    for (const route of ['/draft', '/:bookingId/quote', '/:bookingId/confirm', '/:bookingId/start', '/:bookingId/complete', '/:bookingId/cancel', '/flow']) {
      const idx = text.indexOf(`router.post('${route}'`);
      if (idx < 0) continue;
      const next = text.indexOf('\nrouter.', idx + 10);
      const block = next > 0 ? text.slice(idx, next) : text.slice(idx, idx + 3000);
      expect(block, `${route} should NOT call emitUnifiedBookingAdminAudit`).not.toMatch(/emitUnifiedBookingAdminAudit\s*\(/);
    }
  });
});

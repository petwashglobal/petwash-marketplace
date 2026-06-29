/**
 * /api/unified-booking is a DIVERGENT engine (trusts client price, confirms-as-paid
 * on any reference). It must be DARK in production until rebuilt on the canonical
 * BookingLifecycleService — gated behind UNIFIED_BOOKING_ENABLED, 503 otherwise.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
const SRC = readFileSync(resolve(__dirname, '..', 'routes', 'unified-booking.ts'), 'utf8');

describe('unified-booking dark gate (#41)', () => {
  it('all routes 503 unless UNIFIED_BOOKING_ENABLED=true (router-level guard before handlers)', () => {
    expect(SRC).toMatch(/router\.use\(\(req: Request, res: Response, next: NextFunction\)/);
    expect(SRC).toMatch(/process\.env\.UNIFIED_BOOKING_ENABLED/);
    expect(SRC).toMatch(/return res\.status\(503\)[^]*ENGINE_DARK/);
    // The guard must be declared before the first route handler.
    expect(SRC.indexOf('router.use((req: Request, res: Response, next: NextFunction)'))
      .toBeLessThan(SRC.indexOf("router.post('/draft'"));
  });
});

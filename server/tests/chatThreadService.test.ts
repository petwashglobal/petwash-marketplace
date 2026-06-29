import { describe, it, expect, vi } from 'vitest';

// db is not reached for the validation cases (they throw before any query), but
// the module imports it — provide a harmless stub.
vi.mock('../db', () => ({ db: {}, pool: {} }));

import { getOrCreateThread } from '../services/chatThreadService';

describe('chatThreadService — core rule: every thread needs a real entity', () => {
  it('rejects an unknown thread_type', async () => {
    await expect(
      getOrCreateThread({ threadType: 'NONSENSE' as any, bookingId: 'b1' }),
    ).rejects.toThrow(/Unknown thread_type/);
  });

  it('rejects a BOOKING thread with no booking_id', async () => {
    await expect(
      getOrCreateThread({ threadType: 'BOOKING' }),
    ).rejects.toThrow(/requires bookingId/);
  });

  it('rejects a SHOP_ORDER thread with no order_id', async () => {
    await expect(
      getOrCreateThread({ threadType: 'SHOP_ORDER', customerUserId: 'u1' }),
    ).rejects.toThrow(/requires orderId/);
  });

  it('rejects a K9000 thread with no station_id', async () => {
    await expect(
      getOrCreateThread({ threadType: 'K9000' }),
    ).rejects.toThrow(/requires stationId/);
  });
});

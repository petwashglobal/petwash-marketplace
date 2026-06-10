import { describe, it, expect } from 'vitest';
import { isDeliveryDay, addDeliveryDays, nextDispatchDate, ISRAELI_NO_DELIVERY_DATES } from '../services/shop/israeliDeliveryCalendar';

describe('israeliDeliveryCalendar', () => {
  it('treats Friday and Saturday as non-delivery days', () => {
    // 2026-06-12 is a Friday, 2026-06-13 a Saturday, 2026-06-14 a Sunday.
    expect(isDeliveryDay(new Date('2026-06-12T09:00:00Z'))).toBe(false); // Fri
    expect(isDeliveryDay(new Date('2026-06-13T09:00:00Z'))).toBe(false); // Sat
    expect(isDeliveryDay(new Date('2026-06-14T09:00:00Z'))).toBe(true);  // Sun
  });

  it('treats Israeli public holidays as non-delivery days', () => {
    expect(ISRAELI_NO_DELIVERY_DATES.has('2026-09-21')).toBe(true); // Yom Kippur
    expect(isDeliveryDay(new Date('2026-09-21T09:00:00Z'))).toBe(false);
  });

  it('addDeliveryDays skips weekends + holidays', () => {
    // From Thursday 2026-04-30, 1 delivery day should land on Sunday 2026-05-03
    // (Fri 5/1 + Sat 5/2 skipped).
    expect(addDeliveryDays(1, new Date('2026-04-30T09:00:00Z'))).toBe('2026-05-03');
  });

  it('nextDispatchDate rolls a Friday forward to Sunday', () => {
    expect(nextDispatchDate(new Date('2026-06-12T09:00:00Z'))).toBe('2026-06-14');
  });
});

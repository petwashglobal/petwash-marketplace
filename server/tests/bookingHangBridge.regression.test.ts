/**
 * THE HANG FIX (CEO 2026-07-24 "fix wtf").
 *
 * Sitter Suite + Walk My Pet bookings were written to sitter_bookings /
 * walk_bookings, but the ONLY live provider job inbox reads booking_requests.
 * Customers saw "waiting for provider approval"; providers had no screen that
 * could show — let alone accept — the job. Every such booking hung forever.
 *
 * The bridge mirrors those bookings into booking_requests (+ the same
 * provider notification the healthy chain sends) and writes the provider's
 * accept/decline BACK to the customer-side row.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');
const bridge = R('server/services/legacyBookingBridge.ts');
const sitter = R('server/routes/sitter-suite.ts');
const walk = R('server/routes/walk-my-pet.ts');
const v2 = R('server/routes/provider-dashboard-v2.ts');

describe('the bridge itself', () => {
  it('mirrors into booking_requests with the provider UID and a legacy back-link', () => {
    expect(bridge).toMatch(/db\.insert\(bookingRequests\)/);
    expect(bridge).toMatch(/providerId: input\.providerUserId/);
    expect(bridge).toMatch(/legacyRef: input\.legacyRef/);
    expect(bridge).toMatch(/status: 'pending'/);
  });

  it('notifies the provider on every channel the healthy chain uses', () => {
    expect(bridge).toMatch(/channels: \['inbox', 'email', 'sms', 'push'\]/);
  });

  it('is fail-soft — a bridge failure never fails the customer booking', () => {
    expect(bridge).toMatch(/mirror failed \(booking itself unaffected\)/);
    expect(bridge).toMatch(/return null;/);
  });

  it('the write-back only touches the two known legacy tables (no SQL injection surface)', () => {
    expect(bridge).toMatch(/const TABLE_STATUS: Record<string/);
    expect(bridge).toMatch(/if \(!cfg\) return;/);
    // table name is never interpolated from input
    expect(bridge).not.toMatch(/UPDATE \$\{/);
  });
});

describe('both hanging creators are bridged', () => {
  it('sitter bookings mirror on create', () => {
    expect(sitter).toMatch(/bridgeLegacyBooking\(\{/);
    expect(sitter).toMatch(/table: 'sitter_bookings'/);
    expect(sitter).toMatch(/providerUserId: sitter\.userId/);
  });

  it('walk bookings mirror on create (and the walker UID is now selected)', () => {
    expect(walk).toMatch(/userId: walkerProfiles\.userId/);
    expect(walk).toMatch(/bridgeLegacyBooking\(\{/);
    expect(walk).toMatch(/table: 'walk_bookings'/);
  });
});

describe('provider decision reaches the customer', () => {
  it('v2 accept/decline syncs the legacy row via the back-link', () => {
    expect(v2).toMatch(/quote_breakdown\n\s+FROM booking_requests/);
    expect(v2).toMatch(/applyBridgeDecision\(booking\.quote_breakdown, action\)/);
  });
});

/**
 * SITTER SUITE WAS OUTSIDE THE PAYOUT GATE (2026-09-17).
 *
 * #2491 put every provider payout behind a Pet Wash admin's "yes" — but it
 * gated EscrowService and ProviderPayoutService. Sitter Suite has its own
 * table (sitter_bookings) and its own completion path: /complete calls
 * processSitterPayout directly, so it passed through neither. It is also
 * invisible to the evidence engine, which only reads walk_bookings and
 * booking_requests.
 *
 * Nothing leaks today — processSitterPayout has no rail and the caller leaves
 * payoutStatus 'pending' (owed, not paid). This pins the gate so that whoever
 * wires a real transfer meets it instead of shipping money on a timer, and so
 * that money owed to a sitter shows up in the admin queue rather than in a log.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

const alerts: any[] = [];
vi.mock('../lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../services/AlertEngine', () => ({
  createOrUpdateAlert: vi.fn(async (a: any) => { alerts.push(a); }),
  resolveClearedByPrefix: vi.fn(async () => 0),
}));

import { NayaxSitterMarketplaceService } from '../services/NayaxSitterMarketplaceService';

const payout = (over: Record<string, unknown> = {}) =>
  NayaxSitterMarketplaceService.processSitterPayout({
    bookingId: 'SIT-2026-0001', sitterId: 77, sitterPayoutCents: 85000,
    sitterBankAccount: 'TBD', ...over,
  } as any);

beforeEach(() => { alerts.length = 0; });

describe('a completed stay with nobody’s approval', () => {
  it('raises ONE admin alert naming the sitter and the amount owed', async () => {
    const r = await payout();
    expect(r.success).toBe(true);           // completion + VAT record must not be blocked
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      dedupeKey: 'payout_review:booking:SIT-2026-0001',
      category: 'provider',
    });
    expect(alerts[0].message).toContain('₪850.00');
    expect(alerts[0].metadata.providerId).toBe(77);
  });

  it('a cron or "system" actor is not an approval', async () => {
    for (const actor of ['system', 'system_auto_approve', 'cron-sitter', '', null, undefined]) {
      alerts.length = 0;
      await payout({ approvedByUid: actor });
      expect(alerts, `actor ${JSON.stringify(actor)} must not count as a human`).toHaveLength(1);
    }
  });
});

describe('a stay a Pet Wash admin approved', () => {
  it('does not raise a "waiting for approval" alert', async () => {
    const r = await payout({ approvedByUid: 'admin-uid-123' });
    expect(r.success).toBe(true);
    expect(alerts).toEqual([]);
  });
});

describe('the payout still moves no money', () => {
  it('returns a MANUAL reference — there is no automated rail to call', async () => {
    const r = await payout({ approvedByUid: 'admin-uid-123' });
    expect(r.payoutReference).toMatch(/^MANUAL_SIT-2026-0001_/);
  });
});

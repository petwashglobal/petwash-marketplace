/**
 * Behavioural test — POST /api/unified-booking/:bookingId/confirm
 * (cross-tenant sweep, 2026-09-05).
 *
 * PRE-FIX PROBLEM: after confirming the CALLER's own booking, this route
 * called `walletService.confirmRedemption(redemptionSessionId, paymentConfirmed)`
 * — omitting the `userId` argument entirely. WalletService.confirmRedemption's
 * owner clause (`AND user_id = ${userId}`) is only applied when userId is
 * passed; when it's undefined (as it was here) the lookup falls back to
 * "sessionId alone", the exact ownership-scoping regression the sibling
 * route (routes/credit-wallet.ts POST /redemptions/:sessionId/confirm)
 * was already fixed against. A caller confirming THEIR OWN booking could
 * put ANY OTHER user's redemptionSessionId in the request body and have
 * that stranger's wallet-credit hold force-confirmed/burned.
 *
 * FIX: pass `userId` (the route's own server-derived caller uid) as the
 * 4th argument so WalletService scopes the confirm to the caller's own
 * session.
 *
 * Note: this whole router is flag-gated DARK (`UNIFIED_BOOKING_ENABLED`,
 * default off — no GA surface uses it yet, per the file's own top-of-file
 * comment) so the bug was not live in production. It's still a real
 * latent hole worth closing before any future flag flip. The test forces
 * the flag on to exercise the route directly.
 *
 * Real supertest against the router mounted in a fresh express app;
 * WalletService + the booking engine are mocked so the test focuses on
 * the ROUTE'S argument-passing contract to WalletService.
 */
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.UNIFIED_BOOKING_ENABLED = 'true';

let injectUid: string | null = null;
vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    if (!injectUid) return res.status(401).json({ error: 'Unauthorized' });
    req.firebaseUser = { uid: injectUid };
    return next();
  },
}));

vi.mock('../middleware/rbac', () => ({
  requireAdmin: (_req: any, _res: any, next: any) => next(),
  isSuperAdminVerified: () => false,
}));

let bookingRow: any = null;
vi.mock('../db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(bookingRow ? [bookingRow] : []),
      }),
    }),
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: (field: string, value: any) => ({ __op: 'eq', field, value }),
}));

vi.mock('@shared/schema', () => ({ bookings: {} }));

vi.mock('../services/unified-booking', () => ({
  unifiedBookingEngine: {
    confirm: vi.fn(async (input: any) => ({
      booking: { ...input.booking, status: 'CONFIRMED' },
      transactionId: 'txn_test_1',
      creditBreakdown: input.creditBreakdown,
    })),
  },
  transactionStampService: {},
  eventLogService: {},
  SERVICE_CONFIGS: {},
}));

vi.mock('../services/EventPublisher', () => ({
  eventPublisher: { publish: vi.fn() },
}));

const confirmRedemptionMock = vi.fn(async () => true);
vi.mock('../services/WalletService', () => ({
  walletService: { confirmRedemption: (...args: any[]) => confirmRedemptionMock(...args) },
}));

async function makeApp() {
  const app = express();
  app.use(express.json());
  const router = (await import('../routes/unified-booking')).default;
  app.use('/api/unified-booking', router);
  return app;
}

function makeBookingRow(userId: string) {
  return {
    id: 'bk_1',
    bookingNumber: 'BK-1',
    userId,
    startTime: new Date(),
    endTime: new Date(),
    status: 'quoted',
    platformData: { priceSnapshot: { gross: 100, vat: 0, net: 100, currency: 'ILS', vatRate: 0.18, breakdown: {}, platformFee: 0, providerPayout: 0 } },
    total: 100,
    subtotal: 100,
    currency: 'ILS',
    platformFee: 0,
    providerPayout: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    paymentIntentId: null,
    serviceType: 'wash',
    platformId: 'wash',
    providerId: null,
    stationId: null,
  };
}

beforeEach(() => {
  injectUid = null;
  bookingRow = null;
  confirmRedemptionMock.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/unified-booking/:bookingId/confirm · redemption ownership passthrough', () => {
  it("passes the CALLER's own uid to WalletService.confirmRedemption as the 4th arg (owner-scoped)", async () => {
    injectUid = 'booking_owner_uid';
    bookingRow = makeBookingRow('booking_owner_uid');
    const app = await makeApp();

    const res = await request(app)
      .post('/api/unified-booking/bk_1/confirm')
      .send({
        paymentReference: 'ref_1',
        redemptionSessionId: 'someone_elses_session_id',
        creditBreakdown: { totalCreditsAppliedCents: 0, cashPaidCents: 10000 },
      });

    expect(res.status).toBe(200);
    expect(confirmRedemptionMock).toHaveBeenCalledTimes(1);
    const args = confirmRedemptionMock.mock.calls[0];
    // sessionId, paymentConfirmed, idempotencyKey, userId
    expect(args[0]).toBe('someone_elses_session_id');
    expect(args[3]).toBe('booking_owner_uid'); // the FIX: server-derived caller uid, not omitted
  });

  it('403s when the caller does not own the booking, and never reaches WalletService at all', async () => {
    injectUid = 'attacker_uid';
    bookingRow = makeBookingRow('victim_uid');
    const app = await makeApp();

    const res = await request(app)
      .post('/api/unified-booking/bk_1/confirm')
      .send({
        paymentReference: 'ref_1',
        redemptionSessionId: 'anything',
        creditBreakdown: { totalCreditsAppliedCents: 0, cashPaidCents: 10000 },
      });

    expect(res.status).toBe(403);
    expect(confirmRedemptionMock).not.toHaveBeenCalled();
  });
});

/**
 * Behavioural test — server/lib/bookingRequestIdResolver.ts (2026-09-18).
 *
 * THE BUG: a Sitter Suite booking lives in sitter_bookings and is mirrored
 * into booking_requests by the legacy bridge. My Bookings links the card to
 * /booking/confirmation/<LEGACY id>, and GET /api/booking-requests/:requestId
 * resolves that id — so the page renders, and once the provider accepts it
 * renders the gold "Pay & confirm booking" panel with the real amount.
 *
 * The POST routes never learned the same trick. /pay looked the id up by
 * request_id alone and answered 404 'Booking not found'. The customer could
 * see the price and press the button; the booking could never be paid. Same
 * for /confirm (end of stay), /cancel and /meet-greet.
 *
 * Real express routing with the real param middleware; the two DB reads are
 * the injected seam, so the resolution itself is exercised, not grepped for.
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bookingRequestIdParam, resolveBookingRequestId } from '../lib/bookingRequestIdResolver';

const CANONICAL = 'BR-2026-abcd1234';
const LEGACY = 'SIT-2026-0001';
const OWNER = 'owner-uid';
const STRANGER = 'stranger-uid';

/** The bridged row: canonical id, legacy id in quote_breakdown, owned by OWNER. */
const isCanonicalId = vi.fn(async (id: string) => id === CANONICAL);
const findCanonicalForLegacyId = vi.fn(async (legacyId: string, userId: string) =>
  legacyId === LEGACY && (userId === OWNER) ? CANONICAL : null,
);

/** Whatever id the handlers end up seeing — that is what the routes act on. */
const seen: { requestId?: string; legacyRequestId?: string } = {};

function app(uid: string | null) {
  const a = express();
  a.use(express.json());
  a.use((req: any, _res, next) => { if (uid) req.user = { uid }; next(); });
  const router = express.Router();
  router.param('requestId', bookingRequestIdParam({ isCanonicalId, findCanonicalForLegacyId }));
  const echo = (req: any, res: any) => {
    seen.requestId = req.params.requestId;
    seen.legacyRequestId = req.legacyRequestId;
    // Stands in for every handler in booking-requests.ts: they all look the
    // booking up by req.params.requestId and 404 when it is not canonical.
    if (req.params.requestId !== CANONICAL) return res.status(404).json({ error: 'Booking not found' });
    return res.json({ ok: true, requestId: req.params.requestId });
  };
  for (const p of ['/pay', '/confirm', '/cancel', '/meet-greet']) router.post(`/:requestId${p}`, echo);
  router.get('/:requestId', echo);
  a.use('/api/booking-requests', router);
  return a;
}

beforeEach(() => {
  isCanonicalId.mockClear();
  findCanonicalForLegacyId.mockClear();
  delete seen.requestId;
  delete seen.legacyRequestId;
});

describe('a customer can pay the sitter booking the provider accepted', () => {
  it.each(['/pay', '/confirm', '/cancel', '/meet-greet'])(
    'POST :legacyId%s reaches the bridged booking',
    async (path) => {
      const res = await request(app(OWNER)).post(`/api/booking-requests/${LEGACY}${path}`).send({});
      expect(res.status).toBe(200);
      expect(seen.requestId).toBe(CANONICAL);
    });

  it('the id the customer sent is kept for support, not thrown away', async () => {
    await request(app(OWNER)).post(`/api/booking-requests/${LEGACY}/pay`).send({});
    expect(seen.legacyRequestId).toBe(LEGACY);
  });
});

describe('it cannot widen who reaches a booking', () => {
  it('a stranger is not resolved onto someone else’s booking', async () => {
    const res = await request(app(STRANGER)).post(`/api/booking-requests/${LEGACY}/pay`).send({});
    expect(res.status).toBe(404);
    expect(seen.requestId).toBe(LEGACY);
  });

  it('an anonymous caller never makes the server scan for a legacy id', async () => {
    const res = await request(app(null)).post(`/api/booking-requests/${LEGACY}/pay`).send({});
    expect(res.status).toBe(404);
    expect(findCanonicalForLegacyId).not.toHaveBeenCalled();
    expect(isCanonicalId).not.toHaveBeenCalled();
  });
});

describe('it costs nothing and changes nothing for a canonical id', () => {
  it('a canonical id is passed through untouched', async () => {
    const res = await request(app(OWNER)).post(`/api/booking-requests/${CANONICAL}/pay`).send({});
    expect(res.status).toBe(200);
    expect(seen.requestId).toBe(CANONICAL);
    expect(seen.legacyRequestId).toBeUndefined();
    // One indexed lookup; the jsonb scan is never reached.
    expect(findCanonicalForLegacyId).not.toHaveBeenCalled();
  });

  it('an id that is neither still 404s, exactly as before', async () => {
    const res = await request(app(OWNER)).post('/api/booking-requests/NOPE-1/pay').send({});
    expect(res.status).toBe(404);
    expect(seen.requestId).toBe('NOPE-1');
  });
});

describe('a resolver failure never takes down a route that works today', () => {
  it('a DB error lets the request through with the original id', async () => {
    const boom = vi.fn(async () => { throw new Error('db down'); });
    const a = express();
    a.use((req: any, _res, next) => { req.user = { uid: OWNER }; next(); });
    const router = express.Router();
    router.param('requestId', bookingRequestIdParam({
      isCanonicalId: boom as any,
      findCanonicalForLegacyId: async () => CANONICAL,
    }));
    router.post('/:requestId/pay', (req: any, res: any) => res.json({ requestId: req.params.requestId }));
    a.use('/api/booking-requests', router);

    const res = await request(a).post(`/api/booking-requests/${LEGACY}/pay`).send({});
    expect(res.status).toBe(200);
    expect(res.body.requestId).toBe(LEGACY);
  });
});

describe('the resolver itself', () => {
  const deps = { isCanonicalId, findCanonicalForLegacyId };
  it('returns null (= leave it alone) for a canonical id', async () => {
    expect(await resolveBookingRequestId(CANONICAL, OWNER, deps)).toBeNull();
  });
  it('returns the canonical id for the owner of a bridged booking', async () => {
    expect(await resolveBookingRequestId(LEGACY, OWNER, deps)).toBe(CANONICAL);
  });
  it('returns null without a user', async () => {
    expect(await resolveBookingRequestId(LEGACY, '', deps)).toBeNull();
    expect(isCanonicalId).not.toHaveBeenCalled();
  });
});

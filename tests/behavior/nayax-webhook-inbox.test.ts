/**
 * Behavioural tests for the Nayax webhook inbox (P0-A/B/C, 2026-08-20 audit).
 *
 * These are true behavioural tests, not grep pins: the dedup lib is mocked so
 * the middleware's decision tree is exercised end-to-end via supertest, and
 * the state transitions requested by the route handler are asserted directly.
 *
 * Coverage (agent-3 P0 evil-hunt):
 *   1. new eventId → RECEIVED → handler success → COMPLETED → replay dedups.
 *   2. new eventId → handler throws → FAILED_RETRYABLE → retry re-runs.
 *   3. PROCESSING stale (>10 min) → replay allowed.
 *   4. PROCESSING fresh → 409.
 *   5. Settlement payload with only settlementId → middleware extracts it.
 *   6. DB unavailable at claim time → 503, no processing.
 *   7. NAYAX_ALLOWED_IPS unset → 503, no example IP fallback.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import http from 'http';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AddressInfo } from 'net';

// ── Mock the DB-backed dedup lib BEFORE importing the routes ────────────────
const claimEvent = vi.fn();
const markProcessing = vi.fn();
const markCompleted = vi.fn();
const markFailedRetryable = vi.fn();
const markFailedFinal = vi.fn();
const tryClaimWebhookEvent = vi.fn();

vi.mock('../../server/lib/nayaxWebhookDedup', () => ({
  STALE_PROCESSING_MS: 10 * 60 * 1000,
  claimEvent,
  markProcessing,
  markCompleted,
  markFailedRetryable,
  markFailedFinal,
  tryClaimWebhookEvent,
}));

// The route file transitively imports many services; stub the ones that would
// require a real DB / Redis / Firestore connection so the behavioural test can
// run in isolation. Only the middleware behaviour is under test here.
vi.mock('../../server/db', () => ({ db: {}, pool: { query: vi.fn() } }));
vi.mock('../../server/services/redis', () => ({
  redis: { get: vi.fn(), setEx: vi.fn() },
}));
vi.mock('../../server/services/PaymentGatewayService', () => ({
  default: { handleNayaxWebhook: vi.fn().mockResolvedValue({ processed: true }) },
  __esModule: true,
}));
vi.mock('../../server/services/NayaxOnlinePaymentService', () => ({
  NayaxOnlinePaymentService: {
    isSignatureEnforced: () => true,
    verifyWebhookSignature: () => true,
  },
}));
vi.mock('../../server/services/googleSheetsIntegration', () => ({
  logReceipt: vi.fn(),
  appendFormSubmission: vi.fn(),
  logOpsLiveFeed: vi.fn(),
}));
vi.mock('../../server/services/DealGateService', () => ({
  canConfirmBooking: vi.fn().mockResolvedValue({ can_confirm: true, missing_requirements: [] }),
}));
vi.mock('../../server/services/PetWashNotificationEngine', () => ({
  dispatchNotifications: vi.fn(),
}));
vi.mock('../../server/services/AlertEngine', () => ({
  createOrUpdateAlert: vi.fn(),
}));
vi.mock('@shared/schema', () => ({
  paymentIntents: { transactionId: 'transactionId', status: 'status', amount: 'amount' },
  bookings: {},
  bookingStatusHistory: {},
  availabilitySlots: {},
  escrowHoldings: {},
  users: {},
}));

// ── Load the middleware factory + extractors directly ───────────────────────
// (Routes wire many extra dependencies; the middleware unit itself is what
// carries the P0-A/B contract we want to pin.)
async function loadMiddleware() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = await import('../../server/routes/nayax-webhooks');
  return mod as any;
}

// ── Test app builder ────────────────────────────────────────────────────────
function buildApp(middleware: any, keyExtractor?: any) {
  const app = express();
  app.use(express.json());
  app.post(
    '/hook',
    middleware.checkIdempotency(keyExtractor ?? middleware.defaultKeyExtractor),
    async (req, res) => {
      const inbox = res.locals.nayaxInbox;
      try {
        if (req.body.__throw === 'retryable') {
          await inbox?.markFailedRetryable?.('handler_thrown');
          return res.status(500).json({ error: 'boom' });
        }
        if (req.body.__throw === 'final') {
          await inbox?.markFailedFinal?.('handler_permanent');
          return res.status(400).json({ error: 'bad_payload' });
        }
        await inbox?.markCompleted?.();
        return res.status(200).json({ ok: true, eventId: inbox?.eventId });
      } catch (e) {
        await inbox?.markFailedRetryable?.('exception');
        return res.status(500).json({ error: 'exception' });
      }
    },
  );
  return app;
}

async function request(app: express.Application, body: any, path: string = '/hook') {
  const server = http.createServer(app).listen(0);
  const port = (server.address() as AddressInfo).port;
  const payload = JSON.stringify(body);
  const response: { status: number; body: any } = await new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let parsed: any = raw;
          try { parsed = raw ? JSON.parse(raw) : null; } catch { /* keep raw */ }
          resolve({ status: res.statusCode ?? 0, body: parsed });
        });
      },
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
  await new Promise<void>((r) => server.close(() => r()));
  return response;
}

describe('nayax webhook inbox — behavioural (2026-08-20 P0-A/B)', () => {
  beforeEach(() => {
    claimEvent.mockReset();
    markProcessing.mockReset().mockResolvedValue(undefined);
    markCompleted.mockReset().mockResolvedValue(undefined);
    markFailedRetryable.mockReset().mockResolvedValue(undefined);
    markFailedFinal.mockReset().mockResolvedValue(undefined);
  });

  it('new eventId → RECEIVED → handler success → markCompleted → replay dedups', async () => {
    const middleware = await loadMiddleware();

    // First delivery: brand-new event.
    claimEvent.mockResolvedValueOnce({
      decision: 'new',
      row: { eventId: 'e1', status: 'RECEIVED', attemptCount: 1, lastAttemptAt: new Date(), completedAt: null, sourceRoute: '/hook', errorCode: null },
    });

    const app = buildApp(middleware);
    const first = await request(app, { eventId: 'e1' });
    expect(first.status).toBe(200);
    expect(markProcessing).toHaveBeenCalledWith('e1');
    expect(markCompleted).toHaveBeenCalledWith('e1');
    expect(markFailedRetryable).not.toHaveBeenCalled();

    // Second delivery of the same event: inbox says dedup.
    claimEvent.mockResolvedValueOnce({
      decision: 'dedup',
      row: { eventId: 'e1', status: 'COMPLETED', attemptCount: 1, lastAttemptAt: new Date(), completedAt: new Date(), sourceRoute: '/hook', errorCode: null },
    });
    const replay = await request(app, { eventId: 'e1' });
    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({ received: true, duplicate: true, status: 'COMPLETED' });
  });

  it('new eventId → handler throws retryably → FAILED_RETRYABLE → retry re-runs', async () => {
    const middleware = await loadMiddleware();
    claimEvent.mockResolvedValueOnce({
      decision: 'new',
      row: { eventId: 'e2', status: 'RECEIVED', attemptCount: 1, lastAttemptAt: new Date(), completedAt: null, sourceRoute: '/hook', errorCode: null },
    });
    const app = buildApp(middleware);
    const failed = await request(app, { eventId: 'e2', __throw: 'retryable' });
    expect(failed.status).toBe(500);
    expect(markFailedRetryable).toHaveBeenCalledWith('e2', 'handler_thrown');
    expect(markCompleted).not.toHaveBeenCalled();

    // Retry — inbox reports the previous FAILED_RETRYABLE state as a 'retry'.
    claimEvent.mockResolvedValueOnce({
      decision: 'retry',
      previous: 'FAILED_RETRYABLE',
      row: { eventId: 'e2', status: 'RECEIVED', attemptCount: 2, lastAttemptAt: new Date(), completedAt: null, sourceRoute: '/hook', errorCode: null },
    });
    const retried = await request(app, { eventId: 'e2' });
    expect(retried.status).toBe(200);
    // markProcessing was called twice — once per delivery.
    expect(markProcessing).toHaveBeenCalledTimes(2);
    // markCompleted was called once — on the successful retry.
    expect(markCompleted).toHaveBeenCalledWith('e2');
  });

  it('PROCESSING stale (>10 min) → replay allowed (retry decision re-runs handler)', async () => {
    const middleware = await loadMiddleware();
    claimEvent.mockResolvedValueOnce({
      decision: 'retry',
      previous: 'PROCESSING',
      row: { eventId: 'e3', status: 'RECEIVED', attemptCount: 4, lastAttemptAt: new Date(), completedAt: null, sourceRoute: '/hook', errorCode: null },
    });
    const app = buildApp(middleware);
    const res = await request(app, { eventId: 'e3' });
    expect(res.status).toBe(200);
    expect(markProcessing).toHaveBeenCalledWith('e3');
    expect(markCompleted).toHaveBeenCalledWith('e3');
  });

  it('PROCESSING fresh → 409 (Nayax retries later)', async () => {
    const middleware = await loadMiddleware();
    claimEvent.mockResolvedValueOnce({
      decision: 'conflict',
      row: { eventId: 'e4', status: 'PROCESSING', attemptCount: 1, lastAttemptAt: new Date(), completedAt: null, sourceRoute: '/hook', errorCode: null },
    });
    const app = buildApp(middleware);
    const res = await request(app, { eventId: 'e4' });
    expect(res.status).toBe(409);
    expect(markProcessing).not.toHaveBeenCalled();
    expect(markCompleted).not.toHaveBeenCalled();
  });

  it('DB unavailable at claim time → 503, no processing, no row created', async () => {
    const middleware = await loadMiddleware();
    claimEvent.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const app = buildApp(middleware);
    const res = await request(app, { eventId: 'e5' });
    expect(res.status).toBe(503);
    expect(markProcessing).not.toHaveBeenCalled();
    expect(markCompleted).not.toHaveBeenCalled();
    expect(markFailedRetryable).not.toHaveBeenCalled();
  });

  it('handler throws with permanent error → FAILED_FINAL; retry short-circuits as dedup', async () => {
    const middleware = await loadMiddleware();
    claimEvent.mockResolvedValueOnce({
      decision: 'new',
      row: { eventId: 'e6', status: 'RECEIVED', attemptCount: 1, lastAttemptAt: new Date(), completedAt: null, sourceRoute: '/hook', errorCode: null },
    });
    const app = buildApp(middleware);
    const res = await request(app, { eventId: 'e6', __throw: 'final' });
    expect(res.status).toBe(400);
    expect(markFailedFinal).toHaveBeenCalledWith('e6', 'handler_permanent');

    claimEvent.mockResolvedValueOnce({
      decision: 'dedup',
      row: { eventId: 'e6', status: 'FAILED_FINAL', attemptCount: 1, lastAttemptAt: new Date(), completedAt: null, sourceRoute: '/hook', errorCode: 'handler_permanent' },
    });
    const replay = await request(app, { eventId: 'e6' });
    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({ duplicate: true, status: 'FAILED_FINAL' });
  });

  it('missing event key → 400 without calling claimEvent', async () => {
    const middleware = await loadMiddleware();
    const app = buildApp(middleware);
    const res = await request(app, { unrelated: 'field' });
    expect(res.status).toBe(400);
    expect(claimEvent).not.toHaveBeenCalled();
  });
});

describe('per-route key extractors — P0-B', () => {
  it('settlementKeyExtractor pulls settlementId from a real Nayax settlement fixture', async () => {
    const middleware = await loadMiddleware();
    const settlement = JSON.parse(
      readFileSync(join(__dirname, '..', 'fixtures', 'nayax', 'settlement-webhook.json'), 'utf8'),
    );
    // The default extractor (eventId || transactionId) would return null and 400 — dead route.
    expect(middleware.defaultKeyExtractor(settlement)).toBeNull();
    // The route-specific extractor pulls settlementId.
    expect(middleware.settlementKeyExtractor(settlement)).toBe('settle_2026_08_20_daily_001');
  });

  it('terminal fixture → defaultKeyExtractor pulls eventId', async () => {
    const middleware = await loadMiddleware();
    const terminal = JSON.parse(
      readFileSync(join(__dirname, '..', 'fixtures', 'nayax', 'terminal-webhook.json'), 'utf8'),
    );
    expect(middleware.defaultKeyExtractor(terminal)).toBe('evt_terminal_2026_08_20_001');
  });

  it('refund fixture → refundKeyExtractor pulls RefundID from Nayax Lynx shape', async () => {
    const middleware = await loadMiddleware();
    const refund = JSON.parse(
      readFileSync(join(__dirname, '..', 'fixtures', 'nayax', 'refund-webhook.json'), 'utf8'),
    );
    expect(middleware.refundKeyExtractor(refund)).toBe('rfd_2026_08_20_001');
  });

  it('extractor null → middleware 400s before touching the inbox', async () => {
    const middleware = await loadMiddleware();
    const app = buildApp(middleware, () => null);
    const res = await request(app, { anything: 'goes' });
    expect(res.status).toBe(400);
    expect(claimEvent).not.toHaveBeenCalled();
  });
});

describe('IP allowlist — P0-C', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    process.env = { ...OLD_ENV };
  });
  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('unset NAYAX_ALLOWED_IPS → 503 SERVICE_UNAVAILABLE, no example IP is honoured', async () => {
    delete process.env.NAYAX_ALLOWED_IPS;
    process.env.NODE_ENV = 'production';
    // Re-import — createIPAllowlist snapshots env at construction time.
    vi.resetModules();
    const { createIPAllowlist } = await import('../../server/middleware/ipAllowlist');
    const guard = createIPAllowlist('NAYAX_ALLOWED_IPS', 'Nayax');
    const app = express();
    app.use(express.json());
    app.post('/x', guard, (_req, res) => res.status(200).json({ ok: true }));
    const res = await request(app, {}, '/x');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ error: 'Service Unavailable' });
  });

  it('unset NAYAX_ALLOWED_IPS never lets Nayax\'s example CIDR 185.60.216.0/24 through', async () => {
    delete process.env.NAYAX_ALLOWED_IPS;
    process.env.NODE_ENV = 'production';
    vi.resetModules();
    // Even if a caller sent the request from an IP inside the old-fallback
    // example CIDR, the guard must refuse — there is no fallback list any more.
    const { createIPAllowlist } = await import('../../server/middleware/ipAllowlist');
    const guard = createIPAllowlist('NAYAX_ALLOWED_IPS', 'Nayax');
    const app = express();
    app.set('trust proxy', true);
    app.use(express.json());
    app.post('/x', (req, _res, next) => {
      // Fake the client IP so the test proves the fallback is truly gone.
      Object.defineProperty(req, 'ip', { value: '185.60.216.42', configurable: true });
      next();
    }, guard, (_req, res) => res.status(200).json({ ok: true }));
    const res = await request(app, {}, '/x');
    expect(res.status).toBe(503);
  });

  it('rejection log does not include the allowlist contents (P0-C sanitization)', async () => {
    process.env.NAYAX_ALLOWED_IPS = '10.0.0.0/24';
    process.env.NODE_ENV = 'production';
    vi.resetModules();
    const { createIPAllowlist } = await import('../../server/middleware/ipAllowlist');
    const { logger } = await import('../../server/lib/logger');
    const errSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const guard = createIPAllowlist('NAYAX_ALLOWED_IPS', 'Nayax');
    const app = express();
    app.set('trust proxy', true);
    app.use(express.json());
    app.post(
      '/x',
      (req, _res, next) => { Object.defineProperty(req, 'ip', { value: '203.0.113.99', configurable: true }); next(); },
      guard,
      (_req, res) => res.status(200).json({ ok: true }),
    );
    const res = await request(app, {}, '/x');
    expect(res.status).toBe(403);
    // Every logged payload for the rejection must NOT contain the CIDR list.
    for (const call of errSpy.mock.calls) {
      const dump = JSON.stringify(call);
      expect(dump).not.toContain('10.0.0.0');
      expect(dump).not.toMatch(/allowedRanges/);
    }
    errSpy.mockRestore();
  });
});

describe('signature log sanitization — P0-D', () => {
  it('validateNayaxSignature source never spells expectedSignature into a log payload', () => {
    // Simplest guarantee: read the source and check the "Invalid signature"
    // log block contains no reference to the expected digest. Regression pin.
    const src = readFileSync(join(__dirname, '..', '..', 'server', 'routes', 'nayax-webhooks.ts'), 'utf8');
    const invalidBlock = src.match(/Invalid signature'[\s\S]{0,400}?\}\);/);
    expect(invalidBlock).toBeTruthy();
    expect(invalidBlock![0]).not.toMatch(/expectedSignature/);
    expect(invalidBlock![0]).not.toMatch(/expected_signature/);
    expect(invalidBlock![0]).not.toMatch(/expectedHmac/);
  });
});

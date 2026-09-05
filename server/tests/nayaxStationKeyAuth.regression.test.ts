/**
 * Nayax station-key auth — behavioural regression pin (2026-09-05 wallet-money audit).
 *
 * THE BUG: POST /api/credit-wallet/nayax/validate-code and
 * POST /api/credit-wallet/nayax/acknowledge each did:
 *
 *     const stationApiKey = req.headers['x-station-key'] as string;
 *     if (!stationApiKey) return res.status(401)...
 *
 * ...and then NEVER used stationApiKey again. There was no comparison
 * against any registered station credential, so `x-station-key: anything`
 * authenticated. A redemption `code`/`sessionId` is just a string the
 * customer already holds from their own successful /redemptions flow, so
 * any customer could POST /nayax/acknowledge directly over HTTP to burn
 * and confirm their own hardware redemption as delivered — credit spent,
 * wash never taken, never physically at a K9000.
 *
 * These tests drive the real middleware through a real Express app. The
 * headline case — case (2) — sends a NON-EMPTY but unregistered header,
 * which is exactly what the old emptiness-only check waved through.
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const REGISTERED_KEY = 'registered-station-key-kfar-saba-right-bay';
const REGISTERED_STATION = 'IL-KS-001';

// Firestore registry stand-in: only REGISTERED_KEY resolves, mirroring
// validateStationKey()'s `where apiKey == ? and isActive == true` query.
const firestoreLookup = vi.fn(async (apiKey: string) =>
  apiKey === REGISTERED_KEY
    ? { id: 'terminal-182443', name: 'Kfar Saba RIGHT', apiKey: REGISTERED_KEY, stationId: REGISTERED_STATION, isActive: true }
    : null,
);

vi.mock('../nayaxFirestoreService', () => ({
  validateStationKey: (apiKey: string) => firestoreLookup(apiKey),
}));

// Postgres fallback registries hold nothing in this test — every
// select().from().where().limit() resolves to an empty result set.
vi.mock('../db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => [] }),
      }),
    }),
  },
}));

vi.mock('../lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const { requireNayaxStationDevice } = await import('../middleware/nayaxStationDeviceAuth');

function buildApp(opts: { bindBodyStationId?: boolean } = {}) {
  const app = express();
  app.use(express.json());
  app.post(
    '/nayax/acknowledge',
    requireNayaxStationDevice({ bindBodyStationId: opts.bindBodyStationId, route: 'test' }),
    (req, res) => res.json({ success: true, device: (req as any).stationDevice }),
  );
  return app;
}

describe('nayax station-key auth — the header is actually verified', () => {
  beforeEach(() => {
    firestoreLookup.mockClear();
  });

  it('(1) rejects a request with NO x-station-key header — 401', async () => {
    const res = await request(buildApp()).post('/nayax/acknowledge').send({ sessionId: 'sess-1' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('STATION_KEY_REQUIRED');
  });

  it('(2) THE PIN: rejects a NON-EMPTY but unregistered key — 403, not 200', async () => {
    const res = await request(buildApp())
      .post('/nayax/acknowledge')
      .set('x-station-key', 'anything')
      .send({ sessionId: 'sess-1' });

    // Under the old emptiness-only check this was a 200 and the caller's
    // wallet credit was burned without a wash.
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('STATION_KEY_INVALID');
    expect(res.body.success).toBe(false);
    // The key WAS actually looked up — not silently ignored.
    expect(firestoreLookup).toHaveBeenCalledWith('anything');
  });

  it('(2b) rejects other plausible forged values a customer might try', async () => {
    for (const forged of ['true', '1', 'undefined', 'null', REGISTERED_STATION, REGISTERED_KEY.slice(0, -1), `${REGISTERED_KEY}x`]) {
      const res = await request(buildApp())
        .post('/nayax/acknowledge')
        .set('x-station-key', forged)
        .send({ sessionId: 'sess-1' });
      expect(res.status, `forged key "${forged}" must not authenticate`).toBe(403);
    }
  });

  it('(3) rejects a whitespace-only header as absent — 401, never 200', async () => {
    const res = await request(buildApp())
      .post('/nayax/acknowledge')
      .set('x-station-key', '   ')
      .send({ sessionId: 'sess-1' });
    expect(res.status).toBe(401);
  });

  it('(4) accepts the genuinely registered station key and attaches its identity', async () => {
    const res = await request(buildApp())
      .post('/nayax/acknowledge')
      .set('x-station-key', REGISTERED_KEY)
      .send({ sessionId: 'sess-1' });
    expect(res.status).toBe(200);
    expect(res.body.device).toMatchObject({
      source: 'firestore_terminal',
      terminalId: 'terminal-182443',
      stationId: REGISTERED_STATION,
    });
  });

  it('(5) fails CLOSED when every registry lookup throws — 403, never open', async () => {
    firestoreLookup.mockRejectedValueOnce(new Error('firestore unavailable'));
    const res = await request(buildApp())
      .post('/nayax/acknowledge')
      .set('x-station-key', REGISTERED_KEY)
      .send({ sessionId: 'sess-1' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('STATION_KEY_INVALID');
  });

  it('(6) a valid key for station A cannot drive station B when bound', async () => {
    const res = await request(buildApp({ bindBodyStationId: true }))
      .post('/nayax/acknowledge')
      .set('x-station-key', REGISTERED_KEY)
      .send({ sessionId: 'sess-1', stationId: 'IL-TLV-999' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('STATION_KEY_STATION_MISMATCH');
  });

  it('(6b) the same bound key still works against its own station', async () => {
    const res = await request(buildApp({ bindBodyStationId: true }))
      .post('/nayax/acknowledge')
      .set('x-station-key', REGISTERED_KEY)
      .send({ sessionId: 'sess-1', stationId: REGISTERED_STATION.toLowerCase() });
    expect(res.status).toBe(200);
  });
});

describe('credit-wallet nayax routes are wired to the gate — source pin', () => {
  const SRC = new URL('../routes/credit-wallet.ts', import.meta.url);

  it('both routes mount requireNayaxStationDevice and no longer self-check the header', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(SRC, 'utf8');

    expect(src).toContain("import { requireNayaxStationDevice } from '../middleware/nayaxStationDeviceAuth'");
    expect(src).toMatch(/router\.post\('\/nayax\/validate-code',[\s\S]{0,200}?requireNayaxStationDevice\(/);
    expect(src).toMatch(/router\.post\('\/nayax\/acknowledge',[\s\S]{0,200}?requireNayaxStationDevice\(/);

    // The dead emptiness-only check must be gone — its presence would mean
    // someone re-introduced the unverified path.
    expect(src).not.toMatch(/const stationApiKey = req\.headers\['x-station-key'\]/);
  });
});

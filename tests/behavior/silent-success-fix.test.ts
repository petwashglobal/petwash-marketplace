/**
 * Behavioral test — provider-intake stats + mobile /logout must FAIL loudly on
 * server-side errors, not silently return success.
 *
 * These are runtime HTTP tests: we mount an Express router with the real
 * handler code and mock only the DB adapter it calls. If the handler swallows
 * an error and returns 200 `{success:true}` we detect it. Grep-only pins would
 * pass a broken handler that just prints the right words in a comment.
 *
 * Evil-hunt 2026-08-20: previous behaviour was to return `success: true`
 * (empty counters / "logged out") from the catch block on either handler,
 * hiding real outages from the admin dashboard and leaving refresh tokens
 * un-revoked on mobile after a DB blip.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// server/routes/auth.ts refuses to load without these — they'd normally come
// from prod env. Set safe test values before any import.
process.env.JWT_SECRET = 'test-jwt-secret-1234567890abcdef1234567890abcdef';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-1234567890abcdef1234567890';

// ─── Mocks that survive both routers ─────────────────────────────────────────
// db: expose db.select().from().where().limit() as a chain-terminator.
// Individual tests override the resolved value / throw behaviour per test.
const dbSelectChain = {
  from: () => dbSelectChain,
  where: () => dbSelectChain,
  limit: () => Promise.resolve([]),
};
const mockDb = {
  select: vi.fn(() => dbSelectChain),
  update: vi.fn(),
  insert: vi.fn(),
};

vi.mock('../../server/db', () => ({ db: mockDb, pool: {} }));
vi.mock('../../server/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
// Bypass auth middleware — we're testing the handler, not the guard.
vi.mock('../../server/customAuth', () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../server/middleware/rbac', () => ({
  requireAdmin: (_req: any, _res: any, next: any) => next(),
  requireStaff: (_req: any, _res: any, next: any) => next(),
}));
// Downstream services that provider-intake/auth import at module load —
// stub them so import doesn't touch real infra.
vi.mock('../../server/services/PetWashOperationsOrchestrator', () => ({
  petWashOrchestrator: {},
}));
vi.mock('../../server/services/ProviderIntakeService', () => ({
  providerIntakeService: {},
}));
vi.mock('../../server/email/luxury-email-service', () => ({
  sendProviderEnrollmentConfirmation: vi.fn(),
}));
vi.mock('../../server/services/googleSheetsIntegration', () => ({
  logProviderApplication: vi.fn(),
}));

describe('silent-success-fix — provider-intake stats fails loudly on DB error', () => {
  let app: express.Express;
  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../../server/routes/provider-intake');
    app = express();
    app.use(express.json());
    app.use('/api/provider-intake', mod.default);
  });

  it('returns 200 with real counters when DB succeeds', async () => {
    // db.select() → from → resolves an array
    dbSelectChain.from = () =>
      Promise.resolve([
        { status: 'new' },
        { status: 'new' },
        { status: 'pending_review' },
        { status: 'approved' },
      ]) as any;
    const res = await request(app).get('/api/provider-intake/stats');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, newCount: 2, pendingCount: 1, approvedCount: 1, totalCount: 4 });
  });

  it('returns 503 STATS_UNAVAILABLE when DB throws (no fake zeros)', async () => {
    dbSelectChain.from = () => Promise.reject(new Error('ECONNREFUSED'));
    const res = await request(app).get('/api/provider-intake/stats');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ success: false, error: 'STATS_UNAVAILABLE' });
    // Explicitly not the old lying shape.
    expect(res.body.totalCount).toBeUndefined();
    expect(res.body.pendingCount).toBeUndefined();
  });
});

describe('silent-success-fix — mobile auth /logout fails loudly on server error', () => {
  // Minimal jwt mock — we only need to verify the "logout swallows DB error" path.
  vi.mock('jsonwebtoken', () => ({
    default: {
      verify: vi.fn(() => ({ jti: 'jti-1', userId: 'u-1' })),
      sign: vi.fn(),
    },
  }));

  let app: express.Express;
  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../../server/routes/auth');
    app = express();
    app.use(express.json());
    // Cookie parser so req.cookies works for the logout handler.
    const cookieParser = (await import('cookie-parser')).default;
    app.use(cookieParser());
    app.use('/api/auth', mod.default);
  });

  it('returns 200 success when revoke succeeds', async () => {
    mockDb.update.mockReturnValue({
      set: () => ({ where: () => Promise.resolve() }),
    });
    const res = await request(app)
      .post('/api/auth/logout')
      .send({ refreshToken: 'some-refresh-token' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });

  it('returns 503 LOGOUT_INCOMPLETE when DB revoke throws (no fake success)', async () => {
    mockDb.update.mockReturnValue({
      set: () => ({ where: () => Promise.reject(new Error('ECONNRESET')) }),
    });
    const res = await request(app)
      .post('/api/auth/logout')
      .send({ refreshToken: 'some-refresh-token' });
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ error: 'LOGOUT_INCOMPLETE' });
    expect(res.body.success).toBeUndefined();
  });
});

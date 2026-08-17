/**
 * PR-ADMIN-AUTH-GAPS — integration coverage for
 *   claude/pr-admin-auth-gaps → server/middleware/rbac.ts requireAdmin.
 *
 * Before the fix, `requireAdmin` matched on SUPER_ADMIN_EMAILS via
 * `isSuperAdmin(email)` with no `email_verified` requirement. After the
 * fix it uses `isSuperAdminVerified(req)`, which requires
 *   req.firebaseUser.email_verified === true AND allowlist match.
 *
 * This file is a supertest-based vitest suite (NOT Playwright) because the
 * assertion surface is a server middleware whose inputs are
 * `req.firebaseUser`, not any DOM interaction.
 *
 * Run:
 *   npx vitest run tests/integration/pr-admin-auth-gaps.spec.ts
 *
 * NEEDS-BACKEND-FIXTURES: no
 *   No DB, no Firebase Admin. We mount the real requireAdmin middleware on
 *   a bare Express app and inject `req.firebaseUser` via a shim middleware.
 *   The logger and drizzle-based schema import are mocked to zero-value
 *   stubs so importing rbac.ts doesn't touch real infra.
 *
 * EXPECTED STATE ON origin/main
 *   Three cases here (email_verified=false / missing / uppercase+false)
 *   will FAIL on today's origin/main because rbac.ts still uses the
 *   legacy `isSuperAdmin(email)` shortcut — with no `email_verified`
 *   gate. Those failures ARE the regression this PR closes. Once
 *   claude/pr-admin-auth-gaps merges, all seven cases pass.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import express, { type Request, type Response, type NextFunction } from 'express';
import request from 'supertest';

// ── Mocks (hoisted) ────────────────────────────────────────────────────────

vi.mock('../../server/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// rbac.ts imports drizzle schema for `loadUserRole` — we don't exercise that
// path here, but the import must not throw. Provide minimal shells.
vi.mock('../../shared/schema-enterprise', () => ({
  systemRoles: {},
  userRoleAssignments: {},
}));

// db is only touched by loadUserRole, not by requireAdmin. Still, guard it.
vi.mock('../../server/db', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }),
  },
}));

// Ensure the SUPER_ADMIN_EMAILS env var is populated BEFORE rbac.ts is
// imported — the module cache-reads it on first call.
const ALLOWED_ADMIN = 'ceo@petwash.co.il';
process.env.SUPER_ADMIN_EMAILS = ALLOWED_ADMIN;

// ── Import under test ──────────────────────────────────────────────────────
// Dynamic import so the env vars above are set first.
let requireAdmin: any;
let invalidateSuperAdminCache: (() => void) | undefined;

beforeAll(async () => {
  const mod: any = await import('../../server/middleware/rbac');
  requireAdmin = mod.requireAdmin;
  invalidateSuperAdminCache = mod.invalidateSuperAdminCache;
});

// ── Test app factory ───────────────────────────────────────────────────────
/**
 * Build a bare Express app that:
 *   1. Injects the given `firebaseUser` shape onto req (as if
 *      firebase-auth.ts had run and produced a verified decoded token).
 *   2. Mounts the real requireAdmin.
 *   3. Terminates with 200 { ok: true }.
 *
 * The response we assert on is:
 *   - 401 if no firebaseUser email
 *   - 403 if requireAdmin denied
 *   - 200 { ok: true } if requireAdmin passed
 */
function makeApp(firebaseUser: any) {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).firebaseUser = firebaseUser;
    next();
  });
  app.get('/admin/ping', requireAdmin, (_req: Request, res: Response) => {
    res.status(200).json({ ok: true });
  });
  return app;
}

// ── Cases ──────────────────────────────────────────────────────────────────

describe('rbac.requireAdmin — canonical email_verified gate', () => {
  beforeEach(() => {
    invalidateSuperAdminCache?.();
    process.env.SUPER_ADMIN_EMAILS = ALLOWED_ADMIN;
  });

  it('403 — allowlisted email but email_verified=false (attack vector this PR closes)', async () => {
    const app = makeApp({
      uid: 'firebase-uid-attacker',
      email: ALLOWED_ADMIN,
      email_verified: false,
    });
    const res = await request(app).get('/admin/ping');
    expect(res.status).toBe(403);
    expect(res.body?.error).toMatch(/admin access required/i);
  });

  it('200 — allowlisted email AND email_verified=true (canonical success)', async () => {
    const app = makeApp({
      uid: 'firebase-uid-ceo',
      email: ALLOWED_ADMIN,
      email_verified: true,
    });
    const res = await request(app).get('/admin/ping');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('403 — normal verified customer NOT on the allowlist', async () => {
    const app = makeApp({
      uid: 'firebase-uid-customer',
      email: 'customer@example.com',
      email_verified: true,
    });
    const res = await request(app).get('/admin/ping');
    expect(res.status).toBe(403);
  });

  it('403 — email_verified missing entirely (undefined ≠ true, per isSuperAdminVerified)', async () => {
    const app = makeApp({
      uid: 'firebase-uid-legacy-token',
      email: ALLOWED_ADMIN,
      // email_verified deliberately omitted.
    });
    const res = await request(app).get('/admin/ping');
    expect(res.status).toBe(403);
  });

  it('401 — no firebaseUser email at all (unauthenticated)', async () => {
    const app = makeApp({});
    const res = await request(app).get('/admin/ping');
    expect(res.status).toBe(401);
  });

  it('403 — allowlist match is case-insensitive but verified check still required', async () => {
    const app = makeApp({
      uid: 'firebase-uid-ceo-caps',
      email: ALLOWED_ADMIN.toUpperCase(),
      email_verified: false,
    });
    const res = await request(app).get('/admin/ping');
    expect(res.status).toBe(403);
  });

  it('200 — case-insensitive email match with email_verified=true', async () => {
    const app = makeApp({
      uid: 'firebase-uid-ceo-caps',
      email: ALLOWED_ADMIN.toUpperCase(),
      email_verified: true,
    });
    const res = await request(app).get('/admin/ping');
    expect(res.status).toBe(200);
  });
});

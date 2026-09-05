/**
 * /admin/manual-credit operating-control gate — behavioural pin (2026-09-06).
 *
 * THE GAP: LEGACY_PRESTIGE_MONEY_ROUTE_GATES matched
 * `/admin/wallet/manual-credit` but NOT `/admin/manual-credit` — a DIFFERENT
 * route ~2.4k lines further down prestige-pass.ts that mints wallet credit via
 * adminManualCredit(). So that route minted real credit OUTSIDE the operating
 * control gateway, while its near-namesake was gated.
 *
 * Its own controls were never the problem and are all retained:
 *   ADMIN_SECRET + verified super-admin (both, "Audit #27"), an idempotency
 *   key, an audit_events row, and WalletEngine dedup.
 * This adds the missing operating-control gate IN FRONT of all of that, using
 * the existing MANUAL_FINANCIAL_ADJUSTMENT family — no new capability system.
 *
 * The layer order that matters, proven below:
 *   operating control → ADMIN_SECRET → verified super-admin → handler/wallet
 * A denial at any layer must stop BEFORE the wallet is mutated.
 */
import express from 'express';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach } from 'vitest';

const ROUTE_SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'prestige-pass.ts'),
  'utf8',
);

// ── Test state ──────────────────────────────────────────────────────────────
let controlAllows = true;
let superAdmin = true;
const SECRET = 'manual-credit-secret-under-test';
/** Every wallet mutation the handler would perform. MUST stay empty on denial. */
let walletMutations: Array<Record<string, unknown>> = [];
/** idempotencyKey → txnId, standing in for WalletEngine dedup. */
const applied = new Map<string, string>();
let txnSeq = 0;

/**
 * Mirrors the real layering: the router-level money gate, then the handler's
 * own two checks, then the mint.
 */
function buildApp() {
  const app = express();
  app.use(express.json());

  // Layer 1 — LEGACY_PRESTIGE_MONEY_ROUTE_GATES / assertOperatingControl
  const MONEY = /^\/admin\/manual-credit$|^\/admin\/wallet\/manual-credit$/;
  app.use((req, res, next) => {
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) return next();
    const gatePath = (req.path || '/').replace(/\/+$/, '') || '/';
    if (!MONEY.test(gatePath)) return next();
    if (!controlAllows) {
      return res.status(403).json({ error: 'OPERATING_CONTROL_DENIED', gated: gatePath });
    }
    return next();
  });

  app.post('/admin/manual-credit', (req, res) => {
    // Layer 2 — shared machine secret
    if (req.headers['x-admin-secret'] !== SECRET) {
      return res.status(403).json({ ok: false, error: 'Admin authorization required' });
    }
    // Layer 3 — verified super-admin identity (defence in depth, Audit #27)
    if (!superAdmin) {
      return res.status(403).json({ ok: false, error: 'Verified super-admin Firebase session required' });
    }
    // Layer 4 — the mint, with idempotency
    const key = String(req.body?.idempotencyKey ?? '');
    if (key && applied.has(key)) {
      return res.json({ ok: true, txnId: applied.get(key), idempotent: true });
    }
    const txnId = `txn-${++txnSeq}`;
    if (key) applied.set(key, txnId);
    walletMutations.push({ ...req.body, txnId });
    return res.json({ ok: true, txnId, idempotent: false });
  });

  return app;
}

const body = (over: Record<string, unknown> = {}) => ({
  targetUserId: 'user-1', creditType: 'promo_credit', amountCents: 5000,
  reason: 'audit test', idempotencyKey: 'idem-1', ...over,
});

describe('/admin/manual-credit — operating control gates the mint', () => {
  beforeEach(() => {
    controlAllows = true; superAdmin = true;
    walletMutations = []; applied.clear(); txnSeq = 0;
  });

  it('1. operating-control denial blocks the credit BEFORE any wallet mutation', async () => {
    controlAllows = false;
    const res = await request(buildApp())
      .post('/admin/manual-credit')
      .set('x-admin-secret', SECRET)
      .send(body());
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('OPERATING_CONTROL_DENIED');
    expect(walletMutations).toEqual([]);   // nothing minted
  });

  it('2. allowed control + WRONG secret still fails, no mutation', async () => {
    const res = await request(buildApp())
      .post('/admin/manual-credit')
      .set('x-admin-secret', 'wrong-secret')
      .send(body());
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Admin authorization required');
    expect(walletMutations).toEqual([]);
  });

  it('3. allowed control + correct secret but NOT super-admin fails, no mutation', async () => {
    superAdmin = false;
    const res = await request(buildApp())
      .post('/admin/manual-credit')
      .set('x-admin-secret', SECRET)
      .send(body());
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Verified super-admin Firebase session required');
    expect(walletMutations).toEqual([]);
  });

  it('4. the fully authorised path reaches the handler and mints once', async () => {
    const res = await request(buildApp())
      .post('/admin/manual-credit')
      .set('x-admin-secret', SECRET)
      .send(body());
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.idempotent).toBe(false);
    expect(walletMutations).toHaveLength(1);
    expect(walletMutations[0]).toMatchObject({ targetUserId: 'user-1', amountCents: 5000 });
  });

  it('5. replay with the same idempotency key does NOT mint twice', async () => {
    const app = buildApp();
    const first = await request(app).post('/admin/manual-credit')
      .set('x-admin-secret', SECRET).send(body());
    const replay = await request(app).post('/admin/manual-credit')
      .set('x-admin-secret', SECRET).send(body());

    expect(first.body.idempotent).toBe(false);
    expect(replay.status).toBe(200);
    expect(replay.body.idempotent).toBe(true);
    expect(replay.body.txnId).toBe(first.body.txnId);
    expect(walletMutations).toHaveLength(1);   // still ONE mint
  });

  it('6. a trailing slash cannot step around the money gate', async () => {
    controlAllows = false;
    const res = await request(buildApp())
      .post('/admin/manual-credit/')
      .set('x-admin-secret', SECRET)
      .send(body());
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('OPERATING_CONTROL_DENIED');
    expect(walletMutations).toEqual([]);
  });
});

describe('the real route file wires this up — source pin', () => {
  it('MANUAL_FINANCIAL_ADJUSTMENT covers BOTH manual-credit paths', () => {
    const family = ROUTE_SRC.slice(
      ROUTE_SRC.indexOf('const LEGACY_PRESTIGE_MONEY_ROUTE_GATES'),
      ROUTE_SRC.indexOf("actionType: 'MANUAL_FINANCIAL_ADJUSTMENT'"),
    );
    expect(family).toContain('^\\/admin\\/manual-credit$');
    expect(family).toContain('^\\/admin\\/wallet\\/manual-credit$');
  });

  it('the gate normalises trailing slashes before matching', () => {
    expect(ROUTE_SRC).toMatch(/const gatePath = \(req\.path \|\| '\/'\)\.replace\(\/\\\/\+\$\/, ''\) \|\| '\/';/);
    expect(ROUTE_SRC).toMatch(/candidate\.pattern\.test\(gatePath\)/);
  });

  it('manual-credit still requires BOTH the secret and a verified super-admin', () => {
    expect(ROUTE_SRC).toMatch(/if \(!isValidAdminSecret\(req\)\) \{[\s\S]{0,200}?if \(!isSuperAdminVerified\(req\)\) \{/);
  });

  it('idempotency key and audit trail are still present on the route', () => {
    expect(ROUTE_SRC).toContain('adminManualCredit({');
    expect(ROUTE_SRC).toContain("actionType: 'PRESTIGE_MANUAL_CREDIT'");
  });
});

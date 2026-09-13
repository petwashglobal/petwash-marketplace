import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { reserveLiteralSegments } from '../lib/reserveLiteralSegments';

const root = path.resolve(__dirname, '../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

/**
 * 2026-09-13 — old code that was still mounted and still reachable.
 *
 * Two separate classes, pinned together because they were found in the same
 * sweep and share one cause: a route stays in the table long after the journey
 * that used it is gone, and nothing in the build says so.
 */

describe('sealed: unauthenticated endpoints that created value or identity', () => {
  const routes = read('server/routes.ts');

  const SEALED: Array<{ path: string; anchor: string; why: string }> = [
    // /api/vouchers/purchase is sealed by PR #2455 (same fix, landed separately).
    {
      path: '/api/qr-validate',
      anchor: "app.post('/api/qr-validate', async (req, res) => {",
      why: 'returned a voucher remaining balance to any unauthenticated caller',
    },
    {
      path: '/api/smart-receipts',
      anchor: "app.post('/api/smart-receipts', async (req, res) => {",
      why: 'issued a receipt and loyalty points from a fully caller-controlled body',
    },
    {
      path: '/api/loyalty/external-enroll',
      anchor: "app.post('/api/loyalty/external-enroll', apiLimiter, async (req, res) => {",
      why: 'created a loyalty identity for an unverified address and emailed it',
    },
    {
      path: '/api/express-gift-purchase',
      anchor: "app.post('/api/express-gift-purchase', async (req, res) => {",
      why: 'unauthenticated purchase that re-entered the app over loopback',
    },
  ];

  for (const { path: p, anchor, why } of SEALED) {
    it(`${p} returns 410 before any work — ${why}`, () => {
      const at = routes.indexOf(anchor);
      expect(at, `${p} registration changed shape; re-verify the seal`).toBeGreaterThan(-1);

      // The 410 must be the FIRST thing the handler does. Measure against the
      // next handler registration so a later route's 410 cannot satisfy this.
      const nextHandler = routes.indexOf('\n  app.', at + anchor.length);
      const body = routes.slice(at, nextHandler > -1 ? nextHandler : undefined);
      const sealAt = body.indexOf("res.status(410)");
      expect(sealAt, `${p} is no longer sealed`).toBeGreaterThan(-1);
      expect(body.indexOf('ENDPOINT_SEALED')).toBeGreaterThan(-1);

      // Nothing may await, query or send mail ahead of the seal. Strip comment
      // lines first — the seal's own explanation names the call it replaced.
      const before = body
        .slice(0, sealAt)
        .split('\n')
        .filter((l) => !l.trim().startsWith('//'))
        .join('\n');
      for (const forbidden of ['await ', 'storage.', 'EmailService.', 'db.']) {
        expect(before.includes(forbidden), `${p} runs "${forbidden}" before the 410`).toBe(false);
      }
    });
  }

  it('no client code calls a sealed path', () => {
    const clientDir = path.join(root, 'client/src');
    const files: string[] = [];
    // Declared as a function, not a const arrow: a recursive const arrow has no
    // inferable return type and trips noImplicitAny.
    function walk(d: string): void {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, e.name);
        if (e.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(e.name)) files.push(full);
      }
    }
    walk(clientDir);
    const hay = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
    for (const { path: p } of SEALED) {
      expect(hay.includes(p), `${p} is sealed but the client still calls it`).toBe(false);
    }
  });
});

describe('HubSpot relays take identity from the session, not the request body', () => {
  const routes = read('server/routes.ts');

  it('sync-user requires auth and ignores body uid/email', () => {
    const at = routes.indexOf("app.post('/api/hubspot/sync-user'");
    expect(at).toBeGreaterThan(-1);
    const body = routes.slice(at, routes.indexOf('\n  app.', at + 40));
    expect(body).toContain('requireAuth');
    expect(body).toContain('req.user?.uid || req.firebaseUser?.uid');
    // the destructure must no longer pull identity out of the body
    expect(body).not.toContain('const { uid, email,');
  });

  it('track-event requires auth and ignores body email', () => {
    const at = routes.indexOf("app.post('/api/hubspot/track-event'");
    expect(at).toBeGreaterThan(-1);
    const body = routes.slice(at, routes.indexOf('\n  app.', at + 40));
    expect(body).toContain('requireAuth');
    expect(body).not.toContain('const { email, eventName');
  });
});

describe('literal routes are not swallowed by an earlier /:param route', () => {
  /**
   * Each entry: the file, the shadowing registration, and the literal sibling
   * registered later in the same router that it used to eat.
   */
  const SHADOWED: Array<[file: string, shadowing: string, literal: string]> = [
    ['server/routes/pets.ts', "router.get('/:petId', reserveLiteralSegments('petId', 'intake-forms')", "router.get('/intake-forms'"],
    ['server/routes/k9000-supplier.ts', "router.get('/spare-parts/:id', reserveLiteralSegments('id', 'orders', 'summary')", "router.get('/spare-parts/orders'"],
    ['server/routes/k9000-supplier.ts', "reserveLiteralSegments('id', 'orders', 'summary')", "router.get('/spare-parts/summary'"],
    ['server/routes/stations.ts', "router.get('/:id', reserveLiteralSegments('id', 'low-stock')", "router.get('/low-stock'"],
    ['server/routes/enterprise.ts', `router.get("/stations/:id", reserveLiteralSegments('id', 'map')`, `router.get("/stations/map"`],
    ['server/routes/google-services.ts', "router.get('/places/:placeId', reserveLiteralSegments('placeId', 'photo')", "router.get('/places/photo'"],
    ['server/routes/prestige-pass.ts', "router.get('/admin/system/e2e/:id', reserveLiteralSegments('id', 'history')", "router.get('/admin/system/e2e/history'"],
    ['server/routes/operations.ts', `router.patch("/tasks/:id", reserveLiteralSegments('id', 'bulk')`, `router.patch("/tasks/bulk"`],
    ['server/routes/operations.ts', `router.patch("/incidents/:id", reserveLiteralSegments('id', 'bulk')`, `router.patch("/incidents/bulk"`],
    ['server/routes/provider-onboarding.ts', "router.get('/admin/applications/:applicationId', reserveLiteralSegments('applicationId', 'queue')", "router.get('/admin/applications/queue'"],
    ['server/routes/events.ts', "router.get('/:id', reserveLiteralSegments('id', 'stats')", "router.get('/stats'"],
  ];

  for (const [file, shadowing, literal] of SHADOWED) {
    it(`${file} — ${literal} is reachable`, () => {
      const src = read(file);
      expect(src.indexOf(shadowing), 'guard missing on the shadowing route').toBeGreaterThan(-1);
      expect(src.indexOf(literal), 'literal route no longer registered').toBeGreaterThan(-1);
    });
  }

  it('the guard actually hands the literal route its turn', async () => {
    const app = express();
    const router = express.Router();
    router.get('/:id', reserveLiteralSegments('id', 'low-stock'), (_req: Request, res: Response) => {
      res.status(200).json({ handler: 'byId' });
    });
    router.get('/low-stock', (_req: Request, res: Response) => {
      res.status(200).json({ handler: 'lowStock' });
    });
    app.use('/t', router);

    const literal = await request(app).get('/t/low-stock');
    expect(literal.body.handler).toBe('lowStock');

    const byId = await request(app).get('/t/42');
    expect(byId.body.handler).toBe('byId');

    // case-insensitive, so /t/LOW-STOCK cannot sneak into the id handler either
    const upper = await request(app).get('/t/LOW-STOCK');
    expect(upper.body.handler).toBe('lowStock');
  });

  it('the guard runs before auth, so no protected work happens on the skipped route', async () => {
    const app = express();
    const router = express.Router();
    let authRan = false;
    router.get(
      '/:id',
      reserveLiteralSegments('id', 'stats'),
      (_req: Request, _res: Response, next: NextFunction) => {
        authRan = true;
        next();
      },
      (_req: Request, res: Response) => res.json({ handler: 'byId' }),
    );
    router.get('/stats', (_req: Request, res: Response) => res.json({ handler: 'stats' }));
    app.use('/t', router);

    await request(app).get('/t/stats');
    expect(authRan, 'auth middleware ran on the shadowed route').toBe(false);
  });
});

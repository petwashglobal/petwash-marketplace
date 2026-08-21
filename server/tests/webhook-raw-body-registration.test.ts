/**
 * Webhook raw-body-parser registration — regression pins (2026-08-21).
 *
 * ============================================================================
 * DEFECT (webhook contract-drift audit, agent 11):
 *
 * server/index.ts registers a GLOBAL express.json() body parser for every
 * request whose path is not in RAW_BODY_WEBHOOK_PATHS (or does not start
 * with '/api/webhooks/nayax/'). When express.json() consumes a request body
 * it sets req._body = true; any downstream route-level express.raw() then
 * silently no-ops (built-in behaviour of body-parser), so req.body arrives at
 * the handler as an already-parsed object instead of the Buffer the handler
 * expects.
 *
 * Two live webhook endpoints were missing from the allowlist:
 *
 *   1. POST /api/webhooks/nayax   (inline handler in server/routes.ts around
 *      the "Handle Nayax webhook events (Firestore + Google Cloud Backup)"
 *      comment). The prefix guard is '/api/webhooks/nayax/' — WITH a trailing
 *      slash — so the exact path '/api/webhooks/nayax' did NOT match. The
 *      handler then did `const rawBodyBuffer = req.body as Buffer;
 *      const rawBodyString = rawBodyBuffer.toString('utf8')`, producing
 *      "[object Object]" and crashing the follow-up JSON.parse → 400 on every
 *      real Nayax delivery. This is the webhook URL documented for operators
 *      in docs/NAYAX_PRODUCTION_SETUP_GUIDE.md and docs/API_CREDENTIALS_SETUP_GUIDE.md.
 *
 *   2. POST /api/sumit/webhook   (server/routes/sumit-webhook.ts). Handler
 *      mounts its own express.raw with a wildcard type and immediately checks
 *      Buffer.isBuffer(req.body); because the global parser had already
 *      consumed the body, req.body was a parsed object, the guard fired, and
 *      the handler returned 400 invalid_body on every real SUMIT delivery.
 *      Non-2xx tells SUMIT to retry → retry storm.
 *
 * FIX: add both exact paths to RAW_BODY_WEBHOOK_PATHS so the global parser
 * skips them and the route-level express.raw() actually captures the bytes.
 * ============================================================================
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const INDEX_TS = fs.readFileSync(
  path.resolve(__dirname, '..', 'index.ts'),
  'utf8',
);

describe('server/index.ts RAW_BODY_WEBHOOK_PATHS registration (agent-11, 2026-08-21)', () => {
  it('declares the RAW_BODY_WEBHOOK_PATHS allowlist', () => {
    expect(INDEX_TS).toMatch(/const RAW_BODY_WEBHOOK_PATHS = new Set\(\[/);
  });

  it('exempts POST /api/webhooks/nayax (exact) — the docs-published Nayax URL', () => {
    // Must be listed by exact path; the prefix guard below requires a trailing
    // slash and therefore never matched the singular path.
    expect(INDEX_TS).toMatch(/['"]\/api\/webhooks\/nayax['"]/);
  });

  it('exempts POST /api/sumit/webhook — SUMIT HMAC receiver', () => {
    expect(INDEX_TS).toMatch(/['"]\/api\/sumit\/webhook['"]/);
  });

  it('still exempts the previously registered raw-body webhook paths', () => {
    expect(INDEX_TS).toMatch(/['"]\/api\/webhooks\/sendgrid['"]/);
    expect(INDEX_TS).toMatch(/['"]\/api\/webhooks\/nayax-events['"]/);
    expect(INDEX_TS).toMatch(/['"]\/api\/webhooks\/whatsapp['"]/);
  });

  it('keeps the /api/webhooks/nayax/ prefix guard for the sub-routes (terminal, settlement, refund, payment, cortina, monyx)', () => {
    // The prefix match still covers the router-mounted Nayax sub-paths; the
    // fix above ADDS the singular /api/webhooks/nayax, it does not replace
    // the prefix. Regression pin so a future refactor doesn't silently drop
    // the prefix and re-break every sub-route.
    expect(INDEX_TS).toMatch(/req\.path\.startsWith\(['"]\/api\/webhooks\/nayax\/['"]\)/);
  });
});

describe('notifications router — dead unauthenticated webhook stubs are removed (agent-11, 2026-08-21)', () => {
  // The two endpoints POST /api/notifications/webhook/{delivered,failed} were
  // never wired to any provider (no caller in server/ or client/) yet were
  // exposed publicly with no signature and no auth — an anonymous caller could
  // POST {logId:<n>} and flip an arbitrary notification_logs row to delivered
  // or failed, hiding real send failures from monitoring. The routes are gone;
  // provider-side status updates live only in the signed webhook handlers.
  const NOTIF_TS = fs.readFileSync(
    path.resolve(__dirname, '..', 'routes', 'notifications.ts'),
    'utf8',
  );

  it('no router.post("/webhook/delivered") remains', () => {
    expect(NOTIF_TS).not.toMatch(/router\.post\(\s*["']\/webhook\/delivered["']/);
  });

  it('no router.post("/webhook/failed") remains', () => {
    expect(NOTIF_TS).not.toMatch(/router\.post\(\s*["']\/webhook\/failed["']/);
  });
});

/**
 * Two production error storms found in Cloud Run logs (2026-07-22, CEO's
 * "backend has bugs" report — he was right):
 *
 * 1) POST /api/webhooks/sendgrid → 500 loop. The global express.json() parsed
 *    the body BEFORE the route's express.raw() could, so req.body arrived as an
 *    object; `req.body.toString()` = "[object Object]" → JSON.parse crash →
 *    500 → SendGrid retried the same batch forever. Also broke ECDSA signature
 *    verification (signed over raw bytes, not an object's toString).
 *
 * 2) [AsyncJobWorker] Cycle error every 30s: pw_async_jobs was NEVER created
 *    by any migration (phantom table). Every claim query failed; every
 *    enqueued Drive/Sheets/Gmail/SUMIT job silently evaporated.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const indexTs = readFileSync(resolve(ROOT, 'server/index.ts'), 'utf8');
const routes = readFileSync(resolve(ROOT, 'server/routes.ts'), 'utf8');
const queryClient = readFileSync(resolve(ROOT, 'client/src/lib/queryClient.ts'), 'utf8');
const migrationPath = resolve(ROOT, 'migrations/0100_pw_async_jobs.sql');

describe('SendGrid webhook gets the RAW body', () => {
  it('the global JSON parser skips /api/webhooks/sendgrid (and only it)', () => {
    expect(indexTs).toMatch(/req\.path === '\/api\/webhooks\/sendgrid' \? next\(\) : globalJsonParser\(req, res, next\)/);
  });

  it('signature verification signs over the normalized rawBody, never an object toString', () => {
    expect(routes).toMatch(/\.update\(timestamp \+ rawBody\)/);
    expect(routes).not.toMatch(/\.update\(timestamp \+ req\.body\.toString\(\)\)/);
    expect(routes).toMatch(/Buffer\.isBuffer\(req\.body\)/);
  });

  it('processing failure acks 200 — a 5xx makes SendGrid retry the same batch forever', () => {
    // Scope the check to the sendgrid handler block.
    const start = routes.indexOf("'/api/webhooks/sendgrid'");
    const block = routes.slice(start, routes.indexOf('processEmailEvent(event', start) + 400);
    expect(start).toBeGreaterThan(-1);
    expect(block).not.toMatch(/status\(500\)/);
    expect(routes).toMatch(/processing_failed_logged/);
  });
});

describe('pw_async_jobs exists as a real migration', () => {
  it('migration 0100 creates the table the worker polls', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const mig = readFileSync(migrationPath, 'utf8');
    expect(mig).toMatch(/CREATE TABLE IF NOT EXISTS pw_async_jobs/);
    // Every column the worker's SQL touches must exist in the DDL.
    for (const col of ['job_type', 'entity_type', 'entity_id', 'payload', 'status',
      'attempts', 'max_attempts', 'next_run_at', 'last_error', 'locked_at', 'locked_by', 'updated_at']) {
      expect(mig).toContain(col);
    }
    expect(mig).toMatch(/pw_async_jobs_poll_idx/);
  });
});

describe('guest 401s are not console errors', () => {
  it('queryClient only console.errors non-401 failures, with status+url in the message', () => {
    expect(queryClient).toMatch(/res\.status !== 401/);
    expect(queryClient).toMatch(/\[API Error\] \$\{res\.status\} \$\{res\.url\}/);
  });
});

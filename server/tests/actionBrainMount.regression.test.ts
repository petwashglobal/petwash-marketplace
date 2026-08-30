/**
 * server/routes.ts — Action Brain mount regression pin.
 *
 * Locks that both Action Brain routers are mounted at /api/actions
 * behind validateFirebaseToken + apiLimiter, matching the pattern
 * every other authed feature uses.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes.ts'),
  'utf8',
);

describe('Action Brain mount (doctrine §41)', () => {
  it('imports both router factories + the shared in-memory store', () => {
    expect(SRC).toMatch(/buildAvailableActionsRouter[\s\S]{0,120}from ["']\.\/routes\/available-actions["']/);
    expect(SRC).toMatch(/buildActionExecutionRouter[\s\S]{0,180}from ["']\.\/routes\/action-execution["']/);
    expect(SRC).toMatch(/createInMemoryStore[\s\S]{0,120}from ["']@shared\/marketplace\/actionExecution["']/);
  });

  it('mounts both routers at /api/actions behind validateFirebaseToken + apiLimiter', () => {
    // Both routers must run through the same auth + rate-limiter chain
    // that every other authed endpoint uses — no bypass.
    expect(SRC).toMatch(
      /app\.use\(['"]\/api\/actions['"], validateFirebaseToken, apiLimiter, availableActionsRouter\)/,
    );
    expect(SRC).toMatch(
      /app\.use\(['"]\/api\/actions['"], validateFirebaseToken, apiLimiter, actionExecutionRouter\)/,
    );
  });

  it('startup log surfaces the framework mount so ops can grep boot logs', () => {
    expect(SRC).toMatch(/Action Brain registered at \/api\/actions/);
  });

  it('first-pass loaders return null (stub) — do NOT reach the DB during boot', () => {
    // The stubs return null so the endpoints reach production with a
    // well-formed 404 while loaders land incrementally. Real loaders
    // land per action-type; if a naive edit inlined a DB call, this
    // pin catches it before it ships.
    const idx = SRC.indexOf('buildAvailableActionsRouter({');
    const end = SRC.indexOf('});', idx);
    const body = SRC.slice(idx, end);
    // Zero references to db / storage / drizzle inside the stub block.
    expect(body).not.toMatch(/\bdb\./);
    expect(body).not.toMatch(/\bstorage\./);
    expect(body).not.toMatch(/drizzle/);
    // Every loader returns null.
    const nullReturns = body.match(/return null;/g) ?? [];
    expect(nullReturns.length).toBeGreaterThanOrEqual(4);
  });
});

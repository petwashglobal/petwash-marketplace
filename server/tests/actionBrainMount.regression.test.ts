/**
 * server/routes.ts — Action Brain mount regression pin.
 *
 * Locks BOTH routers mount at /api/actions AND the CEO §1–§7 security
 * invariants for the mutation surface. A regression that reintroduces
 * client-supplied impact / reauth, or enables mutations without a
 * durable store, trips these pins before it ships.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes.ts'),
  'utf8',
);

describe('Action Brain mount — doctrine §41', () => {
  it('imports both router factories + the test-only store + shared types', () => {
    expect(SRC).toMatch(/buildAvailableActionsRouter[\s\S]{0,120}from ["']\.\/routes\/available-actions["']/);
    expect(SRC).toMatch(/buildActionExecutionRouter[\s\S]{0,180}from ["']\.\/routes\/action-execution["']/);
    expect(SRC).toMatch(/createInMemoryTestOnlyStore/);
    expect(SRC).toMatch(/ImpactResolver/);
    expect(SRC).toMatch(/ServerAuthContext/);
  });

  it('mounts both routers at /api/actions behind validateFirebaseToken + apiLimiter', () => {
    expect(SRC).toMatch(
      /app\.use\(['"]\/api\/actions['"], validateFirebaseToken, apiLimiter, availableActionsRouter\)/,
    );
    expect(SRC).toMatch(
      /app\.use\(['"]\/api\/actions['"], validateFirebaseToken, apiLimiter, actionExecutionRouter\)/,
    );
  });

  it('boot log surfaces framework mount + mutation state', () => {
    expect(SRC).toMatch(/Action Brain registered at \/api\/actions/);
    expect(SRC).toMatch(/MUTATIONS \$\{mutationsEnabled\(\) \? 'ENABLED' : 'DISABLED/);
  });
});

describe('CEO §7 — MUTATIONS off by default (feature flag + durable-store gate)', () => {
  it('isMutationEnabled requires BOTH env flag AND durable store availability', () => {
    // The gate must NOT be `process.env.X === '1'` alone — that would
    // enable mutations against the in-memory store in prod.
    expect(SRC).toMatch(
      /process\.env\.ACTION_BRAIN_MUTATIONS_ENABLED === '1'[\s\S]{0,120}durableStoreAvailable/,
    );
    expect(SRC).toMatch(/const durableStoreAvailable = false/);
  });
});

describe('CEO §2 — auth context is server-derived from Firebase token', () => {
  it('authContextFor reads req.firebaseUser.uid + auth_time; never touches req.body', () => {
    const idx = SRC.indexOf('authContextFor: (req');
    expect(idx).toBeGreaterThan(0);
    const end = SRC.indexOf('},', idx);
    const body = SRC.slice(idx, end);
    expect(body).toMatch(/req\?\.firebaseUser\?\.uid/);
    expect(body).toMatch(/auth_time/);
    // Body never contributes to auth.
    expect(body).not.toMatch(/req\.body/);
    // recentReauthAt is NOT sourced from the request body.
    expect(body).not.toMatch(/reauthProven/);
  });
});

describe('CEO §6 — READ endpoint stays safe with stubbed loaders', () => {
  it('first-pass loaders all return null — no DB calls at boot', () => {
    const idx = SRC.indexOf('buildAvailableActionsRouter({');
    const end = SRC.indexOf('});', idx);
    const body = SRC.slice(idx, end);
    const nullReturns = body.match(/return null;/g) ?? [];
    expect(nullReturns.length).toBeGreaterThanOrEqual(4);
    expect(body).not.toMatch(/\bdb\./);
    expect(body).not.toMatch(/drizzle/);
  });
});

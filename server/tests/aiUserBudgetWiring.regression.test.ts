/**
 * Regression pin — aiUserBudget wiring across AI endpoints
 * (AUDIT-AI-8 / #203 slice 2).
 *
 * The existing rate limiters aiChatLimiter + aiChatHourlyLimiter are
 * IP-only and in-memory. The per-Firebase-UID daily budget (Redis-
 * backed) lives in server/middleware/aiUserBudget.ts and is what
 * actually stops one authenticated user from burning through the AI
 * token budget from a single logged-in seat. This slice wires it to
 * every AI-fanning endpoint we could find.
 *
 * This pin refuses REGRESSION on the migrated wiring — any listed
 * endpoint that drops the aiUserBudget middleware fails the pin. New
 * AI endpoints added to these files must include aiUserBudget in the
 * middleware chain.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');

const WIRED_FILES = [
  'server/routes.ts',
  'server/routes/loyalty.ts',
  'server/routes/daycare-calculator.ts',
  'server/routes/provider-console.ts',
];

describe('AUDIT-AI-8 / #203 slice 2 — aiUserBudget wiring', () => {
  for (const rel of WIRED_FILES) {
    it(`${rel} imports aiUserBudget`, () => {
      const src = readFileSync(join(ROOT, rel), 'utf8');
      expect(src).toMatch(/from ['"]\.{1,2}\/middleware\/aiUserBudget['"]/);
    });

    it(`${rel} still calls aiUserBudget({...}) in at least one endpoint`, () => {
      const src = readFileSync(join(ROOT, rel), 'utf8');
      expect(src).toMatch(/aiUserBudget\(\{/);
    });
  }

  it('routes.ts /api/ai/chat still chains aiUserBudget after aiChatLimiter', () => {
    const src = readFileSync(join(ROOT, 'server/routes.ts'), 'utf8');
    expect(src).toMatch(/\/api\/ai\/chat['"]\s*,\s*aiChatLimiter\s*,\s*aiChatHourlyLimiter\s*,\s*aiUserBudget\(\{/);
  });

  it('routes.ts /api/v1/chat/message still chains aiUserBudget after aiChatLimiter', () => {
    const src = readFileSync(join(ROOT, 'server/routes.ts'), 'utf8');
    expect(src).toMatch(/\/api\/v1\/chat\/message['"]\s*,\s*aiChatLimiter\s*,\s*aiChatHourlyLimiter\s*,\s*aiUserBudget\(\{/);
  });

  it('provider-console /ai/query has aiUserBudget in its middleware chain', () => {
    const src = readFileSync(join(ROOT, 'server/routes/provider-console.ts'), 'utf8');
    expect(src).toMatch(/router\.post\(['"]\/ai\/query['"]\s*,\s*aiUserBudget\(\{/);
  });
});

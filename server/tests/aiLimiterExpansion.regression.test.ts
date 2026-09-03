/**
 * Post-release 2026-09-03 (backlog P1): AI-3 / AI-5 / AI-7 —
 * aiChatLimiter + aiUserBudget expansion to previously-unlimited
 * Gemini-backed endpoints. Source-anchored pins keep the wire in
 * place so a future refactor cannot silently strip either middleware.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), 'utf8');
}

describe('AI limiter expansion — provider-console.ts /ai/query', () => {
  const src = read('server/routes/provider-console.ts');

  it('imports aiChatLimiter alongside aiUserBudget', () => {
    expect(src).toMatch(/import\s*\{\s*aiChatLimiter\s*\}\s*from\s*['"]\.\.\/middleware\/rateLimiter['"]/);
    expect(src).toMatch(/aiUserBudget/);
  });

  it('/ai/query chains aiChatLimiter FIRST, then aiUserBudget', () => {
    // Cheapest reject (IP burst) must run before the per-uid budget check.
    expect(src).toMatch(
      /router\.post\(\s*['"]\/ai\/query['"]\s*,\s*aiChatLimiter\s*,\s*aiUserBudget\(\{/,
    );
  });
});

describe('AI limiter expansion — ai-booking.ts /parse|/match-score|/slot-suggestions|/care-tags', () => {
  const src = read('server/routes/ai-booking.ts');

  it('imports both aiChatLimiter and aiUserBudget', () => {
    expect(src).toMatch(/import\s*\{\s*aiChatLimiter\s*\}\s*from\s*['"]\.\.\/middleware\/rateLimiter['"]/);
    expect(src).toMatch(/import\s*\{\s*aiUserBudget\s*\}\s*from\s*['"]\.\.\/middleware\/aiUserBudget['"]/);
  });

  it.each([
    ['/parse',             'ai_booking_parse'],
    ['/match-score',       'ai_booking_match_score'],
    ['/slot-suggestions',  'ai_booking_slot_suggestions'],
    ['/care-tags',         'ai_booking_care_tags'],
  ])('%s chains aiChatLimiter, then aiUserBudget with tag %s', (path, tag) => {
    const escaped = path.replace(/[/-]/g, (c) => `\\${c}`);
    const rx = new RegExp(
      `router\\.post\\(\\s*['"]${escaped}['"]\\s*,\\s*aiChatLimiter\\s*,\\s*aiUserBudget\\(\\{[^}]*endpointTag:\\s*['"]${tag}['"]`,
      's',
    );
    expect(src).toMatch(rx);
  });
});

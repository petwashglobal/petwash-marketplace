/**
 * Regression pin — subscription AI-recommendations prompt-budget +
 * middleware wiring (AUDIT-AI-11 / #206).
 *
 * POST /api/subscriptions/:id/ai-recommendations previously:
 *   1. injected the FULL active-product catalogue into the Gemini
 *      prompt — a growth-linear per-call token blow-up
 *   2. skipped the per-UID daily AI budget middleware entirely
 *   3. called generateContent without maxOutputTokens, so a runaway
 *      response could spend past any bound.
 *
 * Fix: the handler now pre-filters the catalogue by petType +
 * sizeGroup + ageGroup, hard-caps the injected list to AI_PRODUCT_LIMIT
 * (=40), chains aiUserBudget, and caps maxOutputTokens on the Gemini
 * call. This pin refuses regression on all three.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const src = readFileSync(join(ROOT, 'server/routes.ts'), 'utf8');

describe('AUDIT-AI-11 / #206 — /api/subscriptions/:id/ai-recommendations', () => {
  it('endpoint chains requireAuth + aiUserBudget', () => {
    expect(src).toMatch(/\/api\/subscriptions\/:id\/ai-recommendations['"]\s*,\s*requireAuth\s*,\s*aiUserBudget\(\{/);
  });

  it('handler defines an AI_PRODUCT_LIMIT cap on injected products', () => {
    expect(src).toMatch(/const AI_PRODUCT_LIMIT\s*=\s*40/);
  });

  it('handler filters products by petType + sizeGroup + ageGroup before injection', () => {
    expect(src).toMatch(/const filtered = allActive\.filter/);
    expect(src).toMatch(/typeOk && sizeOk && ageOk/);
  });

  it('handler slices the injected product list to AI_PRODUCT_LIMIT', () => {
    expect(src).toMatch(/\.slice\(0, AI_PRODUCT_LIMIT\)/);
  });

  it('Gemini call passes a maxOutputTokens cap', () => {
    expect(src).toMatch(/subscription_ai_recommendations[\s\S]{0,4000}?maxOutputTokens:\s*\d+/);
  });
});

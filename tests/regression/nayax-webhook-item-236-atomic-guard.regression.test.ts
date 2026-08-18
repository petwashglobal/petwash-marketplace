import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = readFileSync(
  join(__dirname, '..', '..', 'server', 'routes', 'nayax-webhooks.ts'),
  'utf8',
);

// Regression pin for Item 236 (2026-08-18, MONEY-CODE): the previous flow
// read wash_history.status once, then unconditionally updated
// users.totalSpent / users.loyaltyPoints. Two concurrent Nayax webhook
// deliveries for the same washHistoryId both saw status='pending' and both
// applied the blind increment — silently double-crediting tier progression
// and birthday-coupon math.

describe('nayax-webhooks — Item 236 atomic race guard (MONEY-CODE)', () => {
  it('claims wash_history atomically with UPDATE ... WHERE status = pending RETURNING', () => {
    // Strip comments so the pin only tests real code paths.
    const stripped = SRC.replace(/\/\/[^\n]*/g, '');
    expect(stripped).toMatch(/db\s*\.\s*update\(washHistoryTable\)/);
    expect(stripped).toMatch(/eq\(washHistoryTable\.status,\s*['"]pending['"]\)/);
    expect(stripped).toMatch(/\.returning\(\{\s*id:\s*washHistoryTable\.id\s*\}\)/);
  });

  it('sets the intermediate status to `processing` (not `completed`) on claim', () => {
    // Reserve `completed` for the tail of the successful handler.
    expect(SRC).toMatch(/\.set\(\{\s*status:\s*['"]processing['"]\s*\}\)/);
  });

  it('returns idempotent 200 with concurrent_lost_race note when the claim loses', () => {
    expect(SRC).toMatch(/note:\s*['"]concurrent_lost_race['"]/);
    expect(SRC).toMatch(/claimed\.length === 0/);
  });

  it('never removes the pre-existing already_completed idempotent early-return', () => {
    expect(SRC).toMatch(/note:\s*['"]already_completed['"]/);
  });
});

/**
 * CEO MASTER DIRECTIVE 2026-08-28 §57 §78 §79 — AI Context
 * Authorization invariants.
 *
 * The server builds an AUTHORIZED context BEFORE any AI call. This
 * suite pins:
 *   * every scope has a NARROW allow-list of keys
 *   * the hard denylist covers bank / national ID / passwords /
 *     protected characteristics
 *   * the builder REJECTS unknown keys and denylist matches
 *   * the assertAiContext guard forces every caller to use a real
 *     context, never a hand-rolled bag
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  AI_HARD_DENYLIST,
  AI_SCOPE_KEY_ALLOWLIST,
} from '@shared/lib/aiContext';
import {
  buildAiContext,
  bucketMoneyCents,
  bucketProviderRate,
  bucketRateVsMedian,
  assertAiContext,
  AiScopeAuthorizationError,
} from '../services/aiContextBuilder';

const CONTRACT = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'shared', 'lib', 'aiContext.ts'),
  'utf8',
);

describe('AI scope contract (CEO §57 §78)', () => {
  it('every scope defines a NARROW allow-list — nothing wide', () => {
    for (const [scope, keys] of Object.entries(AI_SCOPE_KEY_ALLOWLIST)) {
      expect(keys.length, `scope ${scope} has too many keys — narrow it`).toBeLessThanOrEqual(10);
      expect(keys.length, `scope ${scope} allow-list is empty`).toBeGreaterThan(0);
    }
  });

  it('hard denylist covers bank / national ID / passwords / protected characteristics', () => {
    // Sample the critical categories — a refactor that dropped one
    // trips CI here.
    for (const term of [
      'password', 'passwordHash', 'pin', 'apiKey',
      'israeliId', 'israeliIdEncrypted', 'passportNumber', 'idDocumentUrl',
      'bankIban', 'bankAccountNumber', 'creditCardNumber', 'cardCvv',
      'race', 'ethnicity', 'religion', 'sexualOrientation', 'medicalConditions',
      'chainOfThought', 'reasoning', 'systemPrompt',
    ]) {
      expect(AI_HARD_DENYLIST.has(term), `denylist missing ${term}`).toBe(true);
    }
  });
});

describe('buildAiContext filter (CEO §78 §79)', () => {
  it('projects ONLY allow-list keys — everything else is dropped silently', () => {
    const ctx = buildAiContext({
      scope: 'concierge_greeting',
      actor: 'pet_parent',
      userUid: 'firebase-uid-123',
      language: 'en',
      candidate: {
        displayName: 'Nir',
        tier: 'gold',
        timezone: 'Asia/Jerusalem',
        timeOfDay: 'morning',
        attentionCount: 3,
        // Not on the allow-list — must drop.
        walletBalanceCents: 1234,
        emailAddress: 'x@y.com',
      },
    });
    expect(ctx.payload).toEqual({
      displayName: 'Nir',
      tier: 'gold',
      timezone: 'Asia/Jerusalem',
      timeOfDay: 'morning',
      attentionCount: 3,
    });
  });

  it('REFUSES any denylisted key EVEN IF a scope allow-list widens to include it', () => {
    // Belt-and-braces: substring match against the denylist. A
    // scope that (mistakenly) allowed `bankIban` still sees it
    // stripped.
    const ctx = buildAiContext({
      scope: 'support_transaction',
      actor: 'pet_parent',
      userUid: 'x',
      language: 'en',
      candidate: {
        transactionRef: 'TX-1',
        state: 'confirmed',
        amountBucket: 'under_500',
        currency: 'ILS',
        // Denylisted substring — even if a caller manually inserted
        // it, must NOT appear on the payload.
        bankIbanLast4: '1234',
      },
    });
    expect(ctx.payload).not.toHaveProperty('bankIbanLast4');
    expect(ctx.payload).toEqual({
      transactionRef: 'TX-1',
      state: 'confirmed',
      amountBucket: 'under_500',
      currency: 'ILS',
    });
  });

  it('rejects an empty scope / actor / userUid / language input (§78)', () => {
    expect(() => buildAiContext({ scope: '' as any, actor: 'pet_parent', userUid: 'x', language: 'en', candidate: {} }))
      .toThrow(AiScopeAuthorizationError);
    expect(() => buildAiContext({ scope: 'concierge_greeting', actor: '' as any, userUid: 'x', language: 'en', candidate: {} }))
      .toThrow(AiScopeAuthorizationError);
    expect(() => buildAiContext({ scope: 'concierge_greeting', actor: 'pet_parent', userUid: '', language: 'en', candidate: {} }))
      .toThrow(AiScopeAuthorizationError);
    expect(() => buildAiContext({ scope: 'concierge_greeting', actor: 'pet_parent', userUid: 'x', language: '' as any, candidate: {} }))
      .toThrow(AiScopeAuthorizationError);
  });

  it('rejects an unknown scope even if allow-list-shaped', () => {
    expect(() => buildAiContext({
      scope: 'unknown_scope' as any,
      actor: 'pet_parent',
      userUid: 'x',
      language: 'en',
      candidate: { displayName: 'Nir' },
    })).toThrow(AiScopeAuthorizationError);
  });

  it('stamps a fresh scopeToken + issuedAt on every build', () => {
    const a = buildAiContext({
      scope: 'concierge_greeting', actor: 'pet_parent', userUid: 'x', language: 'en',
      candidate: { displayName: 'A' },
    });
    const b = buildAiContext({
      scope: 'concierge_greeting', actor: 'pet_parent', userUid: 'x', language: 'en',
      candidate: { displayName: 'A' },
    });
    expect(a.scopeToken).not.toEqual(b.scopeToken);
    expect(typeof a.issuedAt).toBe('string');
    expect(a.issuedAt.length).toBeGreaterThan(0);
  });
});

describe('assertAiContext guard (CEO §78)', () => {
  it('throws when the caller passes a bare object', () => {
    expect(() => assertAiContext(null)).toThrow(AiScopeAuthorizationError);
    expect(() => assertAiContext(undefined)).toThrow(AiScopeAuthorizationError);
    expect(() => assertAiContext({})).toThrow(AiScopeAuthorizationError);
    expect(() => assertAiContext({ scope: 'concierge_greeting' })).toThrow(AiScopeAuthorizationError);
  });

  it('accepts a real built context', () => {
    const ctx = buildAiContext({
      scope: 'concierge_greeting', actor: 'pet_parent', userUid: 'x', language: 'en',
      candidate: { displayName: 'Nir' },
    });
    expect(() => assertAiContext(ctx)).not.toThrow();
  });
});

describe('bucket helpers (CEO §79)', () => {
  it('bucketMoneyCents groups amounts — never leaks raw cents', () => {
    expect(bucketMoneyCents(null)).toBe('zero');
    expect(bucketMoneyCents(0)).toBe('zero');
    expect(bucketMoneyCents(500)).toBe('under_100');
    expect(bucketMoneyCents(9999)).toBe('under_100');
    expect(bucketMoneyCents(10000)).toBe('under_500');
    expect(bucketMoneyCents(49999)).toBe('under_500');
    expect(bucketMoneyCents(50000)).toBe('under_2000');
    expect(bucketMoneyCents(200000)).toBe('over_2000');
    expect(bucketMoneyCents(500000)).toBe('over_2000');
  });

  it('bucketRateVsMedian returns above/at/below', () => {
    expect(bucketRateVsMedian(120, 100)).toBe('above');
    expect(bucketRateVsMedian(115, 100)).toBe('at');
    expect(bucketRateVsMedian(85, 100)).toBe('at');
    expect(bucketRateVsMedian(80, 100)).toBe('below');
  });

  it('bucketProviderRate groups 0-100 → low/medium/high', () => {
    expect(bucketProviderRate(95)).toBe('high');
    expect(bucketProviderRate(75)).toBe('medium');
    expect(bucketProviderRate(30)).toBe('low');
    expect(bucketProviderRate(Number.NaN)).toBe('low');
  });
});

describe('module discipline (CEO §78)', () => {
  it('the shared contract exports a CLOSED enum of AiScope — new scopes require an allow-list', () => {
    // TypeScript already enforces this at compile time; pin the
    // structural marker here so a refactor that migrated to a
    // loose union trips CI.
    expect(CONTRACT).toMatch(/export type AiScope =\s*\n(\s*\|\s*'[a-z_]+'[^\n]*\n)+/);
  });

  it('hard denylist is a Set (efficient lookup) not a plain array', () => {
    expect(AI_HARD_DENYLIST instanceof Set).toBe(true);
  });
});

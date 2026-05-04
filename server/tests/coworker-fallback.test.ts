/**
 * coworker-fallback.test.ts (PR-23)
 *
 * Pure-function tests for the deterministic fallback module. No DB, no
 * Firebase, no Gemini. Covers:
 *   1. Output shape conforms to CoworkerFallbackResponse.
 *   2. Each known error class → correct reason.
 *   3. Unknown errors → reason:'unknown'.
 *   4. isFallbackResponse type guard accepts valid + rejects invalid input.
 *   5. Timestamp is a recent ISO string.
 *   6. Snapshot of the JSON shape is stable.
 */

import { describe, it, expect } from 'vitest';
import {
  buildFallback,
  coerceErrorToFallback,
  isFallbackResponse,
  COWORKER_FALLBACK_REASONS,
  type CoworkerFallbackResponse,
} from '../services/coworker/fallback';

// ─── Local error doubles ────────────────────────────────────────────────────
// We do NOT import the real PR-21/PR-22 error classes here; the fallback
// module matches by error.name string so that it stays decoupled. These
// doubles exercise that lookup table directly.
class CoworkerRateLimitError extends Error {
  constructor() {
    super('rate limit');
    this.name = 'CoworkerRateLimitError';
  }
}
class CoworkerDailyBudgetExceededError extends Error {
  constructor() {
    super('budget exhausted');
    this.name = 'CoworkerDailyBudgetExceededError';
  }
}
class CoworkerGovernanceError extends Error {
  constructor() {
    super('governance trip');
    this.name = 'CoworkerGovernanceError';
  }
}
class CoworkerUnsafeOutputError extends Error {
  constructor() {
    super('unsafe output');
    this.name = 'CoworkerUnsafeOutputError';
  }
}
class CoworkerGeminiUnavailableError extends Error {
  constructor() {
    super('gemini down');
    this.name = 'CoworkerGeminiUnavailableError';
  }
}

describe('buildFallback', () => {
  it('produces an object with the documented shape', () => {
    const out = buildFallback('rate_limit');
    expect(out.degraded).toBe(true);
    expect(out.reason).toBe('rate_limit');
    expect(out.findings).toEqual([]);
    expect(typeof out.summary).toBe('string');
    expect(out.summary.length).toBeGreaterThan(0);
    expect(typeof out.timestamp).toBe('string');
  });

  it('includes family when provided, omits otherwise', () => {
    const withFamily = buildFallback('budget', { family: 'fraud' });
    expect(withFamily.family).toBe('fraud');

    const withoutFamily = buildFallback('budget');
    expect(withoutFamily.family).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(withoutFamily, 'family')).toBe(false);
  });

  it('uses a distinct default summary per reason', () => {
    const summaries = COWORKER_FALLBACK_REASONS.map((r) => buildFallback(r).summary);
    const unique = new Set(summaries);
    expect(unique.size).toBe(summaries.length);
  });

  it('honours summary override', () => {
    const out = buildFallback('governance', { summary: 'custom text' });
    expect(out.summary).toBe('custom text');
  });

  it('produces a recent ISO-8601 timestamp by default', () => {
    const before = Date.now();
    const out = buildFallback('unknown');
    const after = Date.now();
    const t = Date.parse(out.timestamp);
    expect(Number.isNaN(t)).toBe(false);
    // Allow 5s clock skew either side — generous to keep CI stable.
    expect(t).toBeGreaterThanOrEqual(before - 5_000);
    expect(t).toBeLessThanOrEqual(after + 5_000);
    // ISO-8601 with Z suffix.
    expect(out.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
  });
});

describe('coerceErrorToFallback', () => {
  it('maps CoworkerRateLimitError → rate_limit', () => {
    const out = coerceErrorToFallback(new CoworkerRateLimitError());
    expect(out.reason).toBe('rate_limit');
    expect(out.degraded).toBe(true);
  });

  it('maps CoworkerDailyBudgetExceededError → budget', () => {
    const out = coerceErrorToFallback(new CoworkerDailyBudgetExceededError());
    expect(out.reason).toBe('budget');
  });

  it('maps CoworkerGovernanceError → governance', () => {
    const out = coerceErrorToFallback(new CoworkerGovernanceError());
    expect(out.reason).toBe('governance');
  });

  it('maps CoworkerUnsafeOutputError → governance', () => {
    const out = coerceErrorToFallback(new CoworkerUnsafeOutputError());
    expect(out.reason).toBe('governance');
  });

  it('maps CoworkerGeminiUnavailableError → gemini_unavailable', () => {
    const out = coerceErrorToFallback(new CoworkerGeminiUnavailableError());
    expect(out.reason).toBe('gemini_unavailable');
  });

  it('maps a generic Error → unknown', () => {
    const out = coerceErrorToFallback(new Error('boom'));
    expect(out.reason).toBe('unknown');
  });

  it('maps non-Error throwables → unknown without throwing', () => {
    expect(coerceErrorToFallback('string error').reason).toBe('unknown');
    expect(coerceErrorToFallback(42).reason).toBe('unknown');
    expect(coerceErrorToFallback(null).reason).toBe('unknown');
    expect(coerceErrorToFallback(undefined).reason).toBe('unknown');
    expect(coerceErrorToFallback({}).reason).toBe('unknown');
  });

  it('preserves family option through coercion', () => {
    const out = coerceErrorToFallback(new CoworkerRateLimitError(), { family: 'booking' });
    expect(out.family).toBe('booking');
    expect(out.reason).toBe('rate_limit');
  });
});

describe('isFallbackResponse', () => {
  it('accepts a freshly built fallback', () => {
    expect(isFallbackResponse(buildFallback('rate_limit'))).toBe(true);
    expect(isFallbackResponse(buildFallback('budget', { family: 'fraud' }))).toBe(true);
  });

  it('rejects null / undefined / primitives', () => {
    expect(isFallbackResponse(null)).toBe(false);
    expect(isFallbackResponse(undefined)).toBe(false);
    expect(isFallbackResponse('hello')).toBe(false);
    expect(isFallbackResponse(123)).toBe(false);
    expect(isFallbackResponse(true)).toBe(false);
  });

  it('rejects objects missing required fields', () => {
    expect(isFallbackResponse({})).toBe(false);
    expect(isFallbackResponse({ degraded: true })).toBe(false);
    expect(isFallbackResponse({ degraded: true, reason: 'rate_limit' })).toBe(false);
    expect(
      isFallbackResponse({
        degraded: true,
        reason: 'rate_limit',
        summary: 's',
        // missing timestamp + findings
      }),
    ).toBe(false);
  });

  it('rejects objects with unknown reason codes', () => {
    expect(
      isFallbackResponse({
        degraded: true,
        reason: 'not-a-real-reason',
        summary: 's',
        findings: [],
        timestamp: new Date().toISOString(),
      }),
    ).toBe(false);
  });

  it('rejects objects where degraded !== true', () => {
    expect(
      isFallbackResponse({
        degraded: false,
        reason: 'rate_limit',
        summary: 's',
        findings: [],
        timestamp: new Date().toISOString(),
      }),
    ).toBe(false);
  });

  it('rejects objects with non-empty findings', () => {
    expect(
      isFallbackResponse({
        degraded: true,
        reason: 'rate_limit',
        summary: 's',
        findings: [{ title: 'leaked through' }],
        timestamp: new Date().toISOString(),
      }),
    ).toBe(false);
  });

  it('rejects objects with empty timestamp', () => {
    expect(
      isFallbackResponse({
        degraded: true,
        reason: 'rate_limit',
        summary: 's',
        findings: [],
        timestamp: '',
      }),
    ).toBe(false);
  });

  it('narrows the type when used as a guard', () => {
    const value: unknown = buildFallback('budget');
    if (isFallbackResponse(value)) {
      // If this compiles, the type-guard worked.
      const reason: CoworkerFallbackResponse['reason'] = value.reason;
      expect(reason).toBe('budget');
    } else {
      throw new Error('expected fallback');
    }
  });
});

describe('JSON shape stability', () => {
  // Stable timestamp keeps the snapshot deterministic without freezing time
  // globally. We pass it via opts so production callers stay on Date.now().
  const FIXED_TS = '2026-01-01T00:00:00.000Z';

  it('serializes to a stable shape (snapshot)', () => {
    const out = buildFallback('rate_limit', { family: 'provider', timestamp: FIXED_TS });
    expect(JSON.parse(JSON.stringify(out))).toMatchInlineSnapshot(`
      {
        "degraded": true,
        "family": "provider",
        "findings": [],
        "reason": "rate_limit",
        "summary": "Coworker rate limit reached for this actor. Showing live data only; AI commentary suppressed.",
        "timestamp": "2026-01-01T00:00:00.000Z",
      }
    `);
  });

  it('serializes without family when omitted', () => {
    const out = buildFallback('gemini_unavailable', { timestamp: FIXED_TS });
    expect(JSON.parse(JSON.stringify(out))).toMatchInlineSnapshot(`
      {
        "degraded": true,
        "findings": [],
        "reason": "gemini_unavailable",
        "summary": "AI service is temporarily unavailable. Showing live data only; retry shortly.",
        "timestamp": "2026-01-01T00:00:00.000Z",
      }
    `);
  });

  it('every reason code yields a guard-passing object', () => {
    for (const reason of COWORKER_FALLBACK_REASONS) {
      const out = buildFallback(reason);
      expect(isFallbackResponse(out)).toBe(true);
    }
  });
});

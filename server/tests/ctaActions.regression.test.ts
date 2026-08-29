/**
 * CEO MASTER §A11 §A12 (2026-08-29) — pins for the CTA action-id
 * registry. Every semantic action a critical button carries must be
 * defined ONCE in client/src/lib/ctaActions.ts. Adding a new CTA
 * without an entry there is a lint-level defect (data-action-id
 * derives its value from CtaAction, so an unknown id fails at
 * type-check time).
 *
 * These pins are source-anchored (not runtime) — they enforce shape:
 *   * every value is a string LITERAL matching its key
 *   * SCREAMING_SNAKE_CASE
 *   * the canonical provider-service action-id map is complete
 *   * canonical URL-alias table covers the full 5-string vocabulary
 */
import { describe, it, expect } from 'vitest';
import {
  CtaAction,
  PROVIDER_SERVICE_ACTION_IDS,
  CANONICAL_URL_ALIAS,
  urlForProviderIntent,
  setCtaEventSink,
  emitCtaEvent,
} from '../../client/src/lib/ctaActions';

describe('CtaAction registry — CEO §A12 identity discipline', () => {
  it('every key equals its value (compile-time literal pin)', () => {
    for (const [key, value] of Object.entries(CtaAction)) {
      expect(value, `CtaAction.${key} value must equal its key`).toBe(key);
    }
  });

  it('every id is SCREAMING_SNAKE_CASE — no punctuation, no lowercase, no leading/trailing underscore', () => {
    const rx = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/;
    for (const [key, value] of Object.entries(CtaAction)) {
      expect(value, `CtaAction.${key} must be SCREAMING_SNAKE_CASE`).toMatch(rx);
    }
  });

  it('carries at least the 9 auth ids CEO §A12 named', () => {
    // These are the exact ids the CEO called out. Removing one is a
    // breaking change to the auth funnel and must be a deliberate
    // decision, not a silent rename.
    const REQUIRED_AUTH = [
      'AUTH_GOOGLE', 'AUTH_APPLE', 'AUTH_PHONE', 'AUTH_EMAIL', 'AUTH_PASSKEY',
      'AUTH_SIGN_IN', 'AUTH_SIGN_UP', 'AUTH_SIGN_OUT', 'AUTH_PASSWORD_RESET',
    ];
    for (const id of REQUIRED_AUTH) {
      expect(Object.values(CtaAction)).toContain(id);
    }
  });

  it('carries the 4 provider-journey action ids CEO §A12 named', () => {
    const REQUIRED = [
      'START_PROVIDER_APPLICATION',
      'SAVE_PROVIDER_DRAFT',
      'SUBMIT_PROVIDER_APPLICATION',
      'RESUME_PROVIDER_APPLICATION',
    ];
    for (const id of REQUIRED) {
      expect(Object.values(CtaAction)).toContain(id);
    }
  });

  it('carries a SELECT + ADD id for every canonical provider service (§A7 vocabulary)', () => {
    // CEO §A7 vocabulary: PET_SITTING / DOG_WALKING / TRAINING /
    // PET_TRANSPORT / STATION_OPERATOR. Every service needs BOTH
    // shapes — SELECT (the picker card) and ADD (the CTA intent
    // seed).
    const CANONICAL = [
      'PET_SITTING',
      'DOG_WALKING',
      'TRAINING',
      'PET_TRANSPORT',
      'STATION_OPERATOR',
    ];
    for (const svc of CANONICAL) {
      expect(Object.values(CtaAction), `SELECT_PROVIDER_SERVICE_${svc} missing`)
        .toContain(`SELECT_PROVIDER_SERVICE_${svc}`);
      expect(Object.values(CtaAction), `ADD_PROVIDER_SERVICE_${svc} missing`)
        .toContain(`ADD_PROVIDER_SERVICE_${svc}`);
    }
  });
});

describe('PROVIDER_SERVICE_ACTION_IDS — 5 canonical services, both shapes each', () => {
  it('covers all 5 canonical services', () => {
    const services = Object.keys(PROVIDER_SERVICE_ACTION_IDS).sort();
    expect(services).toEqual(['driver', 'sitter', 'station_operator', 'trainer', 'walker'].sort());
  });

  it('each entry has SELECT and ADD action ids that exist in CtaAction', () => {
    for (const [key, { select, add }] of Object.entries(PROVIDER_SERVICE_ACTION_IDS)) {
      expect(Object.values(CtaAction), `${key}.select must be a real CtaAction`).toContain(select);
      expect(Object.values(CtaAction), `${key}.add must be a real CtaAction`).toContain(add);
      expect(select, `${key}.select must start SELECT_PROVIDER_SERVICE_`).toMatch(/^SELECT_PROVIDER_SERVICE_/);
      expect(add, `${key}.add must start ADD_PROVIDER_SERVICE_`).toMatch(/^ADD_PROVIDER_SERVICE_/);
    }
  });
});

describe('CANONICAL_URL_ALIAS — the CEO §A7 URL vocabulary', () => {
  it('covers all 5 canonical services and maps to the CEO vocabulary', () => {
    // Legacy label → canonical URL alias the emitter should write.
    expect(CANONICAL_URL_ALIAS).toEqual({
      sitter: 'pet_sitting',
      walker: 'dog_walking',
      trainer: 'training',
      driver: 'pet_transport',
      station_operator: 'station_operator',
    });
  });
});

describe('urlForProviderIntent — the one URL emitter', () => {
  it('writes /provider-onboarding?requestedService=<canonical>', () => {
    expect(urlForProviderIntent('sitter')).toBe('/provider-onboarding?requestedService=pet_sitting');
    expect(urlForProviderIntent('walker')).toBe('/provider-onboarding?requestedService=dog_walking');
    expect(urlForProviderIntent('trainer')).toBe('/provider-onboarding?requestedService=training');
    expect(urlForProviderIntent('driver')).toBe('/provider-onboarding?requestedService=pet_transport');
    expect(urlForProviderIntent('station_operator')).toBe('/provider-onboarding?requestedService=station_operator');
  });

  it('preserves extra query params (utm, campaign) alongside the intent', () => {
    const url = urlForProviderIntent('sitter', { utm_source: 'google', utm_campaign: 'sitter_launch' });
    // Order is not guaranteed by URLSearchParams; parse and check.
    const parsed = new URL('http://x' + url);
    expect(parsed.pathname).toBe('/provider-onboarding');
    expect(parsed.searchParams.get('requestedService')).toBe('pet_sitting');
    expect(parsed.searchParams.get('utm_source')).toBe('google');
    expect(parsed.searchParams.get('utm_campaign')).toBe('sitter_launch');
  });
});

describe('emitCtaEvent — safe observability sink', () => {
  it('is a no-op before a sink is installed (safe on server-side import)', () => {
    // Reset sink to the no-op used at module init. If a previous
    // test installed one, this test would leak — so we always
    // install a fresh no-op first.
    setCtaEventSink(() => {});
    expect(() => emitCtaEvent(CtaAction.AUTH_GOOGLE)).not.toThrow();
  });

  it('routes to the installed sink with the exact action + meta', () => {
    const seen: Array<{ action: string; meta?: Record<string, any> }> = [];
    setCtaEventSink((action, meta) => { seen.push({ action, meta }); });
    emitCtaEvent(CtaAction.AUTH_GOOGLE, { authJourneyId: 'abc-123' });
    expect(seen).toEqual([{ action: 'AUTH_GOOGLE', meta: { authJourneyId: 'abc-123' } }]);
    setCtaEventSink(() => {});
  });

  it('swallows a throwing sink — observability MUST NEVER break a real user action', () => {
    setCtaEventSink(() => { throw new Error('telemetry unreachable'); });
    expect(() => emitCtaEvent(CtaAction.AUTH_GOOGLE)).not.toThrow();
    setCtaEventSink(() => {});
  });
});

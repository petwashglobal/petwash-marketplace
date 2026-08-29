/**
 * CEO MASTER §A11 §A12 (2026-08-29) — pins for the CTA action-id
 * registry AND the CEO 2026-08-29 corrections review §1 §5 §6 §7 §10
 * §11.
 *
 * Every semantic action a critical button carries must be defined
 * ONCE in client/src/lib/ctaActions.ts. Adding a new CTA without an
 * entry there is a lint-level defect (data-action-id derives its
 * value from CtaAction, so an unknown id fails at type-check time).
 *
 * The URL emitter routes through the /become-provider gate, never
 * to /provider-onboarding directly. Attribution extras cannot
 * override canonical fields. Return-to values are validated as
 * internal paths only. Money actions are split into START_/OPEN_
 * and CONFIRM_ pairs.
 */
import { describe, it, expect } from 'vitest';
import {
  CtaAction,
  CTA_META,
  PROVIDER_SERVICE_ACTION_IDS,
  urlForProviderIntent,
  urlForLegacyProviderIntent,
  safeInternalReturnTo,
  setCtaEventSink,
  emitCtaEvent,
  CODE_TO_LEGACY,
  LEGACY_TO_CODE,
  normaliseToProviderServiceCode,
} from '../../client/src/lib/ctaActions';
import {
  PROVIDER_SERVICE_CODES,
  LEGACY_PROVIDER_SERVICE_ALIASES,
} from '../../shared/lib/providerServiceVocabulary';

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

  it('every action carries CTA_META (§11 — no orphan action ids)', () => {
    for (const [key, value] of Object.entries(CtaAction)) {
      expect(CTA_META[value], `CTA_META.${key} missing`).toBeTruthy();
      const meta = CTA_META[value];
      expect(['NAVIGATION', 'PREFERENCE', 'AUTH', 'BUSINESS_ACTION', 'MONEY_OR_LEGAL'])
        .toContain(meta.risk);
      expect(typeof meta.requiresAuth).toBe('boolean');
      expect(typeof meta.requiresConfirmation).toBe('boolean');
      expect(['PUBLIC', 'PET_PARENT', 'PROVIDER', 'ADMIN']).toContain(meta.workspace);
    }
  });

  it('§10 — every MONEY_OR_LEGAL action requires confirmation', () => {
    for (const [key, value] of Object.entries(CtaAction)) {
      const meta = CTA_META[value];
      if (meta.risk === 'MONEY_OR_LEGAL') {
        expect(meta.requiresConfirmation, `${key} is MONEY_OR_LEGAL and must set requiresConfirmation`).toBe(true);
      }
    }
  });

  it('§10 — no dangerous verb ids: PAY_ / DELETE_ / REMOVE_MONEY_ / CHARGE_ / REFUND_ etc.', () => {
    // The registry names INTENT, never execution. Dangerous verbs
    // without a CONFIRM_ prefix suggest a command bus, which the
    // registry is not. Money and legal actions are named START_ /
    // OPEN_ (opens surface, no state change) OR CONFIRM_ (explicit
    // user confirmation after seeing the quote).
    const banned = /^(PAY|CHARGE|REFUND|DELETE|REMOVE|MINT|BURN|TRANSFER)_/;
    for (const key of Object.keys(CtaAction)) {
      expect(banned.test(key), `${key} — bare execution verb. Split into START_/OPEN_ + CONFIRM_ (see CEO §10)`).toBe(false);
    }
  });

  it('carries at least the 9 auth ids CEO §A12 named', () => {
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

  it('§10 — no plain CANCEL_ id in the registry (must be OPEN_QUOTE + CONFIRM_CANCELLATION)', () => {
    for (const key of Object.keys(CtaAction)) {
      // CANCEL_ is allowed only in the CONFIRM_..._CANCELLATION shape.
      // A bare "CANCEL_BOOKING" ID would let a UI wire cancellation
      // directly to a click — that's a command bus, forbidden.
      expect(key.startsWith('CANCEL_'), `${key} — plain CANCEL_ ids invite a command bus. Split into OPEN_..._QUOTE + CONFIRM_..._CANCELLATION`).toBe(false);
    }
  });
});

describe('PROVIDER_SERVICE_ACTION_IDS — CEO §7 §8 keyed by canonical code', () => {
  it('covers all 5 canonical codes (from shared vocabulary)', () => {
    const keys = Object.keys(PROVIDER_SERVICE_ACTION_IDS).sort();
    expect(keys).toEqual([...PROVIDER_SERVICE_CODES].sort());
  });

  it('each entry has SELECT and ADD action ids that exist in CtaAction', () => {
    for (const [code, { select, add }] of Object.entries(PROVIDER_SERVICE_ACTION_IDS)) {
      expect(Object.values(CtaAction), `${code}.select must be a real CtaAction`).toContain(select);
      expect(Object.values(CtaAction), `${code}.add must be a real CtaAction`).toContain(add);
      expect(select, `${code}.select must start SELECT_PROVIDER_SERVICE_`).toMatch(/^SELECT_PROVIDER_SERVICE_/);
      expect(add, `${code}.add must start ADD_PROVIDER_SERVICE_`).toMatch(/^ADD_PROVIDER_SERVICE_/);
    }
  });
});

describe('urlForProviderIntent — CEO §1 gate + §6 override protection', () => {
  it('§1 — routes through /become-provider, NOT directly /provider-onboarding', () => {
    // Direct /provider-onboarding for anonymous users drops the
    // query on the sign-in bounce — that recreates the exact
    // requestedService-loss bug Lane B fixed.
    for (const code of PROVIDER_SERVICE_CODES) {
      const url = urlForProviderIntent(code);
      expect(url, `${code} must route through /become-provider gate`).toMatch(/^\/become-provider\?/);
      expect(url).not.toMatch(/^\/provider-onboarding/);
    }
  });

  it('writes ?requestedService=<canonical code>', () => {
    for (const code of PROVIDER_SERVICE_CODES) {
      const url = urlForProviderIntent(code);
      const parsed = new URL('http://x' + url);
      expect(parsed.searchParams.get('requestedService')).toBe(code);
    }
  });

  it('§6 — caller CANNOT override requestedService via `extra`', () => {
    // A caller passing `extra: { requestedService: 'garbage' }` used
    // to defeat the canonical helper via post-spread override. The
    // sanitized attribution allowlist blocks it.
    const url = urlForProviderIntent(
      'pet_sitting',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { requestedService: 'garbage', intent: 'admin', role: 'super_admin' } as any,
    );
    const parsed = new URL('http://x' + url);
    expect(parsed.searchParams.get('requestedService')).toBe('pet_sitting');
    expect(parsed.searchParams.get('intent')).toBeNull();
    expect(parsed.searchParams.get('role')).toBeNull();
  });

  it('§6 — attribution allowlist accepts utm/campaign/referrer only', () => {
    const url = urlForProviderIntent('pet_sitting', {
      utm_source: 'google',
      utm_medium: 'cpc',
      utm_campaign: 'sitter_launch_2026Q3',
      utm_content: 'hero',
      utm_term: 'petwash',
      campaignId: 'c-abc',
      referrer: 'https://example.com',
    });
    const parsed = new URL('http://x' + url);
    expect(parsed.searchParams.get('utm_source')).toBe('google');
    expect(parsed.searchParams.get('utm_medium')).toBe('cpc');
    expect(parsed.searchParams.get('utm_campaign')).toBe('sitter_launch_2026Q3');
    expect(parsed.searchParams.get('utm_content')).toBe('hero');
    expect(parsed.searchParams.get('utm_term')).toBe('petwash');
    expect(parsed.searchParams.get('campaignId')).toBe('c-abc');
    expect(parsed.searchParams.get('referrer')).toBe('https://example.com');
    // Canonical field still present and correct.
    expect(parsed.searchParams.get('requestedService')).toBe('pet_sitting');
  });

  it('drops absurdly long / empty attribution values', () => {
    const url = urlForProviderIntent('pet_sitting', {
      utm_source: '', // empty
      utm_medium: 'a'.repeat(600), // over cap
      utm_campaign: 'ok',
    });
    const parsed = new URL('http://x' + url);
    expect(parsed.searchParams.get('utm_source')).toBeNull();
    expect(parsed.searchParams.get('utm_medium')).toBeNull();
    expect(parsed.searchParams.get('utm_campaign')).toBe('ok');
  });

  it('urlForLegacyProviderIntent maps every legacy alias to the correct canonical URL', () => {
    for (const alias of LEGACY_PROVIDER_SERVICE_ALIASES) {
      const url = urlForLegacyProviderIntent(alias);
      const parsed = new URL('http://x' + url);
      expect(parsed.pathname).toBe('/become-provider');
      expect(parsed.searchParams.get('requestedService')).toBe(LEGACY_TO_CODE[alias]);
    }
  });
});

describe('safeInternalReturnTo — CEO §5 open-redirect guard', () => {
  it('accepts internal paths starting with a single slash', () => {
    expect(safeInternalReturnTo('/pet-parent/home')).toBe('/pet-parent/home');
    expect(safeInternalReturnTo('/provider-onboarding?requestedService=pet_sitting'))
      .toBe('/provider-onboarding?requestedService=pet_sitting');
  });

  it('rejects absolute URLs (protocol-relative and full URLs)', () => {
    expect(safeInternalReturnTo('https://evil.example/x')).toBeNull();
    expect(safeInternalReturnTo('http://evil.example/x')).toBeNull();
    expect(safeInternalReturnTo('//evil.example/x')).toBeNull();
  });

  it('rejects javascript:/data:/file: schemes', () => {
    expect(safeInternalReturnTo('javascript:alert(1)')).toBeNull();
    expect(safeInternalReturnTo('/x?u=javascript:alert(1)')).toBeNull();
    expect(safeInternalReturnTo('data:text/html,<script>')).toBeNull();
    expect(safeInternalReturnTo('file:///etc/passwd')).toBeNull();
  });

  it('rejects paths without leading slash, empty, whitespace, non-strings', () => {
    expect(safeInternalReturnTo('home')).toBeNull();
    expect(safeInternalReturnTo('')).toBeNull();
    expect(safeInternalReturnTo('   ')).toBeNull();
    expect(safeInternalReturnTo(null)).toBeNull();
    expect(safeInternalReturnTo(undefined)).toBeNull();
    expect(safeInternalReturnTo(42)).toBeNull();
  });

  it('rejects paths containing relative traversal', () => {
    expect(safeInternalReturnTo('/x/../../etc/passwd')).toBeNull();
    expect(safeInternalReturnTo('/../home')).toBeNull();
  });

  it('rejects paths over 2048 chars', () => {
    expect(safeInternalReturnTo('/' + 'a'.repeat(2048))).toBeNull();
  });
});

describe('Shared vocabulary consistency — CEO §7 §8 (one source of truth)', () => {
  it('LEGACY_TO_CODE and CODE_TO_LEGACY are round-trip inverses', () => {
    for (const alias of LEGACY_PROVIDER_SERVICE_ALIASES) {
      expect(CODE_TO_LEGACY[LEGACY_TO_CODE[alias]]).toBe(alias);
    }
    for (const code of PROVIDER_SERVICE_CODES) {
      expect(LEGACY_TO_CODE[CODE_TO_LEGACY[code]]).toBe(code);
    }
  });

  it('normaliseToProviderServiceCode accepts every alias and every canonical code', () => {
    for (const code of PROVIDER_SERVICE_CODES) {
      expect(normaliseToProviderServiceCode(code)).toBe(code);
    }
    for (const alias of LEGACY_PROVIDER_SERVICE_ALIASES) {
      expect(normaliseToProviderServiceCode(alias)).toBe(LEGACY_TO_CODE[alias]);
    }
    // Marketing shorthand.
    expect(normaliseToProviderServiceCode('sit')).toBe('pet_sitting');
    expect(normaliseToProviderServiceCode('walk')).toBe('dog_walking');
    expect(normaliseToProviderServiceCode('train')).toBe('training');
    expect(normaliseToProviderServiceCode('pet_trek')).toBe('pet_transport');
  });

  it('normaliseToProviderServiceCode drops hostile values', () => {
    for (const bad of [null, undefined, '', 'admin', 'provider', 'customer', 'super_admin', '<script>', 42]) {
      expect(normaliseToProviderServiceCode(bad as unknown)).toBeNull();
    }
  });
});

describe('emitCtaEvent — safe observability sink', () => {
  it('is a no-op before a sink is installed (safe on server-side import)', () => {
    setCtaEventSink(() => {});
    expect(() => emitCtaEvent(CtaAction.AUTH_GOOGLE)).not.toThrow();
  });

  it('routes to the installed sink with the exact action + meta', () => {
    const seen: Array<{ action: string; meta?: Record<string, unknown> }> = [];
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

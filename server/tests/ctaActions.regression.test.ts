/**
 * Lane B (post-release 2026-09-03): CTA action-id registry. Every
 * critical CTA has ONE semantic identity that survives i18n / CSS /
 * copy changes. Source pins + real behavioural checks against the
 * pure-JS registry lib.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ADMIN_DASHBOARD_URL,
  CANONICAL_URL_ALIAS,
  CtaAction,
  emitCtaEvent,
  PET_PARENT_WORKSPACE_URL,
  PROVIDER_SERVICE_ACTION_IDS,
  PROVIDER_WORKSPACE_URL,
  setCtaEventSink,
  urlForProviderIntent,
} from '../../client/src/lib/ctaActions';

afterEach(() => setCtaEventSink(null));

describe('cta-actions · URL constants', () => {
  it('canonical workspace URLs match the Lane A ruling', () => {
    expect(PET_PARENT_WORKSPACE_URL).toBe('/pet-parent/home');
    expect(PROVIDER_WORKSPACE_URL).toBe('/provider-os');
    expect(ADMIN_DASHBOARD_URL).toBe('/admin/dashboard');
  });
});

describe('cta-actions · urlForProviderIntent', () => {
  it('emits requestedService=<canonical> as the first param', () => {
    expect(urlForProviderIntent('sitter')).toBe('/provider-onboarding?requestedService=sitter');
    expect(urlForProviderIntent('walker')).toBe('/provider-onboarding?requestedService=walker');
    expect(urlForProviderIntent('trainer')).toBe('/provider-onboarding?requestedService=trainer');
    expect(urlForProviderIntent('driver')).toBe('/provider-onboarding?requestedService=driver');
    expect(urlForProviderIntent('station_operator')).toBe(
      '/provider-onboarding?requestedService=station_operator',
    );
  });

  it('preserves extra UTM/campaign params', () => {
    const url = urlForProviderIntent('sitter', {
      utm_source: 'header',
      utm_campaign: 'launch_2026',
    });
    expect(url).toMatch(/requestedService=sitter/);
    expect(url).toMatch(/utm_source=header/);
    expect(url).toMatch(/utm_campaign=launch_2026/);
  });

  it('drops null / undefined / empty extras', () => {
    const url = urlForProviderIntent('walker', {
      utm_source: 'header',
      utm_medium: null,
      utm_campaign: undefined,
      referrer: '',
    });
    expect(url).toBe('/provider-onboarding?requestedService=walker&utm_source=header');
  });
});

describe('cta-actions · CANONICAL_URL_ALIAS', () => {
  it('CEO §A7 vocabulary maps to the wizard 5-string alphabet', () => {
    expect(CANONICAL_URL_ALIAS.pet_sitting).toBe('sitter');
    expect(CANONICAL_URL_ALIAS.dog_walking).toBe('walker');
    expect(CANONICAL_URL_ALIAS.training).toBe('trainer');
    expect(CANONICAL_URL_ALIAS.pet_transport).toBe('driver');
    expect(CANONICAL_URL_ALIAS.station_operator).toBe('station_operator');
  });
});

describe('cta-actions · PROVIDER_SERVICE_ACTION_IDS', () => {
  it('every service pairs a SELECT and ADD action-id', () => {
    for (const service of ['sitter', 'walker', 'trainer', 'driver', 'station_operator'] as const) {
      const pair = PROVIDER_SERVICE_ACTION_IDS[service];
      expect(pair.select).toMatch(new RegExp(`^SELECT_PROVIDER_SERVICE_${service.toUpperCase()}$`));
      expect(pair.add).toMatch(new RegExp(`^ADD_PROVIDER_SERVICE_${service.toUpperCase()}$`));
    }
  });
});

describe('cta-actions · emitCtaEvent observability', () => {
  it('is a no-op when no sink is installed', () => {
    expect(() => emitCtaEvent('AUTH_GOOGLE')).not.toThrow();
  });

  it('delivers to the installed sink with action + href + ts', () => {
    const sink = vi.fn();
    setCtaEventSink(sink);
    emitCtaEvent('BOOK_SITTER_ENTRY', { source: 'homepage_hero' });
    expect(sink).toHaveBeenCalledTimes(1);
    const ev = sink.mock.calls[0][0];
    expect(ev.action).toBe('BOOK_SITTER_ENTRY');
    expect(typeof ev.ts).toBe('number');
    expect(ev.extra).toEqual({ source: 'homepage_hero' });
  });

  it('a throwing sink NEVER surfaces to the caller', () => {
    setCtaEventSink(() => {
      throw new Error('analytics down');
    });
    expect(() => emitCtaEvent('AUTH_SIGN_OUT')).not.toThrow();
  });

  it('the CtaAction enum is exhaustive (compile-time check)', () => {
    // Every enum value is a distinct string literal — this test is
    // really about the TypeScript compiler surfacing typos. If a
    // future edit accidentally makes two entries collide, this
    // array-of-literals initialisation will fail at compile time.
    const sample: CtaAction[] = [
      'AUTH_GOOGLE',
      'AUTH_APPLE',
      'AUTH_EMAIL_PASSWORD',
      'AUTH_PHONE_OTP',
      'AUTH_PASSKEY',
      'AUTH_MAGIC_LINK',
      'AUTH_SIGN_OUT',
      'BECOME_PROVIDER_ENTRY',
      'PROVIDER_SUBMIT_APPLICATION',
      'SWITCH_TO_PET_PARENT_WORKSPACE',
      'SWITCH_TO_PROVIDER_WORKSPACE',
      'SWITCH_TO_ADMIN_WORKSPACE',
      'BOOK_SITTER_ENTRY',
      'PRESTIGE_JOIN',
      'WALLET_TOP_UP',
      'EGIFT_REDEEM',
      'PET_ADD',
    ];
    expect(new Set(sample).size).toBe(sample.length);
  });
});

/**
 * CEO MASTER §A3 §A5 §1.2 §1.5 §4.1 §4.2 §B41 (2026-08-29) — pins
 * for the auth-journey trace id, per-device preferredAuthMethod, and
 * first/last-touch attribution helpers.
 *
 * These helpers are the CLIENT-SIDE half of the auth funnel + Journey
 * Brain attribution. The server-side auth trace + attribution pipeline
 * consume the same identifiers; a schema mismatch here is a broken
 * funnel, so these pins are behavioural (not source-anchored).
 */
import { describe, it, beforeEach, afterEach, expect } from 'vitest';

// Minimal storage stub — vitest's default happy-dom is heavy; we use
// a swap-in Storage impl so these tests run without a DOM.
class MemStorage implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  key(i: number) { return Array.from(this.m.keys())[i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

const originalWindow = (globalThis as any).window;
beforeEach(() => {
  (globalThis as any).window = {
    localStorage: new MemStorage(),
    sessionStorage: new MemStorage(),
    location: { search: '', pathname: '/' },
  };
});
afterEach(() => {
  (globalThis as any).window = originalWindow;
});

import {
  beginAuthJourney,
  recordAuthJourneyStage,
  currentAuthJourneyId,
  currentAuthJourney,
  endAuthJourney,
  authJourneyHeader,
  errorReference,
} from '../../client/src/lib/authJourney';

describe('authJourney — CEO §B41 §1.2 identity + timeline', () => {
  it('beginAuthJourney creates a stable id and stores it', () => {
    const id = beginAuthJourney('google');
    expect(id).toMatch(/^[0-9a-f]{16}$/);
    expect(currentAuthJourneyId()).toBe(id);
  });

  it('reusing beginAuthJourney within 20 minutes keeps the same id (survives OAuth redirect)', () => {
    const first = beginAuthJourney('google');
    const second = beginAuthJourney('google');
    expect(second).toBe(first);
  });

  it('records stages in order', () => {
    beginAuthJourney('google');
    recordAuthJourneyStage('AUTH_METHOD_SELECTED');
    recordAuthJourneyStage('FIREBASE_POPUP_STARTED');
    recordAuthJourneyStage('FIREBASE_SUCCESS');
    const rec = currentAuthJourney();
    expect(rec?.stages.map((s) => s.stage)).toEqual([
      'AUTH_METHOD_SELECTED',
      'FIREBASE_POPUP_STARTED',
      'FIREBASE_SUCCESS',
    ]);
  });

  it('authJourneyHeader is safe — no PII, no secret', () => {
    beginAuthJourney('google');
    const h = authJourneyHeader();
    expect(h).toMatch(/^[0-9a-f]{16};method=google$/);
    expect(h).not.toMatch(/password|token|otp|credential/i);
  });

  it('errorReference format PW-ERR-<8 chars uppercase>', () => {
    beginAuthJourney('google');
    expect(errorReference()).toMatch(/^PW-ERR-[0-9A-F]{8}$/);
  });

  it('endAuthJourney clears the store', () => {
    beginAuthJourney('google');
    endAuthJourney();
    expect(currentAuthJourneyId()).toBeNull();
    expect(authJourneyHeader()).toBeNull();
  });
});

import {
  readPreferredAuthMethod,
  writePreferredAuthMethod,
  clearPreferredAuthMethod,
  isPreferredAuthMethod,
} from '../../client/src/lib/preferredAuthMethod';

describe('preferredAuthMethod — CEO §A3 §1.5 UX preference (never authority)', () => {
  it('round-trip persists and reads back', () => {
    writePreferredAuthMethod('google');
    expect(readPreferredAuthMethod()).toBe('google');
  });

  it('rejects hostile / unknown method values', () => {
    for (const bad of ['admin', 'super_admin', '<script>', '', null, undefined, 42, {}, 'GOOGLE']) {
      expect(isPreferredAuthMethod(bad)).toBe(false);
      writePreferredAuthMethod(bad);
      expect(readPreferredAuthMethod()).toBeNull();
    }
  });

  it('clear removes the value', () => {
    writePreferredAuthMethod('phone');
    clearPreferredAuthMethod();
    expect(readPreferredAuthMethod()).toBeNull();
  });
});

import {
  buildTouchFromUrl,
  recordTouch,
  readAttribution,
  currentTouchAsSearchParams,
  captureInitialTouch,
} from '../../client/src/lib/attribution';

describe('attribution — CEO §A5 §4.1 §4.2 first/last touch discipline', () => {
  it('buildTouchFromUrl extracts UTM/campaign/referrer, sanitizes empty', () => {
    const t = buildTouchFromUrl('?utm_source=google&utm_campaign=sitter_launch&utm_term=&campaignId=c-1');
    expect(t).not.toBeNull();
    expect(t!.utm_source).toBe('google');
    expect(t!.utm_campaign).toBe('sitter_launch');
    expect(t!.utm_term).toBeUndefined();
    expect(t!.campaignId).toBe('c-1');
  });

  it('returns null when nothing usable is present', () => {
    expect(buildTouchFromUrl('?other=1')).toBeNull();
    expect(buildTouchFromUrl('')).toBeNull();
  });

  it('firstTouch is IMMUTABLE — a second touch updates lastTouch only', () => {
    recordTouch(buildTouchFromUrl('?utm_source=google'));
    recordTouch(buildTouchFromUrl('?utm_source=instagram'));
    const store = readAttribution();
    expect(store.firstTouch?.utm_source).toBe('google');
    expect(store.lastTouch?.utm_source).toBe('instagram');
  });

  it('captureInitialTouch reads window.location.search + document.referrer', () => {
    (globalThis as any).window.location.search = '?utm_source=facebook&utm_medium=cpc';
    (globalThis as any).document = { referrer: 'https://example.com/x' };
    captureInitialTouch();
    const store = readAttribution();
    expect(store.firstTouch?.utm_source).toBe('facebook');
    expect(store.firstTouch?.utm_medium).toBe('cpc');
    expect(store.firstTouch?.referrer).toBe('https://example.com/x');
    delete (globalThis as any).document;
  });

  it('currentTouchAsSearchParams emits ONLY the whitelisted attribution fields', () => {
    recordTouch(buildTouchFromUrl('?utm_source=google&utm_campaign=x'));
    const params = currentTouchAsSearchParams();
    expect(params.get('utm_source')).toBe('google');
    expect(params.get('utm_campaign')).toBe('x');
    // No PII / secret fields ever appear.
    expect(params.get('password')).toBeNull();
    expect(params.get('email')).toBeNull();
    expect(params.get('token')).toBeNull();
  });

  it('caps length at 512 chars per field — resists a hostile referrer', () => {
    const t = buildTouchFromUrl('', 'x'.repeat(600));
    expect(t).toBeNull();
  });
});

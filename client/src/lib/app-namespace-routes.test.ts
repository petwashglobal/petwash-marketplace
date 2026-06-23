/**
 * Tests for the app-structure rebuild namespace map (SDD §6 / §11).
 *
 * This is the coverage gate the SDD requires: it FAILS if any of the 48
 * CEO-listed screens (23 Prestige + 25 Provider) loses its target route, so the
 * screen-coverage matrix can never silently drift as the rebuild proceeds.
 */

import { describe, it, expect } from 'vitest';
import {
  PRESTIGE_SCREENS,
  PROVIDER_SCREENS,
  SCREEN_ROUTES,
  REDIRECTABLE_SCREENS,
} from './app-namespace-routes';

describe('app-namespace-routes — CEO screen coverage', () => {
  it('maps exactly 23 Prestige screens', () => {
    expect(PRESTIGE_SCREENS).toHaveLength(23);
  });

  it('maps exactly 25 Provider screens', () => {
    expect(PROVIDER_SCREENS).toHaveLength(25);
  });

  it('covers all 48 CEO-listed screens', () => {
    expect(SCREEN_ROUTES).toHaveLength(48);
  });

  it('numbers Prestige screens 1..23 with no gaps', () => {
    const nums = PRESTIGE_SCREENS.map((s) => s.ceoNumber).sort((a, b) => a - b);
    expect(nums).toEqual(Array.from({ length: 23 }, (_, i) => i + 1));
  });

  it('numbers Provider screens 1..25 with no gaps', () => {
    const nums = PROVIDER_SCREENS.map((s) => s.ceoNumber).sort((a, b) => a - b);
    expect(nums).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
  });

  it('gives every screen a non-empty namespaced newPath', () => {
    for (const s of SCREEN_ROUTES) {
      // Either the app home root (/prestige) or a deeper namespaced path.
      expect(s.newPath, s.id).toMatch(/^\/(prestige|provider)(\/|$)/);
    }
  });

  it('roots Prestige paths under /prestige and Provider paths under /provider', () => {
    for (const s of PRESTIGE_SCREENS) {
      expect(s.newPath === '/prestige' || s.newPath.startsWith('/prestige/'), s.id).toBe(true);
    }
    for (const s of PROVIDER_SCREENS) {
      expect(s.newPath.startsWith('/provider/'), s.id).toBe(true);
    }
  });

  it('has a unique id for every screen', () => {
    const ids = SCREEN_ROUTES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has a unique newPath for every screen', () => {
    const paths = SCREEN_ROUTES.map((s) => s.newPath);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('only marks the signed-out member welcome as missing (no oldPath)', () => {
    const missingOld = SCREEN_ROUTES.filter((s) => s.oldPath === null);
    expect(missingOld.map((s) => s.id)).toEqual(['prestige-welcome']);
  });

  it('exposes every screen-with-old-path as redirectable', () => {
    expect(REDIRECTABLE_SCREENS).toHaveLength(SCREEN_ROUTES.length - 1); // all but welcome
  });

  it('tags money screens consistently (re-host only)', () => {
    // Money screens must always have an oldPath (we never build a brand-new
    // money screen in this structural rebuild — finance runtime is sacred).
    for (const s of SCREEN_ROUTES.filter((x) => x.money)) {
      expect(s.oldPath, `${s.id} is money but has no oldPath`).not.toBeNull();
    }
  });
});

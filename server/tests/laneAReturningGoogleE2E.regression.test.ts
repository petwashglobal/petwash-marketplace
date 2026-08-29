/**
 * Lane A — RETURNING Google E2E scenario pins.
 *
 * CEO FLY MODE II §12 — AUTH CONVERSION P0 (2026-08-29).
 *
 * "Google → Firebase → PetWash session → capability/bootstrap →
 *  destination. DO NOT show signup profile fields again. DO NOT show
 *  DOB/terms signup gate again."
 *
 * The reducer's ACCOUNT_RESOLUTION → ACTIVATION shortcut on
 * requiredActions:[] is what makes this behaviour possible; the
 * spec asserts PROFILE_COMPLETION never appears; these pins lock
 * both.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SPEC = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'tests', 'e2e', 'auth-master-lane-a-returning-google.e2e.spec.ts'),
  'utf8',
);

const REDUCER = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'client', 'src', 'lib', 'progressiveSignupState.ts'),
  'utf8',
);

describe('CEO FLY MODE II §12 — RETURNING Google E2E scenario', () => {
  it('spec uses personas.customerActive (NOT customerNew) — this is the returning path', () => {
    expect(SPEC).toMatch(/installFirebaseTestAdapter\(page, personas\.customerActive\)/);
    expect(SPEC).not.toMatch(/installFirebaseTestAdapter\(page, personas\.customerNew\)/);
  });

  it('scenario mounts /signup-v2 with NO intent params — pure returning journey', () => {
    // The spec goes to /signup-v2 without a query string — a
    // returning user has no attached provider intent to survive.
    expect(SPEC).toMatch(/page\.goto\(\s*['"]\/signup-v2['"]\s*\)/);
  });

  it('records EVERY data-state transition via MutationObserver — no polling', () => {
    // A polling test could miss PROFILE_COMPLETION if the transition
    // happens between polls. The MutationObserver captures every
    // change synchronously, so a stray PROFILE_COMPLETION state
    // between ACCOUNT_RESOLUTION and ACTIVATION would be caught.
    expect(SPEC).toMatch(/new MutationObserver/);
    expect(SPEC).toMatch(/attributeFilter:\s*\['data-state'\]/);
    expect(SPEC).toMatch(/__recordedStates\.push\(root\.getAttribute\('data-state'\)\)/);
  });

  it('asserts PROFILE_COMPLETION NEVER appears in the recorded sequence', () => {
    expect(SPEC).toMatch(/expect\(states\)\.not\.toContain\(['"]PROFILE_COMPLETION['"]\)/);
  });

  it('asserts NO profile-action screens were EVER mounted', () => {
    expect(SPEC).toMatch(
      /locator\('\[data-testid\^="signup-progressive-action-"\]'\)[\s\S]{0,200}toBe\(0\)/,
    );
  });

  it('asserts NO progress label ("N of M") was EVER mounted', () => {
    expect(SPEC).toMatch(
      /locator\('\[data-testid="signup-progressive-progress"\]'\)[\s\S]{0,200}toBe\(0\)/,
    );
  });

  it('final destination assertion is /pet-parent/home', () => {
    expect(SPEC).toMatch(/waitForURL\(\(u\)\s*=>\s*\/\\\/pet-parent\\\/home\/\.test/);
  });

  it('scenario skips cleanly when adapter is unavailable', () => {
    expect(SPEC).toMatch(/test\.skip\(\s*!firebaseAdapterAvailable\(\)/);
  });
});

describe('CEO FLY MODE II §12 — reducer honors zero-action shortcut', () => {
  it('ACCOUNT_RESOLUTION with requiredActions:[] jumps to ACTIVATION directly', () => {
    // The pin locks the exact branch in the reducer that makes the
    // returning-Google discipline possible. A refactor that always
    // routes through PROFILE_COMPLETION (even empty) would render
    // an unnecessary "0 of 0" screen and fail the spec.
    expect(REDUCER).toMatch(
      /if \(requiredActions\.length === 0\) \{[\s\S]{0,500}return \{ name: 'ACTIVATION' \};/,
    );
  });

  it('reducer is a switch on state.name — no side effects, no async', () => {
    // Structural guarantee: the reducer is pure. Async work belongs
    // in the shell's useEffect drivers.
    expect(REDUCER).toMatch(/export function reduce\(state: SignupState, event: SignupEvent\): SignupState/);
    // No `await` anywhere in the reducer body.
    const reduceIdx = REDUCER.indexOf('export function reduce');
    const nextExport = REDUCER.indexOf('\nexport ', reduceIdx + 1);
    const body = REDUCER.slice(reduceIdx, nextExport > 0 ? nextExport : reduceIdx + 5000);
    expect(body).not.toMatch(/\bawait\b/);
  });
});

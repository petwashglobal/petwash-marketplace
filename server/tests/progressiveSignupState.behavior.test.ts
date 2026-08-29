/**
 * Lane A — Progressive signup state machine behavioural tests.
 *
 * CEO FLY MODE II — AUTH CONVERSION P0 (2026-08-29).
 *
 * The reducer is pure; every transition below is deterministic and
 * independent of any DOM, network, or Firebase.
 */
import { describe, it, expect } from 'vitest';
import {
  reduce,
  initialState,
  currentAction,
  progressLabel,
  type AccountResolution,
  type SignupState,
} from '../../client/src/lib/progressiveSignupState';

describe('CEO FLY MODE II Lane A — progressive signup state machine', () => {
  it('initial state is METHOD_SELECTION', () => {
    expect(initialState).toEqual({ name: 'METHOD_SELECTION' });
  });

  it('CHOOSE_METHOD → AUTHENTICATING carries the selected method', () => {
    for (const method of ['google', 'apple', 'mobile', 'email'] as const) {
      const next = reduce(initialState, { kind: 'CHOOSE_METHOD', method });
      expect(next).toEqual({ name: 'AUTHENTICATING', method });
    }
  });

  it('Google/Apple skip CONTACT_VERIFY — AUTH_SUCCESS goes straight to ACCOUNT_RESOLUTION', () => {
    for (const method of ['google', 'apple'] as const) {
      let s: SignupState = reduce(initialState, { kind: 'CHOOSE_METHOD', method });
      s = reduce(s, { kind: 'AUTH_SUCCESS' });
      expect(s).toEqual({ name: 'ACCOUNT_RESOLUTION' });
    }
  });

  it('mobile method transits AUTHENTICATING → CONTACT_VERIFY → ACCOUNT_RESOLUTION', () => {
    let s: SignupState = reduce(initialState, { kind: 'CHOOSE_METHOD', method: 'mobile' });
    s = reduce(s, { kind: 'AUTH_CODE_SENT', method: 'mobile', sentTo: '+972-50-1234567' });
    expect(s).toEqual({ name: 'CONTACT_VERIFY', method: 'mobile', sentTo: '+972-50-1234567' });
    s = reduce(s, { kind: 'AUTH_SUCCESS' });
    expect(s).toEqual({ name: 'ACCOUNT_RESOLUTION' });
  });

  it('email method transits AUTHENTICATING → CONTACT_VERIFY → ACCOUNT_RESOLUTION', () => {
    let s: SignupState = reduce(initialState, { kind: 'CHOOSE_METHOD', method: 'email' });
    s = reduce(s, { kind: 'AUTH_CODE_SENT', method: 'email', sentTo: 'a@b.com' });
    expect(s).toEqual({ name: 'CONTACT_VERIFY', method: 'email', sentTo: 'a@b.com' });
    s = reduce(s, { kind: 'AUTH_SUCCESS' });
    expect(s).toEqual({ name: 'ACCOUNT_RESOLUTION' });
  });

  it('RESOLVED with zero required actions → ACTIVATION (returning user path)', () => {
    let s: SignupState = { name: 'ACCOUNT_RESOLUTION' };
    const resolution: AccountResolution = {
      isNewUser: false,
      profileState: 'complete',
      requiredActions: [],
      destination: '/pet-parent/home',
    };
    s = reduce(s, { kind: 'RESOLVED', resolution });
    expect(s).toEqual({ name: 'ACTIVATION' });
  });

  it('RESOLVED with 2 required actions → PROFILE_COMPLETION 1/2, then ACTION_COMPLETED → 2/2, then → ACTIVATION', () => {
    let s: SignupState = { name: 'ACCOUNT_RESOLUTION' };
    const resolution: AccountResolution = {
      isNewUser: true,
      profileState: 'incomplete',
      requiredActions: ['mobile_verification', 'terms_acceptance'],
      destination: '/pet-parent/home',
    };
    s = reduce(s, { kind: 'RESOLVED', resolution });
    expect(s.name).toBe('PROFILE_COMPLETION');
    expect(progressLabel(s)).toEqual({ current: 1, total: 2 });
    expect(currentAction(s)).toBe('mobile_verification');

    s = reduce(s, { kind: 'ACTION_COMPLETED' });
    expect(s.name).toBe('PROFILE_COMPLETION');
    expect(progressLabel(s)).toEqual({ current: 2, total: 2 });
    expect(currentAction(s)).toBe('terms_acceptance');

    s = reduce(s, { kind: 'ACTION_COMPLETED' });
    expect(s).toEqual({ name: 'ACTIVATION' });
  });

  it('server order is honored — client renders actions in the order the server returned', () => {
    let s: SignupState = { name: 'ACCOUNT_RESOLUTION' };
    const resolution: AccountResolution = {
      isNewUser: true,
      profileState: 'incomplete',
      requiredActions: ['date_of_birth', 'first_name', 'last_name', 'terms_acceptance'],
      destination: '/pet-parent/home',
    };
    s = reduce(s, { kind: 'RESOLVED', resolution });
    const order: string[] = [];
    while (s.name === 'PROFILE_COMPLETION') {
      const a = currentAction(s);
      if (a) order.push(a);
      s = reduce(s, { kind: 'ACTION_COMPLETED' });
    }
    expect(order).toEqual(['date_of_birth', 'first_name', 'last_name', 'terms_acceptance']);
    expect(s).toEqual({ name: 'ACTIVATION' });
  });

  it('ACTIVATION → POST_LOGIN → DONE', () => {
    let s: SignupState = { name: 'ACTIVATION' };
    s = reduce(s, { kind: 'ACTIVATED' });
    expect(s.name).toBe('POST_LOGIN');
    s = reduce(s, { kind: 'REACHED_DESTINATION' });
    expect(s).toEqual({ name: 'DONE' });
  });

  it('RESET returns to METHOD_SELECTION from ANY state', () => {
    const states: SignupState[] = [
      { name: 'AUTHENTICATING', method: 'google' },
      { name: 'CONTACT_VERIFY', method: 'mobile', sentTo: '+972501234567' },
      { name: 'ACCOUNT_RESOLUTION' },
      { name: 'PROFILE_COMPLETION', pending: ['mobile_verification'], total: 1, index: 0 },
      { name: 'ACTIVATION' },
      { name: 'POST_LOGIN', destination: '/pet-parent/home' },
      { name: 'DONE' },
    ];
    for (const s of states) {
      expect(reduce(s, { kind: 'RESET' })).toEqual(initialState);
    }
  });

  it('unhandled (state, event) pair returns the state unchanged — never throws', () => {
    const s: SignupState = { name: 'METHOD_SELECTION' };
    expect(reduce(s, { kind: 'AUTH_SUCCESS' })).toBe(s);
    expect(reduce(s, { kind: 'RESOLVED', resolution: {
      isNewUser: true,
      profileState: 'incomplete',
      requiredActions: [],
      destination: '/',
    } })).toBe(s);
    expect(reduce(s, { kind: 'ACTIVATED' })).toBe(s);
  });

  it('currentAction / progressLabel return null outside PROFILE_COMPLETION', () => {
    for (const s of [
      initialState,
      { name: 'AUTHENTICATING', method: 'google' } as SignupState,
      { name: 'ACCOUNT_RESOLUTION' } as SignupState,
      { name: 'ACTIVATION' } as SignupState,
      { name: 'DONE' } as SignupState,
    ]) {
      expect(currentAction(s)).toBeNull();
      expect(progressLabel(s)).toBeNull();
    }
  });
});

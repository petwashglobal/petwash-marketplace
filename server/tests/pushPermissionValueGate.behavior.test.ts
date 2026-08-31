/**
 * PushPermissionValueGate — CEO P0-CEP task #172 (Batch §5).
 *
 * "Never ask on first launch." The user has to have seen value.
 * The verdict ORDER matters: OS state trumps everything (no point
 * asking when we already know the OS answer), then value, then
 * user-choice cooldowns.
 */
import { describe, it, expect } from 'vitest';
import {
  evaluatePushPermissionGate,
  type PushValueGateInput,
  type PushValueSignal,
} from '@shared/marketplace/pushPermissionValueGate';

const NOW = new Date('2026-08-31T12:00:00Z');

function makeInput(over: Partial<PushValueGateInput> = {}): PushValueGateInput {
  return {
    osState: 'DEFAULT',
    valueSignals: [],
    now: NOW,
    ...over,
  };
}

describe('PushPermissionValueGate', () => {
  it('HOLD(NO_VALUE_YET) on the first-launch case', () => {
    const v = evaluatePushPermissionGate(makeInput());
    expect(v.code).toBe('HOLD');
    if (v.code !== 'HOLD') throw new Error();
    expect(v.reasonCode).toBe('NO_VALUE_YET');
  });

  it('PROMPT_NOW once the user has one qualifying value signal', () => {
    const v = evaluatePushPermissionGate(makeInput({
      valueSignals: ['FIRST_BOOKING_CONFIRMED' satisfies PushValueSignal],
    }));
    expect(v.code).toBe('PROMPT_NOW');
  });

  it('HOLD(OS_UNAVAILABLE) trumps everything — even a granted OS state below is impossible here', () => {
    const v = evaluatePushPermissionGate(makeInput({
      osState: 'UNAVAILABLE',
      valueSignals: ['FIRST_BOOKING_CONFIRMED'],
    }));
    expect(v.code).toBe('HOLD');
    if (v.code !== 'HOLD') throw new Error();
    expect(v.reasonCode).toBe('OS_UNAVAILABLE');
  });

  it('HOLD(ALREADY_GRANTED) when OS already granted — do not re-prompt', () => {
    const v = evaluatePushPermissionGate(makeInput({
      osState: 'GRANTED',
      valueSignals: ['FIRST_BOOKING_CONFIRMED'],
    }));
    expect(v.code).toBe('HOLD');
    if (v.code !== 'HOLD') throw new Error();
    expect(v.reasonCode).toBe('ALREADY_GRANTED');
  });

  it('HOLD(ALREADY_DENIED_BY_OS) — one shot spent; never re-prompt via OS', () => {
    const v = evaluatePushPermissionGate(makeInput({
      osState: 'DENIED',
      valueSignals: ['FIRST_BOOKING_CONFIRMED'],
    }));
    expect(v.code).toBe('HOLD');
    if (v.code !== 'HOLD') throw new Error();
    expect(v.reasonCode).toBe('ALREADY_DENIED_BY_OS');
  });

  it('HOLD(USER_DECLINED_RECENTLY) within cooldown after in-app decline', () => {
    const v = evaluatePushPermissionGate(makeInput({
      valueSignals: ['FIRST_BOOKING_CONFIRMED'],
      lastDeclinedAt: new Date(NOW.getTime() - 1_000),
    }));
    expect(v.code).toBe('HOLD');
    if (v.code !== 'HOLD') throw new Error();
    expect(v.reasonCode).toBe('USER_DECLINED_RECENTLY');
  });

  it('HOLD(COOLDOWN_ACTIVE) when re-asking within cooldown after a benign prompt', () => {
    const v = evaluatePushPermissionGate(makeInput({
      valueSignals: ['FIRST_BOOKING_CONFIRMED'],
      lastPromptAt: new Date(NOW.getTime() - 1_000),
    }));
    expect(v.code).toBe('HOLD');
    if (v.code !== 'HOLD') throw new Error();
    expect(v.reasonCode).toBe('COOLDOWN_ACTIVE');
  });

  it('PROMPT_NOW once cooldown has fully elapsed', () => {
    const v = evaluatePushPermissionGate(makeInput({
      valueSignals: ['FIRST_BOOKING_CONFIRMED'],
      lastPromptAt: new Date(NOW.getTime() - 31 * 24 * 60 * 60 * 1000),
    }));
    expect(v.code).toBe('PROMPT_NOW');
  });

  it('deduplicates repeated value signals (spam-safe)', () => {
    const v = evaluatePushPermissionGate(makeInput({
      valueSignals: ['FAVOURITE_SAVED', 'FAVOURITE_SAVED', 'FAVOURITE_SAVED'],
    }));
    expect(v.code).toBe('PROMPT_NOW');
  });

  it('honours a caller-supplied minCooldownMs override', () => {
    const v = evaluatePushPermissionGate(makeInput({
      valueSignals: ['FIRST_BOOKING_CONFIRMED'],
      lastPromptAt: new Date(NOW.getTime() - 60_000),
      minCooldownMs: 30_000,
    }));
    expect(v.code).toBe('PROMPT_NOW');
  });
});

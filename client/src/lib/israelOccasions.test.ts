import { describe, it, expect } from 'vitest';
import { israelOccasion } from './israelOccasions';
import { smartGreeting } from './smartGreeting';

const at = (iso: string) => new Date(iso);

describe('israelOccasion — Israel-first calendar', () => {
  it('Rosh Hashana → Shana Tova (Hebrew)', () => {
    expect(israelOccasion('he', at('2026-09-11T12:00:00'))?.text).toBe('שנה טובה ומתוקה');
  });
  it('Pesach → Chag Sameach', () => {
    expect(israelOccasion('he', at('2026-04-01T12:00:00'))?.text).toBe('חג שמח');
  });
  it('World Dog Day (Aug 26) → world dog day greeting', () => {
    const o = israelOccasion('en', at('2026-08-26T12:00:00'));
    expect(o?.text).toBe('Happy World Dog Day');
    expect(o?.emoji).toBe('🐶');
  });
  it('an ordinary day → null', () => {
    expect(israelOccasion('he', at('2026-06-23T12:00:00'))).toBeNull();
  });
});

describe('smartGreeting — occasion ranking', () => {
  it('uses the occasion above the time-of-day greeting', () => {
    expect(smartGreeting('NIR', 'he', { now: at('2026-09-11T08:00:00'), occasion: { text: 'שנה טובה ומתוקה', emoji: '🍎' } }))
      .toBe('שנה טובה ומתוקה NIR! 🍎');
  });
  it('a personal birthday still beats the occasion', () => {
    expect(smartGreeting('NIR', 'he', { now: at('2026-09-11T08:00:00'), birthday: '1985-09-11', occasion: { text: 'שנה טובה ומתוקה', emoji: '🍎' } }))
      .toBe('יום הולדת שמח NIR! 🎂');
  });
});

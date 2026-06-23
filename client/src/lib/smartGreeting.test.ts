import { describe, it, expect } from 'vitest';
import { smartGreeting } from './smartGreeting';

const at = (iso: string) => new Date(iso);

describe('smartGreeting — time of day (Hebrew)', () => {
  it('morning', () => expect(smartGreeting('NIR', 'he', { now: at('2026-06-23T08:00:00') })).toBe('בוקר טוב NIR'));
  it('afternoon', () => expect(smartGreeting('NIR', 'he', { now: at('2026-06-23T14:00:00') })).toBe('צהריים טובים NIR'));
  it('evening', () => expect(smartGreeting('Ido', 'he', { now: at('2026-06-23T19:30:00') })).toBe('ערב טוב Ido'));
  it('night (after midnight wraps)', () => expect(smartGreeting('Ido', 'he', { now: at('2026-06-23T02:00:00') })).toBe('לילה טוב Ido'));
});

describe('smartGreeting — time of day (English)', () => {
  it('morning', () => expect(smartGreeting('Nir', 'en', { now: at('2026-06-23T08:00:00') })).toBe('Good morning Nir'));
  it('evening', () => expect(smartGreeting('Nir', 'en', { now: at('2026-06-23T21:00:00') })).toBe('Good evening Nir'));
});

describe('smartGreeting — occasions override time of day', () => {
  it('user birthday (day+month match, any year)', () => {
    expect(smartGreeting('NIR', 'he', { now: at('2026-06-23T08:00:00'), birthday: '1985-06-23' })).toBe('יום הולדת שמח NIR! 🎂');
  });
  it('pet birthday uses the pet name, not the owner name', () => {
    expect(smartGreeting('NIR', 'he', { now: at('2026-06-23T08:00:00'), petBirthdays: [{ name: 'רקסי', dob: '2020-06-23' }] }))
      .toBe('יום הולדת שמח לרקסי 🐾');
  });
  it('user birthday beats pet birthday on the same day', () => {
    expect(smartGreeting('NIR', 'he', { now: at('2026-06-23T08:00:00'), birthday: '1985-06-23', petBirthdays: [{ name: 'רקסי', dob: '2020-06-23' }] }))
      .toBe('יום הולדת שמח NIR! 🎂');
  });
  it('two pets sharing a birthday are greeted together (Hebrew)', () => {
    expect(smartGreeting('NIR', 'he', { now: at('2026-06-23T08:00:00'), petBirthdays: [
      { name: 'רקסי', dob: '2020-06-23' }, { name: 'לונה', dob: '2021-06-23' },
    ] })).toBe('יום הולדת שמח לרקסי ולונה 🐾');
  });
  it('two pets sharing a birthday are greeted together (English)', () => {
    expect(smartGreeting('Nir', 'en', { now: at('2026-06-23T08:00:00'), petBirthdays: [
      { name: 'Rexy', dob: '2020-06-23' }, { name: 'Luna', dob: '2021-06-23' },
    ] })).toBe('Happy Birthday to Rexy & Luna 🐾');
  });
  it('only the pet whose birthday is today is greeted', () => {
    expect(smartGreeting('Nir', 'en', { now: at('2026-06-23T08:00:00'), petBirthdays: [
      { name: 'Rexy', dob: '2020-06-23' }, { name: 'Luna', dob: '2021-12-01' },
    ] })).toBe('Happy Birthday to Rexy 🐾');
  });
  it('civil New Year', () => {
    expect(smartGreeting('Nir', 'en', { now: at('2026-01-01T08:00:00') })).toBe('Happy New Year Nir! 🎉');
  });
  it('non-birthday day falls back to time of day', () => {
    expect(smartGreeting('NIR', 'he', { now: at('2026-06-24T08:00:00'), birthday: '1985-06-23' })).toBe('בוקר טוב NIR');
  });
});

describe('smartGreeting — missing name', () => {
  it('no name still greets', () => expect(smartGreeting('', 'he', { now: at('2026-06-23T08:00:00') })).toBe('בוקר טוב'));
});

/**
 * PR-W52 — phone-display formatter and LTR isolation invariants.
 *
 * The bug: Hebrew RTL container reorders "+972 54-983-3355" into
 * "972-54-983-3355+" because the leading "+" gets pushed to the visual
 * end. PR-W52 fixes this with two changes:
 *
 *   1. `formatIsraeliPhoneForDisplay()` produces a canonical "+972 …"
 *      string (a single space between country code and national number
 *      so the bidi algorithm has a clean LTR run).
 *   2. The `<Ltr>` component / `.ltr-inline` CSS class wraps every
 *      visible rendering of the phone, applying
 *      `direction: ltr` + `unicode-bidi: isolate`.
 *
 * This test pins (1). Static source-pin assertions cover (2) inside
 * the page-level test files.
 */

import { describe, it, expect } from 'vitest';
import {
  SUPPORT_PHONE,
  SUPPORT_PHONE_DISPLAY,
  SUPPORT_TEL_URL,
  formatIsraeliPhoneForDisplay,
} from './support-contact';

describe('PR-W52 — support-contact constants', () => {
  it('SUPPORT_PHONE is the canonical E.164 (no spaces, no dashes)', () => {
    expect(SUPPORT_PHONE).toBe('+972549833355');
  });

  it('SUPPORT_PHONE_DISPLAY is the canonical visible form', () => {
    expect(SUPPORT_PHONE_DISPLAY).toBe('+972 54-983-3355');
  });

  it('SUPPORT_PHONE_DISPLAY starts with "+" so the country code never reorders', () => {
    expect(SUPPORT_PHONE_DISPLAY.startsWith('+')).toBe(true);
  });

  it('SUPPORT_TEL_URL is a valid tel: link to the canonical phone', () => {
    expect(SUPPORT_TEL_URL).toBe(`tel:${SUPPORT_PHONE}`);
  });
});

describe('PR-W52 — formatIsraeliPhoneForDisplay', () => {
  it('formats E.164 mobile to the canonical display form', () => {
    expect(formatIsraeliPhoneForDisplay('+972549833355')).toBe('+972 54-983-3355');
  });

  it('formats national mobile (leading 0) to the canonical display form', () => {
    expect(formatIsraeliPhoneForDisplay('0549833355')).toBe('+972 54-983-3355');
  });

  it('strips spaces / dashes / parentheses in input', () => {
    expect(formatIsraeliPhoneForDisplay('+972 (54) 983-3355')).toBe('+972 54-983-3355');
    expect(formatIsraeliPhoneForDisplay('054-983-3355')).toBe('+972 54-983-3355');
  });

  it('matches SUPPORT_PHONE_DISPLAY when given SUPPORT_PHONE', () => {
    expect(formatIsraeliPhoneForDisplay(SUPPORT_PHONE)).toBe(SUPPORT_PHONE_DISPLAY);
  });

  it('handles 8-digit landline format', () => {
    // Tel Aviv area code 03 + 7-digit local number → "+972 3-XXX-XXXX"
    expect(formatIsraeliPhoneForDisplay('035551234')).toBe('+972 3-555-1234');
  });

  it('returns empty string for empty input (not "+972 ")', () => {
    expect(formatIsraeliPhoneForDisplay('')).toBe('');
  });

  it('falls back gracefully for unknown lengths (no crash)', () => {
    const out = formatIsraeliPhoneForDisplay('12345');
    expect(out.length).toBeGreaterThan(0);
    expect(out.startsWith('+972 ')).toBe(true);
  });
});

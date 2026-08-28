/**
 * CEO §60 (2026-08-28) — map stable server error codes into friendly
 * HE/EN copy on the /apply submit path.
 *
 * Prior state: the error toast rendered `data.error` verbatim — Firebase
 * internal messages, Zod issue lists, and 500 stack summaries could
 * reach the applicant's screen. Human product.
 *
 * Fix: a small errorCode → { he, en } map at the failure branch of
 * handleSubmit. Unknown codes fall back to a neutral "Error submitting
 * application" copy. Network / parse failures in the outer catch never
 * surface the raw error either.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'ProviderOnboarding.tsx'),
  'utf8',
);

describe('ProviderOnboarding /apply error mapping (CEO §60)', () => {
  it('declares a FRIENDLY map keyed on server errorCode', () => {
    expect(SRC).toMatch(/const FRIENDLY: Record<string,\s*\{\s*he: string;\s*en: string \}\>/);
  });

  it('covers the five stable server codes from provider-onboarding.ts /apply', () => {
    for (const code of [
      'PHONE_NOT_VERIFIED',
      'VERIFY_LOOKUP_FAILED',
      'ID_NUMBER_REQUIRED',
      'APPLICATION_ALREADY_PROCESSED',
      'APPLICATION_NOT_FOUND',
    ]) {
      expect(SRC).toContain(code);
    }
  });

  it('selects HE or EN off the existing isHebrew flag — no en-only fallback', () => {
    // A regression that dropped isHebrew would leave HE users with an
    // English error. Pin the ternary.
    expect(SRC).toMatch(/const description = friendly\s*\n\s*\? \(isHebrew \? friendly\.he : friendly\.en\)/);
  });

  it('unknown errorCode → neutral fallback (never rendered from data.error verbatim)', () => {
    // The fallback branch is the neutral message; it must NOT read
    // data.error / data?.error inside the toast description.
    expect(SRC).toMatch(/isHebrew \? 'שגיאה בשליחת בקשה' : 'Error submitting application'/);
    // The old `description: data.error || ...` pattern is gone.
    expect(SRC).not.toMatch(/description:\s*data\.error \|\|/);
  });

  it('outer catch (network / parse failure) uses the neutral copy — no raw error surfaces', () => {
    // Guarantee the catch block doesn't render error?.message either.
    const catchIdx = SRC.indexOf("[ProviderOnboarding] Submit exception");
    expect(catchIdx).toBeGreaterThan(0);
    const window = SRC.slice(catchIdx, catchIdx + 1200);
    // No `description: error.message` or `description: error?.message` pattern.
    expect(window).not.toMatch(/description:\s*error\.?\?\.?message/);
    expect(window).toMatch(/Please try again in a moment/);
  });
});

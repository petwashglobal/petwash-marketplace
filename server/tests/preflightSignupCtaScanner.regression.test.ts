/**
 * CEO §73 (2026-08-28) — preflight scanner covers signup + onboarding CTAs.
 *
 * Prior audit history: refactors dropped the data-testid on the continue
 * buttons, E2E tests started passing against DOM that no longer existed,
 * and the "wrong OTP silent-continue" bug shipped for weeks before it
 * was caught by a customer report. Add a scanner check + pin it here.
 *
 * The scanner runs from CI's Legacy UI Scanner gate
 * (.github/workflows/petwash-ci.yml). This test pins the scanner
 * itself — a rename that drops an anchor from the SURFACES list would
 * let a real regression slip past CI silently, so we require the
 * anchors to survive here too.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SCANNER = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'scripts', 'petwash-preflight.ts'),
  'utf8',
);

describe('petwash-preflight — CTA scanner (CEO §73)', () => {
  it('declares checkSignupOnboardingCTAs and runs it in runAllGuards', () => {
    expect(SCANNER).toMatch(/async function checkSignupOnboardingCTAs\(\): Promise<GuardResult>/);
    expect(SCANNER).toMatch(/results\.push\(await checkSignupOnboardingCTAs\(\)\)/);
  });

  it('pins the SignUpLuxury.tsx anchors (mobile/email continue + new-user consents + change-affordances)', () => {
    for (const anchor of [
      'button-continue-mobile',
      'button-continue-email',
      'checkbox-ageConfirmed18Plus',
      'checkbox-agreedTerms',
      'checkbox-acceptedMarketing',
      'button-resend-code-mobile',
      'button-change-number-mobile',
      'button-change-email',
    ]) {
      expect(SCANNER).toContain(anchor);
    }
  });

  it('pins the ProviderOnboarding.tsx anchors (submit + background consent + bank section + IBAN + driving licence)', () => {
    for (const anchor of [
      'button-submit-application',
      'checkbox-background-consent',
      'section-bank-payout',
      'input-bank-iban',
      // CEO §35 driving-licence conditional block.
      'section-driving-license',
      'input-driving-license-number',
      'input-driving-license-expiry',
    ]) {
      expect(SCANNER).toContain(anchor);
    }
  });

  it('pins the Pets.tsx medical-share consent toggle (CEO §22)', () => {
    // Without this control the KYA server enforcement chain is dark.
    expect(SCANNER).toContain('consent-toggle-');
    expect(SCANNER).toContain('consent-row-');
  });

  it('pins the booking-flow booking-scoped share checkboxes (CEO §5)', () => {
    expect(SCANNER).toContain('section-booking-scoped-share-walker');
    expect(SCANNER).toContain('checkbox-booking-scoped-share-walker');
    expect(SCANNER).toContain('section-booking-scoped-share-sitter');
    expect(SCANNER).toContain('checkbox-booking-scoped-share-sitter');
  });

  it('pins the ProviderApplicationStatus per-section state list (CEO §46)', () => {
    expect(SCANNER).toContain('section-status-list');
    expect(SCANNER).toContain('section-status-row-');
  });

  it('pins the ProviderApplicationStatus eligibility summary anchors (CEO §23)', () => {
    // readiness-summary + readiness-row-${key} — a rename that drops
    // either would let the applicant lose sight of their search /
    // booking eligibility state silently.
    expect(SCANNER).toContain('readiness-summary');
    expect(SCANNER).toContain('readiness-row-');
  });

  it('pins the ChooseMode CUSTOMER_FALLBACK guard against a /prestige/home regression', () => {
    // The regex must exist (case sensitive) so a re-introduction of the
    // old string trips the scanner.
    expect(SCANNER).toMatch(/CUSTOMER_FALLBACK\\s\*=\\s\*\['"\]\\\/prestige\\\/home\['"\]/);
    expect(SCANNER).toContain("'/pet-parent/home'");
  });
});

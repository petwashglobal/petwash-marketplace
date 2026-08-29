/**
 * Lane A — Phone + Email input screens + persona catalog pins.
 *
 * CEO FLY MODE II §4 + §6 — AUTH CONVERSION P0 (2026-08-29).
 *
 * "Initial screen: Continue with mobile → show ONLY mobile number →
 *  tap Send code → OTP → server determines existing vs new."
 *
 * The shell must render:
 *   • AUTHENTICATING(method='mobile') → ContactEntryScreen(kind='mobile')
 *     with a phone-number input and NO name/DOB/password/terms.
 *   • AUTHENTICATING(method='email')  → same, kind='email'.
 *   • CONTACT_VERIFY(method='mobile') → OtpVerifyScreen showing the
 *     sentTo value and an OTP input.
 *   • CONTACT_VERIFY(method='email')  → same.
 * And the persona catalog must expose customerNewPhone /
 * customerNewEmail that omit the just-verified contact's action.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = path.resolve(__dirname, '..', '..');

const SHELL = fs.readFileSync(
  path.resolve(ROOT, 'client', 'src', 'pages', 'SignUpProgressive.tsx'),
  'utf8',
);

const ADAPTER = fs.readFileSync(
  path.resolve(ROOT, 'tests', 'e2e', 'firebaseTestAdapter.ts'),
  'utf8',
);

describe('CEO FLY MODE II §4 — mobile entry screen renders ONE field only', () => {
  it('AUTHENTICATING+method=mobile renders ContactEntryScreen with kind=mobile', () => {
    expect(SHELL).toMatch(
      /state\.name === 'AUTHENTICATING' && state\.method === 'mobile'[\s\S]{0,200}<ContactEntryScreen kind="mobile"/,
    );
  });

  it('ContactEntryScreen shows ONLY the contact input — no name / DOB / password / terms', () => {
    const idx = SHELL.indexOf('function ContactEntryScreen');
    expect(idx).toBeGreaterThan(0);
    const nextFn = SHELL.indexOf('\nfunction ', idx + 1);
    const body = SHELL.slice(idx, nextFn > 0 ? nextFn : idx + 3000);
    // The screen renders ONE <input>. A second input would appear.
    const inputs = body.match(/<input\b/g) || [];
    expect(inputs.length).toBe(1);
    // No name/DOB/password/terms fields.
    expect(body).not.toMatch(/type=["']password["']/);
    expect(body).not.toMatch(/type=["']date["']/);
    expect(body).not.toMatch(/firstName/i);
    expect(body).not.toMatch(/lastName/i);
    expect(body).not.toMatch(/dateOfBirth/i);
    expect(body).not.toMatch(/agreedTerms/i);
  });

  it('Send-code button dispatches AUTH_CODE_SENT with { method, sentTo }', () => {
    const idx = SHELL.indexOf('function ContactEntryScreen');
    const nextFn = SHELL.indexOf('\nfunction ', idx + 1);
    const body = SHELL.slice(idx, nextFn > 0 ? nextFn : idx + 3000);
    expect(body).toMatch(
      /dispatch\(\{\s*kind:\s*'AUTH_CODE_SENT',[\s\S]{0,200}method:\s*kind,[\s\S]{0,100}sentTo:\s*value\.trim\(\)/,
    );
  });

  it('input testids are stable — signup-progressive-input-{mobile|email}', () => {
    expect(SHELL).toMatch(/data-testid=\{`signup-progressive-input-\$\{kind\}`\}/);
  });
});

describe('CEO FLY MODE II §4 — OTP verify screen', () => {
  it('CONTACT_VERIFY renders OtpVerifyScreen with method + sentTo', () => {
    expect(SHELL).toMatch(
      /<OtpVerifyScreen language=\{language\} sentTo=\{state\.sentTo\} method=\{state\.method\}/,
    );
  });

  it('OtpVerifyScreen shows the sentTo value on a testid the E2E can assert', () => {
    expect(SHELL).toMatch(/data-testid="signup-progressive-sent-to"/);
  });

  it('OTP input is numeric-only + one-time-code autocomplete', () => {
    const idx = SHELL.indexOf('function OtpVerifyScreen');
    const nextFn = SHELL.indexOf('\nfunction ', idx + 1);
    const body = SHELL.slice(idx, nextFn > 0 ? nextFn : idx + 3000);
    expect(body).toMatch(/inputMode="numeric"/);
    expect(body).toMatch(/autoComplete="one-time-code"/);
    // Non-digit input is stripped — a UI hardening against paste noise.
    expect(body).toMatch(/e\.target\.value\.replace\(\/\\D\/g, ''\)/);
  });

  it('Verify button dispatches AUTH_SUCCESS', () => {
    const idx = SHELL.indexOf('function OtpVerifyScreen');
    const nextFn = SHELL.indexOf('\nfunction ', idx + 1);
    const body = SHELL.slice(idx, nextFn > 0 ? nextFn : idx + 3000);
    expect(body).toMatch(/dispatch\(\{ kind: 'AUTH_SUCCESS' \}\)/);
  });
});

describe('CEO FLY MODE II Lane A — new phone + email personas', () => {
  it('personas.customerNewPhone EXISTS and OMITS mobile_verification (already OTP-verified)', () => {
    expect(ADAPTER).toMatch(/customerNewPhone:\s*\{/);
    const idx = ADAPTER.indexOf('customerNewPhone:');
    const nextPersona = ADAPTER.indexOf('  }', idx + 500);
    const block = ADAPTER.slice(idx, nextPersona);
    // Ordered action list must NOT include mobile_verification.
    expect(block).not.toMatch(/'mobile_verification'/);
    // Canonical §6 ordering: names → DOB → terms.
    expect(block).toMatch(
      /requiredActions:\s*\[\s*'first_name',\s*'last_name',\s*'date_of_birth',\s*'terms_acceptance',/,
    );
  });

  it('personas.customerNewPhone uses the synthetic uid@firebase.user email pattern', () => {
    // Matches the SignUpLuxury:1801 fallback so an aggregator that
    // matches by email doesn't false-positive across personas.
    expect(ADAPTER).toMatch(
      /customerNewPhone:[\s\S]{0,600}email:\s*'usr_e2e_customer_new_phone@firebase\.user'/,
    );
  });

  it('personas.customerNewEmail EXISTS and OMITS email_verification', () => {
    expect(ADAPTER).toMatch(/customerNewEmail:\s*\{/);
    const idx = ADAPTER.indexOf('customerNewEmail:');
    const nextPersona = ADAPTER.indexOf('  }', idx + 500);
    const block = ADAPTER.slice(idx, nextPersona);
    // The email was just verified via OTP so no email_verification action.
    expect(block).not.toMatch(/'email_verification'/);
    // Every OTHER action is present in canonical §6 order.
    expect(block).toMatch(
      /requiredActions:\s*\[\s*'mobile_verification',\s*'first_name',\s*'last_name',\s*'date_of_birth',\s*'terms_acceptance',/,
    );
  });

  it('each new persona carries a DISTINCT uid so the harness never confuses them', () => {
    for (const uid of [
      'usr_e2e_customer_new',
      'usr_e2e_customer_new_phone',
      'usr_e2e_customer_new_email',
    ]) {
      expect(ADAPTER).toMatch(new RegExp(`uid:\\s*'${uid}'`));
    }
  });
});

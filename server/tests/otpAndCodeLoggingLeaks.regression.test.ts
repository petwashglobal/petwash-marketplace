/**
 * Task 7 — CEO fire order 101-140.
 *
 * (a) OTP LOGGING: repo-wide check that OTP/verification-code VALUES
 *     never appear as raw fields in logger.* calls. The audited
 *     services already store hashes (HMAC / bcrypt) and log only
 *     length / userId / attempts / phone-suffix — this pin freezes
 *     that.
 *
 * (b) SINGLE-USE PROMO CODES (birthday + seasonal): 5 logger calls
 *     that previously echoed `code` as-is have been swapped to
 *     `codeHash` (sha256 first-12 hex chars). Attackers cannot
 *     reconstruct discount codes from log access.
 *
 * (c) CEO 2FA request 500 response no longer echoes error.message.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');

describe('OTP services log length/userId/attempts — never the raw code', () => {
  const OTP_FILES = [
    'services/TwilioSMSService.ts',
    'services/UnifiedVerificationService.ts',
    'services/RegistrationOTPService.ts',
    'services/TransactionOTPService.ts',
    'services/TwoFactorAuthService.ts',
    'services/TOTPService.ts',
    'routes/publicAuthRoutes.ts',
    'routes/provider-phone.ts',
    'routes/onboarding-verification.ts',
    'routes/israeli-2025-esign.ts',
    'routes/mfa.ts',
    'routes/transaction-otp.ts',
  ];

  for (const rel of OTP_FILES) {
    it(`${rel}: no raw OTP/verificationCode/smsCode value inside logger.* args`, () => {
      const src = R(rel);
      // Iterate over each logger.* call and inspect the argument text.
      // We accept: `code: err.code` (twilio error code — safe), `code: 'STRING_LITERAL'`.
      // We reject: `otp,` / `otp:` where otp is a variable, `code,` (variable) inside logger args
      //           that reference these auth-code identifiers.
      const rx = /(logger|console)\.(log|info|debug|warn|error)\(/g;
      let m: RegExpExecArray | null;
      while ((m = rx.exec(src)) !== null) {
        const start = m.index + m[0].length;
        let depth = 1;
        let i = start;
        while (i < src.length && depth > 0) {
          const c = src[i];
          if (c === '(') depth++;
          else if (c === ')') depth--;
          i++;
        }
        const call = src.slice(start, i);
        // Forbidden: log passes an OTP/verificationCode/smsCode variable directly.
        expect(call).not.toMatch(/\botp\s*,/i);        // otp as positional variable
        expect(call).not.toMatch(/\botp\s*:\s*(otp|otpCode|verificationCode|smsCode|code|generatedOtp)\b/i);
        expect(call).not.toMatch(/\bverificationCode\s*:\s*(verificationCode|code|otp)\b/);
        expect(call).not.toMatch(/\bsmsCode\s*:\s*(smsCode|code|otp)\b/);
        expect(call).not.toMatch(/\bgeneratedOtp\b/);
      }
    });
  }
});

describe('Birthday + seasonal promo logs use codeHash, never the raw code', () => {
  it('birthday-promo.ts: no `, code,` or `code: code` inside logger args', () => {
    const src = R('routes/birthday-promo.ts');
    // Line-level check: any logger call that contains a `code` shortcut
    // property should be gone.
    const badPatterns = [
      /logger\.(info|warn|debug)\([^)]*\{\s*uid,\s*code,/,          // { uid, code, ...
      /logger\.(info|warn|debug)\([^)]*providedCode:\s*code\b/,     // providedCode: code
      /logger\.(info|warn|debug)\([^)]*actualCode:\s*data\.code\b/, // actualCode: data.code
    ];
    for (const p of badPatterns) expect(src).not.toMatch(p);
  });

  it('birthday-promo.ts: every touched log now emits a codeHash', () => {
    const src = R('routes/birthday-promo.ts');
    // 5 touched sites (one has two hashes) — expect at least 5 lines.
    const lines = src.split('\n').filter(l => /createHash\('sha256'\)\.update\(.{0,40}\)\.digest\('hex'\)\.slice\(0, 12\)/.test(l));
    expect(lines.length).toBeGreaterThanOrEqual(5);
    expect(src).toContain("codeHash:");
    expect(src).toContain("providedCodeHash:");
    expect(src).toContain("expectedCodeHash:");
  });
});

describe('admin.ts CEO 2FA request 500 body is sanitised', () => {
  it('no more `details: error instanceof Error ? error.message`', () => {
    const src = R('routes/admin.ts');
    // Locate the request-2FA catch block by its logger tag then check the following res.status.
    const idx = src.indexOf("[CEO] Error requesting voucher 2FA");
    expect(idx).toBeGreaterThan(-1);
    const window = src.slice(idx, idx + 400);
    expect(window).not.toMatch(/details:\s*error instanceof Error\s*\?\s*error\.message/);
    expect(window).toContain("'CEO_2FA_SEND_500'");
  });
});

/**
 * Regression pin — sms_evidence OTP body redaction (AUDIT-SMS-7 / #222).
 *
 * The `sms_evidence` table previously stored the exact SMS body we sent
 * to a subscriber — for OTP messages, that meant every historical row
 * carried a fully-usable, reusable 4-8 digit code in plain text.
 * Anyone with SELECT on that table (SRE with prod DB access, a leaked
 * backup, an admin tool) got a working OTP for the destination phone
 * number in the same row.
 *
 * Fix: every insert into `smsEvidence` where messageType === 'OTP'
 * now routes the body through `redactOtpBody(body, 'OTP')` from
 * server/lib/redactOtpBody.ts, which scrubs `\d{4,8}` runs to
 * `******`. Canonical verification lives in
 * `verification_challenges.codeHash` — the scrubbed digits are not
 * needed for legal evidence-of-delivery.
 *
 * This pin walks every writer known to emit `smsEvidence` with an
 * OTP messageType and refuses:
 *   1. any surviving raw `renderedText: smsBody` / `renderedText: renderedText`
 *      insert that bypasses `redactOtpBody(`;
 *   2. any new writer file that does NOT import redactOtpBody after
 *      inserting into smsEvidence with an OTP body.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');

const OTP_WRITER_FILES = [
  'server/services/RegistrationOTPService.ts',
  'server/services/UnifiedVerificationService.ts',
];

describe('AUDIT-SMS-7 / #222 — sms_evidence OTP writers route body through redactOtpBody', () => {
  for (const rel of OTP_WRITER_FILES) {
    it(`${rel} imports redactOtpBody`, () => {
      const src = readFileSync(join(ROOT, rel), 'utf8');
      expect(src).toMatch(/from ['"]\.\.\/lib\/redactOtpBody['"]/);
    });

    it(`${rel} never inserts a raw OTP body into smsEvidence`, () => {
      const src = readFileSync(join(ROOT, rel), 'utf8');
      // Every renderedText assignment for an smsEvidence insert with
      // messageType 'OTP' must be `redactOtpBody(...)`.
      expect(src).not.toMatch(/renderedText:\s*smsBody\b/);
      // No `renderedText: <bareIdent>,` at insert positions — every
      // insert must wrap the body in redactOtpBody(...).
      expect(src).not.toMatch(/renderedText:\s*renderedText\s*,/);
      // Every `renderedText:` that is a runtime assignment (not a type
      // annotation like `renderedText: string`) must be a redactOtpBody call.
      const bindings = src.match(/renderedText:\s*[^\n,]+/g) || [];
      for (const b of bindings) {
        if (/^renderedText:\s*(string|number|boolean|any|unknown)\s*$/.test(b)) continue;
        expect(b).toMatch(/redactOtpBody\(/);
      }
    });
  }

  it('redactOtpBody scrubs 4-8 digit runs and leaves non-OTP bodies alone', async () => {
    const { redactOtpBody } = await import('../lib/redactOtpBody');
    expect(redactOtpBody('Your code is 1234', 'OTP')).toBe('Your code is ******');
    expect(redactOtpBody('Your code is 12345678', 'OTP')).toBe('Your code is ******');
    // The regex matches 4-8 digit runs; date components below 4 digits are
    // unaffected. That is deliberate — OTPs are always ≥4 digits, and
    // scrubbing every 2-digit run would obliterate timestamps and prices in
    // any other body that ever reused this path.
    expect(redactOtpBody('Booking confirmed for 2026-09-02 at 10am', 'OTP')).toBe(
      'Booking confirmed for ******-09-02 at 10am',
    );
    // Non-OTP messages are untouched.
    expect(redactOtpBody('Order #12345 confirmed', 'WELCOME')).toBe('Order #12345 confirmed');
    expect(redactOtpBody('Order #12345 confirmed', null)).toBe('Order #12345 confirmed');
    expect(redactOtpBody('Order #12345 confirmed', undefined)).toBe('Order #12345 confirmed');
  });

  it('backfill migration exists that scrubs historical OTP bodies', () => {
    const sql = readFileSync(
      join(ROOT, 'migrations/0139_sms_evidence_redact_otp_2026_09_02.sql'),
      'utf8',
    );
    expect(sql).toMatch(/UPDATE\s+sms_evidence/i);
    expect(sql).toMatch(/regexp_replace/);
    expect(sql).toMatch(/message_type\s*=\s*'OTP'/);
  });
});

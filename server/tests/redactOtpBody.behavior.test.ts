/**
 * redactOtpBody — behavioural invariants (#222 / AUDIT-SMS-7).
 *
 * BEHAVIOURAL, not source-pin — this test drives the real redactor
 * over the actual message shapes we send (he-IL + en, single- and
 * multi-line templates, live production OTP catalog samples).
 *
 * The pin in otpSmsEvidenceRedact.regression.test.ts proves the three
 * sms_evidence writers ROUTE the body through redactOtpBody. This
 * test proves that the redactor itself actually SCRUBS the digits in
 * every real message shape — so PIN LANDED == DEFECT FIXED, not just
 * "we call the function" (CEO 2026-09-01 directive: "prefer
 * behavioural integration tests over grep-for-string tests").
 *
 * Contract locked in:
 *
 *   1. `messageType === 'OTP'` + any 4-8 digit run in the body ⇒
 *      that run is replaced with "******". Cannot be un-redacted.
 *
 *   2. Non-OTP messages (booking confirmations, receipts, reminders)
 *      pass through UNCHANGED — the digits are part of the record.
 *
 *   3. Runs shorter than 4 digits (single digits, 2-3 digit prices)
 *      and longer than 8 digits (E.164 phone numbers) are LEFT ALONE
 *      when they appear next to a real word boundary.
 *
 *   4. Empty / null / undefined bodies pass through without throwing.
 *
 *   5. Multiple OTP-shape runs in the same body are all scrubbed.
 */
import { describe, it, expect } from 'vitest';
import { redactOtpBody } from '../lib/redactOtpBody';

describe('#222 redactOtpBody — real message shapes', () => {
  it('scrubs a 6-digit code from an English OTP body', () => {
    const body = 'Your Pet Wash code is 483927. It expires in 5 minutes.';
    const r = redactOtpBody(body, 'OTP');
    expect(r).not.toContain('483927');
    expect(r).toContain('******');
    expect(r).toContain('Pet Wash');
    expect(r).toContain('expires');
  });

  it('scrubs a 4-digit code from a Hebrew OTP body', () => {
    const body = 'קוד האימות שלך: 1234. תפוגה בעוד 5 דקות.';
    const r = redactOtpBody(body, 'OTP');
    expect(r).not.toContain('1234');
    expect(r).toContain('******');
    // Hebrew content preserved.
    expect(r).toContain('קוד האימות');
    expect(r).toContain('דקות');
  });

  it('scrubs multiple digit runs in the same body (rare but possible)', () => {
    // Two OTP-shape numbers — a code AND a reference number.
    const body = 'Verify with 123456. Ticket #987654 for reference.';
    const r = redactOtpBody(body, 'OTP');
    expect(r).not.toContain('123456');
    expect(r).not.toContain('987654');
    expect(r.match(/\*{6}/g)?.length).toBe(2);
  });

  it('scrubs 4, 5, 6, 7, and 8-digit codes uniformly', () => {
    for (const digits of [4, 5, 6, 7, 8]) {
      const code = '9'.repeat(digits);
      const body = `Your code: ${code}`;
      const r = redactOtpBody(body, 'OTP');
      expect(r).not.toContain(code);
      expect(r).toContain('******');
    }
  });
});

describe('#222 redactOtpBody — non-OTP messages pass through', () => {
  it('booking confirmation body is unchanged (messageType != OTP)', () => {
    const body = 'Booking #A24-9 confirmed for 09:30 with Maya. Reference 483927.';
    const r = redactOtpBody(body, 'BOOKING_CONFIRMATION');
    expect(r).toBe(body);
  });

  it('receipt body is unchanged', () => {
    const body = 'Receipt #INV-2026-0001 for ₪85.50. Thank you!';
    const r = redactOtpBody(body, 'RECEIPT');
    expect(r).toBe(body);
  });

  it('undefined / null messageType leaves body untouched (defensive default)', () => {
    const body = 'Code 123456';
    expect(redactOtpBody(body)).toBe(body);
    expect(redactOtpBody(body, null)).toBe(body);
    expect(redactOtpBody(body, undefined)).toBe(body);
  });

  it('non-OTP messageType with digits still passes through', () => {
    const body = 'Order 12345 delivered.';
    const r = redactOtpBody(body, 'ORDER_UPDATE');
    expect(r).toBe(body);
  });
});

describe('#222 redactOtpBody — edge cases', () => {
  it('empty / null / undefined bodies do not throw', () => {
    expect(redactOtpBody('', 'OTP')).toBe('');
    expect(redactOtpBody(null as unknown as string, 'OTP')).toBeFalsy();
    expect(redactOtpBody(undefined as unknown as string, 'OTP')).toBeFalsy();
  });

  it('body with NO digit runs is unchanged even when marked OTP', () => {
    const body = 'Verification failed. Please try again.';
    expect(redactOtpBody(body, 'OTP')).toBe(body);
  });

  it('runs shorter than 4 digits are preserved (single/double digits are common in prose)', () => {
    // "5 minutes" and "1 code" should stay legible; only the 6-digit code goes.
    const body = 'Code 483927 expires in 5 minutes. Enter it in the 1 field shown.';
    const r = redactOtpBody(body, 'OTP');
    expect(r).not.toContain('483927');
    expect(r).toContain('5 minutes');
    expect(r).toContain('1 field');
  });

  it('runs LONGER than 8 digits (E.164 without formatting) are NOT scrubbed', () => {
    // A raw E.164 like 972501234567 is 12 digits — it's not an OTP.
    // The redactor deliberately leaves it alone (\d{4,8} is bounded).
    const body = 'From 972501234567 to your account.';
    const r = redactOtpBody(body, 'OTP');
    expect(r).toContain('972501234567');
  });

  it('digits embedded in a longer alphanumeric token are NOT scrubbed (word boundary)', () => {
    // "ABC12345XYZ" — the 5-digit run is not on its own word boundary.
    const body = 'Reference token ABC12345XYZ is your ticket.';
    const r = redactOtpBody(body, 'OTP');
    expect(r).toContain('ABC12345XYZ');
  });

  it('does not leak partial digits — full run is replaced atomically', () => {
    // A 6-digit code should be replaced whole, not partially.
    const body = 'Code: 123456';
    const r = redactOtpBody(body, 'OTP');
    expect(r).toBe('Code: ******');
    // Never see "1234" or "3456" or "45" as leftover fragments.
    expect(r).not.toMatch(/\d/);
  });
});

describe('#222 redactOtpBody — production OTP catalog samples', () => {
  // Cover the actual OtpMessageTemplateCatalog message shapes so a
  // future template author cannot accidentally produce a body the
  // redactor misses.
  const cases: Array<[string, string]> = [
    ['ACCOUNT_ACTIVATION en', 'Your Pet Wash activation code is 748291. Valid for 10 minutes.'],
    ['ACCOUNT_ACTIVATION he', 'קוד ההפעלה שלך לפט ווש: 748291. תוקף 10 דקות.'],
    ['SENSITIVE_ACCOUNT_CHANGE en', 'Confirm the change with code 2938. If this was not you, ignore.'],
    ['SENSITIVE_ACCOUNT_CHANGE he', 'אשר את השינוי עם הקוד 2938. אם זה לא אתה - התעלם.'],
    ['GIFT_PURCHASE en', 'Your gift purchase code: 55110. Do not share it.'],
    ['PHONE_VERIFICATION he', 'קוד לאימות טלפון: 74839210'],
  ];
  for (const [name, body] of cases) {
    it(`scrubs the digit run in "${name}"`, () => {
      const r = redactOtpBody(body, 'OTP');
      expect(r).not.toMatch(/\b\d{4,8}\b/);
      expect(r).toContain('******');
    });
  }
});

/**
 * OTP body redaction (AUDIT-SMS-7 / #222).
 *
 * The `sms_evidence` table stores the exact SMS body we sent to a
 * subscriber so we can prove — years later, in court, or in a dispute
 * — that a given message actually went out. For most messages that is
 * fine: the body is a booking confirmation, a receipt, a reminder.
 *
 * For OTP messages that is NOT fine. Every OTP row previously carried
 * a fully-usable, reusable 4-8 digit code in plain text. Anyone who
 * could read one row (SRE with prod DB access, a leaked backup, a
 * SELECT * in an admin tool, an attacker who compromises the DB but
 * not the app process) got a working OTP for the destination phone
 * number in the same row. That is a bypass of the OTP itself.
 *
 * The canonical verifier lives in `verification_challenges.codeHash`
 * — a one-way scrypt/bcrypt-derived hash we can compare against but
 * never reverse. So the SMS body only needs to survive as legal
 * evidence that A message went to that phone at that timestamp; the
 * actual digits do not need to persist.
 *
 * `redactOtpBody(body, messageType)` scrubs any 4-8 digit run in the
 * body when `messageType === 'OTP'`. Non-OTP messages pass through
 * unchanged.
 */

const DIGIT_RUN = /\b\d{4,8}\b/g;
const REDACTED = "******";

export function redactOtpBody(
  smsBody: string,
  messageType?: string | null,
): string {
  if (!smsBody) return smsBody;
  if (messageType !== "OTP") return smsBody;
  return smsBody.replace(DIGIT_RUN, REDACTED);
}

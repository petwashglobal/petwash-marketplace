/**
 * OTPPurposeRegistry — CEO P0-CEP Batch §4.
 *
 * Doctrine: "The OTP system needs a purpose. Not just: code = 123456."
 *   OTP { purpose, userId, destination, channel, codeHash, expiresAt,
 *         attempts, consumedAt } — a code issued for one purpose MUST
 *   NOT be reusable for another.
 *
 * This file is:
 *   • The single enumeration of every legitimate OTP purpose.
 *   • The single evaluator that says whether a challenge row loaded
 *     from `verification_challenges` may be consumed for a REQUESTED
 *     purpose right now (given wall-clock, attempts, and status).
 *
 * Pure — no DB, no clock injection beyond `now: Date`, no I/O. The
 * caller (route handler or state machine) supplies a snapshot of the
 * challenge row and the purpose the current request wants to consume
 * it for; the evaluator returns a typed verdict.
 *
 * The purposes are deliberately narrow, each one anchored to a real
 * user-visible action, so the schema.ts freeform `varchar("purpose")`
 * cannot silently accumulate new values without landing here first.
 * A regression pin walks server/routes/lib and rejects any string
 * literal used as an OTP purpose that isn't in OTP_PURPOSES.
 */

/**
 * Every legitimate purpose an OTP may be issued for.
 *
 * Adding one requires: (a) a real user-visible flow that issues it,
 * (b) a state machine or route that consumes it, and (c) an update
 * to the source-anchored regression pin.
 */
export const OTP_PURPOSES = [
  'ACCOUNT_ACTIVATION',        // first-time signup — verify contact ownership
  'EMAIL_VERIFICATION',        // add-or-change email contact
  'PHONE_VERIFICATION',        // add-or-change mobile contact
  'LOGIN',                     // OTP-as-second-factor at sign-in
  'PASSWORD_RECOVERY',         // "forgot password" flow
  'PROVIDER_SECURITY_STEPUP',  // sensitive provider action (payout account, etc.)
  'BOOKING_CONFIRMATION',      // guest-checkout / anonymous booking confirmation
  'PURCHASE_CONFIRMATION',     // guest-checkout Shop purchase confirmation
  'GIFT_PURCHASE',             // eGift purchase confirmation (CEO OTP brief §1 — distinct from Shop)
  'CLOSE_ACCOUNT',             // irreversible destructive action
  'CHANGE_PAYOUT_DESTINATION', // provider bank-account rebinding
  'SENSITIVE_ACCOUNT_CHANGE',  // catch-all for sensitive changes not covered above (CEO OTP brief §1)
] as const;

export type OtpPurpose = (typeof OTP_PURPOSES)[number];

/** Type-narrowing guard used by loaders that receive freeform strings. */
export function isOtpPurpose(value: unknown): value is OtpPurpose {
  return typeof value === 'string' && (OTP_PURPOSES as readonly string[]).includes(value);
}

/**
 * Snapshot of the persisted verification_challenges row the caller
 * loaded. The evaluator never queries anything; it only reads this.
 * Field names track the schema.
 */
export interface OtpChallengeSnapshot {
  /** As stored in the row's `purpose` column. */
  purpose: string;
  /** As stored in the row's `status` column. */
  status: 'pending' | 'verified' | 'consumed' | 'expired' | 'locked' | 'cancelled';
  /** As stored in the row's `expires_at` column. */
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
}

export interface OtpConsumeInput {
  challenge: OtpChallengeSnapshot;
  /** The purpose the CURRENT request wants to consume the challenge for. */
  requestedPurpose: OtpPurpose;
  now: Date;
}

export type OtpConsumeVerdict =
  | { code: 'OK' }
  | { code: 'REFUSE'; reasonCode:
      | 'PURPOSE_MISMATCH'          // stored purpose ≠ requested purpose
      | 'UNKNOWN_STORED_PURPOSE'    // stored purpose is not in OTP_PURPOSES
      | 'STATUS_NOT_CONSUMABLE'     // already consumed / expired / locked / cancelled
      | 'EXPIRED'                   // wall-clock past expiresAt
      | 'ATTEMPTS_EXHAUSTED'        // attempts >= maxAttempts
    };

/**
 * Decide whether an OTP challenge snapshot may be consumed for the
 * requested purpose right now.
 *
 * Order matters: PURPOSE_MISMATCH first so a caller trying to reuse a
 * PHONE_VERIFICATION code for a LOGIN gets the honest reason, not
 * "expired" that leaks nothing about the mistake. UNKNOWN_STORED_PURPOSE
 * comes next so an OTP row inserted by an old (or malicious) code
 * path with an off-registry purpose cannot slip through.
 */
export function evaluateOtpConsumption(input: OtpConsumeInput): OtpConsumeVerdict {
  const { challenge, requestedPurpose, now } = input;

  if (!isOtpPurpose(challenge.purpose)) {
    return { code: 'REFUSE', reasonCode: 'UNKNOWN_STORED_PURPOSE' };
  }
  if (challenge.purpose !== requestedPurpose) {
    return { code: 'REFUSE', reasonCode: 'PURPOSE_MISMATCH' };
  }
  if (challenge.status !== 'pending' && challenge.status !== 'verified') {
    return { code: 'REFUSE', reasonCode: 'STATUS_NOT_CONSUMABLE' };
  }
  if (challenge.expiresAt.getTime() <= now.getTime()) {
    return { code: 'REFUSE', reasonCode: 'EXPIRED' };
  }
  if (challenge.attempts >= challenge.maxAttempts) {
    return { code: 'REFUSE', reasonCode: 'ATTEMPTS_EXHAUSTED' };
  }
  return { code: 'OK' };
}

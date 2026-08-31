/**
 * LegacyOtpPurposeMap — CEO P0-CEP task #177.
 *
 * Doctrine: The verification-trigger inventory (task #182, gap #2)
 * found that `unifiedVerificationPurposeRegistry` ships 9 lowercase
 * legacy purpose strings, none of which are in OTP_PURPOSES. Every
 * real `verification_challenges` row today is off-registry and
 * would trip `evaluateOtpConsumption` with UNKNOWN_STORED_PURPOSE.
 *
 * This file is the SINGLE source of truth for the legacy → canonical
 * bridge. Each entry is annotated by mapping certainty so a reader
 * knows what has been decided and what is still open:
 *
 *   ONE_TO_ONE : legacy string maps unambiguously to a canonical
 *                purpose already in OTP_PURPOSES. Safe to migrate
 *                the call-site to `evaluateOtpConsumption` with
 *                the canonical purpose immediately.
 *   NEEDS_NEW  : the semantic bridge requires a NEW canonical
 *                purpose that isn't in OTP_PURPOSES yet. The
 *                caller stays on the legacy string until CEO
 *                blesses the new canonical name.
 *   NEEDS_CEO  : the legacy string could reasonably map to two or
 *                more existing canonicals; CEO ruling required.
 *
 * A source-anchored regression pin
 * (legacyOtpPurposeMap.regression.test.ts) refuses any legacy
 * string not listed here — the map is authoritative.
 */

import type { OtpPurpose } from './otpPurposeRegistry';

/** Every legacy purpose string that appears in verification_challenges today. */
export const LEGACY_OTP_PURPOSES = [
  'diagnostic_noop',
  'login',
  'signup',
  'egift_redeem',
  'change_email',
  'enable_2fa',
  'disable_2fa',
  'close_account',
  'payout',
] as const;

export type LegacyOtpPurpose = (typeof LEGACY_OTP_PURPOSES)[number];

export type MappingCertainty =
  | 'ONE_TO_ONE'
  | 'NEEDS_NEW'
  | 'NEEDS_CEO'
  | 'DELETE';

export interface MappingEntry {
  legacy: LegacyOtpPurpose;
  certainty: MappingCertainty;
  /** The canonical OtpPurpose this maps to when ONE_TO_ONE; otherwise the intended-but-provisional target. */
  canonical?: OtpPurpose;
  /** Human-readable reason surfaced in error paths / audit reports. */
  rationale: string;
  /**
   * Follow-up task id (or a natural-language TODO) the CEO needs to
   * settle before ONE_TO_ONE becomes safe. Absent on ONE_TO_ONE.
   */
  followUp?: string;
}

/**
 * The 9-entry map. Every legacy purpose is present with an explicit
 * certainty. Adding a NEW legacy purpose (i.e. adding a purpose to
 * unifiedVerificationPurposeRegistry) requires landing an entry
 * here in the same commit — the regression pin enforces this.
 */
export const LEGACY_OTP_PURPOSE_MAP: readonly MappingEntry[] = [
  {
    legacy: 'login',
    certainty: 'ONE_TO_ONE',
    canonical: 'LOGIN',
    rationale: 'Purpose semantics identical: OTP-as-second-factor at sign-in.',
  },
  {
    legacy: 'change_email',
    certainty: 'ONE_TO_ONE',
    canonical: 'EMAIL_VERIFICATION',
    rationale: 'Both verify ownership of a new email address; the change-email flow is a superset that adds a state machine on top.',
  },
  {
    legacy: 'close_account',
    certainty: 'ONE_TO_ONE',
    canonical: 'CLOSE_ACCOUNT',
    rationale: 'Purpose semantics identical: irreversible destructive action.',
  },
  {
    legacy: 'diagnostic_noop',
    certainty: 'DELETE',
    rationale: 'Test-only harness purpose; no user-facing trigger exists. Should be removed from the runtime registry entirely.',
    followUp: 'Remove diagnostic_noop entry from unifiedVerificationPurposeRegistry once ONE_TO_ONE migrations land.',
  },
  {
    legacy: 'signup',
    certainty: 'NEEDS_CEO',
    canonical: 'ACCOUNT_ACTIVATION',
    rationale: '"signup" fires both when we verify the phone number ownership AND when we activate the account. CEO to decide: single purpose (ACCOUNT_ACTIVATION covers both) or split (PHONE_VERIFICATION for the mobile step, ACCOUNT_ACTIVATION for the wire-up).',
    followUp: 'CEO decision — see docs/audit/2026-08-31-otp-verification-trigger-inventory.md gap #2.',
  },
  {
    legacy: 'egift_redeem',
    certainty: 'NEEDS_NEW',
    rationale: 'OTP_PURPOSES has GIFT_PURCHASE for the BUYER side of an eGift; there is no canonical for the RECIPIENT redemption side. Adding GIFT_REDEEM keeps the two flows distinct in the sprawl pin.',
    followUp: 'Add GIFT_REDEEM to OTP_PURPOSES (needs CEO sign-off on the name).',
  },
  {
    legacy: 'enable_2fa',
    certainty: 'NEEDS_CEO',
    canonical: 'SENSITIVE_ACCOUNT_CHANGE',
    rationale: 'Enabling MFA is a sensitive account change; SENSITIVE_ACCOUNT_CHANGE covers it. Alternative: add TWO_FACTOR_ENABLE as its own canonical for finer-grained analytics.',
    followUp: 'CEO decision — one generic SENSITIVE_ACCOUNT_CHANGE or a dedicated TWO_FACTOR_ENABLE canonical.',
  },
  {
    legacy: 'disable_2fa',
    certainty: 'NEEDS_CEO',
    canonical: 'SENSITIVE_ACCOUNT_CHANGE',
    rationale: 'Symmetric to enable_2fa. Disabling a security control is high-risk and warrants either the generic SENSITIVE_ACCOUNT_CHANGE or a dedicated TWO_FACTOR_DISABLE.',
    followUp: 'CEO decision — same choice as enable_2fa; keep the two symmetric.',
  },
  {
    legacy: 'payout',
    certainty: 'NEEDS_CEO',
    canonical: 'CHANGE_PAYOUT_DESTINATION',
    rationale: 'CHANGE_PAYOUT_DESTINATION covers rebinding the bank account. The current "payout" purpose is used more broadly — for any payout operation (destination edit, one-off transfer). CEO to decide: keep the finer-grained CHANGE_PAYOUT_DESTINATION and add PAYOUT_ACTION for one-offs, or fold both under CHANGE_PAYOUT_DESTINATION.',
    followUp: 'CEO decision — see docs/audit/2026-08-31-otp-verification-trigger-inventory.md.',
  },
];

/**
 * Type-guard that says whether a legacy purpose string is recognised
 * at all. Prevents new lowercase strings from being persisted into
 * verification_challenges without landing a map entry first.
 */
export function isLegacyOtpPurpose(value: unknown): value is LegacyOtpPurpose {
  return typeof value === 'string' && (LEGACY_OTP_PURPOSES as readonly string[]).includes(value);
}

/**
 * Look up the mapping entry for a legacy purpose. Returns undefined
 * for unregistered strings (never guess — the caller decides how to
 * handle an off-map value).
 */
export function lookupLegacyMapping(legacy: string): MappingEntry | undefined {
  return LEGACY_OTP_PURPOSE_MAP.find((e) => e.legacy === legacy);
}

/**
 * Resolve a legacy purpose to a canonical purpose IF the mapping is
 * ONE_TO_ONE — the only certainty level that is safe to auto-migrate.
 * Returns undefined for NEEDS_*, DELETE, or unrecognised strings; the
 * caller must fall back to the legacy verification path.
 */
export function canonicalFor(legacy: string): OtpPurpose | undefined {
  const entry = lookupLegacyMapping(legacy);
  if (!entry) return undefined;
  if (entry.certainty !== 'ONE_TO_ONE') return undefined;
  return entry.canonical;
}

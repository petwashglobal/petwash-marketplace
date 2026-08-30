/**
 * RegistrationResumeService — CEO PROGRAM 43 (Progressive Signup).
 *
 * Pure evaluator. Given the identity state the server sees for a
 * given uid, returns the exact next step the client should route to.
 * This replaces the client-side "does the user have X yet?" ladder
 * with one canonical server evaluation.
 *
 * Doctrine (§ Program 43):
 *   Google new:     → missing phone → missing profile → activate
 *   Returning Google: straight in
 *   Phone:          phone → OTP → missing profile
 *   Email:          email → verification → missing profile
 *   No giant upfront form.
 *
 * The evaluator never MUTATES state; the client / server route uses
 * the returned nextStep to redirect.
 */

export type NextStep =
  | 'VERIFY_EMAIL'
  | 'VERIFY_PHONE'
  | 'ACCEPT_TERMS'
  | 'COMPLETE_PROFILE'
  | 'CONFIRM_AGE'
  | 'CHOOSE_MODE'
  | 'HOME_CUSTOMER'
  | 'HOME_PROVIDER_PENDING'
  | 'HOME_PROVIDER';

export interface IdentityState {
  emailVerified: boolean;
  phoneVerified: boolean;
  ageConfirmed: boolean;
  termsAcceptedVersion?: string;
  currentTermsVersion: string;
  profileComplete: boolean;
  hasCustomerCapability: boolean;
  hasProviderApplicant: boolean;
  hasProviderActive: boolean;
}

/**
 * Returns the FIRST unresolved step in the doctrine's order.
 * §65 discipline: BOTH email AND phone must be verified before the
 * account is considered active.
 */
export function nextRegistrationStep(state: IdentityState): NextStep {
  if (!state.ageConfirmed) return 'CONFIRM_AGE';
  if (!state.emailVerified) return 'VERIFY_EMAIL';
  if (!state.phoneVerified) return 'VERIFY_PHONE';
  if (state.termsAcceptedVersion !== state.currentTermsVersion) return 'ACCEPT_TERMS';
  if (!state.profileComplete) return 'COMPLETE_PROFILE';

  // Multi-role routing (§42 — Pet Parent is base capability).
  if (state.hasProviderActive) return 'HOME_PROVIDER';
  if (state.hasProviderApplicant) return 'HOME_PROVIDER_PENDING';
  if (state.hasCustomerCapability) return 'HOME_CUSTOMER';
  // A signed-in user with NEITHER a customer nor a provider
  // capability lands on the mode picker so they can declare intent.
  return 'CHOOSE_MODE';
}

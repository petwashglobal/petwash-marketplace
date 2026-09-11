// SINGLE SOURCE OF TRUTH for the base member profile gate.
//
// Both the post-login router (server/routes/post-login.ts) and the onboarding gate
// middleware (server/middleware/onboardingGate.ts) import this list. They used to each
// declare their OWN copy of the same literal — a drift hazard: change one and they
// silently diverge, and then one says "profile complete" while the other says
// "incomplete", bouncing the user in a route loop. Keeping it here means they cannot
// drift. (2026-08-10)
//
// Provider is a member PLUS a stricter KYC set — that heavier set lives in the
// SEPARATE ProviderOnboarding flow, never in this base gate.
export const MEMBER_REQUIRED_FIELDS: string[] = [
  'firstName',
  'lastName',
  'phone',
  'termsAcceptedAt',
  'privacyAcceptedAt',
];

/**
 * ONE predicate for "is this required field still missing?" — used by
 * post-login, the onboarding-gate middleware and (through getWhoami) the
 * client's /complete-profile. (CEO 2026-09-12, Google signup flow.)
 *
 * 'phone' is satisfied only by a VERIFIED mobile. Before, any string counted,
 * so a number typed on /complete-profile that was never OTP'd made the
 * profile "complete" — and the account was never actually activated.
 */
export function isMemberFieldMissing(user: any, field: string): boolean {
  if (!user) return true;
  if (field === 'phone') {
    // Either verification mark counts: the boolean (login bounce) or the
    // activation timestamp (ActivationService) — they have drifted before.
    const verified = user.phoneVerified === true || !!user.mobileVerifiedAt;
    return !user.phone || !verified;
  }
  return !user[field];
}

export function getMissingMemberFields(user: any, required: string[] = MEMBER_REQUIRED_FIELDS): string[] {
  return required.filter((field) => isMemberFieldMissing(user, field));
}

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

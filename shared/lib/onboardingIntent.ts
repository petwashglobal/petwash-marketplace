/**
 * Single source of truth for sign-up intent strings.
 *
 * The user's pre-login intent (chosen by clicking "Become Provider" /
 * "Join Rewards Club" / etc. on the SignIn page) flows through:
 *
 *   client localStorage.signup_intent            (UI cache)
 *   server-set HttpOnly cookie pw_signup_intent  (Phase A — survives ITP)
 *   POST /api/auth/post-login body { intent }    (server decider input)
 *   POST /api/auth/choose-role body { intent }   (returning-user picker)
 *   POST /api/access-requests body               (staff request creation)
 *   users.signupIntent column                    (durable persistence)
 *
 * Before Phase E these strings were hard-coded in 5+ places. Now every
 * caller imports from this module and the union type prevents typos.
 *
 * Add a new intent here ONLY after deciding:
 *   1. how it maps to users.role (intentToRole on the server)
 *   2. which secondary table it creates (provider_applications, etc.)
 *   3. the post-login route the decider should send the user to
 */

// Mirrors shared/schema.ts ALLOWED_INTENTS exactly. Keep the values
// aligned — adding a new intent requires updating BOTH places.
export const SIGNUP_INTENT = {
  CUSTOMER: 'customer',
  LOYALTY:  'loyalty',
  PROVIDER: 'provider',
  STAFF:    'staff_request',
} as const;

export type SignupIntent = (typeof SIGNUP_INTENT)[keyof typeof SIGNUP_INTENT];

export const ALL_SIGNUP_INTENTS: ReadonlyArray<SignupIntent> = [
  SIGNUP_INTENT.CUSTOMER,
  SIGNUP_INTENT.LOYALTY,
  SIGNUP_INTENT.PROVIDER,
  SIGNUP_INTENT.STAFF,
];

/**
 * Type guard — accept only the canonical strings. Returns false for
 * anything else (typo, attacker-supplied, legacy value).
 */
export function isSignupIntent(value: unknown): value is SignupIntent {
  return typeof value === 'string'
    && (ALL_SIGNUP_INTENTS as ReadonlyArray<string>).includes(value);
}

/**
 * Default route for each intent BEFORE the post-login decider has had
 * a chance to load the user's actual status. Used by the client as a
 * placeholder while POST /api/auth/post-login is in flight.
 *
 * The CANONICAL routing is decided by server/routes/post-login.ts —
 * never trust this map for security or final navigation.
 */
export const INTENT_DEFAULT_DESTINATION: Readonly<Record<SignupIntent, string>> = {
  [SIGNUP_INTENT.CUSTOMER]: '/home',
  [SIGNUP_INTENT.LOYALTY]:  '/loyalty/join',
  [SIGNUP_INTENT.PROVIDER]: '/provider-onboarding',
  [SIGNUP_INTENT.STAFF]:    '/access-pending',
};

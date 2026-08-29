/**
 * AI Context Authorization — CEO MASTER DIRECTIVE 2026-08-28 §57 §78
 * §79.
 *
 * Rule: the server builds an AUTHORIZED context BEFORE any AI call.
 * NEVER hand the LLM a full DB row and ask it to decide what the
 * user can see (§78). AI usually doesn't need bank account / national
 * ID / full tax / raw card data (§79) — use minimised
 * representations ("payout details verified", not the number).
 *
 * Recommender safety (§57): rankable features must come from an
 * explicit ALLOW-LIST. Protected characteristics — race, religion,
 * medical conditions, other sensitive inference — CANNOT be
 * projected into an AI context.
 */

/** The intent scopes a call may request. Each scope maps to a
 *  narrow allow-list of typed fields the composer projects. */
export type AiScope =
  | 'concierge_greeting'        // name + tier + timezone
  | 'concierge_next_step'       // recent attention feed only
  | 'support_transaction'       // last transaction ref + state (no plaintext money)
  | 'support_booking'           // booking ref + status + provider display name
  | 'provider_coach'            // objective operational metrics only
  | 'provider_pricing'          // local median vs current rate label
  | 'kya_summary';              // pet display name + species + safety flags

/**
 * The typed envelope handed to the model at call time. Every field
 * is EXPLICITLY declared here so a refactor that adds a new field
 * must ALSO add it to the allow-list check in the builder.
 */
export interface AiContext {
  /** Random per-request id — must be echoed back in the model's response for audit. */
  scopeToken: string;
  /** The scope this context was built for; the caller cannot ask
   *  the model to answer OUTSIDE this scope. */
  scope: AiScope;
  /** Which workspace the user is in. */
  actor: 'pet_parent' | 'provider' | 'admin';
  /** Server timestamp so a stale context is detectable. */
  issuedAt: string;
  /** Firebase UID, but ONLY used for downstream audit — NOT sent to
   *  the model unless scope explicitly requires it. */
  userUid: string;
  /** Language the model should respond in. */
  language: 'he' | 'en';
  /** Free-form JSON PAYLOAD — the scope-checked, minimised
   *  representation the model sees. Keys are guaranteed to be in
   *  the scope's allow-list. */
  payload: Record<string, unknown>;
}

/**
 * The allow-list of KEYS that may appear in the payload per scope.
 * The builder rejects any key not on this list — a downstream
 * refactor cannot silently expand what the model sees.
 */
export const AI_SCOPE_KEY_ALLOWLIST: Record<AiScope, ReadonlyArray<string>> = {
  concierge_greeting: ['displayName', 'tier', 'timezone', 'timeOfDay', 'attentionCount'],
  concierge_next_step: ['reasonCode', 'actionType', 'domain', 'priority'],
  support_transaction: ['transactionRef', 'state', 'amountBucket', 'currency'],
  support_booking: ['bookingRef', 'status', 'providerDisplayName', 'serviceType'],
  provider_coach: ['responseRateBucket', 'acceptanceBucket', 'completionRate', 'repeatCustomers', 'avgRatingBucket'],
  provider_pricing: ['currentRateBucket', 'medianRateBucket', 'currency'],
  kya_summary: ['petDisplayName', 'species', 'aggressionWarning', 'escapeRisk', 'sensitiveSkin', 'medicalConsented'],
};

/**
 * FIELDS THE MODEL MUST NEVER SEE. Enforced by the builder as a
 * belt-and-braces check even if a scope's allow-list is accidentally
 * widened. Add to this list — never remove.
 */
export const AI_HARD_DENYLIST: ReadonlySet<string> = new Set([
  // Identity / auth
  'password', 'passwordHash', 'passcode', 'passcodeHash', 'pin',
  'firebaseIdToken', 'sessionCookie', 'csrfToken', 'apiKey',
  // National / govt IDs
  'israeliId', 'israeli_id', 'israeliIdEncrypted', 'israeli_id_encrypted',
  'passportNumber', 'nationalId', 'idNumber', 'idDocumentUrl',
  // Bank / payment
  'bankIban', 'bank_iban', 'bankAccountHolder', 'bankAccountNumber',
  'creditCardNumber', 'cardNumber', 'cardCvv', 'cardExpiry',
  'nayaxToken', 'stripeCustomerId', 'panRaw',
  // Personal contact
  'homeAddress', 'streetAddress', 'gpsRawTrail', 'dateOfBirth',
  // Protected characteristics — CEO §57
  'race', 'ethnicity', 'religion', 'sexualOrientation', 'gender',
  'medicalConditions', 'diagnoses', 'disabilityStatus',
  // Raw LLM chain-of-thought if it ever appeared
  'chainOfThought', 'reasoning', 'internalReasoning', 'systemPrompt',
]);

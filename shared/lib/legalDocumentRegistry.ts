/**
 * Canonical legal-document registry — the ONE source of truth for
 * every legal document PetWash asks a user to accept.
 *
 * CEO 2026-08-26 correction pass §1-2: STOP maintaining hand-written
 * counts and STOP duplicating documentKey + docVersion constants
 * across route files, client pages, and the KNOWN_DOCUMENT_KEYS
 * whitelist. Everything derives from this file.
 *
 * Contract:
 *   - `KNOWN_DOCUMENT_KEYS` (server whitelist) = LEGAL_DOCUMENTS.map(d => d.key)
 *   - Every accept endpoint (server) resolves docVersion FROM the
 *     entry here — client may send `versionExpected`, but server
 *     rejects anything not equal to currentVersion.
 *   - Every acceptance snapshotText/snapshotHash is derived from the
 *     `text[language]` field ON THIS FILE, not from client input, so
 *     evidence is honest per language (CEO §3).
 *   - `scope` records whether an acceptance is per-account, per-
 *     provider, per-service (walker/sitter/trainer), per-booking,
 *     per-pet, or per-transaction (CEO §13-14). Enforcement lives in
 *     the writer service; this field DECLARES the intent.
 *   - `provenance` records the LEGACY authority (if any) so
 *     reconciliation can pair rows.
 *
 * Provider declaration text bodies live in
 * `shared/providerProtectionDeclarations.ts` — do NOT copy them here.
 * The registry references those via `providerRegistryKey`.
 */

export type LegalDocumentScope =
  | 'account'      // one row per user, ever
  | 'provider'     // one row per provider application
  | 'service'      // one row per (provider, service) — walker vs sitter vs trainer
  | 'booking'      // one row per booking
  | 'pet'          // one row per pet
  | 'transaction'; // one row per payment

export type LegalDocumentLanguage = 'he' | 'en' | 'ar' | 'ru' | 'fr' | 'es';

export type LegalDocumentActor = 'customer' | 'provider';

/**
 * Where the authoritative TEXT of the document lives today. The
 * canonical writer service uses this to derive snapshotText and
 * snapshotHash server-side — never from client input.
 */
export type LegalDocumentTextSource =
  /** Body lives in the shared/providerProtectionDeclarations.ts registry (in-app declarations). */
  | { kind: 'providerDeclaration'; registryKey: string }
  /** Body is rendered client-side from a static bundled component; no server text is available yet. */
  | { kind: 'staticClientPage'; clientPath: string }
  /** Body is stored in `consent_snapshots` (or a version manifest) — pull by (key, version). */
  | { kind: 'consentSnapshot' };

/**
 * Where the acceptance PROOF currently lives — used by the
 * reconciliation audit and the migration status column below.
 */
export type LegalDocumentProvenance =
  | 'signing_sessions'         // provider declarations DocuSeal / in-app
  | 'users.acceptedTermsAt'    // customer_tos legacy timestamp
  | 'firestore.onboarding'     // /api/consent/onboarding writes to Firestore first
  | 'consent_snapshots'        // /api/consent/onboarding fallback + versioned snapshots
  | 'notification_preferences' // marketing consent timestamps per channel
  | 'consent_ledger'           // consentEngine's grant/withdraw ledger
  | 'none';                    // no legacy authority — canonical is authoritative from day one

/**
 * Migration status per document — CEO §6 + correction pass #2 §3
 * vocabulary. Time does NOT reconcile data; a status only advances
 * when the definition below is provably true for the tested
 * population/window.
 *
 *   LEGACY-ONLY            — canonical writer not wired yet.
 *   DUAL-WRITE-SHADOW      — both writers active but equality NOT yet
 *                            proven. Legacy is authoritative; canonical
 *                            is a best-effort shadow (structured
 *                            {ok:false} result on failure emits the
 *                            LEGAL_ACCEPTANCE_SHADOW_MISSING signal).
 *   DUAL-WRITE-RECONCILED  — for the tested population/window: legacy
 *                            acceptance exists AND canonical acceptance
 *                            exists AND (key, version, language, hash)
 *                            passes the expected rules. A cron may
 *                            MEASURE this — it does NOT magically
 *                            promote a status because N days passed.
 *   CANONICAL-AUTHORITY    — all runtime readers/gates have migrated
 *                            to the canonical source AND rollback +
 *                            reconciliation are proven for that doc.
 */
export type LegalDocumentMigrationStatus =
  | 'LEGACY-ONLY'
  | 'DUAL-WRITE-SHADOW'
  | 'DUAL-WRITE-RECONCILED'
  | 'CANONICAL-AUTHORITY';

export interface LegalDocumentDefinition {
  key: string;
  actor: LegalDocumentActor;
  scope: LegalDocumentScope;
  currentVersion: string;
  languages: readonly LegalDocumentLanguage[];
  textSource: LegalDocumentTextSource;
  provenance: LegalDocumentProvenance;
  migrationStatus: LegalDocumentMigrationStatus;
  /** Short human-readable label — used in reconciliation reports. */
  labelEn: string;
  /**
   * Which onboarding / booking phase requires this acceptance, if any.
   * `null` = optional / marketing / informational.
   */
  requiredFor: null | 'signup' | 'booking' | 'provider_onboarding' | 'wallet_topup' | 'egift_redeem';
}

// ── PROVIDER DECLARATION KEYS (14) — text lives in providerProtectionDeclarations.ts ──

function providerDecl(
  key: string,
  registryKey: string,
  labelEn: string,
): LegalDocumentDefinition {
  return {
    key,
    actor: 'provider',
    scope: 'provider',
    currentVersion: 'v1',
    languages: ['he', 'en'] as const,
    textSource: { kind: 'providerDeclaration', registryKey },
    provenance: 'signing_sessions',
    migrationStatus: 'DUAL-WRITE-SHADOW',
    labelEn,
    requiredFor: 'provider_onboarding',
  };
}

// ── CUSTOMER-SIDE DOCUMENTS (11) ──

const CUSTOMER_DOCS: readonly LegalDocumentDefinition[] = [
  {
    key: 'customer_tos', actor: 'customer', scope: 'account',
    currentVersion: 'v1', languages: ['he', 'en'],
    textSource: { kind: 'staticClientPage', clientPath: 'client/src/pages/legal/CustomerTerms.tsx' },
    provenance: 'users.acceptedTermsAt', migrationStatus: 'DUAL-WRITE-SHADOW',
    labelEn: 'Terms of Service', requiredFor: 'signup',
  },
  {
    key: 'privacy_policy', actor: 'customer', scope: 'account',
    currentVersion: 'v1', languages: ['he', 'en'],
    textSource: { kind: 'staticClientPage', clientPath: 'client/src/pages/legal/PrivacyPolicy.tsx' },
    provenance: 'firestore.onboarding', migrationStatus: 'DUAL-WRITE-SHADOW',
    labelEn: 'Privacy Policy', requiredFor: 'signup',
  },
  {
    key: 'cancellation_refund_14g', actor: 'customer', scope: 'account',
    currentVersion: 'v1', languages: ['he', 'en'],
    textSource: { kind: 'staticClientPage', clientPath: 'client/src/pages/legal/CancellationRefundPolicy.tsx' },
    provenance: 'none', migrationStatus: 'LEGACY-ONLY',
    labelEn: 'Cancellation & Refund (§14ג)', requiredFor: null,
  },
  {
    key: 'marketing_consent', actor: 'customer', scope: 'account',
    currentVersion: 'v1', languages: ['he', 'en'],
    textSource: { kind: 'consentSnapshot' },
    // Lifecycle (grant/withdraw/re-grant) stays in consent_ledger + notification_preferences.
    // Canonical row stores GRANT EVIDENCE ONLY (CEO §9-10).
    provenance: 'consent_ledger', migrationStatus: 'DUAL-WRITE-SHADOW',
    labelEn: 'Marketing consent (grant evidence)', requiredFor: null,
  },
  {
    key: 'booking_rules', actor: 'customer', scope: 'booking',
    currentVersion: 'v1', languages: ['he', 'en'],
    textSource: { kind: 'staticClientPage', clientPath: 'client/src/pages/legal/BookingRules.tsx' },
    provenance: 'none', migrationStatus: 'LEGACY-ONLY',
    labelEn: 'Booking rules', requiredFor: 'booking',
  },
  {
    key: 'pet_owner_responsibility', actor: 'customer', scope: 'pet',
    currentVersion: 'v1', languages: ['he', 'en'],
    textSource: { kind: 'staticClientPage', clientPath: 'client/src/pages/legal/PetOwnerResponsibility.tsx' },
    provenance: 'none', migrationStatus: 'LEGACY-ONLY',
    labelEn: 'Pet owner responsibility', requiredFor: null,
  },
  {
    key: 'emergency_vet_authorisation', actor: 'customer', scope: 'booking',
    currentVersion: 'v1', languages: ['he', 'en'],
    textSource: { kind: 'staticClientPage', clientPath: 'client/src/pages/legal/EmergencyVetAuthorisation.tsx' },
    provenance: 'none', migrationStatus: 'LEGACY-ONLY',
    labelEn: 'Emergency vet authorisation', requiredFor: 'booking',
  },
  {
    key: 'wallet_egift_terms', actor: 'customer', scope: 'account',
    currentVersion: 'v1', languages: ['he', 'en'],
    textSource: { kind: 'staticClientPage', clientPath: 'client/src/pages/legal/WalletEGiftTerms.tsx' },
    provenance: 'none', migrationStatus: 'LEGACY-ONLY',
    labelEn: 'Wallet & eGift terms', requiredFor: 'wallet_topup',
  },
  {
    key: 'reviews_content_policy', actor: 'customer', scope: 'account',
    currentVersion: 'v1', languages: ['he', 'en'],
    textSource: { kind: 'staticClientPage', clientPath: 'client/src/pages/legal/ReviewsContentPolicy.tsx' },
    provenance: 'none', migrationStatus: 'LEGACY-ONLY',
    labelEn: 'Reviews content policy', requiredFor: null,
  },
  {
    key: 'community_guidelines', actor: 'customer', scope: 'account',
    currentVersion: 'v1', languages: ['he', 'en'],
    textSource: { kind: 'staticClientPage', clientPath: 'client/src/pages/legal/CommunityGuidelines.tsx' },
    provenance: 'none', migrationStatus: 'LEGACY-ONLY',
    labelEn: 'Community guidelines', requiredFor: null,
  },
  {
    key: 'home_access_property_authority', actor: 'customer', scope: 'booking',
    currentVersion: 'v1', languages: ['he', 'en'],
    textSource: { kind: 'staticClientPage', clientPath: 'client/src/pages/legal/HomeAccessPropertyAuthority.tsx' },
    provenance: 'none', migrationStatus: 'LEGACY-ONLY',
    labelEn: 'Home access & property authority', requiredFor: 'booking',
  },
] as const;

// ── PROVIDER-SIDE DOCUMENTS (23) ──
// 14 have text in providerProtectionDeclarations.ts (dual-write-shadow).
// 9 are static provider pages with no orphan endpoint yet (legacy-only).

const PROVIDER_DECLARATION_DOCS: readonly LegalDocumentDefinition[] = [
  providerDecl('provider_agreement',                'provider_service_agreement',  'Provider service agreement'),
  providerDecl('provider_independent_status',       'independent_provider',        'Independent provider'),
  providerDecl('provider_no_franchise_no_agency',   'no_franchise_no_agency',      'No franchise / no agency'),
  providerDecl('provider_safety_manual',            'safety_manual_acceptance',    'Safety manual'),
  providerDecl('provider_insurance_disclosure',     'insurance_disclosure',        'Insurance disclosure'),
  providerDecl('provider_tax_business_status',      'tax_business_status',         'Tax / business status'),
  providerDecl('provider_privacy_data',             'privacy_data_handling',       'Privacy & data handling'),
  providerDecl('provider_off_platform_payment',     'off_platform_payment',        'Off-platform payment ban'),
  providerDecl('provider_incident_reporting',       'incident_reporting',          'Incident reporting'),
  providerDecl('provider_home_hosting',             'home_hosting_protocol',       'Home hosting protocol'),
  providerDecl('provider_owner_home_visit',         'owner_home_visit_protocol',   'Owner-home visit protocol'),
  providerDecl('provider_dog_walking_safety',       'walking_protocol',            'Dog-walking safety'),
  providerDecl('provider_academy_trainer',          'academy_protocol',            'Academy trainer'),
  providerDecl('provider_pettrek_transport',        'pettrek_transport_protocol',  'PetTrek transport'),
];

// Provider-side, but text lives on a static page and has no orphan endpoint yet.
function providerStaticPage(key: string, path: string, labelEn: string): LegalDocumentDefinition {
  return {
    key, actor: 'provider', scope: 'provider',
    currentVersion: 'v1', languages: ['he', 'en'],
    textSource: { kind: 'staticClientPage', clientPath: path },
    provenance: 'none', migrationStatus: 'LEGACY-ONLY',
    labelEn, requiredFor: 'provider_onboarding',
  };
}

const PROVIDER_STATIC_DOCS: readonly LegalDocumentDefinition[] = [
  providerStaticPage('provider_self_declaration_no_convictions', 'client/src/pages/legal/ProviderTruthDeclaration.tsx', 'No-convictions self declaration'),
  providerStaticPage('provider_background_check_consent',        'client/src/pages/legal/ProviderDocumentUpload.tsx',   'Background-check consent'),
  providerStaticPage('provider_reconfirmation',                  'client/src/pages/legal/ProviderReconfirmation.tsx',    'Annual reconfirmation'),
  providerStaticPage('provider_truth_declaration',               'client/src/pages/legal/ProviderTruthDeclaration.tsx',  'Truth of statements'),
  providerStaticPage('provider_confidentiality',                 'client/src/pages/legal/ProviderConfidentiality.tsx',   'Confidentiality'),
  providerStaticPage('provider_brand_use',                       'client/src/pages/legal/ProviderBrandUse.tsx',          'Brand-use terms'),
  providerStaticPage('provider_payout_rules',                    'client/src/pages/legal/ProviderPayoutRules.tsx',       'Payout rules'),
  providerStaticPage('provider_cancellation',                    'client/src/pages/legal/ProviderCancellation.tsx',      'Provider cancellation'),
  providerStaticPage('provider_no_circumvention',                'client/src/pages/legal/NoCircumvention.tsx',           'No circumvention'),
];

// ── THE REGISTRY ──

export const LEGAL_DOCUMENTS: readonly LegalDocumentDefinition[] = [
  ...CUSTOMER_DOCS,
  ...PROVIDER_DECLARATION_DOCS,
  ...PROVIDER_STATIC_DOCS,
] as const;

/** All keys in a Set — O(1) whitelist check for the server accept endpoint. */
export const LEGAL_DOCUMENT_KEYS: ReadonlySet<string> = new Set(
  LEGAL_DOCUMENTS.map((d) => d.key),
);

/** Lookup helper — returns undefined for unknown keys. */
export function getLegalDocument(key: string): LegalDocumentDefinition | undefined {
  return LEGAL_DOCUMENTS.find((d) => d.key === key);
}

/** Aggregate counts — the ONE source for reporting (CEO §1). */
export function legalDocumentStats() {
  const total = LEGAL_DOCUMENTS.length;
  const byActor = { customer: 0, provider: 0 } as Record<LegalDocumentActor, number>;
  const byScope = { account: 0, provider: 0, service: 0, booking: 0, pet: 0, transaction: 0 } as Record<LegalDocumentScope, number>;
  const byStatus = { 'LEGACY-ONLY': 0, 'DUAL-WRITE-SHADOW': 0, 'DUAL-WRITE-RECONCILED': 0, 'CANONICAL-AUTHORITY': 0 } as Record<LegalDocumentMigrationStatus, number>;
  for (const d of LEGAL_DOCUMENTS) {
    byActor[d.actor]++;
    byScope[d.scope]++;
    byStatus[d.migrationStatus]++;
  }
  return { total, byActor, byScope, byStatus };
}

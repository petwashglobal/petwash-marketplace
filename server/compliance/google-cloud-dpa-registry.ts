/**
 * PetWash™ Google Cloud Data Processing Registry
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LEGAL REQUIREMENT: This file documents ALL Google Cloud services that process
 * personal data on behalf of PetWash™, as required by:
 *
 *   • GDPR Article 28 — Written contract with each Data Processor
 *   • GDPR Article 30 — Record of Processing Activities (ROPA)
 *   • Israeli Privacy Protection Law 2025 (Amendment 13) §§8, 14, 17
 *   • Israeli Privacy Protection Regulations (Data Security) 2017
 *
 * ACTION REQUIRED BEFORE PRODUCTION LAUNCH:
 *   1. Sign Google Cloud Data Processing Addendum at:
 *      https://cloud.google.com/terms/data-processing-addendum
 *   2. Ensure Google account is on a paid plan (DPA requires paid account)
 *   3. Configure data residency where applicable (see per-service notes)
 *   4. Complete and sign DPIA for biometric processing (Art. 35 GDPR)
 *   5. Appoint a DPO (required for sensitive data processing at scale)
 *   6. Register PetWash™ with Israeli Privacy Protection Authority (PPA)
 * ════════════════════════════════════════════════════════════════════════════
 */

import { logger } from '../lib/logger';

export interface GCPServiceRecord {
  serviceId: string;
  googleProduct: string;
  purpose: string;
  dataCategories: string[];
  legalBasis: string;
  israeliLawBasis: string;
  sensitiveData: boolean;
  retentionByGoogle: string;
  retentionByPetWash: string;
  dataResidency: string;
  dpaRequired: boolean;
  dpiaRequired: boolean;
  consentRequired: boolean;
  status: 'compliant' | 'requires-dpa' | 'requires-dpia' | 'review-needed';
  implementedIn: string[];
  notes: string;
}

export const GCP_SERVICE_REGISTRY: GCPServiceRecord[] = [
  {
    serviceId: 'vision-api-biometric',
    googleProduct: 'Google Cloud Vision API — Face Detection',
    purpose: 'KYC identity verification: compare selfie to government ID for marketplace providers and pet sitters',
    dataCategories: [
      'Facial images (biometric)',
      'Facial landmark coordinates',
      'Government ID photo',
      'Selfie photo',
    ],
    legalBasis: 'GDPR Art. 9(2)(a) — Explicit consent; Art. 6(1)(b) — Contract performance (KYC for marketplace participation)',
    israeliLawBasis: 'Israeli Privacy Law 2025 §8 (informed consent for sensitive data), §14 (biometric = especially sensitive)',
    sensitiveData: true,
    retentionByGoogle: 'ZERO — Vision API is stateless under DPA §7.3. Images not retained post-call.',
    retentionByPetWash: '24 hours max in GCS biometric bucket, then auto-deleted by lifecycle rule',
    dataResidency: 'Global (Google routes to nearest region). For EU GDPR: configure to use EU region if needed.',
    dpaRequired: true,
    dpiaRequired: true,
    consentRequired: true,
    status: 'requires-dpia',
    implementedIn: [
      'server/services/BiometricVerificationService.ts',
      'server/routes/kyc.ts',
      'server/infra/biometricStorage.ts',
    ],
    notes: 'DPIA required before processing biometric data at scale. Consent must explicitly name Google Cloud Vision API. Penetration test required every 18 months (Amendment 13).',
  },

  {
    serviceId: 'vision-api-passport-ocr',
    googleProduct: 'Google Cloud Vision API — Document Text Detection',
    purpose: 'Passport MRZ extraction for loyalty program verification and identity confirmation',
    dataCategories: [
      'Passport image',
      'Full name',
      'Date of birth',
      'Passport number',
      'Nationality',
      'Personal number (Israeli ID)',
    ],
    legalBasis: 'GDPR Art. 6(1)(a) — Consent; Art. 9(2)(a) — Explicit consent (government ID = sensitive)',
    israeliLawBasis: 'Israeli Privacy Law 2025 §8 (consent), §14 (government ID classified as sensitive)',
    sensitiveData: true,
    retentionByGoogle: 'ZERO — Stateless under DPA. Passport data not retained by Google post-call.',
    retentionByPetWash: 'Passport image processed in-memory only. MRZ fields stored in DB for verification period only.',
    dataResidency: 'Global. Consider restricting to EU/IL region for compliance.',
    dpaRequired: true,
    dpiaRequired: true,
    consentRequired: true,
    status: 'requires-dpia',
    implementedIn: [
      'server/services/PassportOCRService.ts',
      'server/routes/passport.ts',
    ],
    notes: 'Consent checkbox explicitly mentioning Vision API required before scan. Raw OCR text must NEVER be logged.',
  },

  {
    serviceId: 'vision-api-receipt-ocr',
    googleProduct: 'Google Cloud Vision API — Text Detection',
    purpose: 'Receipt OCR for employee expense management — extract date, amount, vendor, tax ID',
    dataCategories: [
      'Receipt image',
      'Business tax ID (עוסק מורשה)',
      'Transaction amounts',
      'Vendor names',
      'Transaction dates',
    ],
    legalBasis: 'GDPR Art. 6(1)(b) — Contract performance (employment expense processing)',
    israeliLawBasis: 'Israeli Privacy Law 2025 §8 — processing within employment relationship',
    sensitiveData: false,
    retentionByGoogle: 'ZERO — Stateless under DPA.',
    retentionByPetWash: 'Receipt images not stored. Extracted structured data stored per Israeli Tax Ordinance (7 years).',
    dataResidency: 'Global.',
    dpaRequired: true,
    dpiaRequired: false,
    consentRequired: false,
    status: 'compliant',
    implementedIn: [
      'server/services/ReceiptOCRService.ts',
    ],
    notes: 'Raw OCR text preview removed from logs. Tax IDs masked in logs. Uses explicit credentials (not ADC).',
  },

  {
    serviceId: 'cloud-storage-documents',
    googleProduct: 'Google Cloud Storage — petwash-secure-documents bucket',
    purpose: 'Secure storage of business documents, contracts, employee files, KYC documents',
    dataCategories: [
      'Employment contracts',
      'KYC identity documents',
      'Business licenses',
      'Financial statements',
      'Provider agreements',
    ],
    legalBasis: 'GDPR Art. 6(1)(b) — Contract; Art. 6(1)(c) — Legal obligation (Israeli labor/tax law)',
    israeliLawBasis: 'Israeli Privacy Law 2025 §3 (maintain secure database), Israeli Tax Ordinance (7-year retention)',
    sensitiveData: true,
    retentionByGoogle: 'Until object deletion. GCS stores data at rest with AES-256 encryption.',
    retentionByPetWash: 'Per document category: financial = 7 years, KYC = 5 years, contracts = 7 years',
    dataResidency: 'Default: US-MULTI. IMPORTANT: For GDPR compliance consider EU region. Israeli data may stay in US under Privacy Shield successor adequacy.',
    dpaRequired: true,
    dpiaRequired: false,
    consentRequired: false,
    status: 'requires-dpa',
    implementedIn: [
      'server/routes/documents.ts',
      'server/services/gcsBackupService.ts',
    ],
    notes: 'Bucket name now configurable via GCS_DOCUMENTS_BUCKET env var. RBAC enforced via server middleware. Access audit log in PostgreSQL.',
  },

  {
    serviceId: 'cloud-storage-biometric',
    googleProduct: 'Google Cloud Storage — Firebase Storage biometric bucket',
    purpose: 'Temporary storage of biometric images (selfie + ID) during KYC verification flow',
    dataCategories: [
      'Facial selfie images (biometric)',
      'Government ID photos',
    ],
    legalBasis: 'GDPR Art. 9(2)(a) — Explicit consent',
    israeliLawBasis: 'Israeli Privacy Law 2025 §14 — especially sensitive; §8 — consent',
    sensitiveData: true,
    retentionByGoogle: 'Until object deletion. Encrypted at rest (AES-256).',
    retentionByPetWash: 'AUTO-DELETED after 24 hours via GCS lifecycle rule ✅',
    dataResidency: 'Firebase Storage (US by default). Cannot change region post-creation.',
    dpaRequired: true,
    dpiaRequired: true,
    consentRequired: true,
    status: 'requires-dpia',
    implementedIn: [
      'server/infra/biometricStorage.ts',
      'server/routes/mobile-biometric.ts',
    ],
    notes: '24-hour lifecycle rule CONFIRMED active. DPIA required. Consent audit via auditBiometricConsent().',
  },

  {
    serviceId: 'cloud-storage-backup',
    googleProduct: 'Google Cloud Storage — Backup buckets',
    purpose: 'Automated code and Firestore backups for disaster recovery',
    dataCategories: [
      'Application source code',
      'Firestore database exports (contains user data)',
    ],
    legalBasis: 'GDPR Art. 6(1)(f) — Legitimate interest (business continuity)',
    israeliLawBasis: 'Israeli Privacy Law 2025 §3 (data security obligation)',
    sensitiveData: false,
    retentionByGoogle: 'Until object deletion.',
    retentionByPetWash: 'Configurable via GCS lifecycle. Recommended: 90 days for backups.',
    dataResidency: 'Configurable via GCS_CODE_BUCKET and GCS_FIRESTORE_BUCKET env vars.',
    dpaRequired: true,
    dpiaRequired: false,
    consentRequired: false,
    status: 'requires-dpa',
    implementedIn: [
      'server/services/gcsBackupService.ts',
    ],
    notes: 'Backup buckets contain Firestore exports which may include personal data. Set explicit retention lifecycle rules on these buckets in GCS console.',
  },

  {
    serviceId: 'google-translate',
    googleProduct: 'Google Cloud Translation API',
    purpose: 'Translate UI text and user-facing content across 6 supported languages',
    dataCategories: [
      'UI text strings (generally non-personal)',
      'Potentially: user-provided text sent for translation',
    ],
    legalBasis: 'GDPR Art. 6(1)(b) — Contract performance (providing multilingual service)',
    israeliLawBasis: 'Israeli Privacy Law 2025 §3 — standard processing',
    sensitiveData: false,
    retentionByGoogle: 'Under DPA: translation requests not retained for model training.',
    retentionByPetWash: 'Translation results cached in memory/Redis only.',
    dataResidency: 'Global.',
    dpaRequired: true,
    dpiaRequired: false,
    consentRequired: false,
    status: 'requires-dpa',
    implementedIn: [
      'server/services/TranslationService.ts',
      'server/routes/translation.ts',
      'server/lib/i18n.ts',
    ],
    notes: 'Ensure user-generated text is NOT sent to Translation API. Only predefined UI strings. If user content could be translated, obtain consent.',
  },

  {
    serviceId: 'dialogflow-cx',
    googleProduct: 'Google Dialogflow CX',
    purpose: 'AI-powered bilingual chat assistant (Hebrew/English) for pet care inquiries',
    dataCategories: [
      'User chat messages',
      'Session identifiers (anonymized)',
      'Language preference',
    ],
    legalBasis: 'GDPR Art. 6(1)(a) — Consent (user initiates chat); Art. 6(1)(b) — Contract performance',
    israeliLawBasis: 'Israeli Privacy Law 2025 §8 — consent for processing chat data',
    sensitiveData: false,
    retentionByGoogle: 'Dialogflow CX retains conversation logs for 365 days by default. MUST configure shorter retention in Dialogflow CX console → Agent Settings → Data Retention.',
    retentionByPetWash: 'Session IDs are ephemeral. Not stored in PetWash™ DB.',
    dataResidency: 'Configurable per agent. Set region in GOOGLE_AGENT_LOCATION env var.',
    dpaRequired: true,
    dpiaRequired: false,
    consentRequired: true,
    status: 'review-needed',
    implementedIn: [
      'server/services/AiChatService.ts',
      'server/routes/ai-chat.ts',
    ],
    notes: '⚠️ CRITICAL: Change Dialogflow CX data retention from 365 days to 30 days in the agent console. Add chat privacy notice before first message: "Your messages are processed by Google Dialogflow." Session IDs truncated in logs ✅.',
  },

  {
    serviceId: 'gemini-ai',
    googleProduct: 'Google Gemini AI (via @google/generative-ai)',
    purpose: 'Content generation, receipt analysis, booking orchestration, AI monitoring, watchdog',
    dataCategories: [
      'Booking data',
      'Platform analytics data',
      'Potentially: user-facing content with PII',
    ],
    legalBasis: 'GDPR Art. 6(1)(b) — Contract; Art. 6(1)(f) — Legitimate interest (platform operations)',
    israeliLawBasis: 'Israeli Privacy Law 2025 §3 — standard data processing',
    sensitiveData: false,
    retentionByGoogle: 'Under Gemini API DPA: inputs not used for model training on paid plans.',
    retentionByPetWash: 'Gemini responses not persistently stored (used for real-time decisions).',
    dataResidency: 'Global (Gemini API). No region selection available.',
    dpaRequired: true,
    dpiaRequired: false,
    consentRequired: false,
    status: 'requires-dpa',
    implementedIn: [
      'server/ai/kenzoMultiLang.ts',
      'server/ai-monitoring-2025.ts',
      'server/services/geminiTranslation.ts',
      'server/enterprise/aiBookkeeping.ts',
    ],
    notes: '⚠️ Ensure no PII (names, IDs, emails) is sent in Gemini prompts. Use anonymized or aggregated data only. Add Gemini API to privacy policy as a data processor.',
  },

  {
    serviceId: 'maps-places-api',
    googleProduct: 'Google Maps Platform — Places API + Maps JavaScript SDK',
    purpose: 'Station location display, address autocomplete for provider/customer registration, place reviews',
    dataCategories: [
      'User-entered addresses',
      'Geolocation coordinates',
      'Public place data (reviews, ratings)',
    ],
    legalBasis: 'GDPR Art. 6(1)(b) — Contract (finding nearest station)',
    israeliLawBasis: 'Israeli Privacy Law 2025 §3 — standard processing',
    sensitiveData: false,
    retentionByGoogle: 'Per Google Maps ToS. Cached map tiles retained. No user location stored by Google.',
    retentionByPetWash: 'Addresses stored in user profile (PostgreSQL). Geocoordinates for station matching only.',
    dataResidency: 'Global (Google Maps infrastructure).',
    dpaRequired: false,
    dpiaRequired: false,
    consentRequired: false,
    status: 'compliant',
    implementedIn: [
      'server/services/googleMapsPlaces.ts',
      'server/routes/google-services.ts',
      'client/src/components/ui/google-places-autocomplete.tsx',
    ],
    notes: '⚠️ Google Maps ToS §10.5 PROHIBITS: (a) caching/storing place data beyond display, (b) using place data for targeting/advertising, (c) creating competing products from Maps data. Reviews fetched live (not cached) ✅. All Maps calls proxied through backend ✅. Do NOT cache place reviews in DB.',
  },

  {
    serviceId: 'google-business-profile',
    googleProduct: 'Google Business Profile API',
    purpose: 'Manage PetWash™ Google Business listings for station locations',
    dataCategories: [
      'Business information (name, address, hours)',
      'Customer reviews (public)',
    ],
    legalBasis: 'GDPR Art. 6(1)(b) — Contract (business operations)',
    israeliLawBasis: 'Standard business data',
    sensitiveData: false,
    retentionByGoogle: 'Standard Google Business Profile terms.',
    retentionByPetWash: 'Business data stored for operational purposes.',
    dataResidency: 'Global.',
    dpaRequired: false,
    dpiaRequired: false,
    consentRequired: false,
    status: 'compliant',
    implementedIn: [
      'server/services/googleBusinessProfile.ts',
    ],
    notes: 'Customer reviews are public data. No personal data of reviewers stored by PetWash™.',
  },

  {
    serviceId: 'google-calendar',
    googleProduct: 'Google Calendar API (OAuth)',
    purpose: 'Sync pet care bookings with provider/customer Google Calendars',
    dataCategories: [
      'Booking date/time',
      'Service type',
      'Provider and customer names (in event title)',
      'Calendar access tokens',
    ],
    legalBasis: 'GDPR Art. 6(1)(a) — Consent (user explicitly connects Google account)',
    israeliLawBasis: 'Israeli Privacy Law 2025 §8 — consent',
    sensitiveData: false,
    retentionByGoogle: 'Per Google account settings. Calendar events remain until deleted.',
    retentionByPetWash: 'OAuth refresh tokens stored encrypted in DB. Revocable by user.',
    dataResidency: 'Google account region.',
    dpaRequired: false,
    dpiaRequired: false,
    consentRequired: true,
    status: 'compliant',
    implementedIn: [
      'server/services/GoogleCalendarIntegrationService.ts',
      'server/services/CalendarIntegrationService.ts',
    ],
    notes: 'Use minimal OAuth scopes (https://www.googleapis.com/auth/calendar.events only). Allow users to disconnect. Store refresh tokens encrypted.',
  },

  {
    serviceId: 'gmail-api',
    googleProduct: 'Google Gmail API (OAuth)',
    purpose: 'Send transactional emails from business Gmail account for HQ communications',
    dataCategories: [
      'Recipient email addresses',
      'Email content (booking confirmations, notifications)',
    ],
    legalBasis: 'GDPR Art. 6(1)(b) — Contract performance (service notifications)',
    israeliLawBasis: 'Israeli Privacy Law 2025 §3 — standard processing',
    sensitiveData: false,
    retentionByGoogle: 'Emails stored in sender/recipient Gmail accounts per their settings.',
    retentionByPetWash: 'Email content not stored by PetWash™ (SendGrid preferred for transactional email).',
    dataResidency: 'Gmail account region.',
    dpaRequired: false,
    dpiaRequired: false,
    consentRequired: false,
    status: 'compliant',
    implementedIn: [
      'server/routes/gmail.ts',
    ],
    notes: 'Use minimal OAuth scope: gmail.send only. Session cookie verification uses checkRevoked=true ✅.',
  },

  {
    serviceId: 'google-sheets',
    googleProduct: 'Google Sheets API',
    purpose: 'Provider onboarding intake forms, HR data collection',
    dataCategories: [
      'Provider application data',
      'Contact information',
      'Professional credentials',
    ],
    legalBasis: 'GDPR Art. 6(1)(b) — Pre-contractual steps (provider application)',
    israeliLawBasis: 'Israeli Privacy Law 2025 §3',
    sensitiveData: false,
    retentionByGoogle: 'Stored in Google Sheets until deleted by authorized user.',
    retentionByPetWash: 'Data migrated to PostgreSQL after onboarding. Sheet cleared after migration.',
    dataResidency: 'Google Drive region (user account region).',
    dpaRequired: false,
    dpiaRequired: false,
    consentRequired: false,
    status: 'review-needed',
    implementedIn: [
      'server/services/googleSheetsIntegration.ts',
      'server/services/ProviderIntakeService.ts',
    ],
    notes: '⚠️ Sheets should NOT be used for long-term personal data storage. Migrate to PostgreSQL promptly. Restrict sheet access to authorized service accounts only.',
  },

  {
    serviceId: 'firebase-auth',
    googleProduct: 'Firebase Authentication',
    purpose: 'User authentication, session management, MFA',
    dataCategories: [
      'Email addresses',
      'Phone numbers (SMS MFA)',
      'Firebase UID',
      'Authentication metadata (last login, provider)',
    ],
    legalBasis: 'GDPR Art. 6(1)(b) — Contract (account access)',
    israeliLawBasis: 'Israeli Privacy Law 2025 §3',
    sensitiveData: false,
    retentionByGoogle: 'Until account deleted. Firebase retains auth records per account lifecycle.',
    retentionByPetWash: 'UID linked in PostgreSQL. Firebase records deleted on account deletion.',
    dataResidency: 'Firebase project region (signinpetwash). Cannot be changed post-creation.',
    dpaRequired: true,
    dpiaRequired: false,
    consentRequired: false,
    status: 'requires-dpa',
    implementedIn: [
      'server/lib/firebase-admin.ts',
      'server/middleware/firebase-auth.ts',
      'client/src/lib/firebase.ts',
      'client/src/auth/AuthProvider.tsx',
    ],
    notes: '⚠️ projectId and storageBucket are hardcoded in firebase-admin.ts — should use FIREBASE_PROJECT_ID env var. Token revocation check (checkRevoked=true) applied inconsistently across routes.',
  },

  {
    serviceId: 'firestore',
    googleProduct: 'Cloud Firestore',
    purpose: 'Station monitoring, real-time data, KYC events, compliance records, session data',
    dataCategories: [
      'User profiles and roles',
      'Station telemetry',
      'KYC verification status',
      'Compliance records',
      'FCM tokens',
    ],
    legalBasis: 'GDPR Art. 6(1)(b) — Contract; Art. 6(1)(c) — Legal obligation',
    israeliLawBasis: 'Israeli Privacy Law 2025 §3',
    sensitiveData: true,
    retentionByGoogle: 'Until document deletion.',
    retentionByPetWash: 'Per DataRetentionService.ts policies ✅',
    dataResidency: 'Firebase project region.',
    dpaRequired: true,
    dpiaRequired: false,
    consentRequired: false,
    status: 'requires-dpa',
    implementedIn: [
      'server/lib/firebase-admin.ts',
      'client/src/lib/firebase.ts',
    ],
    notes: '⚠️ CRITICAL: No Firestore Security Rules file exists. Client-side components write directly to Firestore. Must create firestore.rules immediately.',
  },

  {
    serviceId: 'firebase-app-check',
    googleProduct: 'Firebase App Check',
    purpose: 'Prevent API abuse from unauthorized clients',
    dataCategories: [
      'Device attestation tokens (anonymized)',
    ],
    legalBasis: 'GDPR Art. 6(1)(f) — Legitimate interest (security)',
    israeliLawBasis: 'Israeli Privacy Law 2025 §3 (security obligation)',
    sensitiveData: false,
    retentionByGoogle: 'Attestation tokens ephemeral.',
    retentionByPetWash: 'Not stored.',
    dataResidency: 'Firebase infrastructure.',
    dpaRequired: true,
    dpiaRequired: false,
    consentRequired: false,
    status: 'review-needed',
    implementedIn: [
      'client/src/lib/firebase.ts',
    ],
    notes: 'App Check is currently disabled (VITE_FIREBASE_APPCHECK_SITE_KEY not set). Should be enabled in production to prevent unauthorized API access.',
  },
];

/**
 * Validate compliance status at server startup.
 * Logs warnings for services that are not fully compliant.
 */
export function validateGCPCompliance(): void {
  const criticalIssues: string[] = [];
  const warnings: string[] = [];

  for (const service of GCP_SERVICE_REGISTRY) {
    if (service.status === 'requires-dpa') {
      warnings.push(`[GCP Compliance] ${service.serviceId}: DPA required — sign Google Cloud DPA at https://cloud.google.com/terms/data-processing-addendum`);
    }
    if (service.status === 'requires-dpia') {
      criticalIssues.push(`[GCP Compliance] ${service.serviceId}: DPIA required before production use of biometric/sensitive data processing`);
    }
    if (service.status === 'review-needed') {
      warnings.push(`[GCP Compliance] ${service.serviceId}: Requires legal review — see notes in google-cloud-dpa-registry.ts`);
    }
    if (service.dpaRequired && !process.env.GOOGLE_CLOUD_DPA_ACCEPTED) {
      warnings.push(`[GCP Compliance] ${service.serviceId}: Set GOOGLE_CLOUD_DPA_ACCEPTED=true after signing the Google Cloud DPA`);
    }
  }

  for (const issue of criticalIssues) {
    logger.error(issue);
  }
  for (const warning of warnings.slice(0, 5)) {
    logger.warn(warning);
  }
  if (warnings.length > 5) {
    logger.warn(`[GCP Compliance] ... and ${warnings.length - 5} more compliance items. Review server/compliance/google-cloud-dpa-registry.ts`);
  }

  logger.info('[GCP Compliance] Registry loaded', {
    totalServices: GCP_SERVICE_REGISTRY.length,
    compliant: GCP_SERVICE_REGISTRY.filter(s => s.status === 'compliant').length,
    requiresDpa: GCP_SERVICE_REGISTRY.filter(s => s.status === 'requires-dpa').length,
    requiresDpia: GCP_SERVICE_REGISTRY.filter(s => s.status === 'requires-dpia').length,
    reviewNeeded: GCP_SERVICE_REGISTRY.filter(s => s.status === 'review-needed').length,
    sensitiveDataServices: GCP_SERVICE_REGISTRY.filter(s => s.sensitiveData).length,
  });
}

/**
 * Get all services that process a specific data category.
 * Use for GDPR Art. 30 ROPA (Record of Processing Activities) generation.
 */
export function getServicesForDataCategory(category: string): GCPServiceRecord[] {
  const lower = category.toLowerCase();
  return GCP_SERVICE_REGISTRY.filter(s =>
    s.dataCategories.some(dc => dc.toLowerCase().includes(lower))
  );
}

/**
 * Get all services requiring explicit user consent.
 * Use to verify consent UI is in place for each.
 */
export function getConsentRequiredServices(): GCPServiceRecord[] {
  return GCP_SERVICE_REGISTRY.filter(s => s.consentRequired);
}

/**
 * Get all services processing biometric or sensitive data.
 * These require DPIA and DPO oversight.
 */
export function getSensitiveDataServices(): GCPServiceRecord[] {
  return GCP_SERVICE_REGISTRY.filter(s => s.sensitiveData);
}

/**
 * Generate a ROPA (Record of Processing Activities) summary.
 * Required by GDPR Article 30 for organizations processing personal data.
 */
export function generateROPASummary(): object {
  return {
    organizationName: 'PetWash™ (Operating Entity: [Legal Entity Name Required])',
    dpoContact: process.env.DPO_EMAIL || 'DPO not yet appointed — REQUIRED for sensitive data processing',
    generatedAt: new Date().toISOString(),
    processingActivities: GCP_SERVICE_REGISTRY.map(s => ({
      activityId: s.serviceId,
      purpose: s.purpose,
      legalBasis: s.legalBasis,
      dataCategories: s.dataCategories,
      dataProcessor: `Google LLC — ${s.googleProduct}`,
      retentionPeriod: s.retentionByPetWash,
      transferMechanism: 'Standard Contractual Clauses (Google Cloud DPA)',
      sensitiveData: s.sensitiveData,
      consentRequired: s.consentRequired,
    })),
  };
}

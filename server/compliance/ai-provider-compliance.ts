/**
 * AI Provider Compliance Record — Item 9
 * Config-backed compliance documentation for AI data processing.
 * Persisted to Firestore on server startup for audit trail.
 *
 * Update this record whenever the AI provider, model, or DPA status changes.
 */

import { logger } from '../lib/logger';
import { db as adminDb } from '../lib/firebase-admin';

export const AI_COMPLIANCE_RECORD = {
  recordVersion: '1.0.0',
  effectiveDate: '2026-03-12',

  provider: {
    name: 'Google Gemini',
    model: 'gemini-2.5-flash',
    apiEndpoint: 'https://generativelanguage.googleapis.com',
    providerRegion: 'us-central1 (default)',
    providerPrivacyUrl: 'https://policies.google.com/privacy',
    providerTermsUrl: 'https://ai.google.dev/terms',
  },

  dataProcessing: {
    promptsRetainedByProvider: false,
    // Google Gemini API (enterprise/paid tier) does NOT use prompts for model training by default.
    // Reference: https://ai.google.dev/gemini-api/docs/data-privacy
    promptRetentionNote:
      'Google does not use API inputs/outputs to train models for paid Gemini API customers. ' +
      'Prompts may be stored by Google for safety review up to 60 days under their standard terms.',

    piiSentToProvider: false,
    piiRedactionNote:
      'Outbound PII redaction is applied before every Gemini API call (aiSecurity.ts). ' +
      'Email, phone, Israeli ID, card numbers, bearer tokens, and API keys are stripped.',

    dataTypes: ['public service questions', 'language preference', 'anonymized conversation context'],
    excludedDataTypes: ['name', 'email', 'phone', 'address', 'payment data', 'identity documents', 'user IDs'],
  },

  dpa: {
    directDpaWithGoogle: false,
    directDpaNote:
      'No direct DPA exists between PetWash and Google for this API key. ' +
      'The Gemini API key is provisioned via Replit AI Integrations, ' +
      'meaning the DPA chain is: PetWash → Replit → Google. ' +
      'ACTION REQUIRED: Sign Google Cloud DPA directly at https://cloud.google.com/terms/data-processing-addendum ' +
      'or obtain written confirmation from Replit that their DPA covers PetWash as a sub-processor beneficiary.',

    replitIntegrationUsed: true,
    replitDpaUrl: 'https://replit.com/legal/data-processing-agreement',

    israeliPrivacyLawCompliance: 'partial',
    israeliPrivacyLawNote:
      'Israeli Privacy Protection Law 5741-1981 and Amendment 13 (2023) require ' +
      'a data transfer agreement when personal data is sent outside Israel. ' +
      'PII redaction is implemented. Consent notice is shown before first AI chat use. ' +
      'Retention is capped at 90 days. Right-to-erasure endpoint exists at DELETE /api/ai-insights/sessions/:sessionId.',

    gdprCompliance: 'partial',
    gdprNote:
      'GDPR Art.5(1)(e) storage limitation: 90-day TTL implemented. ' +
      'Art.17 erasure: admin deletion endpoint implemented. ' +
      'Art.13 transparency: consent notice shown before first chat. ' +
      'Art.28 processor agreement (DPA): pending direct Google DPA — see directDpaNote above.',
  },

  retentionPolicy: {
    aiChatInteractions: '90 days',
    aiTokenUsage: 'indefinite (no PII, monitoring only)',
    aiSecurityEvents: 'indefinite (no PII, security audit)',
    aiDeletionAudit: '7 years (legal compliance)',
    cleanupMechanism: 'daily server-side Firestore query on expiresAt field',
  },

  securityControls: {
    rateLimiting: '20 req/min + 60 req/hour per IP (public AI endpoints)',
    promptInjectionFilter: '15 patterns, server-side, blocks before Gemini call',
    outboundPIIRedaction: 'email, phone, Israeli ID, card, bearer token, API key',
    tokenLogging: 'every Gemini response logged to ai_token_usage collection',
    adminRoutesProtected: 'requireAdmin middleware on all /api/ai-insights/* routes',
  },
};

/**
 * Persist compliance snapshot to Firestore on startup.
 * Creates a dated record each time the server starts.
 * Does not overwrite existing records (audit trail).
 */
export async function persistAIComplianceRecord(): Promise<void> {
  try {
    await adminDb.collection('ai_compliance_records').add({
      ...AI_COMPLIANCE_RECORD,
      capturedAt: new Date(),
      serverEnv: process.env.NODE_ENV ?? 'unknown',
    });
    logger.info('[AI Compliance] ✅ Compliance record persisted to Firestore', {
      provider: AI_COMPLIANCE_RECORD.provider.name,
      model: AI_COMPLIANCE_RECORD.provider.model,
      directDpa: AI_COMPLIANCE_RECORD.dpa.directDpaWithGoogle,
    });
  } catch (err) {
    logger.error('[AI Compliance] Failed to persist compliance record', err);
  }
}

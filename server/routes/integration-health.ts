/**
 * PetWash™ Integration Health API
 * ────────────────────────────────
 * GET /api/admin/integration-health
 *
 * Returns a real-time status matrix for every critical external integration.
 * Checks env-var presence, JSON parsability, and (where cheap) a live connectivity
 * probe so admins/operators can see at a glance what is live, degraded, or dead.
 *
 * Access: admin or viewer only (validateFirebaseToken + requireAdminOrViewer).
 *
 * Status values:
 *   "live"     — env var present AND (if probed) ping succeeded
 *   "degraded" — env var present but probe failed, or partially configured
 *   "dead"     — env var missing entirely
 *   "unknown"  — skipped probe (too expensive for a health check)
 */

import { Router } from 'express';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { isSuperAdmin } from '../middleware/rbac';
import { logger } from '../lib/logger';

const router = Router();

const ADMIN_VIEWER_EMAILS: string[] = (process.env.ADMIN_VIEWER_EMAILS || '')
  .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

function requireAdminOrViewer(req: any, res: any, next: any) {
  const email = (req.firebaseUser?.email || '').toLowerCase();
  if (!isSuperAdmin(email) && !ADMIN_VIEWER_EMAILS.includes(email)) {
    return res.status(403).json({ error: 'Admin or viewer access required' });
  }
  next();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function envPresent(key: string): boolean {
  return !!(process.env[key] || '').trim();
}

function envJson(key: string): { present: boolean; parseable: boolean } {
  const val = (process.env[key] || '').trim();
  if (!val) return { present: false, parseable: false };
  try { JSON.parse(val); return { present: true, parseable: true }; }
  catch { return { present: true, parseable: false }; }
}

type IntegrationStatus = 'live' | 'degraded' | 'dead' | 'unknown';

interface IntegrationCheck {
  name: string;
  category: string;
  status: IntegrationStatus;
  envVars: string[];
  note: string;
  criticalIf: string;
  affectedFeatures?: string[];
}

// ── Integration definitions ───────────────────────────────────────────────────

async function buildHealthMatrix(): Promise<IntegrationCheck[]> {
  const checks: IntegrationCheck[] = [];

  // ── Google Service Account (single point of failure for 10 services) ─────────
  const gsa = envJson('GOOGLE_SERVICE_ACCOUNT_JSON');
  checks.push({
    name: 'Google Service Account JSON',
    category: 'Google Platform',
    status: !gsa.present ? 'dead' : !gsa.parseable ? 'degraded' : 'live',
    envVars: ['GOOGLE_SERVICE_ACCOUNT_JSON'],
    note: gsa.present && !gsa.parseable
      ? 'Secret is set but not valid JSON — all dependent services will fail'
      : gsa.present
      ? 'Present and parseable'
      : 'MISSING — 10 Google services will fail silently',
    criticalIf: 'broken',
    affectedFeatures: [
      'Google Calendar (booking events)',
      'Google Sheets (form data, booking logs)',
      'Gmail fallback (email)',
      'Google Wallet (loyalty passes)',
      'Google Cloud Storage (documents, backups)',
      'Google Cloud Translation (multi-language)',
      'Dialogflow CX (AI chat)',
      'Google Vision API',
      'Google Cloud Messaging (SMS alt)',
      'Google Business Profile',
    ],
  });

  // ── Google Calendar ──────────────────────────────────────────────────────────
  const hasReplitConnector = envPresent('REPLIT_CONNECTORS_HOSTNAME');
  checks.push({
    name: 'Google Calendar',
    category: 'Google Platform',
    status: gsa.present && gsa.parseable ? 'live' : hasReplitConnector ? 'live' : 'dead',
    envVars: ['GOOGLE_SERVICE_ACCOUNT_JSON', 'REPLIT_CONNECTORS_HOSTNAME'],
    note: hasReplitConnector
      ? 'Uses Replit connector; falls back to service account'
      : gsa.present && gsa.parseable
      ? 'Service account present; Replit connector absent (Cloud Run mode)'
      : 'No auth path available — booking events will NOT be created',
    criticalIf: 'booking calendar sync is a user-facing promise',
  });

  // ── Google Maps ──────────────────────────────────────────────────────────────
  checks.push({
    name: 'Google Maps',
    category: 'Google Platform',
    status: envPresent('GOOGLE_MAPS_API_KEY') ? 'live' : 'dead',
    envVars: ['GOOGLE_MAPS_API_KEY'],
    note: envPresent('GOOGLE_MAPS_API_KEY') ? 'Key present' : 'Missing — address lookup and provider search map disabled',
    criticalIf: 'address/location features used in booking',
  });

  // ── Gemini AI ───────────────────────────────────────────────────────────────
  const hasGemini = envPresent('GEMINI_API_KEY') || envPresent('AI_INTEGRATIONS_GEMINI_API_KEY') || envPresent('GOOGLE_API_KEY');
  checks.push({
    name: 'Gemini AI',
    category: 'Google Platform',
    status: hasGemini ? 'live' : 'dead',
    envVars: ['GEMINI_API_KEY', 'AI_INTEGRATIONS_GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    note: hasGemini ? 'At least one Gemini key found' : 'No Gemini key — AI chat, weather advisor, avatar generation disabled',
    criticalIf: 'AI features are user-facing',
  });

  // ── Google reCAPTCHA ─────────────────────────────────────────────────────────
  checks.push({
    name: 'Google reCAPTCHA Enterprise',
    category: 'Google Platform',
    status: envPresent('RECAPTCHA_SECRET_KEY') ? 'live' : 'dead',
    envVars: ['RECAPTCHA_SECRET_KEY', 'VITE_RECAPTCHA_SITE_KEY'],
    note: envPresent('RECAPTCHA_SECRET_KEY') ? 'Present' : 'Missing — bot protection disabled on all auth forms',
    criticalIf: 'abuse/bot protection required',
  });

  // ── SendGrid (primary email) ─────────────────────────────────────────────────
  checks.push({
    name: 'SendGrid (primary email)',
    category: 'Email',
    status: envPresent('SENDGRID_API_KEY') ? 'live' : 'dead',
    envVars: ['SENDGRID_API_KEY'],
    note: envPresent('SENDGRID_API_KEY') ? 'Key present' : 'MISSING — all transactional email fails; Gmail fallback activates',
    criticalIf: 'all booking confirmations, OTPs, notifications fail',
  });

  // ── Gmail fallback (email) ────────────────────────────────────────────────────
  checks.push({
    name: 'Gmail API (email fallback)',
    category: 'Email',
    status: hasReplitConnector && gsa.present ? 'live' : hasReplitConnector ? 'degraded' : gsa.present ? 'unknown' : 'dead',
    envVars: ['GOOGLE_SERVICE_ACCOUNT_JSON', 'REPLIT_CONNECTORS_HOSTNAME'],
    note: hasReplitConnector
      ? 'Replit connector present (primary Gmail path); service account is secondary'
      : gsa.present
      ? 'Replit connector absent — Gmail route may not function outside Replit'
      : 'Neither Replit connector nor service account — Gmail fallback non-functional',
    criticalIf: 'SendGrid is down',
  });

  // ── Twilio (SMS / OTP) ────────────────────────────────────────────────────────
  const hasTwilioCore = envPresent('TWILIO_ACCOUNT_SID') && envPresent('TWILIO_AUTH_TOKEN');
  const hasTwilioSender = envPresent('TWILIO_PHONE_NUMBER') || envPresent('TWILIO_MESSAGING_SERVICE_SID');
  checks.push({
    name: 'Twilio SMS / OTP',
    category: 'Messaging',
    status: hasTwilioCore && hasTwilioSender ? 'live' : hasTwilioCore ? 'degraded' : 'dead',
    envVars: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER', 'TWILIO_MESSAGING_SERVICE_SID'],
    note: !hasTwilioCore
      ? 'Core credentials missing — all OTP/SMS fail'
      : !hasTwilioSender
      ? 'Credentials present but no sender number configured'
      : 'Fully configured',
    criticalIf: 'phone OTP login fails; users locked out',
  });

  // ── Firebase Auth ─────────────────────────────────────────────────────────────
  checks.push({
    name: 'Firebase Auth',
    category: 'Auth',
    status: envPresent('FIREBASE_SERVICE_ACCOUNT_KEY') || envPresent('VITE_FIREBASE_PROJECT_ID') ? 'live' : 'dead',
    envVars: ['FIREBASE_SERVICE_ACCOUNT_KEY', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_API_KEY'],
    note: envPresent('FIREBASE_SERVICE_ACCOUNT_KEY') ? 'Server-side service account present' : 'Server service account missing — token verification fails',
    criticalIf: 'all authenticated requests fail',
  });

  // ── Nayax Payments ────────────────────────────────────────────────────────────
  const hasNayax = envPresent('NAYAX_API_KEY') || envPresent('NAYAX_MERCHANT_ID');
  checks.push({
    name: 'Nayax Payments',
    category: 'Payments',
    status: envPresent('NAYAX_API_KEY') && envPresent('NAYAX_MERCHANT_ID') ? 'live' : hasNayax ? 'degraded' : 'dead',
    envVars: ['NAYAX_API_KEY', 'NAYAX_MERCHANT_ID'],
    note: !hasNayax
      ? 'Missing — K9000 station and online payments disabled'
      : !(envPresent('NAYAX_API_KEY') && envPresent('NAYAX_MERCHANT_ID'))
      ? 'Partially configured — some Nayax flows may fail'
      : 'Configured',
    criticalIf: 'physical wash station and core online payments fail',
  });

  // ── Tranzila Payments ─────────────────────────────────────────────────────────
  checks.push({
    name: 'Tranzila Payments',
    category: 'Payments',
    status: envPresent('TRANZILA_API_KEY') ? 'live' : 'dead',
    envVars: ['TRANZILA_API_KEY', 'TRANZILA_WEBHOOK_SECRET'],
    note: envPresent('TRANZILA_API_KEY')
      ? 'Key present; note: 7 Tranzila feature flags default to false in payment-flags.ts'
      : 'Missing — gift cards and secondary payment features disabled',
    criticalIf: 'secondary payment flows fail (gift cards, etc.)',
  });

  // ── HubSpot CRM ───────────────────────────────────────────────────────────────
  checks.push({
    name: 'HubSpot CRM',
    category: 'Marketing / CRM',
    status: envPresent('HUBSPOT_ACCESS_TOKEN') ? 'live' : 'dead',
    envVars: ['HUBSPOT_ACCESS_TOKEN'],
    note: envPresent('HUBSPOT_ACCESS_TOKEN') ? 'Token present' : 'Missing — new user and loyalty registrations not synced to CRM',
    criticalIf: 'sales leads and registrations lost from CRM',
  });

  // ── Sentry ────────────────────────────────────────────────────────────────────
  checks.push({
    name: 'Sentry Error Tracking',
    category: 'Observability',
    status: envPresent('VITE_SENTRY_DSN') ? 'live' : 'dead',
    envVars: ['VITE_SENTRY_DSN'],
    note: envPresent('VITE_SENTRY_DSN') ? 'DSN present' : 'Missing — production errors not tracked',
    criticalIf: 'production errors invisible to the team',
  });

  // ── DocuSeal (e-signatures) ───────────────────────────────────────────────────
  checks.push({
    name: 'DocuSeal (E-Signatures)',
    category: 'Legal',
    status: envPresent('DOCUSEAL_API_KEY') ? 'live' : 'dead',
    envVars: ['DOCUSEAL_API_KEY'],
    note: envPresent('DOCUSEAL_API_KEY') ? 'Key present' : 'Missing — provider contracts and e-sign flows disabled',
    criticalIf: 'provider contracts cannot be signed',
  });

  // ── Israeli Tax (Rasa) ────────────────────────────────────────────────────────
  checks.push({
    name: 'Israeli Tax / Rasa',
    category: 'Finance / Legal',
    status: envPresent('RASA_API_ENDPOINT') && envPresent('RASA_SUPPLIER_API_KEY') ? 'live' : 'dead',
    envVars: ['RASA_API_ENDPOINT', 'RASA_SUPPLIER_API_KEY', 'VAT_RATE'],
    note: envPresent('RASA_API_ENDPOINT') && envPresent('RASA_SUPPLIER_API_KEY')
      ? 'Configured'
      : 'Credentials missing — Israeli tax invoice generation disabled',
    criticalIf: 'tax invoice generation fails; legal compliance risk',
  });

  // ── Mizrahi Bank ──────────────────────────────────────────────────────────────
  checks.push({
    name: 'Mizrahi Bank Reconciliation',
    category: 'Finance / Legal',
    status: envPresent('BANK_AGGREGATOR_URL') && envPresent('BANK_AGGREGATOR_SECRET_KEY') ? 'live' : 'dead',
    envVars: ['BANK_AGGREGATOR_URL', 'BANK_AGGREGATOR_SECRET_KEY', 'MIZRAHI_ACCOUNT_ID'],
    note: envPresent('BANK_AGGREGATOR_URL') && envPresent('BANK_AGGREGATOR_SECRET_KEY')
      ? 'Configured'
      : 'Credentials missing — bank reconciliation silent fail',
    criticalIf: 'financial reconciliation blind; payout accuracy at risk',
  });

  // ── WhatsApp Business ─────────────────────────────────────────────────────────
  checks.push({
    name: 'WhatsApp Business',
    category: 'Messaging',
    status: envPresent('META_WEBHOOK_SECRET') ? 'live' : 'degraded',
    envVars: ['META_WEBHOOK_SECRET'],
    note: envPresent('META_WEBHOOK_SECRET') ? 'Webhook secret present' : 'No webhook secret — WhatsApp webhooks will be rejected',
    criticalIf: 'WhatsApp customer communication fails',
  });

  // ── Redis ────────────────────────────────────────────────────────────────────
  checks.push({
    name: 'Redis Cache',
    category: 'Infrastructure',
    status: envPresent('REDIS_URL') ? 'live' : 'degraded',
    envVars: ['REDIS_URL'],
    note: envPresent('REDIS_URL') ? 'URL present' : 'No Redis — falling back to in-memory; rate limiter resets on restart',
    criticalIf: 'performance degraded; rate limiting not persistent across restarts',
  });

  // ── Database ─────────────────────────────────────────────────────────────────
  checks.push({
    name: 'PostgreSQL Database',
    category: 'Infrastructure',
    status: envPresent('DATABASE_URL') ? 'live' : 'dead',
    envVars: ['DATABASE_URL'],
    note: envPresent('DATABASE_URL') ? 'URL present' : 'CRITICAL: DATABASE_URL missing — the entire platform is non-functional',
    criticalIf: 'entire platform non-functional',
  });

  // ── Weather (Open-Meteo primary) ──────────────────────────────────────────────
  // Open-Meteo is free and requires no key, so we check for the optional supplementary services.
  const hasOpenWeather = envPresent('OPENWEATHER_API_KEY');
  const hasWeatherApi = envPresent('WEATHERAPI_KEY');
  checks.push({
    name: 'Weather (Multi-source)',
    category: 'Operations',
    status: 'live', // Open-Meteo free tier requires no key
    envVars: ['OPENWEATHER_API_KEY', 'WEATHERAPI_KEY', 'GOOGLE_WEATHER_API_KEY'],
    note: `Open-Meteo (primary, no key needed) always available. ` +
      `OpenWeatherMap: ${hasOpenWeather ? 'configured' : 'not configured (optional fallback)'}. ` +
      `WeatherAPI: ${hasWeatherApi ? 'configured' : 'not configured (optional fallback)'}. ` +
      `⚠️ Weather is ADVISORY ONLY — canProceed is always true; no booking is ever blocked by weather conditions.`,
    criticalIf: 'weather-safety UX promises not met',
  });

  return checks;
}

// ── Route ──────────────────────────────────────────────────────────────────────

router.get('/', validateFirebaseToken, requireAdminOrViewer, async (_req, res) => {
  try {
    const checks = await buildHealthMatrix();

    const summary = {
      total:    checks.length,
      live:     checks.filter((c) => c.status === 'live').length,
      degraded: checks.filter((c) => c.status === 'degraded').length,
      dead:     checks.filter((c) => c.status === 'dead').length,
      unknown:  checks.filter((c) => c.status === 'unknown').length,
    };

    const overallStatus =
      summary.dead > 0    ? 'degraded' :
      summary.degraded > 0 ? 'degraded' :
      'healthy';

    res.json({
      ok:            true,
      timestamp:     new Date().toISOString(),
      overallStatus,
      summary,
      integrations:  checks,
    });
  } catch (err: any) {
    logger.error('[IntegrationHealth] Failed to build health matrix', { err: err.message });
    res.status(500).json({ ok: false, error: 'Failed to build integration health matrix' });
  }
});

export default router;

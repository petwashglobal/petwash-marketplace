/**
 * GEMINI SECURITY ADVISOR
 * ========================
 * Uses Gemini AI to surface known CVEs, security advisories, and best-practice
 * changes for the external SDKs/APIs that PetWash depends on:
 *
 *   • Google Maps Platform (Places API v1, Geocoding, Maps JS)
 *   • Firebase Auth / Firebase App Check
 *   • Twilio Verify / Messaging
 *   • SendGrid / Twilio SendGrid
 *   • Apple Sign-In (ASWebAuthenticationSession)
 *   • Stripe.js
 *
 * The advisor runs once on server startup, then on a 24-hour timer.
 * Any CRITICAL or HIGH advisory is written to the audit_events table immediately.
 * All findings are logged at INFO level for operational review.
 *
 * Gemini model: gemini-2.5-flash (via Replit AI proxy — @google/genai)
 */

import { GoogleGenAI } from '@google/genai';
import { logger } from '../lib/logger';
import { logAuditEvent } from '../middleware/auditLog';

const AUDIT_ACTOR = 'system:gemini-security-advisor';
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;   // 24 hours

function buildPrompt(): string {
  return `
You are a senior application security engineer reviewing a production SaaS platform
built with: Node.js/Express, React/TypeScript, Firebase Auth, Google Maps Places API v1,
Google Geocoding API, Twilio Verify (OTP), SendGrid (transactional email),
Apple Sign-In (ASWebAuthenticationSession), and Stripe.js.

Today's date: ${new Date().toISOString().slice(0, 10)}

Task: Identify the TOP 5 most important security advisories, CVEs, or hardening
recommendations published in the LAST 90 DAYS for any of the technologies listed above.

For each advisory output a JSON object with these exact fields:
{
  "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  "provider": "Google Maps" | "Firebase" | "Twilio" | "SendGrid" | "Apple" | "Stripe" | "Node.js" | "Other",
  "title": "short human-readable title",
  "summary": "1-2 sentence plain-language description",
  "action": "concrete mitigation or upgrade step",
  "reference": "URL or advisory ID if known, otherwise null"
}

Return ONLY a JSON array of these objects. No markdown, no extra text.
If no significant advisories exist for a provider, omit it from the list.
`.trim();
}

interface SecurityAdvisory {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  provider: string;
  title: string;
  summary: string;
  action: string;
  reference: string | null;
}

/** Return the first candidate key that looks like a real API key (not a Replit placeholder) */
function resolveGeminiKey(): string | null {
  const DUMMY_PATTERN = /^_DUMMY|placeholder|fake|test_key/i;
  // NOTE: server/index.ts sets GEMINI_AI_KEY as a stable alias for GEMINI_API_KEY
  // to avoid conflicts with GOOGLE_API_KEY (Google Maps). Check GEMINI_AI_KEY first.
  const candidates = [
    process.env.GEMINI_AI_KEY,
    process.env.GEMINI_API_KEY,
    process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
    process.env.GOOGLE_AI_API_KEY,
  ];
  for (const k of candidates) {
    if (k && k.length > 16 && !DUMMY_PATTERN.test(k)) return k;
  }
  return null;
}

async function runSecurityCheck(): Promise<void> {
  const apiKey = resolveGeminiKey();

  if (!apiKey) {
    logger.warn('[SecurityAdvisor] No valid Gemini API key found — skipping security check (set GEMINI_API_KEY)');
    return;
  }

  try {
    logger.info('[SecurityAdvisor] Starting Gemini security intelligence check');

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: buildPrompt() }] }],
    });

    const raw = (response.text || '').trim();

    let advisories: SecurityAdvisory[] = [];
    try {
      const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      advisories = JSON.parse(cleaned);
      if (!Array.isArray(advisories)) throw new Error('Not an array');
    } catch {
      logger.warn('[SecurityAdvisor] Could not parse Gemini response as JSON', {
        rawLength: raw.length,
        preview: raw.slice(0, 200),
      });
      return;
    }

    for (const adv of advisories) {
      logger.info('[SecurityAdvisor] Advisory', {
        severity:  adv.severity,
        provider:  adv.provider,
        title:     adv.title,
        action:    adv.action,
        reference: adv.reference,
      });

      if (adv.severity === 'CRITICAL' || adv.severity === 'HIGH') {
        await logAuditEvent({
          actorUserId: AUDIT_ACTOR,
          actorRole:   'system',
          actionType:  `SECURITY_ADVISORY_${adv.severity}`,
          targetType:  'external_provider',
          targetId:    adv.provider,
          metadata: {
            title:      adv.title,
            summary:    adv.summary,
            action:     adv.action,
            reference:  adv.reference,
            detectedAt: new Date().toISOString(),
            source:     'gemini-2.5-flash',
          },
        });
      }
    }

    const criticalCount = advisories.filter(a => a.severity === 'CRITICAL').length;
    const highCount     = advisories.filter(a => a.severity === 'HIGH').length;

    logger.info('[SecurityAdvisor] Check complete', {
      totalAdvisories: advisories.length,
      critical: criticalCount,
      high:     highCount,
      nextCheckIn: `${CHECK_INTERVAL_MS / 3_600_000}h`,
    });

  } catch (error: any) {
    logger.error('[SecurityAdvisor] Gemini security check failed', {
      message: error.message,
    });
  }
}

/**
 * Schedule a security intelligence check on startup + every 24 hours.
 * Called once from server/routes.ts after all middleware is registered.
 */
export function startSecurityAdvisor(): void {
  // Delay 90 s after startup so the server is fully ready and DB is warmed up
  setTimeout(async () => {
    await runSecurityCheck();
    setInterval(runSecurityCheck, CHECK_INTERVAL_MS);
  }, 90_000);

  logger.info('[SecurityAdvisor] Scheduled — first check in 90 s, then every 24 h');
}

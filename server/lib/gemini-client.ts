/**
 * server/lib/gemini-client.ts
 * Central Gemini AI client — single source of truth for all AI calls.
 *
 * Priority:
 *   1. AI_INTEGRATIONS_GEMINI_API_KEY + AI_INTEGRATIONS_GEMINI_BASE_URL
 *      → Replit-managed Vertex AI (paid, no 20/day limit)
 *   2. GOOGLE_API_KEY / GEMINI_API_KEY
 *      → Direct Gemini API (free tier, 20/day cap)
 *
 * Features:
 *   - Quota guard: tracks calls per minute in memory
 *   - Graceful fallback: returns null on 429 / quota exhausted
 *   - Usage logging: logs every call with model + caller label
 *   - Circuit breaker: backs off for 10 min after quota hit
 */

import { GoogleGenAI } from '@google/genai';
import { logger } from './logger';

// ─── API key resolution ────────────────────────────────────────────────────────

const INTEGRATION_KEY = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
const INTEGRATION_URL  = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
const FALLBACK_KEY     = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

const API_KEY   = INTEGRATION_KEY || FALLBACK_KEY || '';
const IS_VERTEX = !!(INTEGRATION_KEY && INTEGRATION_URL);

if (!API_KEY) {
  logger.error('[GeminiClient] No API key configured — all AI features disabled');
}

if (IS_VERTEX) {
  logger.info('[GeminiClient] ✅ Using Vertex AI (paid, unlimited) via Replit integration');
} else if (API_KEY) {
  logger.warn('[GeminiClient] ⚠️  Using free-tier Gemini API — quota: ~20 req/day. Add AI_INTEGRATIONS_GEMINI_API_KEY to upgrade.');
}

// ─── Singleton client ──────────────────────────────────────────────────────────

function buildClient(): GoogleGenAI | null {
  if (!API_KEY) return null;
  return new GoogleGenAI({
    apiKey: API_KEY,
    ...(INTEGRATION_URL
      ? { httpOptions: { baseUrl: INTEGRATION_URL, apiVersion: '' } }
      : {}),
  });
}

export const geminiClient: GoogleGenAI | null = buildClient();

// ─── Quota guard ───────────────────────────────────────────────────────────────

interface QuotaState {
  callsThisMinute: number;
  windowStart: number;       // epoch ms
  backoffUntil: number;      // epoch ms (0 = not in backoff)
  totalCallsSession: number;
  totalErrorsSession: number;
}

const quota: QuotaState = {
  callsThisMinute: 0,
  windowStart: Date.now(),
  backoffUntil: 0,
  totalCallsSession: 0,
  totalErrorsSession: 0,
};

const BACKOFF_MS     = 10 * 60 * 1000; // 10 min after quota hit
// Vertex AI paid: Flash = 1000 RPM, Pro = 300 RPM. Use 500 as safe platform-wide cap.
// Free tier: 18/min to stay under the 20/day ceiling conservatively.
const MAX_PER_MINUTE = IS_VERTEX ? 500 : 18;

function checkQuota(): { allowed: boolean; reason?: string } {
  const now = Date.now();

  if (quota.backoffUntil > now) {
    const secsLeft = Math.ceil((quota.backoffUntil - now) / 1000);
    return { allowed: false, reason: `quota_backoff:${secsLeft}s` };
  }

  // Reset 1-min window
  if (now - quota.windowStart > 60_000) {
    quota.callsThisMinute = 0;
    quota.windowStart = now;
  }

  if (quota.callsThisMinute >= MAX_PER_MINUTE) {
    if (!IS_VERTEX) {
      // Free tier — engage backoff
      quota.backoffUntil = now + BACKOFF_MS;
      logger.warn('[GeminiClient] Rate limit hit — backing off 10 min', { totalCalls: quota.totalCallsSession });
    }
    return { allowed: false, reason: 'rate_limit' };
  }

  return { allowed: true };
}

// ─── Safe generate wrapper ────────────────────────────────────────────────────

export interface GeminiResult {
  text: string | null;
  ok: boolean;
  error?: string;
}

/**
 * Safe wrapper around Gemini generateContent.
 * Returns `{ ok: false, text: null }` on quota/error — never throws.
 *
 * @param model   e.g. 'gemini-2.5-flash'
 * @param prompt  The prompt string
 * @param caller  Short label for logging, e.g. 'OctopusBrain', 'Watchdog'
 */
export async function safeGenerate(
  model: string,
  prompt: string,
  caller: string,
): Promise<GeminiResult> {
  if (!geminiClient) {
    return { ok: false, text: null, error: 'no_client' };
  }

  const quotaCheck = checkQuota();
  if (!quotaCheck.allowed) {
    logger.warn(`[GeminiClient] ${caller} blocked by quota guard`, { reason: quotaCheck.reason });
    return { ok: false, text: null, error: quotaCheck.reason };
  }

  quota.callsThisMinute++;
  quota.totalCallsSession++;

  const start = Date.now();
  try {
    const response = await geminiClient.models.generateContent({ model, contents: prompt });
    const text = response.text ?? null;
    logger.info(`[GeminiClient] ${caller} ok`, {
      model,
      ms: Date.now() - start,
      chars: text?.length ?? 0,
      totalCalls: quota.totalCallsSession,
    });
    return { ok: true, text };
  } catch (err: any) {
    quota.totalErrorsSession++;
    const errStr = typeof err === 'string' ? err : JSON.stringify(err?.message || err);
    const isQuota = errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED') || errStr.includes('quota');

    if (isQuota && !IS_VERTEX) {
      quota.backoffUntil = Date.now() + BACKOFF_MS;
      logger.warn(`[GeminiClient] ${caller} quota exhausted — backing off 10 min`, { totalCalls: quota.totalCallsSession });
    } else {
      logger.error(`[GeminiClient] ${caller} failed`, { model, ms: Date.now() - start, error: errStr.slice(0, 200) });
    }

    return { ok: false, text: null, error: isQuota ? 'quota_exhausted' : 'api_error' };
  }
}

// ─── Usage stats ───────────────────────────────────────────────────────────────

export function getGeminiStats() {
  return {
    backend: IS_VERTEX ? 'vertex_ai_paid' : 'gemini_free_tier',
    apiKeyPresent: !!API_KEY,
    totalCallsSession: quota.totalCallsSession,
    totalErrorsSession: quota.totalErrorsSession,
    callsThisMinute: quota.callsThisMinute,
    inBackoff: quota.backoffUntil > Date.now(),
    backoffSecondsLeft: quota.backoffUntil > Date.now()
      ? Math.ceil((quota.backoffUntil - Date.now()) / 1000)
      : 0,
    maxPerMinute: MAX_PER_MINUTE,
    quotaMode: IS_VERTEX ? 'unlimited' : 'free_20_per_day',
  };
}

/**
 * server/lib/gemini-client.ts
 * Central Gemini AI client — routes ALL AI calls through the user's own
 * Google Cloud project (signinpetwash) via the Firebase service account.
 *
 * Auth priority:
 *   1. FIREBASE_SERVICE_ACCOUNT_KEY  → direct Vertex AI, user's billing
 *   2. AI_INTEGRATIONS_GEMINI_API_KEY → Replit proxy (fallback only)
 *   3. GEMINI_API_KEY / GOOGLE_API_KEY → free tier (last resort)
 *
 * Features:
 *   - Writes SA credentials to /tmp at startup (Vertex AI ADC)
 *   - Quota guard: 500 req/min on paid, 18/min on free tier
 *   - Graceful fallback: returns null on quota/error — never throws
 *   - Usage logging per caller label
 *   - Circuit breaker: 10 min backoff after quota hit (free tier only)
 */

import { GoogleGenAI } from '@google/genai';
import { writeFileSync } from 'fs';
import { logger } from './logger';

// ─── Vertex AI setup via Firebase service account ─────────────────────────────

export const VERTEX_PROJECT  = 'signinpetwash';
export const VERTEX_LOCATION = process.env.VERTEX_AI_LOCATION || 'us-central1';
const SA_CREDS_PATH = '/tmp/google-sa.json';

function setupVertexCredentials(): boolean {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.type !== 'service_account') return false;
    writeFileSync(SA_CREDS_PATH, raw, { mode: 0o600 });
    process.env.GOOGLE_APPLICATION_CREDENTIALS = SA_CREDS_PATH;
    return true;
  } catch {
    return false;
  }
}

export const IS_DIRECT_VERTEX = setupVertexCredentials();

// Replit proxy fallback config (used when Firebase SA is unavailable)
const PROXY_KEY = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || '';
const PROXY_URL = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL || '';
const IS_PROXY  = !IS_DIRECT_VERTEX && !!(PROXY_KEY && PROXY_URL);

export const IS_VERTEX = IS_DIRECT_VERTEX || IS_PROXY;

if (IS_DIRECT_VERTEX) {
  logger.info(`[GeminiClient] ✅ Vertex AI — project:${VERTEX_PROJECT} location:${VERTEX_LOCATION} (your Google Cloud billing)`);
} else if (IS_PROXY) {
  logger.info('[GeminiClient] ✅ Replit AI proxy (Vertex AI via Replit billing)');
} else {
  logger.warn('[GeminiClient] ⚠️  Free-tier Gemini API — 20 req/day cap');
}

// ─── Client factory (exported so all services can use it) ─────────────────────

/**
 * Returns a GoogleGenAI config object ready to spread into `new GoogleGenAI(...)`.
 * Always returns the best available backend.
 */
export function getVertexAIConfig(): Record<string, any> {
  if (IS_DIRECT_VERTEX) {
    return { vertexai: true, project: VERTEX_PROJECT, location: VERTEX_LOCATION };
  }
  if (IS_PROXY) {
    return {
      apiKey: PROXY_KEY,
      httpOptions: { baseUrl: PROXY_URL, apiVersion: '' },
    };
  }
  return {
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
  };
}

function buildClient(): GoogleGenAI | null {
  if (!IS_DIRECT_VERTEX && !PROXY_KEY && !process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
    logger.error('[GeminiClient] No AI credentials — all AI features disabled');
    return null;
  }
  return new GoogleGenAI(getVertexAIConfig());
}

export const geminiClient: GoogleGenAI | null = buildClient();

// ─── Quota guard ───────────────────────────────────────────────────────────────

interface QuotaState {
  callsThisMinute: number;
  windowStart: number;
  backoffUntil: number;
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

const BACKOFF_MS     = 10 * 60 * 1000;
// Vertex AI paid: Flash=1000 RPM, Pro=300 RPM. 500 = safe platform cap.
const MAX_PER_MINUTE = IS_VERTEX ? 500 : 18;

function checkQuota(): { allowed: boolean; reason?: string } {
  const now = Date.now();

  if (quota.backoffUntil > now) {
    const secsLeft = Math.ceil((quota.backoffUntil - now) / 1000);
    return { allowed: false, reason: `quota_backoff:${secsLeft}s` };
  }

  if (now - quota.windowStart > 60_000) {
    quota.callsThisMinute = 0;
    quota.windowStart = now;
  }

  if (quota.callsThisMinute >= MAX_PER_MINUTE) {
    if (!IS_VERTEX) {
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
      backend: IS_DIRECT_VERTEX ? 'vertex_direct' : IS_PROXY ? 'vertex_proxy' : 'free',
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
    backend: IS_DIRECT_VERTEX ? 'vertex_ai_direct_signinpetwash' : IS_PROXY ? 'vertex_ai_replit_proxy' : 'gemini_free_tier',
    project: IS_DIRECT_VERTEX ? VERTEX_PROJECT : null,
    location: IS_DIRECT_VERTEX ? VERTEX_LOCATION : null,
    totalCallsSession: quota.totalCallsSession,
    totalErrorsSession: quota.totalErrorsSession,
    callsThisMinute: quota.callsThisMinute,
    inBackoff: quota.backoffUntil > Date.now(),
    backoffSecondsLeft: quota.backoffUntil > Date.now() ? Math.ceil((quota.backoffUntil - Date.now()) / 1000) : 0,
    maxPerMinute: MAX_PER_MINUTE,
    quotaMode: IS_VERTEX ? 'paid_500rpm' : 'free_20_per_day',
  };
}

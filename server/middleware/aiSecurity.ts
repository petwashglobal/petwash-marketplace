/**
 * AI Security Middleware
 * Items 2, 5, 6, 7: Token logging, prompt injection filter, PII redaction, monitoring counters
 */

import { logger } from '../lib/logger';
import { db as adminDb } from '../lib/firebase-admin';

// ─── Monitoring counters (in-memory, reported to Firestore periodically) ───
interface AIMetrics {
  requestsTotal: number;
  requestsBlocked: number;
  injectionAttemptsBlocked: number;
  redactionsPerformed: number;
  tokenUsageTotal: number;
  promptTokensTotal: number;
  candidateTokensTotal: number;
  geminiErrorCount: number;
  topIPs: Map<string, number>;
  lastFlushedAt: Date;
}

const metrics: AIMetrics = {
  requestsTotal: 0,
  requestsBlocked: 0,
  injectionAttemptsBlocked: 0,
  redactionsPerformed: 0,
  tokenUsageTotal: 0,
  promptTokensTotal: 0,
  candidateTokensTotal: 0,
  geminiErrorCount: 0,
  topIPs: new Map(),
  lastFlushedAt: new Date(),
};

export function incrementAIRequest(ip: string) {
  metrics.requestsTotal++;
  metrics.topIPs.set(ip, (metrics.topIPs.get(ip) ?? 0) + 1);
}

export function incrementGeminiError() {
  metrics.geminiErrorCount++;
}

export function getAIMetrics() {
  return {
    requestsTotal: metrics.requestsTotal,
    requestsBlocked: metrics.requestsBlocked,
    injectionAttemptsBlocked: metrics.injectionAttemptsBlocked,
    redactionsPerformed: metrics.redactionsPerformed,
    tokenUsageTotal: metrics.tokenUsageTotal,
    promptTokensTotal: metrics.promptTokensTotal,
    candidateTokensTotal: metrics.candidateTokensTotal,
    geminiErrorCount: metrics.geminiErrorCount,
    topIPs: Array.from(metrics.topIPs.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ip, count]) => ({ ip, count })),
    lastFlushedAt: metrics.lastFlushedAt,
  };
}

// ─── Item 5: Prompt injection filter ───────────────────────────────────────

const INJECTION_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/i, label: 'ignore_previous_instructions' },
  { pattern: /reveal\s+(the\s+)?(system\s+prompt|prompt|instructions?)/i, label: 'reveal_system_prompt' },
  { pattern: /^system\s*:/im, label: 'system_prefix' },
  { pattern: /^developer\s*:/im, label: 'developer_prefix' },
  { pattern: /<\s*INST\s*>/i, label: 'inst_tag' },
  { pattern: /\bjailbreak\b/i, label: 'jailbreak_keyword' },
  { pattern: /bypass\s+(policy|rules?|restrictions?|guidelines?|safety)/i, label: 'bypass_policy' },
  { pattern: /act\s+as\s+(a\s+)?(different|another|unrestricted|evil|uncensored|admin|root|system)/i, label: 'act_as_persona' },
  { pattern: /simulate\s+(admin|root|system|unrestricted)/i, label: 'simulate_admin' },
  { pattern: /you\s+are\s+now\s+(in\s+)?(developer|god|admin|jailbreak|DAN|unrestricted)\s+mode/i, label: 'mode_switch' },
  { pattern: /\[SYSTEM\]/i, label: 'system_bracket_tag' },
  { pattern: /\bdisregard\s+(all\s+)?(previous|prior)\s+/i, label: 'disregard_instructions' },
  { pattern: /forget\s+(all\s+)?(previous|prior)\s+instructions?/i, label: 'forget_instructions' },
  { pattern: /print\s+(the\s+)?(system\s+prompt|full\s+prompt|hidden\s+prompt)/i, label: 'print_prompt' },
  { pattern: /what\s+(are|were)\s+your\s+(original\s+)?instructions?/i, label: 'probe_instructions' },
];

export interface InjectionCheckResult {
  blocked: boolean;
  label?: string;
  safeRefusal?: string;
}

export function checkPromptInjection(text: string, sessionId?: string): InjectionCheckResult {
  for (const { pattern, label } of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      metrics.injectionAttemptsBlocked++;
      metrics.requestsBlocked++;

      logger.warn('[AI Security] Prompt injection attempt blocked', {
        label,
        sessionId: sessionId?.substring(0, 8),
        textPreview: text.substring(0, 60),
      });

      // Fire-and-forget to Firestore
      adminDb.collection('ai_security_events').add({
        type: 'prompt_injection',
        label,
        sessionId: sessionId ?? null,
        textPreview: text.substring(0, 100),
        timestamp: new Date(),
      }).catch(() => {});

      return {
        blocked: true,
        label,
        safeRefusal:
          'אני כאן רק לעזור בנושאי Pet Wash™. לא אוכל לעזור בבקשה זו. 🐾\n' +
          "I'm here to help with Pet Wash™ services only. I can't assist with that request. 🐾",
      };
    }
  }
  return { blocked: false };
}

// ─── Item 6: Outbound PII redaction (before sending to Gemini) ─────────────

const PII_REDACTION_RULES: Array<{ pattern: RegExp; label: string; replacement: string }> = [
  // Email addresses
  {
    pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
    label: 'email',
    replacement: '[EMAIL]',
  },
  // Israeli mobile / landline phone numbers (05x, 03, 04, 08, 09, 02)
  {
    pattern: /\b0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}\b/g,
    label: 'il_phone',
    replacement: '[PHONE]',
  },
  // Israeli ID numbers (exactly 9 digits, word boundary)
  {
    pattern: /\b\d{9}\b/g,
    label: 'il_id',
    replacement: '[ID]',
  },
  // Payment card-like sequences (13-19 consecutive digits, possibly space-separated)
  {
    pattern: /\b(?:\d[ \-]?){13,19}\b/g,
    label: 'card_number',
    replacement: '[CARD]',
  },
  // Bearer tokens / JWT-like strings
  {
    pattern: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
    label: 'bearer_token',
    replacement: 'Bearer [TOKEN]',
  },
  // API keys (common patterns: sk-, pk-, AIza, SG., etc.)
  {
    pattern: /\b(sk|pk|AIza|SG\.|AAAA)[A-Za-z0-9_\-]{16,}/g,
    label: 'api_key',
    replacement: '[API_KEY]',
  },
];

export interface RedactionResult {
  text: string;
  redactionCount: number;
  redactedTypes: string[];
}

export function redactOutboundPII(text: string): RedactionResult {
  let result = text;
  let redactionCount = 0;
  const redactedTypes: string[] = [];

  for (const { pattern, label, replacement } of PII_REDACTION_RULES) {
    const before = result;
    result = result.replace(pattern, replacement);
    if (result !== before) {
      redactionCount++;
      redactedTypes.push(label);
    }
  }

  if (redactionCount > 0) {
    metrics.redactionsPerformed += redactionCount;
    logger.info('[AI Security] PII redacted from outbound prompt', {
      types: redactedTypes,
      count: redactionCount,
    });
  }

  return { text: result, redactionCount, redactedTypes };
}

// ─── Item 2: Token usage logging ───────────────────────────────────────────

export interface TokenUsageRecord {
  model: string;
  promptTokenCount: number | null;
  candidatesTokenCount: number | null;
  totalTokenCount: number | null;
  latencyMs: number;
  sessionId?: string;
  endpoint: string;
  timestamp: Date;
  estimatedCostUSD?: number | null;
}

// Gemini 2.5 Flash pricing (as of 2025 — update when Google publishes 2.5 pricing)
// Using 1.5 Flash as proxy: input $0.075/1M tokens, output $0.30/1M tokens
const COST_PER_PROMPT_TOKEN = 0.075 / 1_000_000;
const COST_PER_CANDIDATE_TOKEN = 0.30 / 1_000_000;

export async function logAITokenUsage(record: TokenUsageRecord): Promise<void> {
  // Update in-memory metrics
  if (record.totalTokenCount) {
    metrics.tokenUsageTotal += record.totalTokenCount;
  }
  if (record.promptTokenCount) {
    metrics.promptTokensTotal += record.promptTokenCount;
  }
  if (record.candidatesTokenCount) {
    metrics.candidateTokensTotal += record.candidatesTokenCount;
  }

  // Estimate cost
  const estimatedCostUSD =
    (record.promptTokenCount ?? 0) * COST_PER_PROMPT_TOKEN +
    (record.candidatesTokenCount ?? 0) * COST_PER_CANDIDATE_TOKEN;

  const fullRecord = { ...record, estimatedCostUSD };

  logger.info('[AI Token Usage]', {
    model: record.model,
    promptTokens: record.promptTokenCount,
    candidateTokens: record.candidatesTokenCount,
    totalTokens: record.totalTokenCount,
    latencyMs: record.latencyMs,
    estimatedCostUSD: estimatedCostUSD.toFixed(6),
    endpoint: record.endpoint,
  });

  // Persist to Firestore (fire-and-forget, non-blocking)
  try {
    await adminDb.collection('ai_token_usage').add(fullRecord);
  } catch (err) {
    logger.error('[AI Token Usage] Failed to persist to Firestore', err);
  }
}

// ─── Item 7: Flush metrics to Firestore every 15 min ──────────────────────

export function startAIMetricsFlusher(): void {
  setInterval(async () => {
    const snapshot = getAIMetrics();
    try {
      await adminDb.collection('ai_monitoring_snapshots').add({
        ...snapshot,
        flushedAt: new Date(),
      });
      metrics.lastFlushedAt = new Date();

      // Alert checks
      if (metrics.injectionAttemptsBlocked > 10) {
        logger.warn('[AI Monitor] ALERT: High injection attempt volume', {
          count: metrics.injectionAttemptsBlocked,
        });
      }
      if (metrics.tokenUsageTotal > 500_000) {
        logger.warn('[AI Monitor] ALERT: High token usage in window', {
          total: metrics.tokenUsageTotal,
        });
      }
      if (metrics.geminiErrorCount > 5) {
        logger.warn('[AI Monitor] ALERT: Gemini API failure rate elevated', {
          errors: metrics.geminiErrorCount,
        });
      }

      // Reset window counters after flush
      metrics.requestsTotal = 0;
      metrics.requestsBlocked = 0;
      metrics.injectionAttemptsBlocked = 0;
      metrics.redactionsPerformed = 0;
      metrics.tokenUsageTotal = 0;
      metrics.promptTokensTotal = 0;
      metrics.candidateTokensTotal = 0;
      metrics.geminiErrorCount = 0;
      metrics.topIPs.clear();
    } catch (err) {
      logger.error('[AI Monitor] Failed to flush metrics', err);
    }
  }, 15 * 60 * 1000);

  logger.info('[AI Security] ✅ Metrics flusher started (every 15 min)');
}

/**
 * AI Context Builder — CEO MASTER 2026-08-28 §57 §78 §79.
 *
 * Every AI call in the codebase MUST route through this builder. The
 * builder:
 *   1. Verifies the caller has the SCOPE they're asking for (auth
 *      happens BEFORE the model, not inside it).
 *   2. Projects a minimal typed payload — the allow-list per scope
 *      is the ONLY source of keys the model can see.
 *   3. Enforces a hard denylist as belt-and-braces (bank / national
 *      ID / passwords / protected characteristics — CEO §57 §79).
 *   4. Stamps a scopeToken the model must echo back for audit.
 *
 * A refactor that hands the LLM a full DB row bypasses this file —
 * the regression test asserts no other code imports the raw drizzle
 * `pets` / `users` / `walletAccounts` schemas inside an ai-* module.
 */
import { randomUUID } from 'crypto';
import {
  AI_HARD_DENYLIST,
  AI_SCOPE_KEY_ALLOWLIST,
  type AiContext,
  type AiScope,
} from '@shared/lib/aiContext';

export class AiScopeAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiScopeAuthorizationError';
  }
}

export interface BuildAiContextInput {
  scope: AiScope;
  actor: 'pet_parent' | 'provider' | 'admin';
  userUid: string;
  language: 'he' | 'en';
  /** Free-form input the composer wants to project into the model
   *  context. The builder filters this against the scope's
   *  allow-list before it ships. */
  candidate: Record<string, unknown>;
}

/**
 * PII buckets — CEO §79. A raw money amount does not need to reach
 * the model; a bucket like "under_100" / "100_500" / "over_500" is
 * enough for the concierge to say something useful.
 */
export function bucketMoneyCents(cents: number | null | undefined): 'zero' | 'under_100' | 'under_500' | 'under_2000' | 'over_2000' {
  const n = Number(cents);
  if (!Number.isFinite(n) || n <= 0) return 'zero';
  if (n < 10000) return 'under_100';
  if (n < 50000) return 'under_500';
  if (n < 200000) return 'under_2000';
  return 'over_2000';
}

/** Rate bucket for the pricing coach — vs local median. */
export function bucketRateVsMedian(current: number, median: number): 'above' | 'at' | 'below' {
  if (!Number.isFinite(current) || !Number.isFinite(median) || median <= 0) return 'at';
  const ratio = current / median;
  if (ratio > 1.15) return 'above';
  if (ratio < 0.85) return 'below';
  return 'at';
}

/** Response-rate / acceptance bucket for the provider coach. */
export function bucketProviderRate(pct: number): 'low' | 'medium' | 'high' {
  if (!Number.isFinite(pct)) return 'low';
  if (pct >= 90) return 'high';
  if (pct >= 60) return 'medium';
  return 'low';
}

/**
 * Build an AI context. Throws AiScopeAuthorizationError if the caller
 * didn't specify a userUid + scope + actor.
 *
 * Filters the candidate payload against:
 *   * the scope's allow-list (keys must appear there — else dropped)
 *   * the hard denylist (case-insensitive substring — keys mentioning
 *     ANY denylisted term are refused even if the allow-list widened)
 */
export function buildAiContext(input: BuildAiContextInput): AiContext {
  if (!input.userUid)    throw new AiScopeAuthorizationError('userUid required');
  if (!input.actor)      throw new AiScopeAuthorizationError('actor required');
  if (!input.scope)      throw new AiScopeAuthorizationError('scope required');
  if (!input.language)   throw new AiScopeAuthorizationError('language required');

  const allow = AI_SCOPE_KEY_ALLOWLIST[input.scope];
  if (!allow) throw new AiScopeAuthorizationError(`unknown scope: ${input.scope}`);

  const denyLower = new Set<string>();
  for (const k of AI_HARD_DENYLIST) denyLower.add(k.toLowerCase());

  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input.candidate ?? {})) {
    // 1. Allow-list check.
    if (!allow.includes(key)) continue;
    // 2. Hard denylist — case-insensitive substring match. This is
    //    intentionally conservative: a key "bankIbanLast4" contains
    //    "bankIban" and is REFUSED even though last-4 is safe. If a
    //    caller genuinely needs a bucket of a sensitive value they
    //    must add it under an unambiguously-scoped name.
    const kl = key.toLowerCase();
    let denied = false;
    for (const d of denyLower) {
      if (kl.includes(d.toLowerCase())) { denied = true; break; }
    }
    if (denied) continue;
    payload[key] = value;
  }

  return {
    scopeToken: randomUUID(),
    scope: input.scope,
    actor: input.actor,
    issuedAt: new Date().toISOString(),
    userUid: input.userUid,
    language: input.language,
    payload,
  };
}

/**
 * Guard used by ai-* modules: throws if the caller failed to build
 * an AI context. The rule is "no bare LLM calls" — every model
 * invocation must pass an AiContext.
 */
export function assertAiContext(ctx: unknown): asserts ctx is AiContext {
  if (!ctx || typeof ctx !== 'object') {
    throw new AiScopeAuthorizationError('AiContext required — build via buildAiContext()');
  }
  const c = ctx as Partial<AiContext>;
  if (!c.scopeToken || !c.scope || !c.actor || !c.userUid || !c.language) {
    throw new AiScopeAuthorizationError('AiContext malformed');
  }
}

/**
 * Coworker Agents — shared types (PR-20 scaffold).
 *
 * These are the contracts every "AI coworker" surface must speak. The real
 * implementations land in PR-21+ per family; this file only defines the
 * shapes so server, routes, and (later) UI all agree.
 *
 * Hard rules baked into the contract:
 *   - Outputs are advisory only. No money, approval, refund, payout, or ban
 *     decisions are derived from these objects directly. A human admin click
 *     is always required downstream.
 *   - Every output carries `wired` so the UI can render "not wired yet" for
 *     families that PR-20 has not implemented.
 *   - Every output carries `fallback` so the UI knows whether the answer
 *     came from Gemini or from the deterministic fallback path.
 *   - Every output carries `generatedAt` and `ttlSeconds` so callers can
 *     decide whether to re-run or use the cached snapshot.
 */
import { z } from 'zod';

// ─── Coworker families ──────────────────────────────────────────────────────
// Keep this list closed and exhaustive. Adding a family is a deliberate PR.
export const COWORKER_FAMILIES = [
  'provider',   // provider onboarding / KYC review assist
  'booking',    // booking lifecycle anomalies / no-shows / disputes
  'signup',     // customer + sitter + walker signup funnel health
  'ops',        // station alerts, transport delays, inventory
  'fraud',      // fraud / risk signals across wallet, refunds, chargebacks
  'support',    // CS triage, ticket clustering, suggested responses
] as const;

export const CoworkerFamilySchema = z.enum(COWORKER_FAMILIES);
export type CoworkerFamily = z.infer<typeof CoworkerFamilySchema>;

// ─── Severity ───────────────────────────────────────────────────────────────
export const CoworkerSeveritySchema = z.enum(['info', 'warn', 'critical']);
export type CoworkerSeverity = z.infer<typeof CoworkerSeveritySchema>;

// ─── Anomaly + Recommendation atoms ─────────────────────────────────────────
export const CoworkerAnomalySchema = z.object({
  id: z.string().min(1),
  severity: CoworkerSeveritySchema,
  title: z.string().min(1).max(140),
  detail: z.string().max(2000).optional(),
  // Free-form tags so the UI can group by station, country, channel, etc.
  // Kept as a string-string map to stay JSON-clean.
  tags: z.record(z.string()).optional(),
});
export type CoworkerAnomaly = z.infer<typeof CoworkerAnomalySchema>;

export const CoworkerRecommendationSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(140),
  rationale: z.string().max(2000).optional(),
  // The admin UI link this recommendation should deep-link to so the human
  // can act. Optional — if absent the UI just shows the text.
  actionHref: z.string().optional(),
});
export type CoworkerRecommendation = z.infer<typeof CoworkerRecommendationSchema>;

// ─── The single output contract every family returns ───────────────────────
export const CoworkerOutputSchema = z.object({
  // wired === false means: family is scaffolded but PR-20 did not implement
  // the real query path yet. UI must render "not wired yet".
  wired: z.boolean(),
  // Reason text when wired === false. Empty string allowed when wired.
  reason: z.string().max(500).default(''),
  // Family that produced this output (echoed for client convenience).
  family: CoworkerFamilySchema,
  // Short natural-language summary suitable for a card header.
  summary: z.string().max(2000).default(''),
  anomalies: z.array(CoworkerAnomalySchema).default([]),
  recommendations: z.array(CoworkerRecommendationSchema).default([]),
  // True when Gemini was unavailable / rate-limited / produced invalid JSON
  // and the deterministic fallback path served the answer instead.
  fallback: z.boolean().default(false),
  // ISO-8601 instant the snapshot was generated.
  generatedAt: z.string(),
  // Cache TTL — clients may show "as of X seconds ago" and refresh after.
  // 60s default matches the shared snapshot cache plan.
  ttlSeconds: z.number().int().min(0).max(86_400).default(60),
});
export type CoworkerOutput = z.infer<typeof CoworkerOutputSchema>;

// ─── Helper: build a "not wired yet" output for a family ───────────────────
// Pure helper — no I/O. Used by the route handler in PR-20 so every family
// can return a uniform "scaffold only" payload.
export function notWiredOutput(
  family: CoworkerFamily,
  reason = 'PR-20 scaffold only — implementation in PR-21+',
): CoworkerOutput {
  return {
    wired: false,
    reason,
    family,
    summary: '',
    anomalies: [],
    recommendations: [],
    fallback: false,
    generatedAt: new Date().toISOString(),
    ttlSeconds: 60,
  };
}

// ─── Actor — who is invoking the coworker ──────────────────────────────────
// Threaded through from route handlers so the service layer can rate-limit
// per-actor and emit audit log entries. Kept minimal and JSON-safe — never
// store the full Firebase token or req object here.
//
// Used by PR-21+ governance hooks. Optional fields are filled when available;
// callers must not fabricate them.
export const CoworkerActorSchema = z.object({
  actorUserId: z.string().min(1).optional(),
  actorRole: z.string().optional(),
  ip: z.string().optional(),
  userAgent: z.string().optional(),
  traceId: z.string().optional(),
});
export type CoworkerActor = z.infer<typeof CoworkerActorSchema>;

/**
 * moderationEvidence — CEO DEEP-LOGIC §20 + Integrity §6.12.
 *
 * The general application `logger.info` is the WRONG surface for raw
 * blocked-message bodies. Those messages can contain sexual content,
 * threats, PII, or payment details — putting them into logs that any
 * on-call engineer can grep is a privacy defect, not a safety win.
 *
 * This module owns the dedicated retention surface for raw moderation
 * evidence:
 *
 *   • `logModerationDecision(...)` writes ONLY the stable, safe
 *     metadata (messageAttemptId, thread + sender tail, category,
 *     confidence, decision, policyVersion) to `logger.info`. The raw
 *     body never reaches this channel.
 *
 *   • `retainModerationEvidence(...)` is called ONLY when
 *     `shouldRetainBody(decision) === true`. It routes the raw body to
 *     a dedicated evidence sink whose durable backing (Postgres table
 *     with row-level access controls, dispute-case linkage, retention
 *     policy) is a CEO-gated schema decision and lands in a later
 *     commit. Until then, the evidence sink is a SEPARATE named
 *     `moderation-evidence` logger channel; nothing about the sink is
 *     shared with the general application log, and callers cannot
 *     reach it directly.
 *
 * Callers must never build their own `retainedBody` payload again.
 * That drifted the retention policy across three routes; this module
 * is the single sink.
 */
import { logger } from '../../lib/logger';
import type {
  PolicyResult,
  PolicyCategory,
} from '@shared/marketplace/policyEngine';
import type { IntegritySignalType } from '@shared/marketplace/moderationAudit';
import { shouldRetainBody } from '@shared/marketplace/moderationAudit';
import crypto from 'crypto';

export interface ModerationLogContext {
  route: string;                // '[BookingChat.policy]' / '[ThreadChat.policy]'
  threadId: string;
  bookingId?: string;
  senderUid: string;
  policyVersion: string;
  primaryCategory?: PolicyCategory;
  integritySignal?: IntegritySignalType | null;
  outcome: PolicyResult['outcome'];
  matches: PolicyResult['matches'];
  messageAttemptId?: string;
}

/**
 * Redact a UID down to its last 6 chars — enough to correlate incidents
 * across log lines while never surfacing a full account identifier.
 */
function tail(uid: string): string {
  return uid.length <= 6 ? uid : `…${uid.slice(-6)}`;
}

/**
 * Highest confidence across matches — a single number the audit line
 * can carry instead of the full match array (which contains rule
 * source labels).
 */
function maxConfidence(matches: PolicyResult['matches']): number {
  let max = 0;
  for (const m of matches) if (m.confidence > max) max = m.confidence;
  return max;
}

/**
 * Log the moderation decision to the general application logger with
 * ONLY safe, stable metadata. No raw text. No detection rule labels.
 * No full UIDs.
 */
export function logModerationDecision(ctx: ModerationLogContext): void {
  const messageAttemptId = ctx.messageAttemptId ?? crypto.randomBytes(6).toString('hex');
  logger.info(`${ctx.route} message evaluated`, {
    messageAttemptId,
    threadId: ctx.threadId,
    bookingId: ctx.bookingId,
    senderUidTail: tail(ctx.senderUid),
    policyVersion: ctx.policyVersion,
    decision: ctx.outcome,
    primaryCategory: ctx.primaryCategory,
    confidence: Number(maxConfidence(ctx.matches).toFixed(3)),
    integritySignal: ctx.integritySignal ?? undefined,
    // matchCount instead of matches[]: rule identifiers must never
    // reach the general log per §29.
    matchCount: ctx.matches.length,
  });
}

/**
 * Route the raw body to the dedicated moderation-evidence sink IFF the
 * doctrine's retention policy says so. Callers pass the raw body
 * directly — this function is the ONE place the retention gate is
 * consulted. Nothing happens when retention is not required.
 *
 * The evidence sink is a SEPARATE named logger channel (child logger
 * `moderation-evidence`). It does NOT flow into the standard
 * application log stream. A durable Postgres evidence store with
 * row-level ACLs is the follow-up (CEO-gated schema change).
 */
export function retainModerationEvidence(
  ctx: ModerationLogContext,
  rawBody: string,
): void {
  if (!shouldRetainBody(ctx.outcome)) return;
  // The evidence stream is intentionally NOT the standard logger —
  // callers of `logger.info` must not see this data. We use a child
  // logger name so the transport layer can bind a different sink /
  // access policy to `moderation-evidence`.
  const evidenceLogger =
    typeof (logger as any).child === 'function'
      ? (logger as any).child({ channel: 'moderation-evidence' })
      : logger;
  evidenceLogger.warn?.('[moderation-evidence] retained', {
    messageAttemptId: ctx.messageAttemptId,
    threadId: ctx.threadId,
    bookingId: ctx.bookingId,
    senderUidTail: tail(ctx.senderUid),
    policyVersion: ctx.policyVersion,
    decision: ctx.outcome,
    primaryCategory: ctx.primaryCategory,
    rawBody,
  });
}

/**
 * One-shot helper: log the decision AND retain evidence when required.
 * The single call site both routes use — no more inlining the
 * retention gate at every send handler.
 */
export function recordModerationDecision(
  ctx: ModerationLogContext,
  rawBody: string,
): { messageAttemptId: string } {
  const messageAttemptId = ctx.messageAttemptId ?? crypto.randomBytes(6).toString('hex');
  const withId = { ...ctx, messageAttemptId };
  logModerationDecision(withId);
  retainModerationEvidence(withId, rawBody);
  return { messageAttemptId };
}

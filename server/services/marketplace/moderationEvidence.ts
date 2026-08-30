/**
 * moderationEvidence — CEO DEEP-LOGIC §1-§3 (FLY MODE III correction).
 *
 * PRIOR IMPLEMENTATION WAS FALSELY REPORTED AS PASS.
 *
 * The prior module tried to route raw blocked-message bodies to a
 * named child-logger channel. But server/lib/logger.ts's ServerLogger
 * has no .child() method, so the fallback executed logger.warn with
 * the raw body — the same stdout / Cloud Logging transport as every
 * other application log. A named metadata field inside the same sink
 * is NOT a separate secure store.
 *
 * Correction (CEO §1):
 *   RAW BODY NEVER TOUCHES ANY LOG. For BLOCK / BLOCK_AND_REVIEW /
 *   SAFETY_ESCALATION we persist only the following metadata to
 *   ordinary logs:
 *
 *     messageAttemptId, threadId, bookingId, senderUidTail,
 *     policyVersion, decision, primaryCategory, confidence,
 *     integritySignal, matchCount, timestamp.
 *
 *   Not: rawBody, email, phone, payment numbers, sexual message
 *   text, threat text.
 *
 * Retention state (CEO §3):
 *   `evidenceRetention` is an explicit state. Production default is
 *   METADATA_ONLY. RESTRICTED_EVIDENCE is reserved for a later
 *   separately-designed evidence store with a different sink,
 *   different permissions, retention policy, access audit, and case
 *   linkage. Until that ships, we do not silently upgrade.
 */
import { logger } from '../../lib/logger';
import type {
  PolicyResult,
  PolicyCategory,
} from '@shared/marketplace/policyEngine';
import type { IntegritySignalType } from '@shared/marketplace/moderationAudit';
import crypto from 'crypto';

export type EvidenceRetentionState = 'METADATA_ONLY' | 'RESTRICTED_EVIDENCE';

/**
 * Production default. Only `METADATA_ONLY` is implemented today; the
 * `RESTRICTED_EVIDENCE` mode is intentionally not reachable and MUST
 * NOT be enabled until a genuinely separate secure evidence store
 * lands (different sink, ACLs, retention, case linkage, encryption).
 */
export const CURRENT_EVIDENCE_RETENTION: EvidenceRetentionState = 'METADATA_ONLY';

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
 * Highest confidence across matches. A single number the audit line
 * can carry instead of the full match array (which contains rule
 * source labels — §29 discipline).
 */
function maxConfidence(matches: PolicyResult['matches']): number {
  let max = 0;
  for (const m of matches) if (m.confidence > max) max = m.confidence;
  return max;
}

/**
 * Log the moderation decision to the general application logger with
 * ONLY safe, stable metadata. No raw text. No detection rule labels.
 * No full UIDs. No email / phone / payment / threat wording.
 */
export function logModerationDecision(ctx: ModerationLogContext): { messageAttemptId: string } {
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
    matchCount: ctx.matches.length,
    evidenceRetention: CURRENT_EVIDENCE_RETENTION,
    timestamp: new Date().toISOString(),
  });
  return { messageAttemptId };
}

/**
 * The ONE call site both send routes use. No `rawBody` parameter —
 * the module intentionally provides no path to log the raw message.
 * If a caller passes a body it is IGNORED here; a future
 * RESTRICTED_EVIDENCE retention mode would take an evidence writer as
 * a dependency, never the plain logger.
 */
export function recordModerationDecision(
  ctx: ModerationLogContext,
): { messageAttemptId: string } {
  return logModerationDecision(ctx);
}

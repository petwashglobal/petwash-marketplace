/**
 * OffPlatformEscalationAuditor — CEO PROGRAM 7 (Anti-circumvention audit).
 *
 * Pure evaluator. Rolls up a window of message-safety verdicts for
 * a single (customer, provider) pair and decides whether the
 * relationship has crossed the audit threshold. §7 discipline: a
 * one-off "let's try WhatsApp" is a WARN; a repeated pattern of
 * circumvention signals a BLOCK_AND_REVIEW at the pair level so
 * moderation can step in.
 */

import type { SafetyVerdict, ReasonCode } from './MessageSafetyClassifier';

export interface MessageAuditRecord {
  at: string;                               // ISO
  verdict: SafetyVerdict;
  reasonCodes: ReasonCode[];
}

export interface AuditInput {
  records: MessageAuditRecord[];
  now?: Date;
  /** Window (hours) over which repeated signals are aggregated. */
  windowHours?: number;
}

export type PairEscalation =
  | 'NONE'
  | 'MODERATION_REVIEW'
  | 'ACCOUNT_REVIEW'
  | 'SAFETY_ESCALATION';

export interface AuditOutcome {
  escalation: PairEscalation;
  reasonCode: string;
  circumventionSignals: number;
  abuseSignals: number;
  threatSignals: number;
}

const DEFAULT_WINDOW_HOURS = 72;

const CIRCUMVENTION: ReadonlySet<ReasonCode> = new Set<ReasonCode>([
  'CIRCUMVENTION_CASH',
  'CIRCUMVENTION_OFFPLATFORM',
  'CIRCUMVENTION_CONTACT_SHARING',
  'CIRCUMVENTION_PLATFORM_MENTIONED',
]);
const ABUSE: ReadonlySet<ReasonCode> = new Set<ReasonCode>([
  'ABUSE_DIRECTED',
  'SEXUAL_SOLICITATION',
]);
const THREAT: ReadonlySet<ReasonCode> = new Set<ReasonCode>([
  'THREAT_PHYSICAL',
]);

export function auditPair(input: AuditInput): AuditOutcome {
  const now = input.now ?? new Date();
  const windowMs = (input.windowHours ?? DEFAULT_WINDOW_HOURS) * 60 * 60 * 1000;
  let circumvention = 0;
  let abuse = 0;
  let threat = 0;
  for (const r of input.records) {
    const t = Date.parse(r.at);
    if (!Number.isFinite(t)) continue;
    if (now.getTime() - t > windowMs) continue;
    for (const code of r.reasonCodes) {
      if (CIRCUMVENTION.has(code)) circumvention += 1;
      if (ABUSE.has(code)) abuse += 1;
      if (THREAT.has(code)) threat += 1;
    }
  }

  if (threat > 0) {
    return { escalation: 'SAFETY_ESCALATION', reasonCode: 'THREAT_DETECTED', circumventionSignals: circumvention, abuseSignals: abuse, threatSignals: threat };
  }
  if (abuse >= 2 || circumvention >= 3) {
    return { escalation: 'ACCOUNT_REVIEW', reasonCode: abuse >= 2 ? 'REPEATED_ABUSE' : 'REPEATED_CIRCUMVENTION', circumventionSignals: circumvention, abuseSignals: abuse, threatSignals: threat };
  }
  if (abuse >= 1 || circumvention >= 1) {
    return { escalation: 'MODERATION_REVIEW', reasonCode: abuse >= 1 ? 'ABUSE_SIGNAL' : 'CIRCUMVENTION_SIGNAL', circumventionSignals: circumvention, abuseSignals: abuse, threatSignals: threat };
  }
  return { escalation: 'NONE', reasonCode: 'CLEAN', circumventionSignals: 0, abuseSignals: 0, threatSignals: 0 };
}

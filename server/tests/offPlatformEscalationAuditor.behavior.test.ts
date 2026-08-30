/**
 * OffPlatformEscalationAuditor — Program 7 pair-level audit.
 */
import { describe, it, expect } from 'vitest';
import {
  auditPair,
  type MessageAuditRecord,
} from '../services/marketplace/OffPlatformEscalationAuditor';

const now = new Date('2026-08-30T10:00:00Z');
const at = (hoursAgo: number): string => new Date(now.getTime() - hoursAgo * 60 * 60 * 1000).toISOString();

describe('OffPlatformEscalationAuditor', () => {
  it('empty history → NONE', () => {
    expect(auditPair({ records: [], now }).escalation).toBe('NONE');
  });

  it('single WhatsApp mention → MODERATION_REVIEW', () => {
    const records: MessageAuditRecord[] = [
      { at: at(1), verdict: 'WARN', reasonCodes: ['CIRCUMVENTION_OFFPLATFORM'] },
    ];
    expect(auditPair({ records, now }).escalation).toBe('MODERATION_REVIEW');
  });

  it('three circumvention signals within window → ACCOUNT_REVIEW', () => {
    const records: MessageAuditRecord[] = [
      { at: at(1), verdict: 'WARN', reasonCodes: ['CIRCUMVENTION_OFFPLATFORM'] },
      { at: at(4), verdict: 'WARN', reasonCodes: ['CIRCUMVENTION_CONTACT_SHARING'] },
      { at: at(12), verdict: 'BLOCK_AND_REVIEW', reasonCodes: ['CIRCUMVENTION_CASH'] },
    ];
    const out = auditPair({ records, now });
    expect(out.escalation).toBe('ACCOUNT_REVIEW');
    expect(out.reasonCode).toBe('REPEATED_CIRCUMVENTION');
  });

  it('two abuse-directed signals → ACCOUNT_REVIEW', () => {
    const records: MessageAuditRecord[] = [
      { at: at(2), verdict: 'BLOCK', reasonCodes: ['ABUSE_DIRECTED'] },
      { at: at(6), verdict: 'BLOCK', reasonCodes: ['ABUSE_DIRECTED'] },
    ];
    expect(auditPair({ records, now }).escalation).toBe('ACCOUNT_REVIEW');
  });

  it('any physical threat → SAFETY_ESCALATION (immediate)', () => {
    const records: MessageAuditRecord[] = [
      { at: at(1), verdict: 'SAFETY_ESCALATION', reasonCodes: ['THREAT_PHYSICAL'] },
    ];
    const out = auditPair({ records, now });
    expect(out.escalation).toBe('SAFETY_ESCALATION');
  });

  it('signals outside the window are ignored', () => {
    const records: MessageAuditRecord[] = [
      { at: at(500), verdict: 'BLOCK', reasonCodes: ['ABUSE_DIRECTED'] },
      { at: at(500), verdict: 'BLOCK', reasonCodes: ['ABUSE_DIRECTED'] },
    ];
    expect(auditPair({ records, now, windowHours: 24 }).escalation).toBe('NONE');
  });

  it('counters returned in the outcome for observability', () => {
    const records: MessageAuditRecord[] = [
      { at: at(1), verdict: 'WARN', reasonCodes: ['CIRCUMVENTION_OFFPLATFORM'] },
      { at: at(2), verdict: 'BLOCK', reasonCodes: ['ABUSE_DIRECTED'] },
    ];
    const out = auditPair({ records, now });
    expect(out.circumventionSignals).toBe(1);
    expect(out.abuseSignals).toBe(1);
  });
});

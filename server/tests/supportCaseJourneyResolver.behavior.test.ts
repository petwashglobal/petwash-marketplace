/**
 * SupportCaseJourneyResolver behavior — CEO NEXT-AUTO §14 refill.
 *
 * §86 same entity → different projection for opener vs staff.
 */
import { describe, it, expect } from 'vitest';
import { resolveSupportCaseJourney } from '../services/marketplace/SupportCaseJourneyResolver';

const base = { caseId: 'SC-1', openerUid: 'sarah' } as const;

describe('SupportCase — opener vs staff routing', () => {
  it('OPEN opener → waitingOn=PETWASH, VIEW_SUPPORT_CASE, MEDIUM', () => {
    const r = resolveSupportCaseJourney({
      snapshot: { ...base, status: 'OPEN' },
      actorUid: 'sarah', actorRole: 'OPENER',
    });
    expect(r.waitingOn).toBe('PETWASH');
    expect(r.primaryAction?.actionType).toBe('VIEW_SUPPORT_CASE');
    expect(r.attentionPriority).toBe('MEDIUM');
  });

  it('OPEN staff → RESPOND_SUPPORT_CASE with REQUIRED obligation, HIGH', () => {
    const r = resolveSupportCaseJourney({
      snapshot: { ...base, status: 'OPEN' },
      actorUid: 'agent-1', actorRole: 'STAFF',
    });
    expect(r.primaryAction?.actionType).toBe('RESPOND_SUPPORT_CASE');
    expect(r.obligations.some((o) => o.severity === 'REQUIRED')).toBe(true);
    expect(r.attentionPriority).toBe('HIGH');
  });

  it('AWAITING_CUSTOMER opener → REQUIRED response, HIGH', () => {
    const r = resolveSupportCaseJourney({
      snapshot: { ...base, status: 'AWAITING_CUSTOMER' },
      actorUid: 'sarah', actorRole: 'OPENER',
    });
    expect(r.waitingOn).toBe('CUSTOMER');
    expect(r.obligations.some((o) => o.severity === 'REQUIRED')).toBe(true);
    expect(r.primaryAction?.actionType).toBe('RESPOND_SUPPORT_CASE');
  });

  it('AWAITING_CUSTOMER staff → passive VIEW, INFO', () => {
    const r = resolveSupportCaseJourney({
      snapshot: { ...base, status: 'AWAITING_CUSTOMER' },
      actorUid: 'agent-1', actorRole: 'STAFF',
    });
    expect(r.primaryAction?.actionType).toBe('VIEW_SUPPORT_CASE');
    expect(r.attentionPriority).toBe('INFO');
  });

  it('RESOLVED_PENDING_CONFIRMATION opener → CLOSE_SUPPORT_CASE (opener only)', () => {
    const r = resolveSupportCaseJourney({
      snapshot: { ...base, status: 'RESOLVED_PENDING_CONFIRMATION' },
      actorUid: 'sarah', actorRole: 'OPENER',
    });
    expect(r.primaryAction?.actionType).toBe('CLOSE_SUPPORT_CASE');
  });

  it('RESOLVED_PENDING_CONFIRMATION staff → cannot close, passive VIEW', () => {
    const r = resolveSupportCaseJourney({
      snapshot: { ...base, status: 'RESOLVED_PENDING_CONFIRMATION' },
      actorUid: 'agent-1', actorRole: 'STAFF',
    });
    expect(r.primaryAction?.actionType).toBe('VIEW_SUPPORT_CASE');
    expect(r.primaryAction?.actionType).not.toBe('CLOSE_SUPPORT_CASE');
  });

  it('CLOSED → waitingOn=NONE, INFO', () => {
    const r = resolveSupportCaseJourney({
      snapshot: { ...base, status: 'CLOSED' },
      actorUid: 'sarah', actorRole: 'OPENER',
    });
    expect(r.waitingOn).toBe('NONE');
    expect(r.attentionPriority).toBe('INFO');
  });

  it('severity=URGENT elevates priority even from an INFO baseline', () => {
    const r = resolveSupportCaseJourney({
      snapshot: { ...base, status: 'CLOSED', severityCode: 'URGENT' },
      actorUid: 'sarah', actorRole: 'OPENER',
    });
    expect(r.attentionPriority).toBe('URGENT');
  });

  it('slaBreachAt surfaces as soft-cutoff deadline', () => {
    const r = resolveSupportCaseJourney({
      snapshot: { ...base, status: 'OPEN', slaBreachAt: '2026-08-31T10:00:00Z' },
      actorUid: 'agent-1', actorRole: 'STAFF',
    });
    expect(r.deadlines).toContainEqual({
      reasonCode: 'SUPPORT_SLA_BREACH',
      dueAt: '2026-08-31T10:00:00Z',
      hardCutoff: false,
    });
  });
});

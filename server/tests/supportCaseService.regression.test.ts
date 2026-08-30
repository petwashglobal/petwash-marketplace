/**
 * SupportCaseService — CEO NEXT-AUTO §13.
 */
import { describe, it, expect } from 'vitest';
import {
  openSupportCase,
  assignSupportCase,
  awaitActor,
  resolveSupportCase,
  closeSupportCase,
  canTransition,
} from '../services/marketplace/SupportCaseService';

describe('canTransition state machine', () => {
  it('legal transitions', () => {
    expect(canTransition('OPEN', 'ADMIN_ASSIGNED')).toBe(true);
    expect(canTransition('OPEN', 'RESOLVED')).toBe(true);
    expect(canTransition('ADMIN_ASSIGNED', 'PENDING_ACTOR')).toBe(true);
    expect(canTransition('ADMIN_ASSIGNED', 'RESOLVED')).toBe(true);
    expect(canTransition('PENDING_ACTOR', 'ADMIN_ASSIGNED')).toBe(true);
    expect(canTransition('PENDING_ACTOR', 'RESOLVED')).toBe(true);
    expect(canTransition('RESOLVED', 'CLOSED')).toBe(true);
    expect(canTransition('RESOLVED', 'ADMIN_ASSIGNED')).toBe(true); // reopen
  });
  it('CLOSED is terminal', () => {
    expect(canTransition('CLOSED', 'OPEN')).toBe(false);
    expect(canTransition('CLOSED', 'RESOLVED')).toBe(false);
    expect(canTransition('CLOSED', 'ADMIN_ASSIGNED')).toBe(false);
  });
});

describe('open', () => {
  it('produces a fresh caseId in OPEN status', () => {
    const r = openSupportCase({
      openedBy: 'sarah', openedByRole: 'CUSTOMER',
      kind: 'BOOKING_INCIDENT', subjectCode: 'BOOKING_STARTED_LATE',
      entityRef: { kind: 'booking', id: 'B-1' },
    });
    expect(r.code).toBe('OPENED');
    expect(r.supportCase!.status).toBe('OPEN');
    expect(r.supportCase!.caseId).toMatch(/^case_[0-9a-f]{12}$/);
    expect(r.supportCase!.entityRef).toEqual({ kind: 'booking', id: 'B-1' });
  });
});

describe('assign', () => {
  it('admin claims OPEN → ADMIN_ASSIGNED with supportOwnerUid', () => {
    const opened = openSupportCase({ openedBy: 'sarah', openedByRole: 'CUSTOMER', kind: 'OTHER', subjectCode: 'x' }).supportCase!;
    const r = assignSupportCase({ supportCase: opened, actorUid: 'agent_1', supportOwnerUid: 'agent_1' });
    expect(r.code).toBe('ASSIGNED');
    expect(r.supportCase!.status).toBe('ADMIN_ASSIGNED');
    expect(r.supportCase!.supportOwnerUid).toBe('agent_1');
  });
  it('non-admin cannot assign', () => {
    const opened = openSupportCase({ openedBy: 'sarah', openedByRole: 'CUSTOMER', kind: 'OTHER', subjectCode: 'x' }).supportCase!;
    const r = assignSupportCase({ supportCase: opened, actorUid: 'sarah', supportOwnerUid: 'agent_1' });
    expect(r.code).toBe('ACTOR_NOT_ADMIN');
  });
});

describe('awaitActor', () => {
  it('support owner pushes back → PENDING_ACTOR with waitingOnRole', () => {
    const opened = openSupportCase({ openedBy: 'sarah', openedByRole: 'CUSTOMER', kind: 'OTHER', subjectCode: 'x' }).supportCase!;
    const assigned = assignSupportCase({ supportCase: opened, actorUid: 'agent_1', supportOwnerUid: 'agent_1' }).supportCase!;
    const r = awaitActor({ supportCase: assigned, actorUid: 'agent_1', waitingOnRole: 'CUSTOMER' });
    expect(r.code).toBe('AWAITING_ACTOR');
    expect(r.supportCase!.status).toBe('PENDING_ACTOR');
    expect(r.supportCase!.waitingOnRole).toBe('CUSTOMER');
  });
  it('non-owner cannot push back', () => {
    const opened = openSupportCase({ openedBy: 'sarah', openedByRole: 'CUSTOMER', kind: 'OTHER', subjectCode: 'x' }).supportCase!;
    const assigned = assignSupportCase({ supportCase: opened, actorUid: 'agent_1', supportOwnerUid: 'agent_1' }).supportCase!;
    const r = awaitActor({ supportCase: assigned, actorUid: 'agent_2', waitingOnRole: 'CUSTOMER' });
    expect(r.code).toBe('ACTOR_NOT_ADMIN');
  });
});

describe('resolve', () => {
  it('support owner resolves → RESOLVED', () => {
    const opened = openSupportCase({ openedBy: 'sarah', openedByRole: 'CUSTOMER', kind: 'OTHER', subjectCode: 'x' }).supportCase!;
    const assigned = assignSupportCase({ supportCase: opened, actorUid: 'agent_1', supportOwnerUid: 'agent_1' }).supportCase!;
    const r = resolveSupportCase({ supportCase: assigned, actorUid: 'agent_1' });
    expect(r.code).toBe('RESOLVED');
    expect(r.supportCase!.waitingOnRole).toBeUndefined();
  });
  it('opener can also resolve', () => {
    const opened = openSupportCase({ openedBy: 'sarah', openedByRole: 'CUSTOMER', kind: 'OTHER', subjectCode: 'x' }).supportCase!;
    const r = resolveSupportCase({ supportCase: opened, actorUid: 'sarah' });
    expect(r.code).toBe('RESOLVED');
  });
  it('non-participant refused', () => {
    const opened = openSupportCase({ openedBy: 'sarah', openedByRole: 'CUSTOMER', kind: 'OTHER', subjectCode: 'x' }).supportCase!;
    const r = resolveSupportCase({ supportCase: opened, actorUid: 'stranger' });
    expect(r.code).toBe('ACTOR_NOT_PARTICIPANT');
  });
});

describe('close — ONLY opener may accept the resolution (§14 evidence)', () => {
  it('opener closes RESOLVED → CLOSED with closedAt', () => {
    const opened = openSupportCase({ openedBy: 'sarah', openedByRole: 'CUSTOMER', kind: 'OTHER', subjectCode: 'x' }).supportCase!;
    const resolved = resolveSupportCase({ supportCase: opened, actorUid: 'sarah' }).supportCase!;
    const r = closeSupportCase({ supportCase: resolved, actorUid: 'sarah', now: 12345 });
    expect(r.code).toBe('CLOSED');
    expect(r.supportCase!.status).toBe('CLOSED');
    expect(r.supportCase!.closedAt).toBe(12345);
  });
  it('admin cannot close on behalf of opener (§14 discipline)', () => {
    const opened = openSupportCase({ openedBy: 'sarah', openedByRole: 'CUSTOMER', kind: 'OTHER', subjectCode: 'x' }).supportCase!;
    const assigned = assignSupportCase({ supportCase: opened, actorUid: 'agent_1', supportOwnerUid: 'agent_1' }).supportCase!;
    const resolved = resolveSupportCase({ supportCase: assigned, actorUid: 'agent_1' }).supportCase!;
    const r = closeSupportCase({ supportCase: resolved, actorUid: 'agent_1' });
    expect(r.code).toBe('ACTOR_NOT_OPENER');
  });
  it('cannot close a non-RESOLVED case', () => {
    const opened = openSupportCase({ openedBy: 'sarah', openedByRole: 'CUSTOMER', kind: 'OTHER', subjectCode: 'x' }).supportCase!;
    const r = closeSupportCase({ supportCase: opened, actorUid: 'sarah' });
    expect(r.code).toBe('ILLEGAL_TRANSITION');
  });
});

describe('reopen (RESOLVED → ADMIN_ASSIGNED) is legal', () => {
  it('an admin can reassign a resolved case', () => {
    const opened = openSupportCase({ openedBy: 'sarah', openedByRole: 'CUSTOMER', kind: 'OTHER', subjectCode: 'x' }).supportCase!;
    const assigned = assignSupportCase({ supportCase: opened, actorUid: 'agent_1', supportOwnerUid: 'agent_1' }).supportCase!;
    const resolved = resolveSupportCase({ supportCase: assigned, actorUid: 'agent_1' }).supportCase!;
    const r = assignSupportCase({ supportCase: resolved, actorUid: 'agent_2', supportOwnerUid: 'agent_2' });
    expect(r.code).toBe('ASSIGNED');
    expect(r.supportCase!.status).toBe('ADMIN_ASSIGNED');
    expect(r.supportCase!.supportOwnerUid).toBe('agent_2');
  });
});

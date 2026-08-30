/**
 * SupportCaseJourneyLoader behavior — CEO DEEP-LOGIC §84 loader.
 *
 * Uses the pluggable SupportCaseStore contract so the loader stays
 * testable end-to-end without a durable table. Verifies the party
 * check, the status → resolver mapping, and the OPENER vs STAFF
 * routing symmetry.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemorySupportCaseStore,
  makeSupportCaseJourneyLoader,
} from '../services/marketplace/loaders/SupportCaseJourneyLoader';
import type { SupportCase } from '../services/marketplace/SupportCaseService';

const store = new InMemorySupportCaseStore();
const loader = makeSupportCaseJourneyLoader(store);

function put(sc: Partial<SupportCase>): SupportCase {
  const full: SupportCase = {
    caseId: sc.caseId ?? 'SC-1',
    openedBy: sc.openedBy ?? 'sarah',
    openedByRole: sc.openedByRole ?? 'CUSTOMER',
    kind: sc.kind ?? 'BOOKING_INCIDENT',
    subjectCode: sc.subjectCode ?? 'BOOKING_ISSUE',
    entityRef: sc.entityRef,
    supportOwnerUid: sc.supportOwnerUid,
    waitingOnRole: sc.waitingOnRole,
    status: sc.status ?? 'OPEN',
    openedAt: 0,
    updatedAt: 0,
  };
  store.put(full);
  return full;
}

beforeEach(() => { store.clear(); });

describe('SupportCaseJourneyLoader', () => {
  it('missing case → NOT_FOUND', async () => {
    const out = await loader({ id: 'SC-does-not-exist', actorUid: 'sarah' });
    expect(out.code).toBe('NOT_FOUND');
  });

  it('actor who is neither opener nor staff → NOT_A_PARTY', async () => {
    put({ openedBy: 'sarah', supportOwnerUid: 'agent-1' });
    const out = await loader({ id: 'SC-1', actorUid: 'nosy-neighbor' });
    expect(out.code).toBe('NOT_A_PARTY');
  });

  it('opener sees the OPENER projection (MEDIUM, VIEW_SUPPORT_CASE)', async () => {
    put({ status: 'OPEN', openedBy: 'sarah' });
    const out = await loader({ id: 'SC-1', actorUid: 'sarah' });
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.journey.attentionPriority).toBe('MEDIUM');
    expect(out.journey.primaryAction?.actionType).toBe('VIEW_SUPPORT_CASE');
  });

  it('staff on the same OPEN case sees RESPOND_SUPPORT_CASE (HIGH)', async () => {
    put({ status: 'OPEN', openedBy: 'sarah', supportOwnerUid: 'agent-1' });
    const out = await loader({ id: 'SC-1', actorUid: 'agent-1' });
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.journey.primaryAction?.actionType).toBe('RESPOND_SUPPORT_CASE');
    expect(out.journey.attentionPriority).toBe('HIGH');
  });

  it('PENDING_ACTOR with waitingOnRole=CUSTOMER maps to AWAITING_CUSTOMER', async () => {
    put({ status: 'PENDING_ACTOR', waitingOnRole: 'CUSTOMER', supportOwnerUid: 'agent-1' });
    const out = await loader({ id: 'SC-1', actorUid: 'sarah' });
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.journey.waitingOn).toBe('CUSTOMER');
  });

  it('RESOLVED status maps to RESOLVED_PENDING_CONFIRMATION (opener may close)', async () => {
    put({ status: 'RESOLVED', supportOwnerUid: 'agent-1' });
    const out = await loader({ id: 'SC-1', actorUid: 'sarah' });
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.journey.primaryAction?.actionType).toBe('CLOSE_SUPPORT_CASE');
  });

  it('CLOSED → waitingOn=NONE INFO', async () => {
    put({ status: 'CLOSED', supportOwnerUid: 'agent-1' });
    const out = await loader({ id: 'SC-1', actorUid: 'sarah' });
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.journey.waitingOn).toBe('NONE');
    expect(out.journey.attentionPriority).toBe('INFO');
  });
});

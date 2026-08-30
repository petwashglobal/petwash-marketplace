/**
 * JourneyState — CEO DEEP-LOGIC §84-§87.
 *
 * Behavior pins for the shape the doctrine's brain read-projection
 * carries. The type itself is exhaustive; the constructor and the
 * `hasRequiredObligation` guard are the two runtime pieces.
 */
import { describe, it, expect } from 'vitest';
import {
  emptyJourneyState,
  hasRequiredObligation,
  type JourneyState,
} from '@shared/marketplace/journeyState';

describe('emptyJourneyState — the safe default', () => {
  it('produces a well-formed JourneyState with waitingOn=NONE and no obligations', () => {
    const js = emptyJourneyState(
      { kind: 'booking', id: 'B-1' },
      { role: 'CUSTOMER', uid: 'nir' },
      'PROVIDER_PROPOSED_CHANGE',
    );
    expect(js.entityRef).toEqual({ kind: 'booking', id: 'B-1' });
    expect(js.actor).toEqual({ role: 'CUSTOMER', uid: 'nir' });
    expect(js.currentStateCode).toBe('PROVIDER_PROPOSED_CHANGE');
    expect(js.waitingOn).toBe('NONE');
    expect(js.obligations).toEqual([]);
    expect(js.blockers).toEqual([]);
    expect(js.availableActions).toEqual([]);
    expect(js.deadlines).toEqual([]);
    expect(js.attentionPriority).toBe('NONE');
    expect(js.primaryAction).toBeUndefined();
  });

  it('the same entity can produce different JourneyStates for different actors (§86)', () => {
    const entity = { kind: 'booking', id: 'B-42' };
    const cust = emptyJourneyState(entity, { role: 'CUSTOMER', uid: 'nir' }, 'X');
    const prov = emptyJourneyState(entity, { role: 'PROVIDER', uid: 'maya' }, 'X');
    expect(cust.actor.role).toBe('CUSTOMER');
    expect(prov.actor.role).toBe('PROVIDER');
    expect(cust.actor.uid).not.toBe(prov.actor.uid);
  });
});

describe('CEO §75 — marketing must never outrank a REQUIRED obligation', () => {
  it('hasRequiredObligation is true when any obligation is REQUIRED', () => {
    const js: JourneyState = {
      entityRef: { kind: 'booking', id: 'B-1' },
      actor: { role: 'CUSTOMER' },
      currentStateCode: 'CONFIRMED',
      waitingOn: 'CUSTOMER',
      obligations: [
        { type: 'PAY', severity: 'REQUIRED', reasonCode: 'PAY_DUE', dueAt: '2026-08-31T09:00:00Z' },
        { type: 'RATE_COMPLETED_SERVICE', severity: 'OPTIONAL', reasonCode: 'RATE_OPTIONAL' },
      ],
      blockers: [],
      availableActions: [],
      deadlines: [],
      attentionPriority: 'URGENT',
    };
    expect(hasRequiredObligation(js)).toBe(true);
  });

  it('optional-only obligations → false', () => {
    const js: JourneyState = {
      entityRef: { kind: 'booking', id: 'B-1' },
      actor: { role: 'CUSTOMER' },
      currentStateCode: 'COMPLETED',
      waitingOn: 'NONE',
      obligations: [
        { type: 'RATE_COMPLETED_SERVICE', severity: 'OPTIONAL', reasonCode: 'RATE_OPTIONAL' },
      ],
      blockers: [],
      availableActions: [],
      deadlines: [],
      attentionPriority: 'INFO',
    };
    expect(hasRequiredObligation(js)).toBe(false);
  });

  it('empty obligations → false', () => {
    const js = emptyJourneyState(
      { kind: 'booking', id: 'B' }, { role: 'CUSTOMER' }, 'X',
    );
    expect(hasRequiredObligation(js)).toBe(false);
  });
});

describe('type shape holds the doctrine invariants', () => {
  it('waitingOn is a closed set including PAYMENT_PROVIDER (§71)', () => {
    const parties: Array<JourneyState['waitingOn']> = [
      'CUSTOMER', 'PROVIDER', 'PETWASH', 'PAYMENT_PROVIDER', 'ADMIN', 'SYSTEM', 'NONE',
    ];
    // If this compiles, the type contains all seven states.
    expect(parties.length).toBe(7);
  });

  it('every AvailableAction may carry a blocker with a reasonCode + optional requirement', () => {
    const js: JourneyState = emptyJourneyState(
      { kind: 'booking', id: 'B' }, { role: 'PROVIDER' }, 'REQUESTED',
    );
    js.availableActions.push({
      actionType: 'BOOKING_ACCEPT',
      enabled: false,
      reasonCode: 'PROVIDER_SERVICE_NOT_BOOKABLE',
      blocker: {
        action: 'BOOKING_ACCEPT',
        reasonCode: 'PROVIDER_SERVICE_NOT_BOOKABLE',
        requirement: { type: 'UPDATE_AVAILABILITY' },
      },
    });
    expect(js.availableActions[0].enabled).toBe(false);
    expect(js.availableActions[0].blocker?.requirement?.type).toBe('UPDATE_AVAILABILITY');
  });
});

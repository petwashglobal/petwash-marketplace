/**
 * AiConciergeContextService — Program 35 / 36.
 */
import { describe, it, expect } from 'vitest';
import {
  buildAiContext,
  FORBIDDEN_INTENTS,
} from '../services/marketplace/AiConciergeContextService';
import { emptyJourneyState } from '@shared/marketplace/journeyState';

const j = emptyJourneyState({ kind: 'booking', id: 'B-1' }, { role: 'CUSTOMER', uid: 'sarah' }, 'REQUESTED');

describe('AiConciergeContextService', () => {
  it('happy path → OK bundle', () => {
    const out = buildAiContext({ actorUid: 'sarah', intent: 'EXPLAIN', journeys: [j] });
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.bundle.intent).toBe('EXPLAIN');
    expect(out.bundle.journeys[0]).toBe(j);
  });

  it('caller passing a forbidden intent slug → FORBIDDEN_INTENT (regardless of the caller\'s TypeScript type)', () => {
    for (const forbidden of FORBIDDEN_INTENTS) {
      const out = buildAiContext({ actorUid: 'sarah', intent: forbidden as any, journeys: [j] });
      expect(out.code).toBe('FORBIDDEN_INTENT');
    }
  });

  it('no journeys → NO_JOURNEYS (never build an empty context)', () => {
    const out = buildAiContext({ actorUid: 'sarah', intent: 'RECOMMEND', journeys: [] });
    expect(out.code).toBe('NO_JOURNEYS');
  });

  it('memory fragments are GROUPED by kind (never blurred)', () => {
    const out = buildAiContext({
      actorUid: 'sarah',
      intent: 'SUMMARIZE',
      journeys: [j],
      memory: [
        { kind: 'IDENTITY_FACT', key: 'firstName', value: 'Sarah' },
        { kind: 'EXPLICIT_PREFERENCE', key: 'language', value: 'he' },
        { kind: 'SAVED_SEARCH', key: 'lastSearch', value: { area: 'TLV' } },
      ],
    });
    if (out.code !== 'OK') throw new Error();
    expect(out.bundle.memory.IDENTITY_FACT).toHaveLength(1);
    expect(out.bundle.memory.EXPLICIT_PREFERENCE).toHaveLength(1);
    expect(out.bundle.memory.SAVED_SEARCH).toHaveLength(1);
    expect(out.bundle.memory.BEHAVIORAL_SIGNAL).toEqual([]);
    expect(out.bundle.memory.TRANSACTION_HISTORY).toEqual([]);
  });

  it('allowedProposeActions is explicit — the AI cannot execute directly (empty by default)', () => {
    const out = buildAiContext({ actorUid: 'sarah', intent: 'SURFACE_NEXT_ACTION', journeys: [j] });
    if (out.code !== 'OK') throw new Error();
    expect(out.bundle.allowedProposeActions).toEqual([]);
  });

  it('actorUid preserved so the AI reasoning frame knows WHOSE journey it is', () => {
    const out = buildAiContext({ actorUid: 'sarah', intent: 'EXPLAIN', journeys: [j] });
    if (out.code !== 'OK') throw new Error();
    expect(out.bundle.actorUid).toBe('sarah');
  });
});

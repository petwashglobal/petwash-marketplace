/**
 * JourneyStateService — dispatch semantics.
 *
 * CEO DEEP-LOGIC §84-§87: one endpoint, per-kind loader registration,
 * honest NOT_IMPLEMENTED for unwired kinds (never fake empty).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  JourneyStateService,
  __resetDefaultJourneyStateServiceForTests,
} from '../services/marketplace/JourneyStateService';
import { emptyJourneyState } from '@shared/marketplace/journeyState';

beforeEach(() => __resetDefaultJourneyStateServiceForTests());

describe('JourneyStateService dispatch', () => {
  it('rejects a kind outside the whitelist as INVALID_KIND', async () => {
    const svc = new JourneyStateService();
    const out = await svc.resolveJourney('not_a_real_kind', 'X-1', 'sarah');
    expect(out.code).toBe('INVALID_KIND');
  });

  it('returns NOT_IMPLEMENTED when a valid kind has no registered loader', async () => {
    const svc = new JourneyStateService();
    const out = await svc.resolveJourney('booking', 'B-1', 'sarah');
    expect(out).toEqual({ code: 'NOT_IMPLEMENTED', kind: 'booking' });
  });

  it('routes to the registered loader and returns its OK journey', async () => {
    const svc = new JourneyStateService();
    const journey = emptyJourneyState({ kind: 'booking', id: 'B-1' }, { role: 'CUSTOMER', uid: 'sarah' }, 'REQUESTED');
    svc.registerLoader('booking', () => ({ code: 'OK', journey }));
    const out = await svc.resolveJourney('booking', 'B-1', 'sarah');
    expect(out).toEqual({ code: 'OK', journey });
  });

  it('propagates NOT_A_PARTY refusal from the loader (never fabricates an empty JourneyState)', async () => {
    const svc = new JourneyStateService();
    svc.registerLoader('shop_order', () => ({ code: 'NOT_A_PARTY' }));
    const out = await svc.resolveJourney('shop_order', 'S-1', 'not-the-owner');
    expect(out.code).toBe('NOT_A_PARTY');
  });

  it('propagates NOT_FOUND from the loader', async () => {
    const svc = new JourneyStateService();
    svc.registerLoader('refund', () => ({ code: 'NOT_FOUND' }));
    const out = await svc.resolveJourney('refund', 'R-99', 'sarah');
    expect(out.code).toBe('NOT_FOUND');
  });

  it('supports async loaders', async () => {
    const svc = new JourneyStateService();
    const journey = emptyJourneyState({ kind: 'gift', id: 'G-1' }, { role: 'CUSTOMER', uid: 'sarah' }, 'CREATED');
    svc.registerLoader('gift', async () => ({ code: 'OK', journey }));
    const out = await svc.resolveJourney('gift', 'G-1', 'sarah');
    expect(out.code).toBe('OK');
  });

  it('hasLoader reflects registration state', () => {
    const svc = new JourneyStateService();
    expect(svc.hasLoader('booking')).toBe(false);
    svc.registerLoader('booking', () => ({ code: 'NOT_FOUND' }));
    expect(svc.hasLoader('booking')).toBe(true);
  });

  it('actorUid is forwarded to the loader (used for the NOT_A_PARTY check)', async () => {
    const svc = new JourneyStateService();
    let seen = '';
    svc.registerLoader('pet', ({ actorUid }) => { seen = actorUid; return { code: 'NOT_FOUND' }; });
    await svc.resolveJourney('pet', 'P-1', 'sarah');
    expect(seen).toBe('sarah');
  });
});

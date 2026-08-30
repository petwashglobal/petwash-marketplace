/**
 * AttentionFeedComposer — Program 37.
 */
import { describe, it, expect } from 'vitest';
import {
  composeAttentionFeed,
  type AttentionCandidate,
} from '../services/marketplace/AttentionFeedComposer';

const cand = (over: Partial<AttentionCandidate>): AttentionCandidate => ({
  key: over.key ?? `${over.domain ?? 'BOOKING'}:booking:${over.entityRef?.id ?? 'B-1'}`,
  domain: over.domain ?? 'BOOKING',
  entityRef: over.entityRef ?? { kind: 'booking', id: 'B-1' },
  priority: over.priority ?? 'MEDIUM',
  reasonCode: over.reasonCode ?? 'BOOKING_ACTION',
  isRequired: over.isRequired,
  resolved: over.resolved,
  lastMeaningfulEventAt: over.lastMeaningfulEventAt,
});

describe('AttentionFeedComposer', () => {
  it('sorts URGENT > HIGH > MEDIUM > INFO', () => {
    const out = composeAttentionFeed([
      cand({ key: 'A', priority: 'INFO', entityRef: { kind: 'booking', id: 'A' } }),
      cand({ key: 'B', priority: 'URGENT', entityRef: { kind: 'booking', id: 'B' } }),
      cand({ key: 'C', priority: 'HIGH', entityRef: { kind: 'booking', id: 'C' } }),
      cand({ key: 'D', priority: 'MEDIUM', entityRef: { kind: 'booking', id: 'D' } }),
    ]);
    expect(out.map((c) => c.key)).toEqual(['B', 'C', 'D', 'A']);
  });

  it('drops resolved items', () => {
    const out = composeAttentionFeed([
      cand({ key: 'A', resolved: true }),
      cand({ key: 'B' }),
    ]);
    expect(out.map((c) => c.key)).toEqual(['B']);
  });

  it('de-dups by key — highest-priority candidate wins for the same key', () => {
    const out = composeAttentionFeed([
      cand({ key: 'K', priority: 'INFO' }),
      cand({ key: 'K', priority: 'URGENT' }),
      cand({ key: 'K', priority: 'MEDIUM' }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].priority).toBe('URGENT');
  });

  it('§75 — marketing gets capped to INFO when a REQUIRED obligation exists elsewhere', () => {
    const out = composeAttentionFeed([
      cand({ key: 'M', domain: 'MARKETING', priority: 'URGENT', entityRef: { kind: 'promo', id: 'M' } }),
      cand({ key: 'R', domain: 'BOOKING', priority: 'HIGH', isRequired: true, entityRef: { kind: 'booking', id: 'R' } }),
    ]);
    // Required booking should land above the (now-INFO) marketing.
    expect(out[0].key).toBe('R');
    const m = out.find((c) => c.key === 'M');
    expect(m?.priority).toBe('INFO');
  });

  it('marketing keeps its declared priority when no REQUIRED obligation exists', () => {
    const out = composeAttentionFeed([
      cand({ key: 'M', domain: 'MARKETING', priority: 'HIGH', entityRef: { kind: 'promo', id: 'M' } }),
      cand({ key: 'INFO', domain: 'BOOKING', priority: 'INFO', entityRef: { kind: 'booking', id: 'INFO' } }),
    ]);
    expect(out[0].key).toBe('M');
  });

  it('at same priority, REQUIRED comes before non-REQUIRED', () => {
    const out = composeAttentionFeed([
      cand({ key: 'A', priority: 'HIGH', entityRef: { kind: 'booking', id: 'A' } }),
      cand({ key: 'B', priority: 'HIGH', isRequired: true, entityRef: { kind: 'booking', id: 'B' } }),
    ]);
    expect(out[0].key).toBe('B');
  });

  it('cap at 30 items', () => {
    const many: AttentionCandidate[] = Array.from({ length: 50 }, (_, i) =>
      cand({ key: `K${i}`, entityRef: { kind: 'booking', id: `K${i}` } })
    );
    const out = composeAttentionFeed(many);
    expect(out).toHaveLength(30);
  });
});

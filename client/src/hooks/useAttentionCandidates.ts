/**
 * useAttentionCandidates — client hook that lifts a set of typed
 * attention candidates (bookings, wallet, prestige, k9000, refunds,
 * documents, provider compliance, payout, support) into ONE ordered
 * feed via AttentionFeedComposer.
 *
 * The hook does NOT fetch anything on its own — it accepts a list
 * of candidates the caller has already gathered, composes the feed
 * client-side (deterministic, no network), and exposes it in a
 * shape the renderer can iterate.
 *
 * Kept client-side deliberately: the composition rules live in a
 * shared-with-server pure evaluator so client + server can agree.
 * (Server-fed candidates already carry their priority + reason
 * codes, so the client's own composer just orders them.)
 */
import { useMemo } from 'react';
import type { JourneyPriority } from '@shared/marketplace/journeyState';

export type AttentionDomain =
  | 'BOOKING'
  | 'SHOP'
  | 'PET'
  | 'PROVIDER'
  | 'PRESTIGE'
  | 'K9000'
  | 'EGIFT'
  | 'WALLET'
  | 'PAYOUT'
  | 'SUPPORT'
  | 'DOCUMENT'
  | 'MARKETING';

export interface AttentionCandidate {
  key: string;
  domain: AttentionDomain;
  entityRef: { kind: string; id: string };
  priority: JourneyPriority;
  reasonCode: string;
  isRequired?: boolean;
  resolved?: boolean;
  lastMeaningfulEventAt?: string;
}

const PRIORITY_ORDER: Record<JourneyPriority, number> = {
  URGENT: 0, HIGH: 1, MEDIUM: 2, INFO: 3, NONE: 4,
};
const MAX_ITEMS = 30;

function composeAttentionFeedClient(candidates: AttentionCandidate[]): AttentionCandidate[] {
  const live = candidates.filter((c) => !c.resolved);
  const byKey = new Map<string, AttentionCandidate>();
  for (const c of live) {
    const key = c.key || `${c.domain}:${c.entityRef.kind}:${c.entityRef.id}`;
    const prior = byKey.get(key);
    if (!prior || PRIORITY_ORDER[c.priority] < PRIORITY_ORDER[prior.priority]) {
      byKey.set(key, c);
    }
  }
  const deduped = Array.from(byKey.values());
  const requiredExists = deduped.some((c) => c.isRequired);
  const capped = deduped.map((c) => (c.domain === 'MARKETING' && requiredExists) ? { ...c, priority: 'INFO' as JourneyPriority } : c);
  const sorted = capped.slice().sort((a, b) => {
    const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (p !== 0) return p;
    const ra = a.isRequired ? 0 : 1;
    const rb = b.isRequired ? 0 : 1;
    if (ra !== rb) return ra - rb;
    const ta = a.lastMeaningfulEventAt ? Date.parse(a.lastMeaningfulEventAt) : 0;
    const tb = b.lastMeaningfulEventAt ? Date.parse(b.lastMeaningfulEventAt) : 0;
    return tb - ta;
  });
  return sorted.slice(0, MAX_ITEMS);
}

export function useAttentionCandidates(candidates: AttentionCandidate[]): AttentionCandidate[] {
  return useMemo(() => composeAttentionFeedClient(candidates), [candidates]);
}

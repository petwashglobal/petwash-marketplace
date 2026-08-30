/**
 * AttentionFeedComposer — CEO PROGRAM 37 (One Attention Feed).
 *
 * Pure evaluator. Given a bundle of attention candidates across
 * every domain (bookings, wallet, eGift, Prestige, Shop, K9000,
 * refunds, documents, provider compliance, payout, support), returns
 * ONE ordered feed applying the doctrine's priority + de-dup rules.
 *
 * Rules:
 *   § URGENT > HIGH > MEDIUM > INFO (§74).
 *   § REQUIRED obligations outrank marketing (§75) — the composer
 *     will never place a marketing attention above a REQUIRED item.
 *   § Attention disappears when the underlying condition resolves —
 *     candidates carry a `resolved` flag; resolved candidates are
 *     dropped from the output.
 *   § De-dup: at most ONE attention per (domain, entityRef) — the
 *     highest-priority candidate for each key wins.
 */
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
  key: string;                                         // stable id (domain + entityRef)
  domain: AttentionDomain;
  entityRef: { kind: string; id: string };
  priority: JourneyPriority;
  reasonCode: string;                                  // stable slug
  isRequired?: boolean;                                // reflects §75 discipline
  resolved?: boolean;
  lastMeaningfulEventAt?: string;                      // ISO
}

const PRIORITY_ORDER: Record<JourneyPriority, number> = {
  URGENT: 0, HIGH: 1, MEDIUM: 2, INFO: 3, NONE: 4,
};

/** Feed length cap. Beyond this the tail is truncated. */
const MAX_ITEMS = 30;

export function composeAttentionFeed(candidates: AttentionCandidate[]): AttentionCandidate[] {
  // Drop resolved.
  const live = candidates.filter((c) => !c.resolved);

  // De-dup by (domain, entityRef.kind + id) — highest-priority wins.
  const byKey = new Map<string, AttentionCandidate>();
  for (const c of live) {
    const key = c.key || `${c.domain}:${c.entityRef.kind}:${c.entityRef.id}`;
    const prior = byKey.get(key);
    if (!prior || PRIORITY_ORDER[c.priority] < PRIORITY_ORDER[prior.priority]) {
      byKey.set(key, c);
    }
  }
  const deduped = Array.from(byKey.values());

  // §75 — a MARKETING candidate never outranks a REQUIRED obligation
  // no matter its declared priority. Force marketing to at most INFO.
  const requiredExists = deduped.some((c) => c.isRequired);
  const capped = deduped.map((c) => {
    if (c.domain === 'MARKETING' && requiredExists) {
      return { ...c, priority: 'INFO' as JourneyPriority };
    }
    return c;
  });

  // Sort: priority asc, REQUIRED before non-REQUIRED at same priority,
  // most recent event first.
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

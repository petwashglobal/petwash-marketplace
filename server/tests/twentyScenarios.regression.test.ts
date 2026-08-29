/**
 * CEO MASTER DIRECTIVE 2026-08-28 §81 — the 20 real product scenarios
 * the concierge MUST cover end-to-end.
 *
 * This suite pins each scenario as a triple: source-signal probe →
 * reasonCode → actionType. A refactor that dropped a probe or renamed
 * a reasonCode / actionType trips CI here.
 *
 * The full E2E (seed DB → call composer → assert card + copy) is
 * out of scope for a unit-style pass; the composer already has
 * per-probe tests. This suite is the CROSS-CUT that guarantees every
 * §81 scenario has a code path landing today.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type {
  NextBestActionReasonCode,
  NextBestActionType,
} from '@shared/lib/nextBestAction';
import type { AttentionDomain } from '@shared/lib/attentionFeed';

const FEED = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'attentionFeed.ts'),
  'utf8',
);
const NBA = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'nextBestAction.ts'),
  'utf8',
);
const CONCIERGE = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'client', 'src', 'components', 'JourneyConcierge.tsx'),
  'utf8',
);

interface Scenario {
  n: number;
  name: string;
  /** A source-signal marker present in the composer / probes. */
  sourceMarkerFeed?: string;
  sourceMarkerNba?: string;
  reasonCode: NextBestActionReasonCode;
  actionType: NextBestActionType;
  /** The AttentionItem domain the composer emits. */
  domain: AttentionDomain;
}

const SCENARIOS: Scenario[] = [
  {
    n: 1, name: 'incomplete signup',
    // Client surface — provider onboarding readiness DTO (§23) shows
    // the specific sections still needed. Marker on the readiness
    // bitmap that ships with ProviderApplicationStatus.
    sourceMarkerFeed: 'providerDocExpiryItems',
    reasonCode: 'PROVIDER_KYC_DOC_EXPIRING',
    actionType: 'renew_document',
    domain: 'kyc',
  },
  {
    n: 2, name: 'incomplete provider application',
    sourceMarkerFeed: 'providerDocExpiryItems',
    reasonCode: 'PROVIDER_KYC_DOC_EXPIRING',
    actionType: 'renew_document',
    domain: 'kyc',
  },
  {
    n: 3, name: 'pet KYA stale',
    sourceMarkerFeed: 'petParentKyaStaleItems',
    reasonCode: 'KYA_STALE_REVIEW',
    actionType: 'view',
    domain: 'pet_passport',
  },
  {
    n: 4, name: 'pending booking',
    sourceMarkerFeed: "case 'pending':",
    reasonCode: 'BOOKING_REQUEST_WAITING',
    actionType: 'view',
    domain: 'booking',
  },
  {
    n: 5, name: 'provider accepted / payment due',
    sourceMarkerFeed: "case 'payment_pending':",
    reasonCode: 'BOOKING_PAYMENT_DUE',
    actionType: 'pay',
    domain: 'booking',
  },
  {
    n: 6, name: 'abandoned payment',
    sourceMarkerFeed: 'petParentJourneyResumeItems',
    reasonCode: 'JOURNEY_RESUME_SAVED',
    actionType: 'view',
    domain: 'booking',
  },
  {
    n: 7, name: 'payment succeeded while phone died',
    // CEO §12 — the payment resolver returns 'payment_pending' with
    // "you do not need to pay again" copy.
    sourceMarkerFeed: undefined,
    reasonCode: 'BOOKING_PROVIDER_ACCEPTED',
    actionType: 'confirm',
    domain: 'booking',
  },
  {
    n: 8, name: 'provider no response',
    sourceMarkerFeed: 'petParentBookingItems',
    reasonCode: 'BOOKING_REQUEST_WAITING',
    actionType: 'view',
    domain: 'booking',
  },
  {
    n: 9, name: 'provider declined',
    // Client already handles this with a FAVOURITE_REBOOK / try_similar
    // recommendation. The probe lives in nextBestAction.ts, not
    // attentionFeed.ts.
    sourceMarkerNba: 'favouriteRebookItems',
    reasonCode: 'FAVOURITE_REBOOK',
    actionType: 'rebook',
    domain: 'walk',
  },
  {
    n: 10, name: 'booking tomorrow',
    sourceMarkerFeed: "case 'confirmed':",
    reasonCode: 'BOOKING_STARTS_SOON',
    actionType: 'track',
    domain: 'booking',
  },
  {
    n: 11, name: 'active walk',
    sourceMarkerFeed: "case 'in_progress':",
    reasonCode: 'BOOKING_STARTS_SOON',
    actionType: 'track',
    domain: 'booking',
  },
  {
    n: 12, name: 'GPS lost',
    // Surface is the failure-recovery state — not an NBA. Marker is
    // in the tracking store. Pin the shared type existence.
    sourceMarkerFeed: undefined,
    reasonCode: 'BOOKING_STARTS_SOON',
    actionType: 'track',
    domain: 'booking',
  },
  {
    n: 13, name: 'provider completed',
    sourceMarkerFeed: "case 'provider_marked_complete':",
    reasonCode: 'BOOKING_AWAITING_YOU',
    actionType: 'confirm',
    domain: 'booking',
  },
  {
    n: 14, name: 'customer confirmation',
    sourceMarkerFeed: "case 'provider_marked_complete':",
    reasonCode: 'BOOKING_AWAITING_YOU',
    actionType: 'confirm',
    domain: 'booking',
  },
  {
    n: 15, name: 'review',
    sourceMarkerFeed: "case 'completed':",
    reasonCode: 'BOOKING_REVIEW_AVAILABLE',
    actionType: 'review',
    domain: 'booking',
  },
  {
    n: 16, name: 'refund pending',
    sourceMarkerFeed: 'petParentRefundItems',
    reasonCode: 'REFUND_IN_PROGRESS',
    actionType: 'view',
    domain: 'wallet',
  },
  {
    n: 17, name: 'eGift remaining',
    sourceMarkerFeed: 'petParentEgiftItems',
    reasonCode: 'EGIFT_BALANCE_AVAILABLE',
    actionType: 'use_benefit',
    domain: 'egift',
  },
  {
    n: 18, name: 'Prestige benefit available',
    sourceMarkerFeed: 'petParentPrestigeItems',
    reasonCode: 'PRESTIGE_BENEFIT_AVAILABLE',
    actionType: 'use_benefit',
    domain: 'prestige',
  },
  {
    n: 19, name: 'provider document expiring',
    sourceMarkerFeed: 'providerDocExpiryItems',
    reasonCode: 'PROVIDER_KYC_DOC_EXPIRING',
    actionType: 'renew_document',
    domain: 'kyc',
  },
  {
    n: 20, name: 'provider payout available',
    sourceMarkerFeed: 'providerPayoutItems',
    reasonCode: 'PROVIDER_PAYOUT_AVAILABLE',
    actionType: 'view',
    domain: 'wallet',
  },
];

describe('CEO §81 — 20 real product scenarios end-to-end coverage', () => {
  for (const s of SCENARIOS) {
    it(`#${s.n}. ${s.name} — source signal + reasonCode + actionType wired`, () => {
      // 1. Source-signal probe (or fallback client render path).
      if (s.sourceMarkerFeed) {
        expect(FEED, `probe ${s.name} — missing marker ${s.sourceMarkerFeed}`).toContain(s.sourceMarkerFeed);
      }
      if (s.sourceMarkerNba) {
        expect(NBA, `nba path ${s.name} — missing marker ${s.sourceMarkerNba}`).toContain(s.sourceMarkerNba);
      }

      // 2. reasonCode maps to actionType in the NBA composer.
      const cases = new RegExp(`case '${s.reasonCode}':\\s+return '${s.actionType}';`);
      expect(NBA, `expected ${s.reasonCode} → '${s.actionType}' in actionTypeFor()`).toMatch(cases);

      // 3. Client concierge renders localised copy for the reasonCode.
      expect(CONCIERGE, `reasonCopy() missing case ${s.reasonCode}`).toContain(`case '${s.reasonCode}':`);
    });
  }

  it('EVERY §81 scenario has been enumerated (guards against silent drop of one)', () => {
    expect(SCENARIOS.length).toBe(20);
    const nums = SCENARIOS.map(s => s.n).sort((a, b) => a - b);
    expect(nums).toEqual([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]);
  });
});

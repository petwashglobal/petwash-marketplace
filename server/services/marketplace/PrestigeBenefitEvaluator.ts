/**
 * PrestigeBenefitEvaluator — CEO PROGRAM 20 (Prestige).
 *
 * Pure evaluator. Doctrine:
 *   § Prestige is CAPABILITY not workspace (§21).
 *   § Prestige benefits apply when the same human acts as CUSTOMER
 *     if eligible.
 *   § Do NOT alter provider earnings because the provider happens
 *     to have Prestige — the benefit belongs to the customer leg
 *     only.
 *
 * The evaluator answers: given the actor's Prestige tier and the
 * context (they're acting as CUSTOMER vs PROVIDER), which
 * benefits apply to THIS transaction?
 */

export type PrestigeTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'NONE';

export type ActorLeg = 'CUSTOMER' | 'PROVIDER';

export type BenefitCode =
  | 'FREE_WASH_PER_MONTH'
  | 'DISCOUNT_PCT'
  | 'PRIORITY_SUPPORT'
  | 'CONCIERGE_ACCESS'
  | 'BIRTHDAY_GIFT';

export interface AppliedBenefit {
  code: BenefitCode;
  valueNumeric?: number;
  valueUnit?: 'PCT' | 'COUNT_PER_MONTH' | 'FLAG';
  reasonCode: string;
}

const TIER_BENEFITS: Record<PrestigeTier, AppliedBenefit[]> = {
  NONE: [],
  BRONZE: [
    { code: 'DISCOUNT_PCT', valueNumeric: 5, valueUnit: 'PCT', reasonCode: 'PRESTIGE_BRONZE_DISCOUNT' },
  ],
  SILVER: [
    { code: 'DISCOUNT_PCT', valueNumeric: 8, valueUnit: 'PCT', reasonCode: 'PRESTIGE_SILVER_DISCOUNT' },
    { code: 'PRIORITY_SUPPORT', valueUnit: 'FLAG', reasonCode: 'PRESTIGE_SILVER_SUPPORT' },
    { code: 'BIRTHDAY_GIFT', valueUnit: 'FLAG', reasonCode: 'PRESTIGE_BIRTHDAY' },
  ],
  GOLD: [
    { code: 'DISCOUNT_PCT', valueNumeric: 12, valueUnit: 'PCT', reasonCode: 'PRESTIGE_GOLD_DISCOUNT' },
    { code: 'PRIORITY_SUPPORT', valueUnit: 'FLAG', reasonCode: 'PRESTIGE_GOLD_SUPPORT' },
    { code: 'FREE_WASH_PER_MONTH', valueNumeric: 1, valueUnit: 'COUNT_PER_MONTH', reasonCode: 'PRESTIGE_GOLD_FREE_WASH' },
    { code: 'BIRTHDAY_GIFT', valueUnit: 'FLAG', reasonCode: 'PRESTIGE_BIRTHDAY' },
  ],
  PLATINUM: [
    { code: 'DISCOUNT_PCT', valueNumeric: 15, valueUnit: 'PCT', reasonCode: 'PRESTIGE_PLATINUM_DISCOUNT' },
    { code: 'PRIORITY_SUPPORT', valueUnit: 'FLAG', reasonCode: 'PRESTIGE_PLATINUM_SUPPORT' },
    { code: 'FREE_WASH_PER_MONTH', valueNumeric: 2, valueUnit: 'COUNT_PER_MONTH', reasonCode: 'PRESTIGE_PLATINUM_FREE_WASH' },
    { code: 'CONCIERGE_ACCESS', valueUnit: 'FLAG', reasonCode: 'PRESTIGE_PLATINUM_CONCIERGE' },
    { code: 'BIRTHDAY_GIFT', valueUnit: 'FLAG', reasonCode: 'PRESTIGE_BIRTHDAY' },
  ],
};

export interface BenefitInput {
  tier: PrestigeTier;
  actorLeg: ActorLeg;
}

/**
 * Returns the applicable benefits for THIS transaction. Provider
 * leg always returns [] — doctrine forbids altering provider
 * earnings based on the provider's own Prestige tier.
 */
export function benefitsForContext(input: BenefitInput): AppliedBenefit[] {
  if (input.actorLeg === 'PROVIDER') return [];
  if (input.tier === 'NONE') return [];
  return TIER_BENEFITS[input.tier] ?? [];
}

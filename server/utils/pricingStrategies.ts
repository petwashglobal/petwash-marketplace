/**
 * 🏆 MICROSOFT-STYLE PRICING STRATEGIES
 * Flexible pricing models for Pet Wash™ enterprise platform
 * Adopted from Microsoft Azure's usage-based pricing approach
 */

export interface PricingTier {
  id: string;
  name: string;
  type: 'pay_per_use' | 'monthly_unlimited' | 'corporate_bulk' | 'franchise_volume';
  basePrice: number;
  currency: 'ILS' | 'USD' | 'EUR';
  features: string[];
  savings?: string;
  targetCustomer: string;
}

/**
 * Microsoft-inspired pricing tiers
 * Pay-as-you-go, Reserved Instances, and Enterprise Agreements
 */
export const PRICING_TIERS: PricingTier[] = [
  {
    id: 'payg',
    name: 'Pay Per Wash',
    type: 'pay_per_use',
    basePrice: 15,
    currency: 'ILS',
    features: [
      'No subscription required',
      'Pay only when you use',
      'Perfect for occasional users',
      'Access to all K9000 stations',
      'Basic loyalty points (1x)',
    ],
    targetCustomer: 'Occasional users, travelers, trial customers',
  },
  {
    id: 'unlimited',
    name: 'Monthly Unlimited',
    type: 'monthly_unlimited',
    basePrice: 99,
    currency: 'ILS',
    features: [
      'Unlimited K9000 washes',
      'Break-even at 7 washes/month',
      'Priority booking',
      'Double loyalty points (2x)',
      'Access to exclusive stations',
      'Pet Care Concierge support',
    ],
    savings: 'Save up to 40% vs pay-per-wash',
    targetCustomer: 'Heavy users, multi-pet families, pet enthusiasts',
  },
  {
    id: 'corporate',
    name: 'Corporate Package',
    type: 'corporate_bulk',
    basePrice: 500,
    currency: 'ILS',
    features: [
      '100 wash credits per month',
      'Bulk discount pricing',
      'Dedicated account manager',
      'Custom billing terms',
      'API access for automation',
      'White-label option',
      'Premium support SLA',
    ],
    savings: 'Up to 60% off retail pricing',
    targetCustomer: 'Pet grooming salons, veterinary clinics, pet daycare centers',
  },
  {
    id: 'franchise',
    name: 'Franchise Volume Tier',
    type: 'franchise_volume',
    basePrice: 2000,
    currency: 'ILS',
    features: [
      '500 wash credits per month',
      'Multi-location support',
      'Real-time franchise dashboard',
      'Centralized billing',
      'Franchisee training portal',
      'Quality audit tools',
      'Supply chain integration',
    ],
    savings: 'Volume pricing + franchise support',
    targetCustomer: 'Pet Wash™ franchisees with multiple stations',
  },
];

/**
 * Calculate dynamic pricing based on usage patterns
 * Microsoft-style smart recommendations
 */
export function recommendPricingTier(monthlyUsage: number): {
  recommended: PricingTier;
  reasoning: string;
  potentialSavings: number;
} {
  const payPerWashCost = monthlyUsage * 15;

  if (monthlyUsage <= 6) {
    return {
      recommended: PRICING_TIERS[0],
      reasoning: 'Pay-per-wash is most economical for your usage pattern',
      potentialSavings: 0,
    };
  }

  if (monthlyUsage >= 7 && monthlyUsage <= 30) {
    const savings = payPerWashCost - 99;
    return {
      recommended: PRICING_TIERS[1],
      reasoning: `You'll save ₪${savings.toFixed(0)} per month with Unlimited plan`,
      potentialSavings: savings,
    };
  }

  if (monthlyUsage > 30) {
    const creditsNeeded = Math.ceil(monthlyUsage / 100) * 100;
    const corporateCost = (creditsNeeded / 100) * 500;
    const savings = payPerWashCost - corporateCost;
    return {
      recommended: PRICING_TIERS[2],
      reasoning: `Corporate package saves ₪${savings.toFixed(0)} for your volume`,
      potentialSavings: savings,
    };
  }

  return {
    recommended: PRICING_TIERS[0],
    reasoning: 'Default recommendation',
    potentialSavings: 0,
  };
}

/**
 * Smart retry logic for failed payments (Stripe-inspired)
 * Automatic retry with exponential backoff
 */
export function getPaymentRetrySchedule(attemptNumber: number): {
  retryAt: Date;
  delayHours: number;
} {
  // Stripe's smart retry pattern: 1 day, 3 days, 5 days, 7 days
  const retryDelays = [24, 72, 120, 168]; // hours
  const delayHours = retryDelays[Math.min(attemptNumber, retryDelays.length - 1)];

  const retryAt = new Date();
  retryAt.setHours(retryAt.getHours() + delayHours);

  return { retryAt, delayHours };
}

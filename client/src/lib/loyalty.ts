// ⁦PetWash™⁩ Premium Loyalty System
// 7-Tier calculation and reward logic (aligned with shared/schema-loyalty.ts canonical source)

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'emerald' | 'royal';

export interface TierConfig {
  tier: LoyaltyTier;
  minWashes: number;
  maxWashes: number | null;
  discount: number;
  color: {
    light: string;
    dark: string;
    gradient: string;
  };
  perks: readonly string[];
  badge: string;
}

export interface TierProgress {
  currentTier: LoyaltyTier;
  currentWashes: number;
  nextTier: LoyaltyTier | null;
  nextTierAt: number | null;
  progressPercentage: number;
  washesUntilNext: number | null;
}

export const TIER_PERKS = {
  bronze: ['perk_5_discount', 'perk_welcome_bonus', 'perk_pet_profile', 'perk_email_notifications'],
  silver: ['perk_6_discount', 'perk_priority_booking', 'perk_birthday_bonus', 'perk_sms_notifications'],
  gold: ['perk_7_discount', 'perk_priority_247', 'perk_birthday_bonus', 'perk_early_access_products', 'perk_premium_shampoo', 'perk_free_wash_yearly'],
  platinum: ['perk_8_discount', 'perk_vip_priority', 'perk_birthday_bonus', 'perk_early_access_events', 'perk_premium_shampoo', 'perk_exclusive_access'],
  diamond: ['perk_9_discount', 'perk_vip_priority', 'perk_birthday_bonus', 'perk_exclusive_events', 'perk_premium_shampoo', 'perk_2_free_washes_yearly'],
  emerald: ['perk_10_discount', 'perk_concierge', 'perk_birthday_bonus', 'perk_account_manager', 'perk_3_free_washes_yearly'],
  royal: ['perk_15_discount', 'perk_vip_concierge', 'perk_birthday_bonus', 'perk_account_manager', 'perk_6_free_washes_yearly', 'perk_exclusive_vip']
} as const;

const TIER_ORDER: LoyaltyTier[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'emerald', 'royal'];

export const TIER_CONFIG: Record<LoyaltyTier, TierConfig> = {
  bronze: {
    tier: 'bronze',
    minWashes: 0,
    maxWashes: 4,
    discount: 5,
    color: {
      light: '#FDE68A',
      dark: '#CD7F32',
      gradient: 'linear-gradient(135deg, #FDE68A 0%, #CD7F32 100%)'
    },
    perks: TIER_PERKS.bronze,
    badge: '🥉'
  },
  silver: {
    tier: 'silver',
    minWashes: 5,
    maxWashes: 14,
    discount: 6,
    color: {
      light: '#E0E0E0',
      dark: '#9E9E9E',
      gradient: 'linear-gradient(135deg, #E0E0E0 0%, #9E9E9E 100%)'
    },
    perks: TIER_PERKS.silver,
    badge: '🥈'
  },
  gold: {
    tier: 'gold',
    minWashes: 15,
    maxWashes: 29,
    discount: 7,
    color: {
      light: '#FEF3C7',
      dark: '#FBBF24',
      gradient: 'linear-gradient(135deg, #FEF3C7 0%, #FBBF24 100%)'
    },
    perks: TIER_PERKS.gold,
    badge: '🥇'
  },
  platinum: {
    tier: 'platinum',
    minWashes: 30,
    maxWashes: 49,
    discount: 8,
    color: {
      light: '#E5E7EB',
      dark: '#9CA3AF',
      gradient: 'linear-gradient(135deg, #E5E7EB 0%, #9CA3AF 100%)'
    },
    perks: TIER_PERKS.platinum,
    badge: '💎'
  },
  diamond: {
    tier: 'diamond',
    minWashes: 50,
    maxWashes: 79,
    discount: 9,
    color: {
      light: '#DBEAFE',
      dark: '#3B82F6',
      gradient: 'linear-gradient(135deg, #DBEAFE 0%, #3B82F6 100%)'
    },
    perks: TIER_PERKS.diamond,
    badge: '💠'
  },
  emerald: {
    tier: 'emerald',
    minWashes: 80,
    maxWashes: 99,
    discount: 10,
    color: {
      light: '#D1FAE5',
      dark: '#10B981',
      gradient: 'linear-gradient(135deg, #D1FAE5 0%, #10B981 100%)'
    },
    perks: TIER_PERKS.emerald,
    badge: '💚'
  },
  royal: {
    tier: 'royal',
    minWashes: 100,
    maxWashes: null,
    discount: 15,
    color: {
      light: '#EDE9FE',
      dark: '#8B5CF6',
      gradient: 'linear-gradient(135deg, #EDE9FE 0%, #8B5CF6 100%)'
    },
    perks: TIER_PERKS.royal,
    badge: '👑'
  }
};

function sanitizeWashes(washes: number | null | undefined): number {
  if (washes == null || isNaN(washes) || washes < 0) {
    return 0;
  }
  return Math.floor(washes);
}

export function calculateTier(washes: number): LoyaltyTier {
  const sanitized = sanitizeWashes(washes);
  if (sanitized >= 100) return 'royal';
  if (sanitized >= 80) return 'emerald';
  if (sanitized >= 50) return 'diamond';
  if (sanitized >= 30) return 'platinum';
  if (sanitized >= 15) return 'gold';
  if (sanitized >= 5) return 'silver';
  return 'bronze';
}

export function getTierProgress(washes: number): TierProgress {
  const sanitizedWashes = sanitizeWashes(washes);
  const currentTier = calculateTier(sanitizedWashes);
  const currentConfig = TIER_CONFIG[currentTier];
  const currentIndex = TIER_ORDER.indexOf(currentTier);
  
  let nextTier: LoyaltyTier | null = null;
  let nextTierAt: number | null = null;
  let washesUntilNext: number | null = null;
  let progressPercentage = 0;

  if (currentIndex < TIER_ORDER.length - 1) {
    nextTier = TIER_ORDER[currentIndex + 1];
    const nextConfig = TIER_CONFIG[nextTier];
    nextTierAt = nextConfig.minWashes;
    washesUntilNext = Math.max(0, nextTierAt - sanitizedWashes);
    const range = nextConfig.minWashes - currentConfig.minWashes;
    const progress = sanitizedWashes - currentConfig.minWashes;
    progressPercentage = range > 0 ? (progress / range) * 100 : 0;
  } else {
    progressPercentage = 100;
  }

  return {
    currentTier,
    currentWashes: sanitizedWashes,
    nextTier,
    nextTierAt,
    progressPercentage: Math.max(0, Math.min(progressPercentage, 100)),
    washesUntilNext
  };
}

export function getTierConfig(tier: LoyaltyTier): TierConfig {
  return TIER_CONFIG[tier];
}

export function getTierDisplay(tier: LoyaltyTier, language: 'en' | 'he'): string {
  const displays: Record<LoyaltyTier, { en: string; he: string }> = {
    bronze: { en: 'Bronze', he: 'ברונזה' },
    silver: { en: 'Silver', he: 'כסף' },
    gold: { en: 'Gold', he: 'זהב' },
    platinum: { en: 'Platinum', he: 'פלטינום' },
    diamond: { en: 'Diamond', he: 'יהלום' },
    emerald: { en: 'Emerald', he: 'אמרלד' },
    royal: { en: 'Royal', he: 'מלכותי' }
  };
  
  return displays[tier][language];
}

export function calculatePointsValue(washes: number, avgWashCost: number = 50): number {
  const sanitizedWashes = sanitizeWashes(washes);
  const tier = calculateTier(sanitizedWashes);
  const discount = TIER_CONFIG[tier].discount;
  return Math.max(0, sanitizedWashes * avgWashCost * (discount / 100));
}

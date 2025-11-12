// PetWash™ Premium Loyalty System
// Tier calculation and reward logic

export type LoyaltyTier = 'new' | 'silver' | 'gold' | 'platinum';

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

// Bilingual perk keys - actual translations happen in the component
export const TIER_PERKS = {
  new: ['perk_welcome_bonus', 'perk_pet_profile', 'perk_email_notifications'],
  silver: ['perk_10_discount', 'perk_priority_booking', 'perk_birthday_bonus', 'perk_sms_notifications'],
  gold: ['perk_15_discount', 'perk_priority_247', 'perk_birthday_bonus', 'perk_early_access_products', 'perk_premium_shampoo'],
  platinum: ['perk_20_discount', 'perk_vip_priority', 'perk_birthday_bonus', 'perk_early_access_events', 'perk_premium_shampoo', 'perk_exclusive_vip', 'perk_account_manager']
} as const;

export const TIER_CONFIG: Record<LoyaltyTier, TierConfig> = {
  new: {
    tier: 'new',
    minWashes: 0,
    maxWashes: 2,
    discount: 0,
    color: {
      light: '#E3F2FD',
      dark: '#2196F3',
      gradient: 'linear-gradient(135deg, #E3F2FD 0%, #2196F3 100%)'
    },
    perks: TIER_PERKS.new,
    badge: '🌟'
  },
  silver: {
    tier: 'silver',
    minWashes: 3,
    maxWashes: 9,
    discount: 10,
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
    minWashes: 10,
    maxWashes: 24,
    discount: 15,
    color: {
      light: '#E0F2FE',
      dark: '#0EA5E9',
      gradient: 'linear-gradient(135deg, #7DD3FC 0%, #0EA5E9 100%)'
    },
    perks: TIER_PERKS.gold,
    badge: '🥇'
  },
  platinum: {
    tier: 'platinum',
    minWashes: 25,
    maxWashes: null,
    discount: 20,
    color: {
      light: '#F3E5F5',
      dark: '#7B1FA2',
      gradient: 'linear-gradient(135deg, #F3E5F5 0%, #7B1FA2 100%)'
    },
    perks: TIER_PERKS.platinum,
    badge: '💎'
  }
};

// Sanitize wash count to prevent negative/NaN values
function sanitizeWashes(washes: number | null | undefined): number {
  if (washes == null || isNaN(washes) || washes < 0) {
    return 0;
  }
  return Math.floor(washes);
}

export function calculateTier(washes: number): LoyaltyTier {
  const sanitized = sanitizeWashes(washes);
  if (sanitized >= 25) return 'platinum';
  if (sanitized >= 10) return 'gold';
  if (sanitized >= 3) return 'silver';
  return 'new';
}

export function getTierProgress(washes: number): TierProgress {
  const sanitizedWashes = sanitizeWashes(washes);
  const currentTier = calculateTier(sanitizedWashes);
  const currentConfig = TIER_CONFIG[currentTier];
  
  let nextTier: LoyaltyTier | null = null;
  let nextTierAt: number | null = null;
  let washesUntilNext: number | null = null;
  let progressPercentage = 0;

  if (currentTier === 'new') {
    nextTier = 'silver';
    nextTierAt = TIER_CONFIG.silver.minWashes;
    washesUntilNext = Math.max(0, nextTierAt - sanitizedWashes);
    progressPercentage = (sanitizedWashes / nextTierAt) * 100;
  } else if (currentTier === 'silver') {
    nextTier = 'gold';
    nextTierAt = TIER_CONFIG.gold.minWashes;
    washesUntilNext = Math.max(0, nextTierAt - sanitizedWashes);
    const range = TIER_CONFIG.gold.minWashes - TIER_CONFIG.silver.minWashes;
    const progress = sanitizedWashes - TIER_CONFIG.silver.minWashes;
    progressPercentage = (progress / range) * 100;
  } else if (currentTier === 'gold') {
    nextTier = 'platinum';
    nextTierAt = TIER_CONFIG.platinum.minWashes;
    washesUntilNext = Math.max(0, nextTierAt - sanitizedWashes);
    const range = TIER_CONFIG.platinum.minWashes - TIER_CONFIG.gold.minWashes;
    const progress = sanitizedWashes - TIER_CONFIG.gold.minWashes;
    progressPercentage = (progress / range) * 100;
  } else {
    // Platinum - max tier
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
    new: { en: 'New Member', he: 'חבר חדש' },
    silver: { en: 'Silver', he: 'כסף' },
    gold: { en: 'Gold', he: 'זהב' },
    platinum: { en: 'Platinum', he: 'פלטינום' }
  };
  
  return displays[tier][language];
}

export function calculatePointsValue(washes: number, avgWashCost: number = 50): number {
  const sanitizedWashes = sanitizeWashes(washes);
  const tier = calculateTier(sanitizedWashes);
  const discount = TIER_CONFIG[tier].discount;
  return Math.max(0, sanitizedWashes * avgWashCost * (discount / 100));
}

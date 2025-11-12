/**
 * 🏆 PREMIUM LOYALTY ENGINE
 * 
 * World-class loyalty system with AI-powered personalization, gamification,
 * and multi-dimensional rewards. Inspired by Apple, Tesla, and Airbnb.
 */

import { TIER_CONFIGS, type TierConfig } from '@/../../shared/schema-loyalty';

// ========================================
// TIER MANAGEMENT
// ========================================

/**
 * Get tier configuration by ID
 */
export function getTierConfig(tierId: string): TierConfig | undefined {
  return TIER_CONFIGS.find(t => t.id === tierId);
}

/**
 * Get next tier based on current tier
 */
export function getNextTier(currentTierId: string): TierConfig | null {
  const currentIndex = TIER_CONFIGS.findIndex(t => t.id === currentTierId);
  if (currentIndex === -1 || currentIndex === TIER_CONFIGS.length - 1) {
    return null; // Already at highest tier
  }
  return TIER_CONFIGS[currentIndex + 1];
}

/**
 * Calculate tier from lifetime points
 */
export function calculateTier(lifetimePoints: number): TierConfig {
  // Find highest tier that user qualifies for
  for (let i = TIER_CONFIGS.length - 1; i >= 0; i--) {
    if (lifetimePoints >= TIER_CONFIGS[i].threshold) {
      return TIER_CONFIGS[i];
    }
  }
  return TIER_CONFIGS[0]; // Default to lowest tier
}

/**
 * Calculate progress to next tier
 */
export function calculateTierProgress(lifetimePoints: number): {
  currentTier: TierConfig;
  nextTier: TierConfig | null;
  progress: number; // 0-100
  pointsNeeded: number;
} {
  const currentTier = calculateTier(lifetimePoints);
  const nextTier = getNextTier(currentTier.id);
  
  if (!nextTier) {
    return {
      currentTier,
      nextTier: null,
      progress: 100,
      pointsNeeded: 0,
    };
  }
  
  const pointsInCurrentTier = lifetimePoints - currentTier.threshold;
  const pointsNeededForNext = nextTier.threshold - currentTier.threshold;
  const progress = Math.min(100, (pointsInCurrentTier / pointsNeededForNext) * 100);
  const pointsNeeded = nextTier.threshold - lifetimePoints;
  
  return {
    currentTier,
    nextTier,
    progress,
    pointsNeeded,
  };
}

// ========================================
// POINTS CALCULATION
// ========================================

/**
 * Calculate points earned from a wash
 */
export function calculateWashPoints(washAmount: number, tier: string): number {
  const tierConfig = getTierConfig(tier);
  if (!tierConfig) return 0;
  
  // Base: 1 point per 1 ILS spent
  const basePoints = Math.floor(washAmount);
  
  // Apply tier multiplier
  const multipliedPoints = Math.floor(basePoints * tierConfig.benefits.pointsMultiplier);
  
  return multipliedPoints;
}

/**
 * Calculate XP earned from a wash
 */
export function calculateWashXP(washAmount: number, isFirstWashToday: boolean): number {
  // Base XP: 10 XP per wash
  let xp = 10;
  
  // Bonus for higher-value washes
  if (washAmount >= 100) xp += 5;
  if (washAmount >= 200) xp += 10;
  
  // Daily first wash bonus
  if (isFirstWashToday) xp += 15;
  
  return xp;
}

/**
 * Calculate level from XP
 */
export function calculateLevel(xp: number): number {
  // Progressive XP requirements: Level N requires N * 100 XP
  // Level 1: 0 XP
  // Level 2: 100 XP
  // Level 3: 200 XP (total 300)
  // Level 4: 300 XP (total 600)
  // etc.
  
  let level = 1;
  let totalXpNeeded = 0;
  
  while (xp >= totalXpNeeded + (level * 100)) {
    totalXpNeeded += level * 100;
    level++;
  }
  
  return level;
}

/**
 * Calculate XP needed for next level
 */
export function calculateXPForNextLevel(currentLevel: number): number {
  return currentLevel * 100;
}

/**
 * Calculate XP progress to next level
 */
export function calculateLevelProgress(xp: number): {
  level: number;
  xpInCurrentLevel: number;
  xpNeededForNext: number;
  progress: number; // 0-100
} {
  const level = calculateLevel(xp);
  
  // Calculate total XP required to reach current level
  let totalXpToCurrentLevel = 0;
  for (let i = 1; i < level; i++) {
    totalXpToCurrentLevel += i * 100;
  }
  
  const xpInCurrentLevel = xp - totalXpToCurrentLevel;
  const xpNeededForNext = calculateXPForNextLevel(level);
  const progress = (xpInCurrentLevel / xpNeededForNext) * 100;
  
  return {
    level,
    xpInCurrentLevel,
    xpNeededForNext,
    progress,
  };
}

// ========================================
// STREAK MANAGEMENT
// ========================================

/**
 * Calculate streak bonus multiplier
 */
export function calculateStreakBonus(streakDays: number): number {
  if (streakDays < 3) return 1.0;
  if (streakDays < 7) return 1.1; // 10% bonus
  if (streakDays < 14) return 1.25; // 25% bonus
  if (streakDays < 30) return 1.5; // 50% bonus
  return 2.0; // 100% bonus for 30+ day streaks!
}

/**
 * Get streak milestone rewards
 */
export function getStreakMilestoneReward(streakDays: number): {
  isMilestone: boolean;
  points?: number;
  badgeCode?: string;
  message?: string;
} {
  const milestones = [
    { days: 3, points: 50, badgeCode: 'streak_3', message: '3-day streak! Keep it up!' },
    { days: 7, points: 150, badgeCode: 'streak_7', message: 'Weekly Warrior! 🔥' },
    { days: 14, points: 300, badgeCode: 'streak_14', message: 'Two weeks strong!' },
    { days: 30, points: 1000, badgeCode: 'streak_30', message: 'Monthly Legend! 🏆' },
    { days: 60, points: 2500, badgeCode: 'streak_60', message: 'Unstoppable!' },
    { days: 100, points: 5000, badgeCode: 'streak_100', message: 'Century Club! 💯' },
  ];
  
  const milestone = milestones.find(m => m.days === streakDays);
  if (milestone) {
    return {
      isMilestone: true,
      ...milestone,
    };
  }
  
  return { isMilestone: false };
}

// ========================================
// AI PERSONALIZATION
// ========================================

/**
 * Predict next wash date based on history
 */
export function predictNextWashDate(
  lastWashDate: Date,
  averageIntervalDays: number
): Date {
  const nextDate = new Date(lastWashDate);
  nextDate.setDate(nextDate.getDate() + averageIntervalDays);
  return nextDate;
}

/**
 * Generate personalized wash reminder message
 */
export function generateWashReminderMessage(
  daysUntilPredicted: number,
  petName?: string
): string {
  const name = petName || 'your pet';
  
  if (daysUntilPredicted <= 0) {
    return `Time for ${name}'s wash! 🛁`;
  } else if (daysUntilPredicted === 1) {
    return `${name}'s wash is due tomorrow! Book now to keep your streak alive.`;
  } else if (daysUntilPredicted <= 3) {
    return `${name}'s wash is coming up in ${daysUntilPredicted} days. Pre-book for bonus points!`;
  } else {
    return `${name}'s next wash: in ${daysUntilPredicted} days`;
  }
}

/**
 * Generate AI-powered personalized offers
 */
export function generatePersonalizedOffers(profile: {
  tier: string;
  totalWashes: number;
  preferredTimes: any[];
  lastWashDate: Date | null;
}): Array<{
  id: string;
  title: string;
  description: string;
  discount: number;
  expiresIn: string;
  type: 'time_based' | 'frequency' | 'tier_upgrade' | 'comeback';
}> {
  const offers: any[] = [];
  
  // Time-based offer (preferred hours)
  if (profile.preferredTimes && profile.preferredTimes.length > 0) {
    offers.push({
      id: 'time_based_1',
      title: 'Your Preferred Time Bonus',
      description: '15% off washes during your favorite time slots',
      discount: 15,
      expiresIn: '7 days',
      type: 'time_based',
    });
  }
  
  // Frequency offer
  if (profile.totalWashes >= 10 && profile.totalWashes < 20) {
    offers.push({
      id: 'frequency_1',
      title: 'Loyal Customer Reward',
      description: 'Complete 5 more washes this month → 500 bonus points!',
      discount: 0,
      expiresIn: '30 days',
      type: 'frequency',
    });
  }
  
  // Tier upgrade incentive
  const tierProgress = calculateTierProgress(profile.totalWashes * 50);
  if (tierProgress.nextTier && tierProgress.pointsNeeded < 500) {
    offers.push({
      id: 'tier_upgrade_1',
      title: `Almost ${tierProgress.nextTier.name}!`,
      description: `Just ${tierProgress.pointsNeeded} more points to unlock ${tierProgress.nextTier.benefits.discountPercent}% discount!`,
      discount: 0,
      expiresIn: '14 days',
      type: 'tier_upgrade',
    });
  }
  
  // Comeback offer (if inactive for 30+ days)
  if (profile.lastWashDate) {
    const daysSinceLastWash = Math.floor(
      (Date.now() - profile.lastWashDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceLastWash >= 30) {
      offers.push({
        id: 'comeback_1',
        title: 'We Miss You!',
        description: 'Come back within 7 days → 25% off + 300 bonus points',
        discount: 25,
        expiresIn: '7 days',
        type: 'comeback',
      });
    }
  }
  
  return offers;
}

// ========================================
// BADGE EVALUATION
// ========================================

/**
 * Check if user qualifies for a badge
 */
export function evaluateBadgeCondition(
  conditions: any,
  userStats: {
    totalWashes: number;
    currentStreak: number;
    longestStreak: number;
    earlyMorningWashes: number;
    weekendWashes: number;
    ecoWashes: number;
  }
): boolean {
  const { type, value, operator } = conditions;
  
  let userValue = 0;
  
  switch (type) {
    case 'wash_count':
      userValue = userStats.totalWashes;
      break;
    case 'current_streak':
      userValue = userStats.currentStreak;
      break;
    case 'longest_streak':
      userValue = userStats.longestStreak;
      break;
    case 'early_morning_washes':
      userValue = userStats.earlyMorningWashes;
      break;
    case 'weekend_washes':
      userValue = userStats.weekendWashes;
      break;
    case 'eco_washes':
      userValue = userStats.ecoWashes;
      break;
    default:
      return false;
  }
  
  switch (operator) {
    case '>=':
      return userValue >= value;
    case '>':
      return userValue > value;
    case '==':
      return userValue === value;
    case '<=':
      return userValue <= value;
    case '<':
      return userValue < value;
    default:
      return false;
  }
}

// ========================================
// MARKETPLACE
// ========================================

/**
 * Check if user can redeem a reward
 */
export function canRedeemReward(
  reward: {
    pointsCost: number;
    minTier?: string | null;
    stock?: number | null;
    maxRedemptionsPerUser?: number;
  },
  userProfile: {
    points: number;
    tier: string;
    redemptionCount?: number;
  }
): {
  canRedeem: boolean;
  reason?: string;
} {
  // Check points
  if (userProfile.points < reward.pointsCost) {
    return {
      canRedeem: false,
      reason: `Need ${reward.pointsCost - userProfile.points} more points`,
    };
  }
  
  // Check tier requirement
  if (reward.minTier) {
    const requiredTierIndex = TIER_CONFIGS.findIndex(t => t.id === reward.minTier);
    const userTierIndex = TIER_CONFIGS.findIndex(t => t.id === userProfile.tier);
    
    if (userTierIndex < requiredTierIndex) {
      return {
        canRedeem: false,
        reason: `Requires ${reward.minTier} tier or higher`,
      };
    }
  }
  
  // Check stock
  if (reward.stock !== null && reward.stock !== undefined && reward.stock <= 0) {
    return {
      canRedeem: false,
      reason: 'Out of stock',
    };
  }
  
  // Check max redemptions per user
  if (reward.maxRedemptionsPerUser && userProfile.redemptionCount) {
    if (userProfile.redemptionCount >= reward.maxRedemptionsPerUser) {
      return {
        canRedeem: false,
        reason: 'Maximum redemptions reached',
      };
    }
  }
  
  return { canRedeem: true };
}

// ========================================
// REFERRAL SYSTEM
// ========================================

/**
 * Generate unique referral code
 */
export function generateReferralCode(userId: string): string {
  // Create a short, memorable code from user ID
  const hash = simpleHash(userId);
  return `PW${hash.toString(36).toUpperCase().substring(0, 6)}`;
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Calculate referral rewards
 */
export function calculateReferralRewards(): {
  referrerPoints: number;
  refereePoints: number;
  referrerMessage: string;
  refereeMessage: string;
} {
  return {
    referrerPoints: 500, // Referrer gets 500 points
    refereePoints: 250,  // New user gets 250 points welcome bonus
    referrerMessage: 'Friend signed up! +500 points',
    refereeMessage: 'Welcome! +250 points from referral',
  };
}

// ========================================
// FORMATTING HELPERS
// ========================================

/**
 * Format points with thousands separator
 */
export function formatPoints(points: number): string {
  return points.toLocaleString();
}

/**
 * Format tier name with emoji
 */
export function formatTierName(tier: string, includeEmoji = true): string {
  const config = getTierConfig(tier);
  if (!config) return tier;
  return includeEmoji ? `${config.icon} ${config.name}` : config.name;
}

/**
 * Get tier color class for Tailwind
 */
export function getTierColorClass(tier: string): string {
  const config = getTierConfig(tier);
  if (!config) return 'text-gray-500';
  
  const colorMap: Record<string, string> = {
    new: 'text-slate-500',
    silver: 'text-gray-400',
    gold: 'text-amber-500',
    platinum: 'text-gray-300',
    diamond: 'text-blue-500',
  };
  
  return colorMap[tier] || 'text-gray-500';
}

/**
 * Get tier gradient class for backgrounds
 */
export function getTierGradientClass(tier: string): string {
  const gradientMap: Record<string, string> = {
    new: 'from-slate-500 to-slate-700',
    silver: 'from-gray-300 to-gray-500',
    gold: 'from-amber-400 to-amber-600',
    platinum: 'from-gray-200 to-gray-400',
    diamond: 'from-blue-400 to-blue-600',
  };
  
  return gradientMap[tier] || 'from-gray-500 to-gray-700';
}

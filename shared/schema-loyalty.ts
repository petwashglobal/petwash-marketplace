import { pgTable, serial, varchar, integer, timestamp, boolean, text, decimal, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

/**
 * 🏆 7-STAR LUXURY LOYALTY SYSTEM
 * 
 * Multi-dimensional rewards platform with:
 * - 7-tier luxury progression (Bronze, Silver, Gold, Platinum, Diamond, Emerald, Royal)
 * - Points & XP system (Pyramid-style accumulation like US leaders 2025)
 * - Special categories: Verified Disabled (10%), Seniors/Golden Age (10%)
 * - Base club members: 5% discount
 * - Badges & Achievements
 * - Daily challenges & streaks
 * - Partner redemption marketplace
 * - AI-powered personalization
 * - VIP experiences
 * 
 * DISCOUNT STRUCTURE (2025 Model):
 * - Base club member: 5% discount
 * - Verified disabled (with official certificate): 10% discount
 * - Seniors/Golden Age (verified): 10% discount
 * - Tier progression adds small bonuses (1-5% max cumulative)
 * - Max discount cap: 15% (excluding special promotions)
 */

// ========================================
// LOYALTY TIER ENUM (7-Star System)
// ========================================

export const LOYALTY_TIERS = {
  BRONZE: 'bronze',
  SILVER: 'silver',
  GOLD: 'gold',
  PLATINUM: 'platinum',
  DIAMOND: 'diamond',
  EMERALD: 'emerald',
  ROYAL: 'royal',
} as const;

export type LoyaltyTier = typeof LOYALTY_TIERS[keyof typeof LOYALTY_TIERS];

export const LOYALTY_TIER_THRESHOLDS = {
  bronze: 0,
  silver: 2500,    // ~5 washes
  gold: 7500,      // ~15 washes
  platinum: 15000, // ~30 washes
  diamond: 25000,  // ~50 washes
  emerald: 40000,  // ~80 washes
  royal: 50000,    // ~100 washes
} as const;

// ========================================
// CORE LOYALTY PROFILE
// ========================================

// ========================================
// SPECIAL MEMBER CATEGORIES
// ========================================

export const SPECIAL_MEMBER_CATEGORIES = {
  NONE: 'none',
  DISABLED: 'disabled',           // נכים - 10% discount with official certificate
  SENIOR: 'senior',               // גיל הזהב - 10% discount
  MILITARY: 'military',           // חיילים - special rates
  FIRST_RESPONDER: 'first_responder', // כיבוי אש, מד"א - special rates
} as const;

export type SpecialMemberCategory = typeof SPECIAL_MEMBER_CATEGORIES[keyof typeof SPECIAL_MEMBER_CATEGORIES];

export const loyaltyProfiles = pgTable('loyalty_profiles', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().unique(), // Firebase UID
  
  // 7-Star Luxury Tier System
  tier: varchar('tier', { length: 50 }).notNull().default('bronze'), // bronze, silver, gold, platinum, diamond, emerald, royal
  tierSince: timestamp('tier_since').notNull().defaultNow(),
  tierProgress: integer('tier_progress').notNull().default(0), // Points toward next tier
  tierThreshold: integer('tier_threshold').notNull().default(1000), // Points needed for next tier
  
  // Points & Currency (Pyramid-style accumulation)
  points: integer('points').notNull().default(0), // Redeemable loyalty points (credit)
  lifetimePoints: integer('lifetime_points').notNull().default(0), // Total points earned (never decreases)
  xp: integer('xp').notNull().default(0), // Experience points for leveling
  level: integer('level').notNull().default(1), // User level (1-100)
  
  // Engagement Metrics
  totalWashes: integer('total_washes').notNull().default(0),
  currentStreak: integer('current_streak').notNull().default(0), // Consecutive service days
  longestStreak: integer('longest_streak').notNull().default(0),
  lastWashDate: timestamp('last_wash_date'),
  
  // AI Personalization
  preferredStations: jsonb('preferred_stations').default([]), // Array of station IDs
  preferredTimes: jsonb('preferred_times').default([]), // Array of hour preferences
  averageWashInterval: integer('average_wash_interval').default(21), // Days between washes
  nextPredictedWash: timestamp('next_predicted_wash'),
  personalizedOffers: jsonb('personalized_offers').default([]), // AI-generated offers
  
  // VIP Benefits
  isVip: boolean('is_vip').notNull().default(false),
  vipSince: timestamp('vip_since'),
  conciergeAccess: boolean('concierge_access').notNull().default(false),
  prioritySupport: boolean('priority_support').notNull().default(false),
  
  // Metadata
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type LoyaltyProfile = typeof loyaltyProfiles.$inferSelect;
export const insertLoyaltyProfileSchema = createInsertSchema(loyaltyProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertLoyaltyProfile = z.infer<typeof insertLoyaltyProfileSchema>;

// ========================================
// POINTS TRANSACTIONS
// ========================================

export const pointsTransactions = pgTable('points_transactions', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  
  // Transaction Details
  type: varchar('type', { length: 50 }).notNull(), // earned, redeemed, expired, bonus, refund
  amount: integer('amount').notNull(), // Positive for earned, negative for spent
  balance: integer('balance').notNull(), // Balance after transaction
  
  // Source Information
  source: varchar('source', { length: 100 }).notNull(), // wash, challenge, referral, bonus, purchase
  sourceId: varchar('source_id', { length: 255 }), // Reference ID (wash ID, challenge ID, etc.)
  description: text('description').notNull(),
  
  // Metadata
  metadata: jsonb('metadata').default({}), // Additional context
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type PointsTransaction = typeof pointsTransactions.$inferSelect;
export const insertPointsTransactionSchema = createInsertSchema(pointsTransactions).omit({
  id: true,
  createdAt: true,
});
export type InsertPointsTransaction = z.infer<typeof insertPointsTransactionSchema>;

// ========================================
// BADGES & ACHIEVEMENTS
// ========================================

export const badges = pgTable('badges', {
  id: serial('id').primaryKey(),
  
  // Badge Identity
  code: varchar('code', { length: 100 }).notNull().unique(), // early_bird, weekend_warrior, eco_champion
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').notNull(),
  icon: varchar('icon', { length: 255 }).notNull(), // Emoji or icon name
  
  // Badge Properties
  category: varchar('category', { length: 50 }).notNull(), // frequency, timing, eco, social, achievement
  rarity: varchar('rarity', { length: 50 }).notNull().default('common'), // common, rare, epic, legendary
  tier: varchar('tier', { length: 50 }), // Minimum tier required (null = any)
  
  // Unlock Conditions (JSON)
  conditions: jsonb('conditions').notNull(), // { type: 'wash_count', value: 10, operator: '>=' }
  
  // Rewards
  pointsReward: integer('points_reward').notNull().default(0),
  xpReward: integer('xp_reward').notNull().default(0),
  
  // Metadata
  isActive: boolean('is_active').notNull().default(true),
  displayOrder: integer('display_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type Badge = typeof badges.$inferSelect;
export const insertBadgeSchema = createInsertSchema(badges).omit({
  id: true,
  createdAt: true,
});
export type InsertBadge = z.infer<typeof insertBadgeSchema>;

// ========================================
// USER BADGE UNLOCKS
// ========================================

export const userBadges = pgTable('user_badges', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  badgeId: integer('badge_id').notNull(),
  
  // Unlock Details
  unlockedAt: timestamp('unlocked_at').notNull().defaultNow(),
  progress: integer('progress').default(0), // For progressive badges
  isNew: boolean('is_new').notNull().default(true), // For showing "New Badge!" notifications
  
  // Display
  isFavorite: boolean('is_favorite').notNull().default(false), // Pin to profile
});

export type UserBadge = typeof userBadges.$inferSelect;
export const insertUserBadgeSchema = createInsertSchema(userBadges).omit({
  id: true,
  unlockedAt: true,
});
export type InsertUserBadge = z.infer<typeof insertUserBadgeSchema>;

// ========================================
// DAILY CHALLENGES
// ========================================

export const dailyChallenges = pgTable('daily_challenges', {
  id: serial('id').primaryKey(),
  
  // Challenge Identity
  code: varchar('code', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').notNull(),
  icon: varchar('icon', { length: 255 }).notNull(),
  
  // Challenge Configuration
  type: varchar('type', { length: 50 }).notNull(), // wash_count, specific_time, referral, social_share
  target: integer('target').notNull(), // Goal value (e.g., wash 3 times)
  duration: varchar('duration', { length: 50 }).notNull().default('daily'), // daily, weekly, monthly
  
  // Rewards
  pointsReward: integer('points_reward').notNull(),
  xpReward: integer('xp_reward').notNull(),
  bonusReward: varchar('bonus_reward', { length: 255 }), // Optional special reward
  
  // Scheduling
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  
  // Metadata
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type DailyChallenge = typeof dailyChallenges.$inferSelect;
export const insertDailyChallengeSchema = createInsertSchema(dailyChallenges).omit({
  id: true,
  createdAt: true,
});
export type InsertDailyChallenge = z.infer<typeof insertDailyChallengeSchema>;

// ========================================
// USER CHALLENGE PROGRESS
// ========================================

export const userChallenges = pgTable('user_challenges', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  challengeId: integer('challenge_id').notNull(),
  
  // Progress Tracking
  progress: integer('progress').notNull().default(0),
  target: integer('target').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('active'), // active, completed, expired, claimed
  
  // Dates
  startedAt: timestamp('started_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
  claimedAt: timestamp('claimed_at'),
  expiresAt: timestamp('expires_at').notNull(),
});

export type UserChallenge = typeof userChallenges.$inferSelect;
export const insertUserChallengeSchema = createInsertSchema(userChallenges).omit({
  id: true,
  startedAt: true,
});
export type InsertUserChallenge = z.infer<typeof insertUserChallengeSchema>;

// ========================================
// REWARDS MARKETPLACE
// ========================================

export const rewardsMarketplace = pgTable('rewards_marketplace', {
  id: serial('id').primaryKey(),
  
  // Reward Identity
  code: varchar('code', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').notNull(),
  imageUrl: varchar('image_url', { length: 500 }),
  
  // Reward Type
  type: varchar('type', { length: 50 }).notNull(), // discount, free_wash, voucher, partner_product, vip_experience
  category: varchar('category', { length: 50 }).notNull(), // wash, merchandise, partner, experience
  
  // Pricing
  pointsCost: integer('points_cost').notNull(),
  cashValue: decimal('cash_value', { precision: 10, scale: 2 }), // Equivalent cash value
  currency: varchar('currency', { length: 10 }).default('ILS'),
  
  // Availability
  stock: integer('stock'), // null = unlimited
  maxRedemptionsPerUser: integer('max_redemptions_per_user').default(1),
  minTier: varchar('min_tier', { length: 50 }), // Minimum tier required
  
  // Partner Info
  partnerId: integer('partner_id'), // Reference to partners table
  partnerName: varchar('partner_name', { length: 255 }),
  externalUrl: varchar('external_url', { length: 500 }),
  
  // Metadata
  isActive: boolean('is_active').notNull().default(true),
  isFeatured: boolean('is_featured').notNull().default(false),
  displayOrder: integer('display_order').notNull().default(0),
  validFrom: timestamp('valid_from'),
  validUntil: timestamp('valid_until'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type RewardItem = typeof rewardsMarketplace.$inferSelect;
export const insertRewardItemSchema = createInsertSchema(rewardsMarketplace).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRewardItem = z.infer<typeof insertRewardItemSchema>;

// ========================================
// USER REDEMPTIONS
// ========================================

export const userRedemptions = pgTable('user_redemptions', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  rewardId: integer('reward_id').notNull(),
  
  // Redemption Details
  pointsCost: integer('points_cost').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('pending'), // pending, approved, fulfilled, cancelled
  
  // Voucher/Code
  voucherCode: varchar('voucher_code', { length: 255 }).unique(), // Generated unique code
  redemptionCode: varchar('redemption_code', { length: 255 }), // Code to use at partner
  
  // Fulfillment
  fulfilledAt: timestamp('fulfilled_at'),
  expiresAt: timestamp('expires_at'),
  
  // Metadata
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type UserRedemption = typeof userRedemptions.$inferSelect;
export const insertUserRedemptionSchema = createInsertSchema(userRedemptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUserRedemption = z.infer<typeof insertUserRedemptionSchema>;

// ========================================
// REFERRAL PROGRAM
// ========================================

export const referrals = pgTable('referrals', {
  id: serial('id').primaryKey(),
  
  // Referrer & Referee
  referrerId: varchar('referrer_id', { length: 255 }).notNull(), // User who referred
  refereeId: varchar('referee_id', { length: 255 }).notNull(), // User who was referred
  
  // Referral Details
  referralCode: varchar('referral_code', { length: 50 }).notNull().unique(),
  status: varchar('status', { length: 50 }).notNull().default('pending'), // pending, qualified, rewarded
  
  // Rewards
  referrerPointsEarned: integer('referrer_points_earned').default(0),
  refereePointsEarned: integer('referee_points_earned').default(0),
  
  // Qualification (referee must complete first wash)
  qualifiedAt: timestamp('qualified_at'),
  rewardedAt: timestamp('rewarded_at'),
  
  // Metadata
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type Referral = typeof referrals.$inferSelect;
export const insertReferralSchema = createInsertSchema(referrals).omit({
  id: true,
  createdAt: true,
});
export type InsertReferral = z.infer<typeof insertReferralSchema>;

// ========================================
// TIER CONFIGURATION
// ========================================

// ========================================
// SPECIAL CATEGORY DISCOUNTS
// ========================================

export const SPECIAL_CATEGORY_DISCOUNTS = {
  disabled: 10,           // נכים מאומתים - 10%
  senior: 10,             // גיל הזהב מאומת - 10%
  military: 5,            // חיילים - 5%
  first_responder: 5,     // כיבוי אש, מד"א - 5%
  none: 0,
} as const;

// Base club member discount (all registered members)
export const BASE_CLUB_DISCOUNT = 5; // 5% for all club members

// Maximum discount cap (excluding special promotions)
export const MAX_DISCOUNT_CAP = 15;

export interface TierConfig {
  id: string;
  name: string;
  nameHe: string;
  color: string;
  icon: string;
  threshold: number; // Minimum lifetime points required
  washesRequired: number; // Approximate washes needed to reach this tier
  benefits: {
    tierBonusPercent: number; // Additional discount ON TOP of base 5% (capped)
    pointsMultiplier: number; // 1.0 = base, 1.5 = 50% bonus points earned
    prioritySupport: boolean;
    birthdayBonus: number; // Extra points on birthday
    freeWashesPerYear: number;
    exclusiveAccess: boolean; // Early access to new products
    conciergeService: boolean;
    pointsToCredit: number; // Points needed for ₪1 credit (lower = better)
  };
}

/**
 * PYRAMID LOYALTY STRUCTURE (2025 Model)
 * 
 * Points earning: 10 points per ₪1 spent (like Starbucks Stars)
 * Average wash: ₪50 = 500 points
 * 
 * Base discount: 5% (all club members)
 * Special categories: 10% (disabled/seniors - replaces base, doesn't stack)
 * 
 * Tier bonuses are SMALL additions that reward loyalty without excessive discounts.
 * Max cumulative discount: 10% for regular members (base 5% + tier 5%)
 * Only Royal tier (after ~100 washes) gets the full 15% cap.
 */
export const TIER_CONFIGS: TierConfig[] = [
  {
    id: 'bronze',
    name: 'Bronze',
    nameHe: 'ברונזה',
    color: '#cd7f32',
    icon: '🥉',
    threshold: 0,
    washesRequired: 0,
    benefits: {
      tierBonusPercent: 0, // Base 5% only
      pointsMultiplier: 1.0,
      prioritySupport: false,
      birthdayBonus: 50,
      freeWashesPerYear: 0,
      exclusiveAccess: false,
      conciergeService: false,
      pointsToCredit: 100, // 100 points = ₪1
    },
  },
  {
    id: 'silver',
    name: 'Silver',
    nameHe: 'כסף',
    color: '#cbd5e1',
    icon: '🥈',
    threshold: 2500, // ~5 washes
    washesRequired: 5,
    benefits: {
      tierBonusPercent: 1, // Total: 6%
      pointsMultiplier: 1.1,
      prioritySupport: false,
      birthdayBonus: 100,
      freeWashesPerYear: 0,
      exclusiveAccess: false,
      conciergeService: false,
      pointsToCredit: 90, // 90 points = ₪1
    },
  },
  {
    id: 'gold',
    name: 'Gold',
    nameHe: 'זהב',
    color: '#fbbf24',
    icon: '🥇',
    threshold: 7500, // ~15 washes
    washesRequired: 15,
    benefits: {
      tierBonusPercent: 2, // Total: 7%
      pointsMultiplier: 1.25,
      prioritySupport: false,
      birthdayBonus: 150,
      freeWashesPerYear: 1,
      exclusiveAccess: false,
      conciergeService: false,
      pointsToCredit: 80,
    },
  },
  {
    id: 'platinum',
    name: 'Platinum',
    nameHe: 'פלטינום',
    color: '#e5e7eb',
    icon: '💎',
    threshold: 15000, // ~30 washes
    washesRequired: 30,
    benefits: {
      tierBonusPercent: 3, // Total: 8%
      pointsMultiplier: 1.5,
      prioritySupport: true,
      birthdayBonus: 250,
      freeWashesPerYear: 1,
      exclusiveAccess: true,
      conciergeService: false,
      pointsToCredit: 70,
    },
  },
  {
    id: 'diamond',
    name: 'Diamond',
    nameHe: 'יהלום',
    color: '#3b82f6',
    icon: '💠',
    threshold: 25000, // ~50 washes
    washesRequired: 50,
    benefits: {
      tierBonusPercent: 4, // Total: 9%
      pointsMultiplier: 1.75,
      prioritySupport: true,
      birthdayBonus: 400,
      freeWashesPerYear: 2,
      exclusiveAccess: true,
      conciergeService: false,
      pointsToCredit: 60,
    },
  },
  {
    id: 'emerald',
    name: 'Emerald',
    nameHe: 'אמרלד',
    color: '#10b981',
    icon: '💚',
    threshold: 40000, // ~80 washes
    washesRequired: 80,
    benefits: {
      tierBonusPercent: 5, // Total: 10%
      pointsMultiplier: 2.0,
      prioritySupport: true,
      birthdayBonus: 600,
      freeWashesPerYear: 3,
      exclusiveAccess: true,
      conciergeService: true,
      pointsToCredit: 50,
    },
  },
  {
    id: 'royal',
    name: 'Royal',
    nameHe: 'מלכותי',
    color: '#8b5cf6',
    icon: '👑',
    threshold: 50000, // ~100 washes
    washesRequired: 100,
    benefits: {
      tierBonusPercent: 10, // Total: 15% (max cap)
      pointsMultiplier: 2.5,
      prioritySupport: true,
      birthdayBonus: 1000,
      freeWashesPerYear: 6,
      exclusiveAccess: true,
      conciergeService: true,
      pointsToCredit: 40, // Best conversion rate
    },
  },
];

// ========================================
// DISCOUNT CALCULATION HELPER
// ========================================

export function calculateTotalDiscount(
  tier: LoyaltyTier,
  specialCategory: SpecialMemberCategory,
  isVerified: boolean
): number {
  const tierConfig = TIER_CONFIGS.find(t => t.id === tier);
  const tierBonus = tierConfig?.benefits.tierBonusPercent || 0;
  
  // Special category (disabled/senior) gives flat 10% - doesn't stack with base
  if (specialCategory !== 'none' && isVerified) {
    const specialDiscount = SPECIAL_CATEGORY_DISCOUNTS[specialCategory] || 0;
    // Special discount + tier bonus, capped at MAX_DISCOUNT_CAP
    return Math.min(specialDiscount + tierBonus, MAX_DISCOUNT_CAP);
  }
  
  // Regular club member: base 5% + tier bonus
  const totalDiscount = BASE_CLUB_DISCOUNT + tierBonus;
  return Math.min(totalDiscount, MAX_DISCOUNT_CAP);
}

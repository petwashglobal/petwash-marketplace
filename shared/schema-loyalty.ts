import { pgTable, serial, varchar, integer, timestamp, boolean, text, decimal, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

/**
 * 🏆 7-STAR LUXURY LOYALTY SYSTEM
 * 
 * Multi-dimensional rewards platform with:
 * - 7-tier luxury progression (Bronze, Silver, Gold, Platinum, Diamond, Emerald, Royal)
 * - Points & XP system
 * - Badges & Achievements
 * - Daily challenges & streaks
 * - Partner redemption marketplace
 * - AI-powered personalization
 * - VIP experiences
 */

// ========================================
// CORE LOYALTY PROFILE
// ========================================

export const loyaltyProfiles = pgTable('loyalty_profiles', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().unique(), // Firebase UID
  
  // 7-Star Luxury Tier System
  tier: varchar('tier', { length: 50 }).notNull().default('bronze'), // bronze, silver, gold, platinum, diamond, emerald, royal
  tierSince: timestamp('tier_since').notNull().defaultNow(),
  tierProgress: integer('tier_progress').notNull().default(0), // Points toward next tier
  tierThreshold: integer('tier_threshold').notNull().default(1000), // Points needed for next tier
  
  // Points & Currency
  points: integer('points').notNull().default(0), // Redeemable loyalty points
  lifetimePoints: integer('lifetime_points').notNull().default(0), // Total points earned (never decreases)
  xp: integer('xp').notNull().default(0), // Experience points for leveling
  level: integer('level').notNull().default(1), // User level (1-100)
  
  // Engagement Metrics
  totalWashes: integer('total_washes').notNull().default(0),
  currentStreak: integer('current_streak').notNull().default(0), // Consecutive wash days
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

export interface TierConfig {
  id: string;
  name: string;
  nameHe: string;
  color: string;
  icon: string;
  threshold: number; // Minimum lifetime points required
  benefits: {
    discountPercent: number;
    pointsMultiplier: number; // 1.0 = base, 1.5 = 50% bonus
    prioritySupport: boolean;
    birthdayBonus: number; // Extra points on birthday
    freeWashesPerYear: number;
    exclusiveAccess: boolean; // Early access to new products
    conciergeService: boolean;
  };
}

export const TIER_CONFIGS: TierConfig[] = [
  {
    id: 'bronze',
    name: 'Bronze',
    nameHe: 'ברונזה',
    color: '#cd7f32', // bronze
    icon: '🥉',
    threshold: 0,
    benefits: {
      discountPercent: 0,
      pointsMultiplier: 1.0,
      prioritySupport: false,
      birthdayBonus: 100,
      freeWashesPerYear: 0,
      exclusiveAccess: false,
      conciergeService: false,
    },
  },
  {
    id: 'silver',
    name: 'Silver',
    nameHe: 'כסף',
    color: '#cbd5e1', // silver
    icon: '🥈',
    threshold: 1000,
    benefits: {
      discountPercent: 10,
      pointsMultiplier: 1.2,
      prioritySupport: false,
      birthdayBonus: 200,
      freeWashesPerYear: 1,
      exclusiveAccess: false,
      conciergeService: false,
    },
  },
  {
    id: 'gold',
    name: 'Gold',
    nameHe: 'זהב',
    color: '#fbbf24', // amber
    icon: '🥇',
    threshold: 3000,
    benefits: {
      discountPercent: 15,
      pointsMultiplier: 1.5,
      prioritySupport: true,
      birthdayBonus: 300,
      freeWashesPerYear: 2,
      exclusiveAccess: true,
      conciergeService: false,
    },
  },
  {
    id: 'platinum',
    name: 'Platinum',
    nameHe: 'פלטינום',
    color: '#e5e7eb', // platinum
    icon: '💎',
    threshold: 6000,
    benefits: {
      discountPercent: 20,
      pointsMultiplier: 2.0,
      prioritySupport: true,
      birthdayBonus: 500,
      freeWashesPerYear: 3,
      exclusiveAccess: true,
      conciergeService: true,
    },
  },
  {
    id: 'diamond',
    name: 'Diamond',
    nameHe: 'יהלום',
    color: '#3b82f6', // blue
    icon: '💠',
    threshold: 10000,
    benefits: {
      discountPercent: 25,
      pointsMultiplier: 2.5,
      prioritySupport: true,
      birthdayBonus: 1000,
      freeWashesPerYear: 5,
      exclusiveAccess: true,
      conciergeService: true,
    },
  },
  {
    id: 'emerald',
    name: 'Emerald',
    nameHe: 'אמרלד',
    color: '#10b981', // emerald green
    icon: '💚',
    threshold: 20000,
    benefits: {
      discountPercent: 30,
      pointsMultiplier: 3.0,
      prioritySupport: true,
      birthdayBonus: 2000,
      freeWashesPerYear: 8,
      exclusiveAccess: true,
      conciergeService: true,
    },
  },
  {
    id: 'royal',
    name: 'Royal',
    nameHe: 'מלכותי',
    color: '#8b5cf6', // royal purple
    icon: '👑',
    threshold: 35000,
    benefits: {
      discountPercent: 40,
      pointsMultiplier: 4.0,
      prioritySupport: true,
      birthdayBonus: 5000,
      freeWashesPerYear: 12,
      exclusiveAccess: true,
      conciergeService: true,
    },
  },
];

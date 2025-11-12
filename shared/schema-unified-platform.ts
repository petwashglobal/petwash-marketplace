/**
 * 🐙 Unified Platform Database Schema
 * Supporting tables for cross-platform features
 * Based on 2025 best practices for CDP and omnichannel platforms
 */

import { pgTable, text, timestamp, jsonb, integer, boolean, decimal, uuid, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ==================== UNIFIED WALLET ====================

/**
 * Wallet Transactions - Cross-platform payment history
 */
export const walletTransactions = pgTable('wallet_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('ILS'),
  type: text('type').notNull(), // 'credit' | 'debit'
  platform: text('platform').notNull(), // Source platform
  description: text('description').notNull(),
  referenceId: text('reference_id'), // Booking ID, transaction ID, etc.
  balanceAfter: decimal('balance_after', { precision: 10, scale: 2 }).notNull(),
  metadata: jsonb('metadata'), // Additional context
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => ({
  userIdIdx: index('wallet_tx_user_id_idx').on(table.userId),
  platformIdx: index('wallet_tx_platform_idx').on(table.platform),
  createdAtIdx: index('wallet_tx_created_at_idx').on(table.createdAt)
}));

export const insertWalletTransactionSchema = createInsertSchema(walletTransactions);
export type InsertWalletTransaction = z.infer<typeof insertWalletTransactionSchema>;
export type WalletTransaction = typeof walletTransactions.$inferSelect;

/**
 * Wallet Balances - Current balance per user per currency
 */
export const walletBalances = pgTable('wallet_balances', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().unique(),
  balance: decimal('balance', { precision: 10, scale: 2 }).notNull().default('0'),
  currency: text('currency').notNull().default('ILS'),
  loyaltyPoints: integer('loyalty_points').notNull().default(0),
  lastUpdated: timestamp('last_updated').defaultNow().notNull()
}, (table) => ({
  userIdIdx: index('wallet_balance_user_id_idx').on(table.userId)
}));

export const insertWalletBalanceSchema = createInsertSchema(walletBalances);
export type InsertWalletBalance = z.infer<typeof insertWalletBalanceSchema>;
export type WalletBalance = typeof walletBalances.$inferSelect;

// ==================== NOTIFICATIONS & MESSAGING ====================

/**
 * Notification Preferences - User preferences per channel and platform
 */
export const notificationPreferences = pgTable('notification_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().unique(),
  
  // Channel preferences
  whatsapp: boolean('whatsapp').notNull().default(true),
  email: boolean('email').notNull().default(true),
  sms: boolean('sms').notNull().default(true),
  push: boolean('push').notNull().default(true),
  inApp: boolean('in_app').notNull().default(true),
  
  // Platform-specific preferences
  platformPreferences: jsonb('platform_preferences').notNull().default({
    'walk-my-pet': true,
    'sitter-suite': true,
    'pettrek': true,
    'academy': true,
    'wash-hub': true,
    'plush-lab': true
  }),
  
  // Notification types
  marketing: boolean('marketing').notNull().default(true),
  transactional: boolean('transactional').notNull().default(true),
  alerts: boolean('alerts').notNull().default(true),
  
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  userIdIdx: index('notification_pref_user_id_idx').on(table.userId)
}));

export const insertNotificationPreferenceSchema = createInsertSchema(notificationPreferences);
export type InsertNotificationPreference = z.infer<typeof insertNotificationPreferenceSchema>;
export type NotificationPreference = typeof notificationPreferences.$inferSelect;

/**
 * Notification History - All notifications sent
 */
export const notificationHistory = pgTable('notification_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  channel: text('channel').notNull(), // 'whatsapp' | 'email' | 'sms' | 'push' | 'in-app'
  template: text('template').notNull(),
  platform: text('platform'), // Source platform
  subject: text('subject'),
  content: text('content').notNull(),
  metadata: jsonb('metadata'), // Template data
  status: text('status').notNull().default('sent'), // 'sent' | 'delivered' | 'failed' | 'read'
  sentAt: timestamp('sent_at').defaultNow().notNull(),
  deliveredAt: timestamp('delivered_at'),
  readAt: timestamp('read_at')
}, (table) => ({
  userIdIdx: index('notification_history_user_id_idx').on(table.userId),
  platformIdx: index('notification_history_platform_idx').on(table.platform),
  sentAtIdx: index('notification_history_sent_at_idx').on(table.sentAt)
}));

export const insertNotificationHistorySchema = createInsertSchema(notificationHistory);
export type InsertNotificationHistory = z.infer<typeof insertNotificationHistorySchema>;
export type NotificationHistory = typeof notificationHistory.$inferSelect;

// ==================== EVENT BUS & AUDIT ====================

/**
 * Platform Events - Event-driven integration bus logs
 */
export const platformEvents = pgTable('platform_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventType: text('event_type').notNull(),
  platform: text('platform').notNull(),
  userId: text('user_id'),
  data: jsonb('data').notNull(),
  triggers: jsonb('triggers'), // Auto-triggered events
  processed: boolean('processed').notNull().default(false),
  processedAt: timestamp('processed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => ({
  eventTypeIdx: index('platform_events_type_idx').on(table.eventType),
  platformIdx: index('platform_events_platform_idx').on(table.platform),
  userIdIdx: index('platform_events_user_id_idx').on(table.userId),
  createdAtIdx: index('platform_events_created_at_idx').on(table.createdAt)
}));

export const insertPlatformEventSchema = createInsertSchema(platformEvents);
export type InsertPlatformEvent = z.infer<typeof insertPlatformEventSchema>;
export type PlatformEvent = typeof platformEvents.$inferSelect;

// ==================== ANALYTICS & CDP ====================

/**
 * User Activity Tracking - Cross-platform user behavior
 * CDP (Customer Data Platform) foundation
 */
export const userActivity = pgTable('user_activity', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  platform: text('platform').notNull(),
  action: text('action').notNull(), // 'view', 'click', 'purchase', 'booking', etc.
  resource: text('resource'), // What they interacted with
  resourceId: text('resource_id'),
  metadata: jsonb('metadata'), // Additional context
  sessionId: text('session_id'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  timestamp: timestamp('timestamp').defaultNow().notNull()
}, (table) => ({
  userIdIdx: index('user_activity_user_id_idx').on(table.userId),
  platformIdx: index('user_activity_platform_idx').on(table.platform),
  timestampIdx: index('user_activity_timestamp_idx').on(table.timestamp),
  sessionIdIdx: index('user_activity_session_id_idx').on(table.sessionId)
}));

export const insertUserActivitySchema = createInsertSchema(userActivity);
export type InsertUserActivity = z.infer<typeof insertUserActivitySchema>;
export type UserActivity = typeof userActivity.$inferSelect;

/**
 * User 360 Profile - Unified customer view (CDP)
 */
export const user360Profiles = pgTable('user_360_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().unique(),
  
  // Computed metrics
  totalSpending: decimal('total_spending', { precision: 10, scale: 2 }).notNull().default('0'),
  totalTransactions: integer('total_transactions').notNull().default(0),
  platformsUsed: jsonb('platforms_used').notNull().default([]), // Array of platforms
  favoriteService: text('favorite_service'),
  loyaltyTier: text('loyalty_tier').notNull().default('bronze'),
  
  // Lifecycle stage
  lifecycleStage: text('lifecycle_stage').notNull().default('new'), // 'new', 'active', 'at-risk', 'churned', 'vip'
  firstPurchaseDate: timestamp('first_purchase_date'),
  lastActivityDate: timestamp('last_activity_date'),
  
  // Preferences and segments
  segments: jsonb('segments').notNull().default([]), // AI-driven segments
  predictedChurnProbability: decimal('predicted_churn_probability', { precision: 5, scale: 2 }),
  predictedLifetimeValue: decimal('predicted_lifetime_value', { precision: 10, scale: 2 }),
  
  // Demographics (from various sources)
  location: text('location'),
  preferredLanguage: text('preferred_language').default('he'),
  
  lastUpdated: timestamp('last_updated').defaultNow().notNull()
}, (table) => ({
  userIdIdx: index('user_360_user_id_idx').on(table.userId),
  lifecycleStageIdx: index('user_360_lifecycle_idx').on(table.lifecycleStage),
  loyaltyTierIdx: index('user_360_loyalty_tier_idx').on(table.loyaltyTier)
}));

export const insertUser360ProfileSchema = createInsertSchema(user360Profiles);
export type InsertUser360Profile = z.infer<typeof insertUser360ProfileSchema>;
export type User360Profile = typeof user360Profiles.$inferSelect;

/**
 * Platform Metrics - Aggregated analytics per platform per day
 */
export const platformMetrics = pgTable('platform_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  platform: text('platform').notNull(),
  date: timestamp('date').notNull(),
  
  // Revenue metrics
  revenue: decimal('revenue', { precision: 10, scale: 2 }).notNull().default('0'),
  transactions: integer('transactions').notNull().default(0),
  avgTransactionValue: decimal('avg_transaction_value', { precision: 10, scale: 2 }).notNull().default('0'),
  
  // User metrics
  activeUsers: integer('active_users').notNull().default(0),
  newUsers: integer('new_users').notNull().default(0),
  returningUsers: integer('returning_users').notNull().default(0),
  
  // Conversion metrics
  conversions: integer('conversions').notNull().default(0),
  conversionRate: decimal('conversion_rate', { precision: 5, scale: 2 }).notNull().default('0'),
  
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => ({
  platformDateIdx: index('platform_metrics_platform_date_idx').on(table.platform, table.date)
}));

export const insertPlatformMetricSchema = createInsertSchema(platformMetrics);
export type InsertPlatformMetric = z.infer<typeof insertPlatformMetricSchema>;
export type PlatformMetric = typeof platformMetrics.$inferSelect;

// ==================== PROGRAMMATIC MARKETING ====================

/**
 * Marketing Campaigns - Automated programmatic campaigns
 */
export const marketingCampaigns = pgTable('marketing_campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'email', 'sms', 'whatsapp', 'push', 'display-ads', 'retargeting'
  platform: text('platform'), // Target platform or 'all'
  
  // Targeting
  targetSegment: jsonb('target_segment').notNull(), // Segment criteria
  targetUsers: integer('target_users'),
  
  // Campaign content
  subject: text('subject'),
  content: text('content').notNull(),
  callToAction: text('call_to_action'),
  
  // Scheduling
  status: text('status').notNull().default('draft'), // 'draft', 'scheduled', 'active', 'paused', 'completed'
  scheduledFor: timestamp('scheduled_for'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  
  // Performance
  sent: integer('sent').notNull().default(0),
  delivered: integer('delivered').notNull().default(0),
  opened: integer('opened').notNull().default(0),
  clicked: integer('clicked').notNull().default(0),
  converted: integer('converted').notNull().default(0),
  revenue: decimal('revenue', { precision: 10, scale: 2 }).notNull().default('0'),
  
  // Budget
  budget: decimal('budget', { precision: 10, scale: 2 }),
  spent: decimal('spent', { precision: 10, scale: 2 }).notNull().default('0'),
  
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  statusIdx: index('marketing_campaigns_status_idx').on(table.status),
  platformIdx: index('marketing_campaigns_platform_idx').on(table.platform),
  scheduledForIdx: index('marketing_campaigns_scheduled_for_idx').on(table.scheduledFor)
}));

export const insertMarketingCampaignSchema = createInsertSchema(marketingCampaigns);
export type InsertMarketingCampaign = z.infer<typeof insertMarketingCampaignSchema>;
export type MarketingCampaign = typeof marketingCampaigns.$inferSelect;

/**
 * AI Segments - Automated user segmentation
 */
export const aiSegments = pgTable('ai_segments', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  criteria: jsonb('criteria').notNull(), // Segmentation rules
  userCount: integer('user_count').notNull().default(0),
  aiGenerated: boolean('ai_generated').notNull().default(false),
  lastRefreshed: timestamp('last_refreshed'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const insertAISegmentSchema = createInsertSchema(aiSegments);
export type InsertAISegment = z.infer<typeof insertAISegmentSchema>;
export type AISegment = typeof aiSegments.$inferSelect;

// ==================== EXPORTS ====================

export const unifiedPlatformSchemas = {
  walletTransactions,
  walletBalances,
  notificationPreferences,
  notificationHistory,
  platformEvents,
  userActivity,
  user360Profiles,
  platformMetrics,
  marketingCampaigns,
  aiSegments
};

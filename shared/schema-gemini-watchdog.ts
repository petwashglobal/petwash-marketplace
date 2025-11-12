/**
 * Gemini AI Watchdog Database Schema
 * Comprehensive monitoring, user struggle tracking, auto-fixes, and journey analytics
 */

import { pgTable, serial, varchar, text, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

/**
 * Watchdog Issues - All detected problems
 */
export const watchdogIssues = pgTable('watchdog_issues', {
  id: serial('id').primaryKey(),
  severity: varchar('severity', { length: 50 }).notNull(), // critical, high, medium, low
  category: varchar('category', { length: 100 }).notNull(), // log_analysis, error, checkout, registration, etc.
  affectedService: varchar('affected_service', { length: 100 }), // payment, auth, k9000, etc.
  description: text('description').notNull(),
  suggestedFix: text('suggested_fix'),
  detectedAt: timestamp('detected_at').notNull(),
  status: varchar('status', { length: 50 }).notNull(), // open, in_progress, resolved, ignored
  autoFixAttempted: boolean('auto_fix_attempted').default(false).notNull(),
  resolvedAt: timestamp('resolved_at'),
  userId: varchar('user_id', { length: 255 }),
  sessionId: varchar('session_id', { length: 255 }),
  metadata: jsonb('metadata')
});

export const insertWatchdogIssueSchema = createInsertSchema(watchdogIssues).omit({ id: true });
export type InsertWatchdogIssue = z.infer<typeof insertWatchdogIssueSchema>;
export type WatchdogIssue = typeof watchdogIssues.$inferSelect;

/**
 * User Struggles - Track when users have difficulty
 */
export const watchdogUserStruggles = pgTable('watchdog_user_struggles', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  sessionId: varchar('session_id', { length: 255 }).notNull(),
  action: varchar('action', { length: 255 }).notNull(), // e.g., "checkout", "login", "booking"
  failureCount: integer('failure_count').notNull(),
  likelyCause: text('likely_cause'),
  suggestedGuidance: text('suggested_guidance'), // What to tell the user
  uxImprovement: text('ux_improvement'), // How to improve the UI/UX
  urgency: varchar('urgency', { length: 50 }).notNull(), // critical, high, medium, low
  detectedAt: timestamp('detected_at').notNull(),
  resolved: boolean('resolved').default(false).notNull(),
  resolvedAt: timestamp('resolved_at'),
  context: jsonb('context') // Additional context about the struggle
});

export const insertWatchdogUserStruggleSchema = createInsertSchema(watchdogUserStruggles).omit({ id: true });
export type InsertWatchdogUserStruggle = z.infer<typeof insertWatchdogUserStruggleSchema>;
export type WatchdogUserStruggle = typeof watchdogUserStruggles.$inferSelect;

/**
 * Auto-Fixes - Track automatic issue resolution
 */
export const watchdogAutoFixes = pgTable('watchdog_auto_fixes', {
  id: serial('id').primaryKey(),
  issueId: integer('issue_id'), // References watchdog_issues.id
  fixType: varchar('fix_type', { length: 100 }).notNull(), // database, cache, restart, config, manual
  fixCode: text('fix_code'), // The code/query executed
  explanation: text('explanation'), // What the fix does
  risks: text('risks'), // Potential risks of the fix
  appliedAt: timestamp('applied_at').notNull(),
  success: boolean('success').notNull(),
  result: text('result'), // Result message
  metadata: jsonb('metadata')
});

export const insertWatchdogAutoFixSchema = createInsertSchema(watchdogAutoFixes).omit({ id: true });
export type InsertWatchdogAutoFix = z.infer<typeof insertWatchdogAutoFixSchema>;
export type WatchdogAutoFix = typeof watchdogAutoFixes.$inferSelect;

/**
 * Checkout Monitoring - Track payment flow issues
 */
export const watchdogCheckoutMonitoring = pgTable('watchdog_checkout_monitoring', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  sessionId: varchar('session_id', { length: 255 }).notNull(),
  step: varchar('step', { length: 100 }).notNull(), // initiated, payment_method, processing, completed, failed, abandoned
  amount: integer('amount'), // In agorot (cents)
  paymentMethod: varchar('payment_method', { length: 100 }),
  errorMessage: text('error_message'),
  timestamp: timestamp('timestamp').notNull(),
  metadata: jsonb('metadata')
});

export const insertWatchdogCheckoutMonitoringSchema = createInsertSchema(watchdogCheckoutMonitoring).omit({ id: true });
export type InsertWatchdogCheckoutMonitoring = z.infer<typeof insertWatchdogCheckoutMonitoringSchema>;
export type WatchdogCheckoutMonitoring = typeof watchdogCheckoutMonitoring.$inferSelect;

/**
 * Registration Monitoring - Track signup flow issues
 */
export const watchdogRegistrationMonitoring = pgTable('watchdog_registration_monitoring', {
  id: serial('id').primaryKey(),
  sessionId: varchar('session_id', { length: 255 }).notNull(),
  step: varchar('step', { length: 100 }).notNull(), // started, email_entered, password_set, phone_verified, completed, failed, abandoned
  email: varchar('email', { length: 255 }),
  failureReason: text('failure_reason'),
  timestamp: timestamp('timestamp').notNull(),
  metadata: jsonb('metadata')
});

export const insertWatchdogRegistrationMonitoringSchema = createInsertSchema(watchdogRegistrationMonitoring).omit({ id: true });
export type InsertWatchdogRegistrationMonitoring = z.infer<typeof insertWatchdogRegistrationMonitoringSchema>;
export type WatchdogRegistrationMonitoring = typeof watchdogRegistrationMonitoring.$inferSelect;

/**
 * User Journeys - Track successful vs failed user actions
 */
export const watchdogUserJourneys = pgTable('watchdog_user_journeys', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  sessionId: varchar('session_id', { length: 255 }).notNull(),
  journey: varchar('journey', { length: 255 }).notNull(), // e.g., "wash_booking", "walk_booking", "loyalty_signup"
  step: varchar('step', { length: 255 }).notNull(),
  success: boolean('success').notNull(),
  duration: integer('duration'), // Time spent on this step in milliseconds
  timestamp: timestamp('timestamp').notNull(),
  metadata: jsonb('metadata')
});

export const insertWatchdogUserJourneySchema = createInsertSchema(watchdogUserJourneys).omit({ id: true });
export type InsertWatchdogUserJourney = z.infer<typeof insertWatchdogUserJourneySchema>;
export type WatchdogUserJourney = typeof watchdogUserJourneys.$inferSelect;

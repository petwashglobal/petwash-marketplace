/**
 * Per-service provider approval + consent-requirement + reconfirmation schema.
 * Backs the legal-gate foundation (see migrations/0053_legal_gates_foundation.sql).
 * A provider approved for one service is NOT approved for another; approved-for-
 * booking is NOT approved-for-payout.
 */
import { pgTable, serial, varchar, boolean, integer, timestamp, unique } from 'drizzle-orm/pg-core';

export const providerServices = pgTable('provider_services', {
  id: serial('id').primaryKey(),
  providerId: varchar('provider_id').notNull(),
  serviceType: varchar('service_type').notNull(),
  serviceStatus: varchar('service_status').notNull().default('not_started'),
  profileVisible: boolean('profile_visible').notNull().default(false),
  bookingEnabled: boolean('booking_enabled').notNull().default(false),
  payoutEnabled: boolean('payout_enabled').notNull().default(false),
  pausedByProvider: boolean('paused_by_provider').notNull().default(false),
  pausedByAdmin: boolean('paused_by_admin').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ uq: unique().on(t.providerId, t.serviceType) }));

export const consentRequirements = pgTable('consent_requirements', {
  id: serial('id').primaryKey(),
  role: varchar('role').notNull(),
  action: varchar('action').notNull(),
  consentType: varchar('consent_type').notNull(),
  documentKey: varchar('document_key'),
  required: boolean('required').notNull().default(true),
  reconfirmDays: integer('reconfirm_days'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ uq: unique().on(t.role, t.action, t.consentType) }));

export const reconfirmationRecords = pgTable('reconfirmation_records', {
  id: serial('id').primaryKey(),
  providerId: varchar('provider_id').notNull(),
  reconfirmationType: varchar('reconfirmation_type').notNull().default('six_month'),
  dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  status: varchar('status').notNull().default('pending'),
  consentRecordId: varchar('consent_record_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ uq: unique().on(t.providerId, t.reconfirmationType, t.dueAt) }));

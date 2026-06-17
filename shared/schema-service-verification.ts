/**
 * Service-handoff verification + hash-chained check-in/out ledger schema
 * (see migrations/0055_service_verification.sql). Code stored hashed only.
 */
import { pgTable, serial, varchar, boolean, integer, timestamp } from 'drizzle-orm/pg-core';

export const bookingVerifications = pgTable('booking_verifications', {
  id: serial('id').primaryKey(),
  bookingId: varchar('booking_id').notNull().unique(),
  codeHash: varchar('code_hash').notNull(),
  codeSalt: varchar('code_salt').notNull(),
  method: varchar('method').notNull().default('code'),
  targetUserId: varchar('target_user_id'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  verified: boolean('verified').notNull().default(false),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  attempts: integer('attempts').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const serviceCheckinEvents = pgTable('service_checkin_events', {
  id: serial('id').primaryKey(),
  eventId: varchar('event_id').notNull().unique(),
  bookingId: varchar('booking_id').notNull(),
  eventType: varchar('event_type').notNull(),
  method: varchar('method').notNull(),
  actorId: varchar('actor_id').notNull(),
  conductAck: boolean('conduct_ack').notNull().default(false),
  conductAckVersion: varchar('conduct_ack_version'),
  jurisdiction: varchar('jurisdiction'),
  prevHash: varchar('prev_hash'),
  hash: varchar('hash').notNull(),
  at: timestamp('at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

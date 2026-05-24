/**
 * Maya reception/intake — Drizzle table definitions.
 *
 * Stage 1b shipped the original eight maya_* tables.
 * Stage 3A (this version) extends mayaConversations with voice columns
 * (channel='phone' now valid) and updates the channel CHECK accordingly.
 *
 * Mirrors:
 *   - migrations/0028_maya_reception_intake_foundation.sql (Stage 1)
 *   - migrations/0030_maya_voice_channel.sql               (Stage 3A)
 *
 * SAFETY: these tables hold reception/intake state only. Maya cannot approve
 * providers, confirm bookings, change wallet balances, refund, start K9000
 * machines, override fraud blocks, or create free washes. Wallet/K9000
 * redemption stays on the existing WalletLedger + AuditLedgerService path.
 */
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  boolean,
  bigserial,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// maya_conversations — Stage 1b + Stage 3A voice columns
// ---------------------------------------------------------------------------
export const mayaConversations = pgTable(
  'maya_conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    channel: varchar('channel', { length: 20 }).notNull(),
    locale: varchar('locale', { length: 2 }).notNull().default('he'),
    contactPhone: varchar('contact_phone', { length: 32 }),
    contactEmail: varchar('contact_email', { length: 255 }),
    contactName: varchar('contact_name', { length: 255 }),
    status: varchar('status', { length: 20 }).notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
    // Voice (Stage 3A) — all nullable. NULL on web/admin channels.
    voiceProvider: varchar('voice_provider', { length: 20 }),
    externalCallSid: varchar('external_call_sid', { length: 128 }),
    callStartedAt: timestamp('call_started_at', { withTimezone: true, mode: 'string' }),
    callEndedAt: timestamp('call_ended_at', { withTimezone: true, mode: 'string' }),
    recordingConsent: boolean('recording_consent'),
    recordingUrl: text('recording_url'),
  },
  (table) => [
    index('idx_maya_conversations_status').on(table.status).where(sql`${table.deletedAt} IS NULL`),
    index('idx_maya_conversations_created_at').on(table.createdAt),
    index('idx_maya_conversations_call_sid')
      .on(table.externalCallSid)
      .where(sql`${table.externalCallSid} IS NOT NULL`),
    check('maya_conversations_channel_chk', sql`${table.channel} IN ('web','admin','test','phone')`),
    check('maya_conversations_locale_chk', sql`${table.locale} IN ('he','en')`),
    check('maya_conversations_status_chk', sql`${table.status} IN ('open','closed','archived')`),
  ],
);

// ---------------------------------------------------------------------------
// maya_messages (unchanged from Stage 1b)
// ---------------------------------------------------------------------------
export const mayaMessages = pgTable(
  'maya_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => mayaConversations.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 20 }).notNull(),
    content: text('content').notNull(),
    locale: varchar('locale', { length: 2 }).notNull().default('he'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_maya_messages_conv_created').on(table.conversationId, table.createdAt),
    check('maya_messages_role_chk', sql`${table.role} IN ('user','maya','system','admin')`),
    check('maya_messages_locale_chk', sql`${table.locale} IN ('he','en')`),
  ],
);

// ---------------------------------------------------------------------------
// maya_leads (unchanged from Stage 1b)
// ---------------------------------------------------------------------------
export const mayaLeads = pgTable(
  'maya_leads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id').references(() => mayaConversations.id, {
      onDelete: 'set null',
    }),
    name: varchar('name', { length: 255 }),
    phone: varchar('phone', { length: 32 }),
    email: varchar('email', { length: 255 }),
    city: varchar('city', { length: 120 }),
    intent: text('intent'),
    source: varchar('source', { length: 40 }),
    status: varchar('status', { length: 20 }).notNull().default('new'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index('idx_maya_leads_status').on(table.status).where(sql`${table.deletedAt} IS NULL`),
    index('idx_maya_leads_phone').on(table.phone).where(sql`${table.deletedAt} IS NULL`),
    check('maya_leads_status_chk', sql`${table.status} IN ('new','contacted','qualified','closed')`),
  ],
);

// ---------------------------------------------------------------------------
// maya_provider_intake_drafts (unchanged from Stage 1b)
// ---------------------------------------------------------------------------
export const mayaProviderIntakeDrafts = pgTable(
  'maya_provider_intake_drafts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id').references(() => mayaConversations.id, {
      onDelete: 'set null',
    }),
    businessName: varchar('business_name', { length: 255 }),
    contactName: varchar('contact_name', { length: 255 }),
    phone: varchar('phone', { length: 32 }),
    email: varchar('email', { length: 255 }),
    city: varchar('city', { length: 120 }),
    region: varchar('region', { length: 120 }),
    servicesOffered: text('services_offered').array(),
    notes: text('notes'),
    intakeStatus: varchar('intake_status', { length: 30 }).notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index('idx_maya_provider_drafts_status')
      .on(table.intakeStatus)
      .where(sql`${table.deletedAt} IS NULL`),
    check(
      'maya_provider_intake_drafts_status_chk',
      sql`${table.intakeStatus} IN ('draft','submitted-for-review')`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// maya_booking_intake_drafts (unchanged from Stage 1b)
// ---------------------------------------------------------------------------
export const mayaBookingIntakeDrafts = pgTable(
  'maya_booking_intake_drafts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id').references(() => mayaConversations.id, {
      onDelete: 'set null',
    }),
    leadId: uuid('lead_id').references(() => mayaLeads.id, { onDelete: 'set null' }),
    serviceCode: varchar('service_code', { length: 40 }),
    petName: varchar('pet_name', { length: 120 }),
    petBreed: varchar('pet_breed', { length: 120 }),
    petSize: varchar('pet_size', { length: 10 }),
    preferredDates: text('preferred_dates').array(),
    preferredLocation: varchar('preferred_location', { length: 120 }),
    notes: text('notes'),
    intakeStatus: varchar('intake_status', { length: 30 }).notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index('idx_maya_booking_drafts_status')
      .on(table.intakeStatus)
      .where(sql`${table.deletedAt} IS NULL`),
    check(
      'maya_booking_intake_drafts_pet_size_chk',
      sql`${table.petSize} IS NULL OR ${table.petSize} IN ('small','medium','large','xl')`,
    ),
    check(
      'maya_booking_intake_drafts_status_chk',
      sql`${table.intakeStatus} IN ('draft','submitted-for-review')`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// maya_tasks (unchanged from Stage 1b)
// ---------------------------------------------------------------------------
export const mayaTasks = pgTable(
  'maya_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id').references(() => mayaConversations.id, {
      onDelete: 'set null',
    }),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    assignee: varchar('assignee', { length: 255 }),
    status: varchar('status', { length: 20 }).notNull().default('open'),
    dueAt: timestamp('due_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index('idx_maya_tasks_status').on(table.status).where(sql`${table.deletedAt} IS NULL`),
    index('idx_maya_tasks_assignee').on(table.assignee).where(sql`${table.deletedAt} IS NULL`),
    check('maya_tasks_status_chk', sql`${table.status} IN ('open','in-progress','done','cancelled')`),
  ],
);

// ---------------------------------------------------------------------------
// maya_escalations (unchanged from Stage 1b)
// ---------------------------------------------------------------------------
export const mayaEscalations = pgTable(
  'maya_escalations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id').references(() => mayaConversations.id, {
      onDelete: 'set null',
    }),
    reason: text('reason').notNull(),
    severity: varchar('severity', { length: 10 }).notNull().default('medium'),
    status: varchar('status', { length: 20 }).notNull().default('open'),
    assignee: varchar('assignee', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index('idx_maya_escalations_status').on(table.status).where(sql`${table.deletedAt} IS NULL`),
    index('idx_maya_escalations_severity').on(table.severity),
    check(
      'maya_escalations_severity_chk',
      sql`${table.severity} IN ('low','medium','high','critical')`,
    ),
    check(
      'maya_escalations_status_chk',
      sql`${table.status} IN ('open','acknowledged','resolved')`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// maya_audit_log (unchanged from Stage 1b — append-only at DB level)
// ---------------------------------------------------------------------------
export const mayaAuditLog = pgTable(
  'maya_audit_log',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    actorType: varchar('actor_type', { length: 20 }).notNull(),
    actorId: varchar('actor_id', { length: 255 }),
    entityType: varchar('entity_type', { length: 40 }).notNull(),
    entityId: varchar('entity_id', { length: 64 }).notNull(),
    action: varchar('action', { length: 40 }).notNull(),
    payload: jsonb('payload'),
  },
  (table) => [
    index('idx_maya_audit_entity').on(table.entityType, table.entityId),
    index('idx_maya_audit_occurred_at').on(table.occurredAt),
    check('maya_audit_log_actor_chk', sql`${table.actorType} IN ('system','maya','admin','user')`),
  ],
);

// ---------------------------------------------------------------------------
// Convenience type exports
// ---------------------------------------------------------------------------
export type MayaConversation = typeof mayaConversations.$inferSelect;
export type NewMayaConversation = typeof mayaConversations.$inferInsert;
export type MayaMessage = typeof mayaMessages.$inferSelect;
export type NewMayaMessage = typeof mayaMessages.$inferInsert;
export type MayaLead = typeof mayaLeads.$inferSelect;
export type NewMayaLead = typeof mayaLeads.$inferInsert;
export type MayaProviderIntakeDraft = typeof mayaProviderIntakeDrafts.$inferSelect;
export type NewMayaProviderIntakeDraft = typeof mayaProviderIntakeDrafts.$inferInsert;
export type MayaBookingIntakeDraft = typeof mayaBookingIntakeDrafts.$inferSelect;
export type NewMayaBookingIntakeDraft = typeof mayaBookingIntakeDrafts.$inferInsert;
export type MayaTask = typeof mayaTasks.$inferSelect;
export type NewMayaTask = typeof mayaTasks.$inferInsert;
export type MayaEscalation = typeof mayaEscalations.$inferSelect;
export type NewMayaEscalation = typeof mayaEscalations.$inferInsert;
export type MayaAuditLogEntry = typeof mayaAuditLog.$inferSelect;
export type NewMayaAuditLogEntry = typeof mayaAuditLog.$inferInsert;

import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  boolean,
  foreignKey,
} from "drizzle-orm/pg-core";
import { users } from "./schema";
import { stationRegistry } from "./schema-corporate";
import { franchisees } from "./schema-franchise";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// =================== AI CHAT HISTORY (Enterprise-Grade PostgreSQL) ===================

export const chatConversations = pgTable("chat_conversations", {
  id: serial("id").primaryKey(),
  conversationId: varchar("conversation_id").unique().notNull(), // UUID for client reference
  
  // Foreign Keys for Data Integrity
  userId: varchar("user_id"), // FK to users.id (nullable for anonymous)
  stationId: varchar("station_id"), // FK to stationRegistry.stationId  
  franchiseId: integer("franchise_id"), // FK to franchisees.id
  
  // External IDs for flexibility (legacy systems, integrations)
  externalUserId: varchar("external_user_id"), // For non-Firebase auth
  externalSystemId: varchar("external_system_id"), // For third-party integrations
  
  // Conversation Metadata
  sessionId: varchar("session_id").notNull(), // Browser/app session
  language: varchar("language").default("en"), // he, en, ar, es, fr, ru
  status: varchar("status").default("active"), // active, archived, deleted
  source: varchar("source").default("web"), // web, mobile, pwa, kiosk
  metadata: jsonb("metadata"), // Custom data: device info, location, referrer
  
  // GDPR & Privacy Controls
  retentionPolicyId: integer("retention_policy_id"), // Link to retention policy
  dataSubjectId: varchar("data_subject_id"), // GDPR data subject identifier
  isAnonymized: boolean("is_anonymized").default(false),
  anonymizedAt: timestamp("anonymized_at"),
  consentGiven: boolean("consent_given").default(false),
  consentGivenAt: timestamp("consent_given_at"),
  
  // Soft Delete & Lifecycle
  deletedAt: timestamp("deleted_at"), // Soft delete for recovery
  deletedBy: varchar("deleted_by"), // Who deleted it
  
  // Timestamps
  lastMessageAt: timestamp("last_message_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  archivedAt: timestamp("archived_at"),
}, (table) => ({
  // Basic Indexes
  conversationIdIdx: index("idx_chat_conversation_id").on(table.conversationId),
  userIdx: index("idx_chat_user").on(table.userId),
  stationIdx: index("idx_chat_station").on(table.stationId),
  franchiseIdx: index("idx_chat_franchise").on(table.franchiseId),
  statusIdx: index("idx_chat_status").on(table.status),
  createdIdx: index("idx_chat_created").on(table.createdAt),
  
  // Composite Indexes for Performance
  userLastMsgIdx: index("idx_chat_user_last_msg").on(table.userId, table.lastMessageAt.desc()),
  stationStatusIdx: index("idx_chat_station_status").on(table.stationId, table.status),
  
  // Foreign Key Constraints
  userFk: foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "fk_chat_conv_user"
  }),
  stationFk: foreignKey({
    columns: [table.stationId],
    foreignColumns: [stationRegistry.stationId],
    name: "fk_chat_conv_station"
  }),
  franchiseFk: foreignKey({
    columns: [table.franchiseId],
    foreignColumns: [franchisees.id],
    name: "fk_chat_conv_franchise"
  }),
}));

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  messageId: varchar("message_id").unique().notNull(), // UUID
  conversationId: varchar("conversation_id").notNull(), // FK to chat_conversations.conversationId
  
  // Message Content
  role: varchar("role").notNull(), // user, assistant, system
  content: text("content").notNull(),
  
  // AI/Learning Metadata
  source: varchar("source").default("gemini"), // gemini, learned, hybrid
  confidence: integer("confidence"), // 0-100 for learned responses
  modelVersion: varchar("model_version"), // Track AI model used
  
  // Localization
  language: varchar("language").default("en"),
  
  // Privacy & GDPR
  isAnonymized: boolean("is_anonymized").default(false),
  anonymizedAt: timestamp("anonymized_at"),
  originalContent: text("original_content"), // Backup before anonymization
  
  // Attachments & Metadata
  attachments: jsonb("attachments"), // Array of file URLs/metadata
  metadata: jsonb("metadata"), // Sentiment, intent, tags, etc.
  
  // Read Status
  readAt: timestamp("read_at"),
  
  // Soft Delete
  deletedAt: timestamp("deleted_at"),
  
  // Event Outbox for EventBus Integration
  eventPublished: boolean("event_published").default(false),
  eventPublishedAt: timestamp("event_published_at"),
  eventRetryCount: integer("event_retry_count").default(0),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Basic Indexes
  messageIdIdx: index("idx_chat_message_id").on(table.messageId),
  conversationIdx: index("idx_chat_message_conversation").on(table.conversationId),
  roleIdx: index("idx_chat_message_role").on(table.role),
  createdIdx: index("idx_chat_message_created").on(table.createdAt),
  
  // Composite Indexes for Pagination & Queries
  convCreatedIdx: index("idx_chat_msg_conv_created").on(table.conversationId, table.createdAt.asc()),
  convUnreadIdx: index("idx_chat_msg_conv_unread").on(table.conversationId, table.readAt),
  
  // Event Outbox Index
  eventOutboxIdx: index("idx_chat_msg_event_outbox").on(table.eventPublished, table.eventRetryCount),
  
  // Foreign Key Constraint to Conversations
  conversationFk: foreignKey({
    columns: [table.conversationId],
    foreignColumns: [chatConversations.conversationId],
    name: "fk_chat_msg_conversation"
  }),
}));

export const chatAttachments = pgTable("chat_attachments", {
  id: serial("id").primaryKey(),
  messageId: varchar("message_id").notNull(), // FK to chat_messages.messageId
  conversationId: varchar("conversation_id").notNull(), // Denormalized for queries
  
  // File Metadata
  attachmentType: varchar("attachment_type").notNull(), // image, document, audio, video
  fileName: varchar("file_name").notNull(),
  fileSize: integer("file_size"), // bytes
  mimeType: varchar("mime_type"),
  
  // Storage
  url: text("url").notNull(), // Storage URL (Firebase Storage or GCS)
  storageProvider: varchar("storage_provider").default("firebase"), // firebase, gcs, s3
  bucketName: varchar("bucket_name"),
  storagePath: text("storage_path"),
  
  // Preview
  thumbnail: text("thumbnail"), // Thumbnail URL for images/videos
  metadata: jsonb("metadata"), // Dimensions, duration, EXIF, etc.
  
  // Privacy & Compliance
  encryptionKey: varchar("encryption_key"), // For encrypted files
  isRedacted: boolean("is_redacted").default(false),
  redactedAt: timestamp("redacted_at"),
  retentionPolicyId: integer("retention_policy_id"),
  
  // Upload Info
  uploadedBy: varchar("uploaded_by"), // user_id
  
  // Soft Delete
  deletedAt: timestamp("deleted_at"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  messageIdx: index("idx_chat_attachment_message").on(table.messageId),
  conversationIdx: index("idx_chat_attachment_conversation").on(table.conversationId),
  typeIdx: index("idx_chat_attachment_type").on(table.attachmentType),
  storageIdx: index("idx_chat_attachment_storage").on(table.storageProvider, table.bucketName),
  
  // Foreign Key Constraints
  messageFk: foreignKey({
    columns: [table.messageId],
    foreignColumns: [chatMessages.messageId],
    name: "fk_chat_attach_message"
  }),
  conversationFk: foreignKey({
    columns: [table.conversationId],
    foreignColumns: [chatConversations.conversationId],
    name: "fk_chat_attach_conversation"
  }),
}));

export const chatAnalytics = pgTable("chat_analytics", {
  id: serial("id").primaryKey(),
  conversationId: varchar("conversation_id").notNull(),
  messageId: varchar("message_id"),
  
  // Event Data
  eventType: varchar("event_type").notNull(), // message_sent, helpful_click, not_helpful_click, follow_up, conversation_closed
  eventData: jsonb("event_data"), // Custom event metadata
  
  // Context
  userId: varchar("user_id"),
  language: varchar("language"),
  source: varchar("source"), // web, mobile, pwa
  
  // Event Correlation (for EventBus tracing)
  correlationId: varchar("correlation_id"), // Trace across services
  parentEventId: varchar("parent_event_id"),
  
  // Timestamps
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => ({
  conversationIdx: index("idx_chat_analytics_conversation").on(table.conversationId),
  eventIdx: index("idx_chat_analytics_event").on(table.eventType),
  timestampIdx: index("idx_chat_analytics_timestamp").on(table.timestamp),
  correlationIdx: index("idx_chat_analytics_correlation").on(table.correlationId),
  userEventIdx: index("idx_chat_analytics_user_event").on(table.userId, table.eventType),
  
  // Foreign Key Constraints
  conversationFk: foreignKey({
    columns: [table.conversationId],
    foreignColumns: [chatConversations.conversationId],
    name: "fk_chat_analytics_conversation"
  }),
  messageFk: foreignKey({
    columns: [table.messageId],
    foreignColumns: [chatMessages.messageId],
    name: "fk_chat_analytics_message"
  }),
}));

// =================== EVENT OUTBOX FOR EVENTBUS INTEGRATION ===================

export const chatEventOutbox = pgTable("chat_event_outbox", {
  id: serial("id").primaryKey(),
  eventId: varchar("event_id").unique().notNull(), // UUID
  eventType: varchar("event_type").notNull(), // ChatMessageCreated, ChatConversationArchived, etc.
  aggregateType: varchar("aggregate_type").notNull(), // ChatConversation, ChatMessage
  aggregateId: varchar("aggregate_id").notNull(), // conversationId or messageId
  
  // Event Payload
  payload: jsonb("payload").notNull(), // Full event data
  metadata: jsonb("metadata"), // Correlation ID, user context, etc.
  
  // Delivery Status
  published: boolean("published").default(false),
  publishedAt: timestamp("published_at"),
  retryCount: integer("retry_count").default(0),
  maxRetries: integer("max_retries").default(5),
  nextRetryAt: timestamp("next_retry_at"),
  
  // Error Tracking
  lastError: text("last_error"),
  lastErrorAt: timestamp("last_error_at"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  eventIdIdx: index("idx_chat_outbox_event_id").on(table.eventId),
  publishedIdx: index("idx_chat_outbox_published").on(table.published, table.nextRetryAt),
  aggregateIdx: index("idx_chat_outbox_aggregate").on(table.aggregateType, table.aggregateId),
  eventTypeIdx: index("idx_chat_outbox_event_type").on(table.eventType),
}));

// =================== INSERT SCHEMAS & TYPE EXPORTS ===================

export const insertChatConversationSchema = createInsertSchema(chatConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  lastMessageAt: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
  archivedAt: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
  anonymizedAt: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
  consentGivenAt: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
  deletedAt: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
});
export type InsertChatConversation = z.infer<typeof insertChatConversationSchema>;
export type ChatConversation = typeof chatConversations.$inferSelect;

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  eventPublished: true,
  eventPublishedAt: true,
  eventRetryCount: true,
}).extend({
  readAt: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
  anonymizedAt: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
  deletedAt: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
});
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

export const insertChatAttachmentSchema = createInsertSchema(chatAttachments).omit({
  id: true,
  createdAt: true,
}).extend({
  redactedAt: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
  deletedAt: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
});
export type InsertChatAttachment = z.infer<typeof insertChatAttachmentSchema>;
export type ChatAttachment = typeof chatAttachments.$inferSelect;

export const insertChatAnalyticsSchema = createInsertSchema(chatAnalytics).omit({
  id: true,
  timestamp: true,
});
export type InsertChatAnalytics = z.infer<typeof insertChatAnalyticsSchema>;
export type ChatAnalytics = typeof chatAnalytics.$inferSelect;

export const insertChatEventOutboxSchema = createInsertSchema(chatEventOutbox).omit({
  id: true,
  createdAt: true,
  published: true,
  publishedAt: true,
  retryCount: true,
}).extend({
  nextRetryAt: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
  lastErrorAt: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
});
export type InsertChatEventOutbox = z.infer<typeof insertChatEventOutboxSchema>;
export type ChatEventOutbox = typeof chatEventOutbox.$inferSelect;

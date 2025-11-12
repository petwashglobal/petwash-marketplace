// Firestore Schema Definitions for Pet Wash™
// Collections: userInbox, franchiseInbox, pets, vouchers

import { z } from "zod";

// ============================================
// USER INBOX SCHEMA
// ============================================

export const userInboxMessageSchema = z.object({
  id: z.string(), // msgId
  title: z.string(),
  bodyHtml: z.string(), // Sanitized HTML
  type: z.enum(["voucher", "system", "receipt", "promo"]),
  ctaText: z.string().optional(),
  ctaUrl: z.string().optional(),
  createdAt: z.date(),
  readAt: z.date().nullable(),
  locale: z.enum(["he", "en"]),
  priority: z.number().int().default(0), // Higher = more important
  attachments: z.array(z.string()).default([]), // Firebase Storage paths
  meta: z.object({
    voucherCode: z.string().optional(),
    discountPercent: z.number().optional(),
    expiry: z.date().optional(),
  }).optional(),
});

export type UserInboxMessage = z.infer<typeof userInboxMessageSchema>;

// ============================================
// FRANCHISE INBOX SCHEMA
// ============================================

export const franchiseInboxMessageSchema = z.object({
  id: z.string(), // msgId
  title: z.string(),
  bodyHtml: z.string(), // Sanitized HTML
  category: z.enum(["ops", "marketing", "finance", "announcement"]),
  attachments: z.array(z.string()).default([]), // Firebase Storage paths
  createdAt: z.date(),
  readAt: z.date().nullable(),
  requiresAck: z.boolean().default(false),
  ackAt: z.date().nullable(),
  meta: z.object({
    period: z.string().optional(), // e.g., "2025-01"
    reportLinks: z.array(z.string()).optional(),
  }).optional(),
});

export type FranchiseInboxMessage = z.infer<typeof franchiseInboxMessageSchema>;

// ============================================
// PET PROFILES SCHEMA
// ============================================

export const petProfileSchema = z.object({
  id: z.string(), // petId
  uid: z.string(), // Owner's Firebase UID
  name: z.string().min(1),
  species: z.enum(["dog", "cat", "other"]).default("dog"),
  breed: z.string().optional(),
  gender: z.enum(["male", "female", "unknown"]).optional(),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Birthday must be in YYYY-MM-DD format" }).optional(), // YYYY-MM-DD
  weightKg: z.number().positive().optional(),
  allergies: z.string().optional(),
  preferredShampoo: z.string().optional(),
  microchip: z.string().optional(),
  vetName: z.string().optional(),
  vaccineDates: z.object({
    rabies: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Date must be in YYYY-MM-DD format" }).optional(), // YYYY-MM-DD
    dhpp: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Date must be in YYYY-MM-DD format" }).optional(),
    lepto: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Date must be in YYYY-MM-DD format" }).optional(),
  }).optional(),
  reminderEnabled: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable().default(null), // Soft delete
});

export type PetProfile = z.infer<typeof petProfileSchema>;

// Insert schemas (for creating new records)
export const insertPetProfileSchema = petProfileSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  deletedAt: true,
});

export type InsertPetProfile = z.infer<typeof insertPetProfileSchema>;

// ============================================
// ENHANCED VOUCHER SCHEMA (Firestore)
// ============================================

export const firestoreVoucherSchema = z.object({
  code: z.string(), // Unique voucher code
  type: z.enum([
    "BIRTHDAY_10",
    "VALENTINE_15", 
    "LOYALTY_5",
    "DISABILITY_10",
    "SENIOR_10",
    "NEW_MEMBER_10",
    "CUSTOM",
  ]),
  issuedToUid: z.string(),
  issuedForPetId: z.string().optional(), // For birthday vouchers
  issuedAt: z.date(),
  expiresAt: z.date(),
  redeemedTxId: z.string().nullable(),
  discountPercent: z.number().int().min(1).max(100),
  oneTime: z.boolean().default(true),
  status: z.enum(["active", "expired", "redeemed"]),
  campaignId: z.string().optional(), // Link to seasonal campaign
  createdBy: z.enum(["system", "admin", "campaign"]).default("system"),
});

export type FirestoreVoucher = z.infer<typeof firestoreVoucherSchema>;

// ============================================
// CAMPAIGN SCHEMA
// ============================================

export const campaignSchema = z.object({
  id: z.string(),
  name: z.string(),
  locale: z.enum(["he", "en", "both"]),
  startDate: z.date(),
  endDate: z.date(),
  eligibleSegment: z.enum([
    "all_users",
    "active_users", 
    "franchise_area",
    "pet_owners",
    "custom",
  ]),
  voucherConfig: z.object({
    enabled: z.boolean(),
    type: z.string(),
    discountPercent: z.number(),
    validityDays: z.number(),
    onDemandIssuance: z.boolean().default(true), // Create on first click
  }).optional(),
  landingUrl: z.string().optional(),
  inboxMessage: z.object({
    title: z.string(),
    bodyHtml: z.string(),
    ctaText: z.string(),
  }),
  emailTemplate: z.string().optional(),
  metrics: z.object({
    impressions: z.number().default(0),
    clicks: z.number().default(0),
    redemptions: z.number().default(0),
  }).default({ impressions: 0, clicks: 0, redemptions: 0 }),
  status: z.enum(["draft", "scheduled", "active", "completed", "stopped"]),
  createdAt: z.date(),
  createdBy: z.string(), // Admin UID
});

export type Campaign = z.infer<typeof campaignSchema>;

// ============================================
// FRANCHISE PROFILE SCHEMA
// ============================================

export const franchiseProfileSchema = z.object({
  id: z.string(), // franchiseId
  locationName: z.string(),
  address: z.string(),
  city: z.string(),
  region: z.string().optional(),
  ownerName: z.string(),
  ownerEmail: z.string().email({ message: "Please enter a valid email address" }),
  ownerPhone: z.string(),
  machineIds: z.array(z.string()).default([]),
  status: z.enum(["active", "inactive", "suspended"]).default("active"),
  joinedAt: z.date(),
  settings: z.object({
    autoReportEmail: z.boolean().default(true),
    maintenanceAlerts: z.boolean().default(true),
    marketingUpdates: z.boolean().default(true),
  }).optional(),
});

export type FranchiseProfile = z.infer<typeof franchiseProfileSchema>;

// ============================================
// SERVICE TICKETS SCHEMA
// ============================================

export const serviceTicketSchema = z.object({
  id: z.string(), // ticketId
  franchiseId: z.string(),
  subject: z.string(),
  description: z.string(),
  category: z.enum(["maintenance", "technical", "supplies", "other"]),
  status: z.enum(["open", "assigned", "in_progress", "resolved", "closed"]),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  assignedTechnician: z.string().optional(),
  technicianNotes: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  resolvedAt: z.date().nullable(),
  attachments: z.array(z.string()).default([]),
});

export type ServiceTicket = z.infer<typeof serviceTicketSchema>;

export const insertServiceTicketSchema = serviceTicketSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
});

export type InsertServiceTicket = z.infer<typeof insertServiceTicketSchema>;

// ============================================
// MARKETING ASSETS SCHEMA
// ============================================

export const marketingAssetSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  type: z.enum(["photo", "video", "template", "brochure"]),
  category: z.enum(["social_media", "print", "campaign", "brand_assets"]),
  fileUrl: z.string(), // Firebase Storage URL
  thumbnailUrl: z.string().optional(),
  fileSize: z.number().optional(),
  locale: z.enum(["he", "en", "both"]).default("both"),
  tags: z.array(z.string()).default([]),
  uploadedAt: z.date(),
  uploadedBy: z.string(), // Admin UID
});

export type MarketingAsset = z.infer<typeof marketingAssetSchema>;

// ============================================
// ADMIN INBOX ACTION LOG
// ============================================

export const adminActionLogSchema = z.object({
  id: z.string(),
  adminUid: z.string(),
  adminEmail: z.string(),
  action: z.enum([
    "inbox_message_sent",
    "campaign_created",
    "campaign_started",
    "campaign_stopped",
    "franchise_message_sent",
    "voucher_issued",
  ]),
  targetType: z.enum(["user", "franchise", "segment", "all"]),
  targetId: z.string().optional(),
  details: z.record(z.any()),
  ipAddress: z.string().optional(),
  timestamp: z.date(),
});

export type AdminActionLog = z.infer<typeof adminActionLogSchema>;

// ============================================
// OBSERVANCES SCHEMA (Pet Holidays & Events)
// ============================================

const dateRuleSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("fixed_date"),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
  }),
  z.object({
    type: z.literal("last_weekday_in_month"),
    weekday: z.enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]),
    month: z.number().int().min(1).max(12),
  }),
]);

const observanceEventSchema = z.object({
  key: z.string(), // Unique event identifier
  active: z.boolean(),
  titles: z.object({
    en: z.string(),
    he: z.string(),
  }),
  bodies: z.object({
    en: z.string(),
    he: z.string(),
  }),
  rule: dateRuleSchema,
  promo: z.object({
    discount_percent: z.number().optional(),
    donation_percent: z.number().optional(),
    code_template: z.string(), // e.g., "DOGDAY-{YYYY}-{RND6}"
    valid_days: z.number().int(),
    informational_only: z.boolean().optional(),
  }),
  appearance: z.object({
    icon: z.string(), // Lucide icon name
    accent: z.string(), // Color accent
    card_style: z.string(), // e.g., "luxury"
  }),
  idempotency_key_template: z.string(), // e.g., "observance:{UID}:international_dog_day:{YYYY}"
});

export const observanceConfigSchema = z.object({
  locale: z.string(), // e.g., "en-AU", "he-IL"
  tz: z.string(), // Timezone e.g., "Asia/Jerusalem"
  evaluate_at: z.string(), // Time to check e.g., "09:00"
  currency: z.string(), // Currency code e.g., "ILS"
  events: z.array(observanceEventSchema),
  updated_at: z.string(), // ISO timestamp
});

export type ObservanceEvent = z.infer<typeof observanceEventSchema>;
export type ObservanceConfig = z.infer<typeof observanceConfigSchema>;
export type DateRule = z.infer<typeof dateRuleSchema>;

// ============================================
// USER ROLES SCHEMA (for Ops Hub permissions)
// ============================================

export const userRolesSchema = z.object({
  owner: z.boolean().optional(),
  manager: z.boolean().optional(),
  tech: z.boolean().optional(),
});

export type UserRoles = z.infer<typeof userRolesSchema>;

// ============================================
// EMPLOYEE PROFILE SCHEMA (Staff/Team Management)
// ============================================

export const employeeRoleEnum = z.enum([
  "admin",
  "ops",
  "manager",
  "maintenance",
  "support",
  "marketing",
  "accounts",
  "subcontractors",
]);

export type EmployeeRole = z.infer<typeof employeeRoleEnum>;

export const employeeStatusEnum = z.enum([
  "active",
  "suspended",
  "inactive",
]);

export type EmployeeStatus = z.infer<typeof employeeStatusEnum>;

export const employeeProfileSchema = z.object({
  uid: z.string(), // Firebase Auth UID
  fullName: z.string().min(1, { message: "Full name is required" }),
  email: z.string().email({ message: "Please enter a valid email address" }),
  phone: z.string().optional(),
  role: employeeRoleEnum,
  stations: z.array(z.string()).default([]), // Array of station IDs
  status: employeeStatusEnum.default("active"),
  employeeId: z.string().optional(), // Internal employee number
  notes: z.string().optional(), // Admin notes about this employee
  createdAt: z.date(),
  createdBy: z.string(), // UID of admin who created this account
  updatedAt: z.date(),
  lastLoginAt: z.date().optional(),
});

export type EmployeeProfile = z.infer<typeof employeeProfileSchema>;

export const insertEmployeeProfileSchema = employeeProfileSchema.omit({
  uid: true,          // Server generates this
  createdAt: true,
  createdBy: true,    // Server sets this
  updatedAt: true,
  lastLoginAt: true,
  status: true,       // Server defaults this to 'active'
});

export type InsertEmployeeProfile = z.infer<typeof insertEmployeeProfileSchema>;

// ============================================
// STATIONS MANAGEMENT SCHEMA
// ============================================

// Utility sub-schemas
const stationUtilitySchema = z.object({
  provider: z.string(),
  accountNumber: z.string().optional(),
  policyNumber: z.string().optional(),
  meterId: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().optional(),
  tariffPlan: z.string().optional(),
  lastBillAmount: z.number().optional(),
  renewalDate: z.date().optional(),
  documents: z.array(z.string()).default([]), // GCS URLs
});

// Council/Municipality contact schema
const councilContactSchema = z.object({
  name: z.string().optional(), // Council/Municipality Name
  contactPerson: z.string().optional(), // Contact Person Name
  role: z.string().optional(), // Role/Department
  phone: z.string().optional(), // Phone (digits only)
  email: z.string().email({ message: "Please enter a valid email address" }).optional(), // Email
  notes: z.string().optional(), // Notes field
});

export const stationSchema = z.object({
  id: z.string(), // stationId (docId)
  serialNumber: z.string(), // Unique, e.g., "PW-IL-00021"
  name: z.string(),
  brand: z.string().default("Pet Wash"),
  address: z.object({
    line1: z.string(),
    line2: z.string().optional(),
    city: z.string(),
    postcode: z.string(),
    country: z.string().default("IL"),
  }),
  council: z.string().optional(),
  geo: z.object({
    lat: z.number(),
    lng: z.number(),
    plusCode: z.string().optional(),
  }).optional(),
  photos: z.array(z.string()).default([]), // GCS URLs
  status: z.enum(["planned", "installing", "active", "paused", "decommissioned"]).default("planned"),
  openedAt: z.date().optional(),
  
  // Utilities tracking
  utilities: z.object({
    insurance: stationUtilitySchema.optional(),
    electricity: stationUtilitySchema.optional(),
    water: stationUtilitySchema.optional(),
    council: councilContactSchema.optional(),
  }).optional(),
  
  // Nayax integration (Phase 2)
  nayax: z.object({
    terminalId: z.string().optional(),
    deviceId: z.string().optional(),
    merchantId: z.string().optional(),
  }).optional(),
  
  // Alert thresholds
  thresholds: z.object({
    minStock: z.object({
      shampoo: z.number().min(0).default(10),
      conditioner: z.number().min(0).default(10),
      disinfectant: z.number().min(0).default(5),
      fragrance: z.number().min(0).default(5),
    }),
    alertEmail: z.string().email({ message: "Please enter a valid email address" }).default("Support@PetWash.co.il"),
    alertSlack: z.boolean().default(true),
  }).optional(),
  
  // Audit fields
  createdBy: z.string(),
  createdAt: z.date(),
  updatedBy: z.string(),
  updatedAt: z.date(),
});

export type Station = z.infer<typeof stationSchema>;

export const insertStationSchema = stationSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertStation = z.infer<typeof insertStationSchema>;

// Station Inventory (legacy flat format - deprecated)
export const stationInventorySchema = z.object({
  stationId: z.string(), // Links to station doc
  items: z.object({
    shampoo: z.object({
      onHand: z.number().min(0),
      uom: z.string().default("L"),
      updatedAt: z.date(),
    }),
    conditioner: z.object({
      onHand: z.number().min(0),
      uom: z.string().default("L"),
      updatedAt: z.date(),
    }),
    disinfectant: z.object({
      onHand: z.number().min(0),
      uom: z.string().default("L"),
      updatedAt: z.date(),
    }),
    fragrance: z.object({
      onHand: z.number().min(0),
      uom: z.string().default("L"),
      updatedAt: z.date(),
    }),
  }),
  weeklyUsageRolling: z.object({
    shampoo: z.number().default(0),
    conditioner: z.number().default(0),
    disinfectant: z.number().default(0),
    fragrance: z.number().default(0),
  }).optional(),
  lastDelivery: z.object({
    at: z.date(),
    by: z.string(),
    note: z.string().optional(),
  }).optional(),
});

export type StationInventory = z.infer<typeof stationInventorySchema>;

// Station Inventory Item (subcollection format for Ops Hub MVP)
// Path: stations/{id}/inventory/{sku}
export const inventoryItemSchema = z.object({
  name: z.string(), // e.g., "Shampoo", "Conditioner", "Disinfectant"
  unit: z.string().default("L"), // Unit of measurement
  qty: z.number().min(0), // Current quantity
  reorderLevel: z.number().min(0), // Threshold for low-stock alerts
  lastRefillAt: z.date().optional(), // Last time stock was refilled
  notes: z.string().optional(), // Field notes
});

export type InventoryItem = z.infer<typeof inventoryItemSchema>;

export const insertInventoryItemSchema = inventoryItemSchema.partial({
  lastRefillAt: true,
  notes: true,
});

export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;

// Station Activity (Audit Log) - NEW
// Path: stations/{id}/activity/{eventId}
export const stationActivitySchema = z.object({
  id: z.string(), // Event ID
  type: z.enum(['inventory_update', 'note', 'status_change']),
  updatedAt: z.date(), // When the activity occurred
  updatedBy: z.string(), // UID of user who made the change
  data: z.object({
    itemId: z.string().optional(), // For inventory updates: "shampoo", "conditioner", "disinfectant"
    oldQty: z.number().optional(),
    newQty: z.number().optional(),
    delta: z.number().optional(), // For adjust operations
    reorderLevel: z.number().optional(),
    notes: z.string().optional(),
    note: z.string().optional(), // For note-type activities
  }),
});

export type StationActivity = z.infer<typeof stationActivitySchema>;

// Station Events (LEGACY - being phased out in favor of activity)
export const stationEventSchema = z.object({
  id: z.string(),
  stationId: z.string(),
  type: z.enum([
    "inventory_adjusted",
    "low_stock",
    "policy_expiring",
    "install_completed",
    "note",
    "status_change",
  ]),
  at: z.date(),
  by: z.string(), // UID or "system"
  data: z.record(z.any()),
});

export type StationEvent = z.infer<typeof stationEventSchema>;

export const insertStationEventSchema = stationEventSchema.omit({
  id: true,
});

export type InsertStationEvent = z.infer<typeof insertStationEventSchema>;

// Low-Stock Alerts
export const lowStockAlertSchema = z.object({
  id: z.string(),
  stationId: z.string(),
  sku: z.string(), // e.g., "shampoo", "conditioner", "disinfectant"
  qty: z.number(),
  threshold: z.number(), // The reorderLevel that was breached
  createdAt: z.date(),
  acknowledged: z.boolean().default(false),
  acknowledgedAt: z.date().optional(),
  acknowledgedBy: z.string().optional(), // UID
});

export type LowStockAlert = z.infer<typeof lowStockAlertSchema>;

export const insertLowStockAlertSchema = lowStockAlertSchema.omit({
  id: true,
});

export type InsertLowStockAlert = z.infer<typeof insertLowStockAlertSchema>;

// Station Usage Daily
export const stationUsageDailySchema = z.object({
  id: z.string(), // Format: ${stationId}_${YYYY-MM-DD}
  stationId: z.string(),
  date: z.string(), // YYYY-MM-DD
  washesCount: z.number().int().default(0),
  avgSpend: z.number().default(0),
  revenue: z.number().default(0),
  avgDurationSec: z.number().default(0),
});

export type StationUsageDaily = z.infer<typeof stationUsageDailySchema>;

// Reconciliation Daily (Phase 2 placeholder)
export const reconciliationDailySchema = z.object({
  id: z.string(), // Format: ${stationId}_${YYYY-MM-DD}
  stationId: z.string(),
  date: z.string(), // YYYY-MM-DD
  expectedRevenue: z.number().default(0),
  actualRevenue: z.number().default(0),
  variance: z.number().default(0),
  reconciled: z.boolean().default(false),
  notes: z.string().optional(),
  reconciledAt: z.date().optional(),
  reconciledBy: z.string().optional(),
});

export type ReconciliationDaily = z.infer<typeof reconciliationDailySchema>;

// ============================================
// TEAM MESSAGING SCHEMA (WhatsApp-style)
// ============================================

export const messagePriorityEnum = z.enum(["low", "normal", "high", "urgent"]);
export type MessagePriority = z.infer<typeof messagePriorityEnum>;

export const messageAttachmentSchema = z.object({
  id: z.string(), // Unique attachment ID
  fileName: z.string(),
  fileSize: z.number(), // Bytes
  mimeType: z.string(),
  gcsUrl: z.string(), // Google Cloud Storage URL
  thumbnailUrl: z.string().optional(), // For images/videos
  uploadedAt: z.date(),
});

export type MessageAttachment = z.infer<typeof messageAttachmentSchema>;

export const teamMessageSchema = z.object({
  id: z.string(), // Message ID
  conversationId: z.string(), // Conversation thread ID
  senderId: z.string(), // Employee UID
  senderName: z.string(),
  content: z.string(), // Message text
  priority: messagePriorityEnum.default("normal"),
  attachments: z.array(messageAttachmentSchema).default([]),
  createdAt: z.date(),
  editedAt: z.date().nullable().default(null),
  deletedAt: z.date().nullable().default(null), // Soft delete
  readBy: z.array(z.object({
    uid: z.string(),
    readAt: z.date(),
  })).default([]),
  reactions: z.array(z.object({
    uid: z.string(),
    emoji: z.string(),
    createdAt: z.date(),
  })).default([]),
});

export type TeamMessage = z.infer<typeof teamMessageSchema>;

export const conversationSchema = z.object({
  id: z.string(), // Conversation ID
  type: z.enum(["direct", "group"]), // Direct message or group chat
  participants: z.array(z.string()), // Array of employee UIDs
  title: z.string().optional(), // For group chats
  createdBy: z.string(), // Creator UID
  createdAt: z.date(),
  lastMessageAt: z.date(),
  lastMessagePreview: z.string().optional(),
  unreadCount: z.record(z.string(), z.number()).default({}), // { uid: count }
  archived: z.array(z.string()).default([]), // UIDs who archived the chat
  pinned: z.array(z.string()).default([]), // UIDs who pinned the chat
  pinnedMessageId: z.string().nullable().default(null), // One pinned message per conversation
  pinnedBy: z.string().nullable().default(null), // UID of user who pinned the message
  pinnedAt: z.date().nullable().default(null), // When message was pinned
});

export type Conversation = z.infer<typeof conversationSchema>;

// Insert schemas
export const insertTeamMessageSchema = teamMessageSchema.omit({
  id: true,
  createdAt: true,
  editedAt: true,
  deletedAt: true,
  readBy: true,
  reactions: true,
});

export type InsertTeamMessage = z.infer<typeof insertTeamMessageSchema>;

export const insertConversationSchema = conversationSchema.omit({
  id: true,
  createdAt: true,
  lastMessageAt: true,
  lastMessagePreview: true,
  unreadCount: true,
  archived: true,
  pinned: true,
  pinnedMessageId: true,
  pinnedBy: true,
  pinnedAt: true,
});

export type InsertConversation = z.infer<typeof insertConversationSchema>;

// ============================================
// FIRESTORE PATHS (for reference)
// ============================================

export const FIRESTORE_PATHS = {
  USER_INBOX: (uid: string, msgId?: string) => 
    msgId ? `userInbox/${uid}/messages/${msgId}` : `userInbox/${uid}/messages`,
  
  FRANCHISE_INBOX: (franchiseId: string, msgId?: string) =>
    msgId ? `franchiseInbox/${franchiseId}/messages/${msgId}` : `franchiseInbox/${franchiseId}/messages`,
  
  FRANCHISE_PROFILES: (franchiseId?: string) =>
    franchiseId ? `franchiseProfiles/${franchiseId}` : `franchiseProfiles`,
  
  PETS: (uid: string, petId?: string) =>
    petId ? `pets/${uid}/${petId}` : `pets/${uid}`,
  
  VOUCHERS: (code: string) => `vouchers/${code}`,
  
  CAMPAIGNS: (campaignId?: string) =>
    campaignId ? `campaigns/${campaignId}` : `campaigns`,
  
  SERVICE_TICKETS: (franchiseId: string, ticketId?: string) =>
    ticketId ? `serviceTickets/${franchiseId}/${ticketId}` : `serviceTickets/${franchiseId}`,
  
  MARKETING_ASSETS: (assetId?: string) =>
    assetId ? `marketingAssets/${assetId}` : `marketingAssets`,
  
  ADMIN_LOGS: (logId?: string) =>
    logId ? `adminLogs/${logId}` : `adminLogs`,
  
  OBSERVANCES: (locale?: string) =>
    locale ? `observances/${locale}` : `observances`,
  
  // Stations Management
  STATIONS: (stationId?: string) =>
    stationId ? `stations/${stationId}` : `stations`,
  
  STATION_INVENTORY_LEGACY: (stationId: string) =>
    `station_inventory/${stationId}`,
  
  STATION_INVENTORY: (stationId: string, sku?: string) =>
    sku ? `stations/${stationId}/inventory/${sku}` : `stations/${stationId}/inventory`,
  
  STATION_EVENTS: (stationId: string, eventId?: string) =>
    eventId ? `station_events/${stationId}_${eventId}` : `station_events`,
  
  STATION_USAGE_DAILY: (stationId: string, date?: string) =>
    date ? `station_usage_daily/${stationId}_${date}` : `station_usage_daily`,
  
  RECONCILIATION_DAILY: (stationId: string, date?: string) =>
    date ? `reconciliation_daily/${stationId}_${date}` : `reconciliation_daily`,
  
  // Alerts
  ALERTS: (alertId?: string) =>
    alertId ? `alerts/${alertId}` : `alerts`,
  
  // User Roles (for Ops Hub)
  USER_ROLES: (uid: string) => `users/${uid}`,
  
  // Employee Profiles (Staff Management)
  EMPLOYEE_PROFILE: (uid: string) => `users/${uid}/employee/profile`,
  EMPLOYEES: () => `employees`, // Collection group for listing all employees
  
  // Team Messaging (WhatsApp-style)
  CONVERSATIONS: (conversationId?: string) =>
    conversationId ? `conversations/${conversationId}` : `conversations`,
  
  MESSAGES: (conversationId: string, messageId?: string) =>
    messageId ? `conversations/${conversationId}/messages/${messageId}` : `conversations/${conversationId}/messages`,
};

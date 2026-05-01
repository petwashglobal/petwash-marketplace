/**
 * Pet Wash Ltd - Super-App Database Schema
 * 
 * Complete database schema for 6 independent business platforms:
 * 1. Pet Wash K9000 Stations (PetWash Hub)
 * 2. Walk My Pet (on-demand dog walking)
 * 3. The Sitter Suite (marketplace-style pet sitting)
 * 4. PetTrek (on-demand pet transport)
 * 5. Groomers Marketplace
 * 6. Shared Pet Services foundation
 * 
 * Architecture: One global super-app with shared services
 * - Shared: Auth, Users, Pets, Booking, Payments, Reviews, Messages, Notifications
 * - Platform-Specific: Each has own routes, menus, dashboards, provider networks
 */

import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  integer,
  decimal,
  boolean,
  serial,
  date,
  real
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================================
// PLATFORM TYPES (6 platforms exactly)
// ============================================================================

export const platformEnum = z.enum([
  'k9000',          // Pet Wash K9000 Stations (PetWash Hub)
  'walk_my_pet',    // on-demand dog walking
  'sitter_suite',   // marketplace-style pet sitting
  'pettrek',        // on-demand pet transport
  'groomers',       // Grooming marketplace
  'shared_services' // Shared Pet Services foundation
]);

export type Platform = z.infer<typeof platformEnum>;

// ============================================================================
// PLATFORMS TABLE (6 business units)
// ============================================================================

export const platforms = pgTable("platforms", {
  id: varchar("id").primaryKey(), // k9000, walk_my_pet, sitter_suite, pettrek, groomers, shared_services
  name: varchar("name").notNull(), // "Pet Wash K9000", "Walk My Pet", etc.
  nameHe: varchar("name_he"), // Hebrew name
  description: text("description"),
  descriptionHe: text("description_he"),
  isActive: boolean("is_active").default(true),
  platformFeePercent: decimal("platform_fee_percent", { precision: 5, scale: 2 }), // 15% flat commission all platforms
  stripeConnectEnabled: boolean("stripe_connect_enabled").default(false), // true for marketplaces
  nayaxEnabled: boolean("nayax_enabled").default(false), // true only for k9000
  settings: jsonb("settings"), // Platform-specific settings
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================================================
// PETS TABLE (Shared across all platforms)
// ============================================================================

export const pets = pgTable("pets", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(), // Owner's Firebase UID
  name: varchar("name").notNull(),
  species: varchar("species").notNull(), // dog, cat, bird, etc.
  breed: varchar("breed"),
  age: integer("age"),
  dateOfBirth: date("date_of_birth"),
  weight: decimal("weight", { precision: 6, scale: 2 }), // in kg
  gender: varchar("gender"), // male, female, unknown
  size: varchar("size"), // small, medium, large, extra_large
  color: varchar("color"),
  microchipId: varchar("microchip_id"),
  photoUrl: varchar("photo_url"),
  
  // Medical info
  allergies: text("allergies"),
  medications: text("medications"),
  specialNeeds: text("special_needs"),
  vetName: varchar("vet_name"),
  vetPhone: varchar("vet_phone"),
  vaccinationStatus: varchar("vaccination_status").default("unknown"), // current, expired, unknown
  lastVaccinationDate: date("last_vaccination_date"),
  nextVaccinationDate: date("next_vaccination_date"),
  
  // Behavioral info
  temperament: varchar("temperament"), // friendly, shy, aggressive, playful
  goodWithKids: boolean("good_with_kids"),
  goodWithDogs: boolean("good_with_dogs"),
  goodWithCats: boolean("good_with_cats"),
  notes: text("notes"),
  
  // Activity tracking
  lastWashDate: timestamp("last_wash_date"),
  lastWalkDate: timestamp("last_walk_date"),
  lastGroomDate: timestamp("last_groom_date"),
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================================================
// PROVIDERS TABLE (Service providers across all marketplace platforms)
// ============================================================================

export const providers = pgTable("providers", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().unique(), // Firebase UID (one user can be multiple provider types)
  platformId: varchar("platform_id").notNull(), // walk_my_pet, sitter_suite, pettrek, groomers
  
  // Profile
  businessName: varchar("business_name"),
  bio: text("bio"),
  bioHe: text("bio_he"),
  photoUrl: varchar("photo_url"),
  languages: text("languages").array(), // ["en", "he", "ar"]
  
  // Verification status
  verificationStatus: varchar("verification_status").default("pending"), // pending, approved, rejected, suspended
  verificationDocuments: jsonb("verification_documents"), // IDs, certificates, insurance
  backgroundCheckStatus: varchar("background_check_status").default("pending"), // pending, passed, failed
  backgroundCheckDate: timestamp("background_check_date"),
  
  // Insurance (required for sitters, walkers, drivers, groomers)
  insuranceProvider: varchar("insurance_provider"),
  insurancePolicyNumber: varchar("insurance_policy_number"),
  insuranceExpiryDate: date("insurance_expiry_date"),
  insuranceDocumentUrl: varchar("insurance_document_url"),
  
  // Ratings & reviews
  averageRating: decimal("average_rating", { precision: 3, scale: 2 }).default("0"), // 0-5.00
  totalReviews: integer("total_reviews").default(0),
  totalBookings: integer("total_bookings").default(0),
  completionRate: decimal("completion_rate", { precision: 5, scale: 2 }).default("0"), // 0-100%
  
  // Availability
  isAvailable: boolean("is_available").default(true),
  acceptingNewClients: boolean("accepting_new_clients").default(true),
  serviceRadius: integer("service_radius"), // km for mobile services (walkers, drivers, groomers)
  
  // Stripe Connect (for marketplace payouts)
  stripeConnectAccountId: varchar("stripe_connect_account_id"),
  stripeOnboardingComplete: boolean("stripe_onboarding_complete").default(false),
  payoutEnabled: boolean("payout_enabled").default(false),
  
  // Earnings
  totalEarnings: decimal("total_earnings", { precision: 12, scale: 2 }).default("0"),
  pendingPayouts: decimal("pending_payouts", { precision: 12, scale: 2 }).default("0"),
  
  // Platform-specific data
  platformData: jsonb("platform_data"), // walker certifications, sitter home details, vehicle info, etc.
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  platformIdx: index("provider_platform_idx").on(table.platformId),
  userIdx: index("provider_user_idx").on(table.userId),
  verificationIdx: index("provider_verification_idx").on(table.verificationStatus),
}));

// ============================================================================
// LOCATIONS TABLE (Addresses for users, providers, stations)
// ============================================================================

export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"), // User who owns this location (null for stations/public locations)
  providerId: integer("provider_id").references(() => providers.id), // Provider location (if applicable)
  type: varchar("type").notNull(), // user_home, provider_home, station, pickup_point, dropoff_point
  
  // Address
  name: varchar("name"), // "Home", "Office", "K9000 Tel Aviv Central", etc.
  addressLine1: varchar("address_line1").notNull(),
  addressLine2: varchar("address_line2"),
  city: varchar("city").notNull(),
  state: varchar("state"),
  country: varchar("country").default("IL"),
  postalCode: varchar("postal_code"),
  
  // Geocoding
  latitude: real("latitude"),
  longitude: real("longitude"),
  googlePlaceId: varchar("google_place_id"),
  
  // Contact
  phone: varchar("phone"),
  email: varchar("email"),
  
  // Metadata
  instructions: text("instructions"), // "Ring doorbell", "Use back entrance", etc.
  isDefault: boolean("is_default").default(false),
  isPublic: boolean("is_public").default(false), // true for stations, false for private addresses
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdx: index("location_user_idx").on(table.userId),
  typeIdx: index("location_type_idx").on(table.type),
  geoIdx: index("location_geo_idx").on(table.latitude, table.longitude),
}));

// ============================================================================
// STATIONS TABLE (K9000 IoT Wash Stations)
// ============================================================================

export const stations = pgTable("stations", {
  id: serial("id").primaryKey(),
  stationCode: varchar("station_code").notNull().unique(), // "K9000-TLV-01"
  locationId: integer("location_id").references(() => locations.id).notNull(),
  franchiseId: varchar("franchise_id"), // For franchise management - uses Firestore document ID (alphanumeric)
  
  // Station info
  name: varchar("name").notNull(),
  nameHe: varchar("name_he"),
  description: text("description"),
  descriptionHe: text("description_he"),
  photoUrls: text("photo_urls").array(),
  
  // Operational status
  status: varchar("status").default("operational"), // operational, maintenance, offline, out_of_service
  isActive: boolean("is_active").default(true),
  
  // IoT integration
  iotDeviceId: varchar("iot_device_id"),
  iotStatus: jsonb("iot_status"), // temperature, water level, soap level, etc.
  lastHeartbeat: timestamp("last_heartbeat"),
  
  // Pricing
  pricePerWash: decimal("price_per_wash", { precision: 10, scale: 2 }),
  pricePerMinute: decimal("price_per_minute", { precision: 10, scale: 2 }),
  
  // Features
  features: text("features").array(), // ["heated_water", "premium_shampoo", "blow_dryer", "towels"]
  
  // Operating hours
  operatingHours: jsonb("operating_hours"), // { "monday": { "open": "08:00", "close": "20:00" } }
  
  // Stats
  totalWashes: integer("total_washes").default(0),
  totalRevenue: decimal("total_revenue", { precision: 12, scale: 2 }).default("0"),
  averageUsageMinutes: integer("average_usage_minutes"),
  lastMaintenanceDate: date("last_maintenance_date"),
  nextMaintenanceDate: date("next_maintenance_date"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  statusIdx: index("station_status_idx").on(table.status),
  locationIdx: index("station_location_idx").on(table.locationId),
}));

// ============================================================================
// VEHICLES TABLE (PetTrek transport vehicles)
// ============================================================================

export const vehicles = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id").references(() => providers.id).notNull(),
  
  // Vehicle info
  make: varchar("make").notNull(), // Toyota, Honda, etc.
  model: varchar("model").notNull(), // Camry, Civic, etc.
  year: integer("year").notNull(),
  color: varchar("color"),
  licensePlate: varchar("license_plate").notNull().unique(),
  vin: varchar("vin"), // Vehicle identification number
  
  // Vehicle type
  type: varchar("type").notNull(), // sedan, suv, van, truck
  capacity: integer("capacity"), // max pets
  
  // Features
  features: text("features").array(), // ["air_conditioning", "pet_crates", "water_bowls", "ramp"]
  sizeSupport: text("size_support").array(), // ["small", "medium", "large", "extra_large"]
  
  // Verification
  registrationDocumentUrl: varchar("registration_document_url"),
  insuranceDocumentUrl: varchar("insurance_document_url"),
  inspectionDocumentUrl: varchar("inspection_document_url"),
  verificationStatus: varchar("verification_status").default("pending"), // pending, approved, rejected
  
  // Safety & insurance
  insuranceProvider: varchar("insurance_provider"),
  insurancePolicyNumber: varchar("insurance_policy_number"),
  insuranceExpiryDate: date("insurance_expiry_date"),
  lastInspectionDate: date("last_inspection_date"),
  nextInspectionDate: date("next_inspection_date"),
  
  // Stats
  totalTrips: integer("total_trips").default(0),
  averageRating: decimal("average_rating", { precision: 3, scale: 2 }).default("0"),
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  providerIdx: index("vehicle_provider_idx").on(table.providerId),
  verificationIdx: index("vehicle_verification_idx").on(table.verificationStatus),
}));

// ============================================================================
// BOOKINGS TABLE (Unified booking system for all platforms)
// ============================================================================

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  bookingNumber: varchar("booking_number").notNull().unique(), // "WMP-20251112-001"
  
  // Platform & participants
  platformId: varchar("platform_id").notNull(), // walk_my_pet, sitter_suite, pettrek, groomers, k9000
  userId: varchar("user_id").notNull(), // Customer Firebase UID
  providerId: integer("provider_id").references(() => providers.id), // null for k9000 (station bookings)
  petId: integer("pet_id").references(() => pets.id), // Which pet(s)
  pets: text("pets").array(), // Multiple pet IDs for multi-pet bookings
  
  // Location & timing
  pickupLocationId: integer("pickup_location_id").references(() => locations.id),
  dropoffLocationId: integer("dropoff_location_id").references(() => locations.id),
  stationId: integer("station_id").references(() => stations.id), // For k9000 bookings
  
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  duration: integer("duration"), // minutes
  timezone: varchar("timezone").default("Asia/Jerusalem"),
  
  // Booking state machine (critical for business logic)
  status: varchar("status").default("draft").notNull(),
  // draft → pending_payment → confirmed → in_progress → completed → cancelled
  
  // Payment status
  paymentStatus: varchar("payment_status").default("pending"), // pending, paid, refunded, failed
  paymentIntentId: varchar("payment_intent_id"), // Stripe payment intent ID
  paymentMethod: varchar("payment_method"), // card, apple_pay, google_pay, nayax
  
  // Payout status (for marketplace platforms)
  payoutStatus: varchar("payout_status").default("pending"), // pending, processing, paid, failed
  payoutDate: timestamp("payout_date"),
  
  // Pricing
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  platformFee: decimal("platform_fee", { precision: 12, scale: 2 }).default("0"),
  providerPayout: decimal("provider_payout", { precision: 12, scale: 2 }).default("0"),
  discount: decimal("discount", { precision: 12, scale: 2 }).default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency").default("ILS"),
  
  // Service details
  serviceType: varchar("service_type"), // dog_walk, pet_sitting, transport, grooming, wash
  serviceDescription: text("service_description"),
  specialRequests: text("special_requests"),
  
  // Platform-specific data
  platformData: jsonb("platform_data"),
  // walk_my_pet: { route_data, gps_tracking }
  // sitter_suite: { sitting_type: "at_host" | "at_owner", daily_photo_updates: true }
  // pettrek: { vehicle_id, route_data, live_eta }
  // groomers: { services: ["bath", "haircut", "nail_trim"] }
  // k9000: { wash_program, addons: ["blow_dry", "premium_shampoo"] }
  
  // Cancellation
  cancellationReason: text("cancellation_reason"),
  cancelledBy: varchar("cancelled_by"), // customer, provider, admin
  cancelledAt: timestamp("cancelled_at"),
  refundAmount: decimal("refund_amount", { precision: 12, scale: 2 }),
  refundProcessedAt: timestamp("refund_processed_at"),
  
  // Review
  customerReviewId: integer("customer_review_id"),
  providerReviewId: integer("provider_review_id"),
  
  // Timestamps
  confirmedAt: timestamp("confirmed_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  platformIdx: index("booking_platform_idx").on(table.platformId),
  userIdx: index("booking_user_idx").on(table.userId),
  providerIdx: index("booking_provider_idx").on(table.providerId),
  statusIdx: index("booking_status_idx").on(table.status),
  dateIdx: index("booking_date_idx").on(table.startTime),
}));

// ============================================================================
// BOOKING ITEMS TABLE (Line items for bookings)
// ============================================================================

export const bookingItems = pgTable("booking_items", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").references(() => bookings.id, { onDelete: 'cascade' }).notNull(),
  
  // Item details
  itemType: varchar("item_type").notNull(), // service, addon, fee
  name: varchar("name").notNull(),
  nameHe: varchar("name_he"),
  description: text("description"),
  
  // Pricing
  quantity: integer("quantity").default(1),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 12, scale: 2 }).notNull(),
  
  // Metadata
  metadata: jsonb("metadata"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  bookingIdx: index("booking_item_booking_idx").on(table.bookingId),
}));

// ============================================================================
// AVAILABILITY SLOTS TABLE (Provider availability management)
// ============================================================================

export const availabilitySlots = pgTable("availability_slots", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id").references(() => providers.id, { onDelete: 'cascade' }).notNull(),
  platformId: varchar("platform_id").notNull(),
  
  // Time slot
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  timezone: varchar("timezone").default("Asia/Jerusalem"),
  
  // Recurrence (for weekly schedules)
  isRecurring: boolean("is_recurring").default(false),
  recurrenceRule: varchar("recurrence_rule"), // RRULE format (e.g., "FREQ=WEEKLY;BYDAY=MO,TU,WE")
  recurrenceEnd: timestamp("recurrence_end"),
  
  // Status
  status: varchar("status").default("available"), // available, booked, blocked, unavailable
  bookingId: integer("booking_id").references(() => bookings.id), // If booked
  
  // Buffer time
  bufferBefore: integer("buffer_before").default(0), // minutes
  bufferAfter: integer("buffer_after").default(0), // minutes
  
  // Metadata
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  providerIdx: index("availability_provider_idx").on(table.providerId),
  timeIdx: index("availability_time_idx").on(table.startTime, table.endTime),
  statusIdx: index("availability_status_idx").on(table.status),
}));

// ============================================================================
// PAYMENTS TABLE (Payment transaction records)
// ============================================================================

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").references(() => bookings.id).notNull(),
  userId: varchar("user_id").notNull(),
  
  // Payment gateway
  gateway: varchar("gateway").notNull(), // stripe, nayax
  gatewayTransactionId: varchar("gateway_transaction_id"),
  paymentIntentId: varchar("payment_intent_id"), // Stripe payment intent
  
  // Amount
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency").default("ILS"),
  
  // Status
  status: varchar("status").default("pending"), // pending, processing, succeeded, failed, refunded
  
  // Payment method
  paymentMethod: varchar("payment_method"), // card, apple_pay, google_pay, nayax_kiosk
  cardBrand: varchar("card_brand"), // visa, mastercard, amex
  cardLast4: varchar("card_last4"),
  
  // Refund
  refundAmount: decimal("refund_amount", { precision: 12, scale: 2 }),
  refundReason: text("refund_reason"),
  refundedAt: timestamp("refunded_at"),
  
  // Metadata
  metadata: jsonb("metadata"),
  
  // Timestamps
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  bookingIdx: index("payment_booking_idx").on(table.bookingId),
  userIdx: index("payment_user_idx").on(table.userId),
  statusIdx: index("payment_status_idx").on(table.status),
}));

// ============================================================================
// PAYOUTS TABLE (Provider payout records - Stripe Connect)
// ============================================================================

export const payouts = pgTable("payouts", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id").references(() => providers.id).notNull(),
  bookingId: integer("booking_id").references(() => bookings.id),
  
  // Stripe Connect
  stripePayoutId: varchar("stripe_payout_id"),
  stripeTransferId: varchar("stripe_transfer_id"),
  
  // Amount
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  platformFee: decimal("platform_fee", { precision: 12, scale: 2 }).notNull(),
  netAmount: decimal("net_amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency").default("ILS"),
  
  // Status
  status: varchar("status").default("pending"), // pending, processing, paid, failed
  failureReason: text("failure_reason"),
  
  // Timestamps
  scheduledFor: timestamp("scheduled_for"), // T+2 days after booking completion
  processedAt: timestamp("processed_at"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  providerIdx: index("payout_provider_idx").on(table.providerId),
  statusIdx: index("payout_status_idx").on(table.status),
}));

// ============================================================================
// REVIEWS TABLE (Two-way reviews: customer ↔ provider)
// ============================================================================

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").references(() => bookings.id).notNull(),
  platformId: varchar("platform_id").notNull(),
  
  // Reviewer & reviewee
  reviewerId: varchar("reviewer_id").notNull(), // Firebase UID
  reviewerType: varchar("reviewer_type").notNull(), // customer, provider
  revieweeId: varchar("reviewee_id").notNull(), // Who is being reviewed (user_id or provider_id)
  revieweeType: varchar("reviewee_type").notNull(), // customer, provider
  
  // Rating & review
  rating: integer("rating").notNull(), // 1-5 stars
  title: varchar("title"),
  comment: text("comment"),
  commentHe: text("comment_he"),
  
  // Review categories (platform-specific)
  categories: jsonb("categories"),
  // walk_my_pet: { punctuality: 5, communication: 5, pet_care: 5 }
  // sitter_suite: { cleanliness: 5, communication: 5, pet_safety: 5 }
  // pettrek: { driving: 5, vehicle_cleanliness: 5, pet_handling: 5 }
  // groomers: { skill: 5, gentleness: 5, results: 5 }
  
  // Media
  photoUrls: text("photo_urls").array(),
  videoUrls: text("video_urls").array(),
  
  // Verification
  isVerifiedPurchase: boolean("is_verified_purchase").default(true),
  
  // Response
  providerResponse: text("provider_response"),
  providerRespondedAt: timestamp("provider_responded_at"),
  
  // Moderation
  isReported: boolean("is_reported").default(false),
  reportReason: text("report_reason"),
  moderationStatus: varchar("moderation_status").default("approved"), // pending, approved, rejected
  
  // Helpfulness
  helpfulCount: integer("helpful_count").default(0),
  notHelpfulCount: integer("not_helpful_count").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  bookingIdx: index("review_booking_idx").on(table.bookingId),
  platformIdx: index("review_platform_idx").on(table.platformId),
  revieweeIdx: index("review_reviewee_idx").on(table.revieweeId),
  ratingIdx: index("review_rating_idx").on(table.rating),
}));

// ============================================================================
// MESSAGES TABLE (In-app messaging between customers & providers)
// ============================================================================

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: varchar("conversation_id").notNull(), // Group messages by booking or thread
  bookingId: integer("booking_id").references(() => bookings.id),
  platformId: varchar("platform_id").notNull(),
  
  // Participants
  senderId: varchar("sender_id").notNull(), // Firebase UID
  recipientId: varchar("recipient_id").notNull(), // Firebase UID
  
  // Message content
  content: text("content").notNull(),
  messageType: varchar("message_type").default("text"), // text, image, location, system
  attachments: jsonb("attachments"), // URLs to images, files, etc.
  
  // Status
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  deliveredAt: timestamp("delivered_at"),
  
  // System messages
  isSystemMessage: boolean("is_system_message").default(false),
  
  // Metadata
  metadata: jsonb("metadata"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  conversationIdx: index("message_conversation_idx").on(table.conversationId),
  senderIdx: index("message_sender_idx").on(table.senderId),
  recipientIdx: index("message_recipient_idx").on(table.recipientId),
  createdIdx: index("message_created_idx").on(table.createdAt),
}));

// ============================================================================
// NOTIFICATIONS TABLE (Push, email, SMS notifications)
// ============================================================================

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(), // Firebase UID
  
  // Notification type
  type: varchar("type").notNull(), // booking_confirmed, walk_started, payment_received, etc.
  platformId: varchar("platform_id"),
  
  // Content
  title: varchar("title").notNull(),
  titleHe: varchar("title_he"),
  body: text("body").notNull(),
  bodyHe: text("body_he"),
  
  // Delivery channels
  channels: text("channels").array(), // ["push", "email", "sms"]
  pushSent: boolean("push_sent").default(false),
  emailSent: boolean("email_sent").default(false),
  smsSent: boolean("sms_sent").default(false),
  
  // Read status
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  
  // Action
  actionUrl: varchar("action_url"), // Deep link to relevant page
  actionType: varchar("action_type"), // view_booking, rate_provider, etc.
  
  // Related entities
  bookingId: integer("booking_id").references(() => bookings.id),
  relatedId: varchar("related_id"), // Generic ID for flexibility
  
  // Metadata
  metadata: jsonb("metadata"),
  
  // Scheduling
  scheduledFor: timestamp("scheduled_for"),
  sentAt: timestamp("sent_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userIdx: index("notification_user_idx").on(table.userId),
  typeIdx: index("notification_type_idx").on(table.type),
  readIdx: index("notification_read_idx").on(table.isRead),
}));

// ============================================================================
// MEMBERSHIPS TABLE (Subscription plans for recurring services)
// ============================================================================

export const memberships = pgTable("memberships", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  platformId: varchar("platform_id").notNull(), // walk_my_pet (weekly walks), groomers (monthly grooming), etc.
  
  // Plan details
  planName: varchar("plan_name").notNull(), // "Weekly Dog Walks - 5x/week"
  planType: varchar("plan_type").notNull(), // weekly_walks, monthly_grooming, unlimited_sitting
  
  // Pricing
  price: decimal("price", { precision: 12, scale: 2 }).notNull(),
  billingInterval: varchar("billing_interval").notNull(), // monthly, weekly
  currency: varchar("currency").default("ILS"),
  
  // Stripe subscription
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  stripeCustomerId: varchar("stripe_customer_id"),
  
  // Status
  status: varchar("status").default("active"), // active, paused, cancelled, expired
  
  // Allowances
  bookingsPerInterval: integer("bookings_per_interval"), // e.g., 5 walks per week
  bookingsUsed: integer("bookings_used").default(0),
  
  // Dates
  startDate: timestamp("start_date").notNull(),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAt: timestamp("cancel_at"),
  cancelledAt: timestamp("cancelled_at"),
  
  // Metadata
  metadata: jsonb("metadata"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdx: index("membership_user_idx").on(table.userId),
  platformIdx: index("membership_platform_idx").on(table.platformId),
  statusIdx: index("membership_status_idx").on(table.status),
}));

// ============================================================================
// ZODB SCHEMAS (for validation)
// ============================================================================

// Platforms
export const insertPlatformSchema = createInsertSchema(platforms);
export type InsertPlatform = z.infer<typeof insertPlatformSchema>;
export type SelectPlatform = typeof platforms.$inferSelect;

// Pets
export const insertPetSchema = createInsertSchema(pets);
export type InsertPet = z.infer<typeof insertPetSchema>;
export type SelectPet = typeof pets.$inferSelect;

// Providers
export const insertProviderSchema = createInsertSchema(providers);
export type InsertProvider = z.infer<typeof insertProviderSchema>;
export type SelectProvider = typeof providers.$inferSelect;

// Locations
export const insertLocationSchema = createInsertSchema(locations);
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type SelectLocation = typeof locations.$inferSelect;

// Stations
export const insertStationSchema = createInsertSchema(stations);
export type InsertStation = z.infer<typeof insertStationSchema>;
export type SelectStation = typeof stations.$inferSelect;

// Vehicles
export const insertVehicleSchema = createInsertSchema(vehicles);
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type SelectVehicle = typeof vehicles.$inferSelect;

// Bookings
export const insertBookingSchema = createInsertSchema(bookings);
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type SelectBooking = typeof bookings.$inferSelect;

// Booking Items
export const insertBookingItemSchema = createInsertSchema(bookingItems);
export type InsertBookingItem = z.infer<typeof insertBookingItemSchema>;
export type SelectBookingItem = typeof bookingItems.$inferSelect;

// Availability Slots
export const insertAvailabilitySlotSchema = createInsertSchema(availabilitySlots);
export type InsertAvailabilitySlot = z.infer<typeof insertAvailabilitySlotSchema>;
export type SelectAvailabilitySlot = typeof availabilitySlots.$inferSelect;

// Payments
export const insertPaymentSchema = createInsertSchema(payments);
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type SelectPayment = typeof payments.$inferSelect;

// Payouts
export const insertPayoutSchema = createInsertSchema(payouts);
export type InsertPayout = z.infer<typeof insertPayoutSchema>;
export type SelectPayout = typeof payouts.$inferSelect;

// Reviews
export const insertReviewSchema = createInsertSchema(reviews);
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type SelectReview = typeof reviews.$inferSelect;

// Messages
export const insertMessageSchema = createInsertSchema(messages);
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type SelectMessage = typeof messages.$inferSelect;

// Notifications
export const insertNotificationSchema = createInsertSchema(notifications);
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type SelectNotification = typeof notifications.$inferSelect;

// Memberships
export const insertMembershipSchema = createInsertSchema(memberships);
export type InsertMembership = z.infer<typeof insertMembershipSchema>;
export type SelectMembership = typeof memberships.$inferSelect;

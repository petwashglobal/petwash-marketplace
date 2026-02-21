// ===================================================================
// PET WASH™ 2026 ENTERPRISE BACKEND - WORLD-CLASS FRANCHISE MANAGEMENT
// ===================================================================
// Complete backend for global DIY pet wash station network
// Supports: Israel, Europe, North America, Asia-Pacific expansion
// ===================================================================

import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  integer,
  decimal,
  boolean,
  serial,
  date
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// =================== FRANCHISE & TERRITORY MANAGEMENT ===================

// Countries & Regions (for global expansion)
export const countries = pgTable("countries", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 2 }).unique().notNull(), // ISO 3166-1 alpha-2 (IL, US, GB, etc.)
  name: varchar("name").notNull(),
  nameLocal: varchar("name_local"), // Local language name
  currency: varchar("currency", { length: 3 }).notNull(), // ILS, USD, EUR, GBP
  currencySymbol: varchar("currency_symbol", { length: 5 }),
  timezone: varchar("timezone").notNull(), // Asia/Jerusalem, America/New_York, etc.
  language: varchar("language", { length: 2 }).notNull(), // he, en, es, fr
  vatRate: decimal("vat_rate", { precision: 5, scale: 4 }).default("0.18"), // Tax rate
  isActive: boolean("is_active").default(true),
  launchDate: date("launch_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Franchise Territories (regions within countries)
export const franchiseTerritories = pgTable("franchise_territories", {
  id: serial("id").primaryKey(),
  countryId: integer("country_id").references(() => countries.id).notNull(),
  name: varchar("name").notNull(), // "Tel Aviv Metro", "Greater London", "NYC Tri-State"
  territoryCode: varchar("territory_code").unique().notNull(), // TLV-01, LON-01, NYC-01
  
  // Geographic boundaries
  boundaryGeoJson: jsonb("boundary_geojson"), // Polygon coordinates
  centerLat: decimal("center_lat", { precision: 10, scale: 7 }),
  centerLng: decimal("center_lng", { precision: 10, scale: 7 }),
  
  // Market data
  population: integer("population"),
  petOwnershipRate: decimal("pet_ownership_rate", { precision: 5, scale: 2 }), // percentage
  estimatedMarketSize: decimal("estimated_market_size", { precision: 12, scale: 2 }),
  competitionLevel: varchar("competition_level"), // low, medium, high
  
  // Status
  status: varchar("status").notNull().default("planning"), // planning, active, saturated, closed
  launchedAt: timestamp("launched_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_territories_country").on(table.countryId),
  index("idx_territories_status").on(table.status),
]);

// Franchisees (Business partners who own stations)
export const franchisees = pgTable("franchisees", {
  id: serial("id").primaryKey(),
  
  // Company information
  companyName: varchar("company_name").notNull(),
  registrationNumber: varchar("registration_number").unique(),
  taxId: varchar("tax_id").unique(), // VAT number, EIN, etc.
  
  // Primary contact
  contactFirstName: varchar("contact_first_name").notNull(),
  contactLastName: varchar("contact_last_name").notNull(),
  contactEmail: varchar("contact_email").unique().notNull(),
  contactPhone: varchar("contact_phone").notNull(),
  
  // Address
  address: text("address").notNull(),
  city: varchar("city").notNull(),
  state: varchar("state"),
  postalCode: varchar("postal_code").notNull(),
  countryId: integer("country_id").references(() => countries.id).notNull(),
  territoryId: integer("territory_id").references(() => franchiseTerritories.id),
  
  // Agreement details
  agreementType: varchar("agreement_type").notNull(), // single_station, multi_station, master_franchise, area_developer
  agreementStartDate: date("agreement_start_date").notNull(),
  agreementEndDate: date("agreement_end_date"),
  
  // Financial terms
  initialFee: decimal("initial_fee", { precision: 12, scale: 2 }),
  royaltyRate: decimal("royalty_rate", { precision: 5, scale: 2 }), // percentage
  marketingFeeRate: decimal("marketing_fee_rate", { precision: 5, scale: 2 }), // percentage
  minimumMonthlyRoyalty: decimal("minimum_monthly_royalty", { precision: 10, scale: 2 }),
  
  // Performance
  totalStations: integer("total_stations").default(0),
  totalRevenue: decimal("total_revenue", { precision: 15, scale: 2 }).default("0"),
  status: varchar("status").notNull().default("active"), // active, suspended, terminated, pending
  
  // Support
  accountManagerId: varchar("account_manager_id"), // Employee ID
  lastAuditDate: date("last_audit_date"),
  nextAuditDate: date("next_audit_date"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_franchisees_country").on(table.countryId),
  index("idx_franchisees_territory").on(table.territoryId),
  index("idx_franchisees_status").on(table.status),
]);

// =================== STATION MANAGEMENT ===================

// Pet Wash Stations (Physical locations)
export const petWashStations = pgTable("pet_wash_stations", {
  id: serial("id").primaryKey(),
  
  // Identification
  stationCode: varchar("station_code").unique().notNull(), // PWS-IL-TLV-001, PWS-US-NYC-042
  stationName: varchar("station_name").notNull(),
  identityNumber: varchar("identity_number").unique().notNull(), // Unique serial number on hardware
  qrCode: varchar("qr_code").unique().notNull(), // QR code for mobile app scanning
  
  // Ownership
  franchiseeId: integer("franchisee_id").references(() => franchisees.id),
  ownershipType: varchar("ownership_type").notNull(), // corporate_owned, franchisee, partner
  territoryId: integer("territory_id").references(() => franchiseTerritories.id).notNull(),
  
  // Location
  address: text("address").notNull(),
  city: varchar("city").notNull(),
  state: varchar("state"),
  postalCode: varchar("postal_code").notNull(),
  countryId: integer("country_id").references(() => countries.id).notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
  
  // Location details
  locationType: varchar("location_type"), // park, gas_station, shopping_center, standalone, pet_store
  parkingAvailable: boolean("parking_available").default(true),
  wheelchairAccessible: boolean("wheelchair_accessible").default(true),
  outdoorType: varchar("outdoor_type"), // covered, uncovered, semi_covered
  
  // Technical specifications
  hardwareVersion: varchar("hardware_version"), // K9000-v2.1, K9000-Pro-v3
  firmwareVersion: varchar("firmware_version"),
  installationDate: date("installation_date"),
  lastMaintenanceDate: date("last_maintenance_date"),
  nextMaintenanceDate: date("next_maintenance_date"),
  warrantyExpiryDate: date("warranty_expiry_date"),
  
  // Operational status
  operationalStatus: varchar("operational_status").notNull().default("active"), // active, offline, maintenance, decommissioned
  healthStatus: varchar("health_status").default("healthy"), // healthy, warning, critical, offline
  lastHeartbeat: timestamp("last_heartbeat"),
  
  // Capacity & usage
  dailyCapacity: integer("daily_capacity").default(50), // Max washes per day
  averageDailyUsage: integer("average_daily_usage").default(0),
  totalWashesCompleted: integer("total_washes_completed").default(0),
  
  // Hours of operation
  operatingHours: jsonb("operating_hours"), // {monday: {open: "06:00", close: "22:00"}, ...}
  
  // Payment systems
  acceptsCash: boolean("accepts_cash").default(false),
  acceptsCard: boolean("accepts_card").default(true),
  acceptsMobile: boolean("accepts_mobile").default(true),
  nayaxTerminalId: varchar("nayax_terminal_id"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_stations_code").on(table.stationCode),
  index("idx_stations_franchisee").on(table.franchiseeId),
  index("idx_stations_territory").on(table.territoryId),
  index("idx_stations_country").on(table.countryId),
  index("idx_stations_status").on(table.operationalStatus),
  index("idx_stations_health").on(table.healthStatus),
]);

// =================== STATION OPERATIONAL COSTS ===================

// Station Bills (Electricity, Water, Internet, Insurance, etc.)
export const stationBills = pgTable("station_bills", {
  id: serial("id").primaryKey(),
  stationId: integer("station_id").references(() => petWashStations.id).notNull(),
  
  // Bill details
  billType: varchar("bill_type").notNull(), // electricity, water, internet, insurance, rent, maintenance, cleaning, security
  vendor: varchar("vendor").notNull(), // Electricity company, ISP, insurance provider
  accountNumber: varchar("account_number"),
  
  // Billing period
  billingPeriod: varchar("billing_period").notNull(), // monthly, quarterly, annual
  dueDate: date("due_date").notNull(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  
  // Amounts
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("ILS"),
  vat: decimal("vat", { precision: 10, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  
  // Payment status
  status: varchar("status").notNull().default("unpaid"), // unpaid, paid, overdue, partially_paid, disputed
  paidDate: date("paid_date"),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }).default("0"),
  paymentMethod: varchar("payment_method"), // bank_transfer, credit_card, check, auto_debit
  paymentReference: varchar("payment_reference"),
  
  // Usage metrics (for utilities)
  usageAmount: decimal("usage_amount", { precision: 12, scale: 3 }), // kWh for electricity, m³ for water
  usageUnit: varchar("usage_unit"), // kWh, m3, GB, etc.
  unitPrice: decimal("unit_price", { precision: 10, scale: 4 }),
  
  // Document storage
  invoiceUrl: varchar("invoice_url"),
  receiptUrl: varchar("receipt_url"),
  
  // Notes
  notes: text("notes"),
  
  // Auto-payment
  autoPayEnabled: boolean("auto_pay_enabled").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_station_bills_station").on(table.stationId),
  index("idx_station_bills_type").on(table.billType),
  index("idx_station_bills_due_date").on(table.dueDate),
  index("idx_station_bills_status").on(table.status),
]);

// =================== K9000 LED STATUS SYSTEM (7-Star Luxury UX) ===================

// K9000 LED Status - Real-time station visual indicators
export const k9000LedStatus = pgTable("k9000_led_status", {
  id: serial("id").primaryKey(),
  stationId: integer("station_id").references(() => petWashStations.id).notNull().unique(),
  
  // Current LED state
  state: varchar("state").notNull().default("OFF"), // OFF, AVAILABLE, DRIVER_ON_ROUTE, IN_USE, MAINTENANCE, ERROR, PAUSED
  color: varchar("color").notNull().default("OFF"), // GREEN, BLUE, YELLOW, RED, WHITE, PURPLE, CYAN, OFF
  pattern: varchar("pattern").notNull().default("SOLID"), // SOLID, PULSE_SLOW, PULSE_MEDIUM, PULSE_FAST, FLASH_SLOW, FLASH_FAST, BREATH, RAINBOW
  
  // Control metadata
  source: varchar("source").notNull().default("SYSTEM"), // AUTOMATION, MANUAL, SYSTEM
  manualOverride: boolean("manual_override").default(false),
  manualExpiresAt: timestamp("manual_expires_at"),
  manualSetBy: varchar("manual_set_by"), // Email of admin who set manual override
  
  // Context
  reason: text("reason"), // Why this state was set
  lastWashSessionId: varchar("last_wash_session_id"), // Link to wash session
  lastDriverId: varchar("last_driver_id"), // Link to driver event
  
  // Timestamps
  lastUpdatedAt: timestamp("last_updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_k9000_led_station").on(table.stationId),
  index("idx_k9000_led_state").on(table.state),
  index("idx_k9000_led_manual_override").on(table.manualOverride),
]);

// K9000 LED Command History - Audit trail for all LED commands
export const k9000LedCommandHistory = pgTable("k9000_led_command_history", {
  id: serial("id").primaryKey(),
  stationId: integer("station_id").references(() => petWashStations.id).notNull(),
  
  // Command details
  commandType: varchar("command_type").notNull(), // SET_STATE, CLEAR_MANUAL, AUTOMATION_UPDATE, ERROR_SIGNAL
  previousState: varchar("previous_state"),
  newState: varchar("new_state").notNull(),
  previousColor: varchar("previous_color"),
  newColor: varchar("new_color").notNull(),
  previousPattern: varchar("previous_pattern"),
  newPattern: varchar("new_pattern").notNull(),
  
  // Who/What triggered this
  triggeredBy: varchar("triggered_by").notNull(), // automation, admin_email, system_health_monitor
  reason: text("reason"),
  
  // Success status
  success: boolean("success").default(true),
  errorMessage: text("error_message"),
  
  // Hardware response time
  responseTimeMs: integer("response_time_ms"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_k9000_led_history_station").on(table.stationId),
  index("idx_k9000_led_history_created").on(table.createdAt),
  index("idx_k9000_led_history_triggered_by").on(table.triggeredBy),
]);

// =================== STATION ASSETS & INVENTORY ===================

// Station Assets (Equipment, Hardware)
export const stationAssets = pgTable("station_assets", {
  id: serial("id").primaryKey(),
  stationId: integer("station_id").references(() => petWashStations.id).notNull(),
  
  // Asset details
  assetType: varchar("asset_type").notNull(), // washing_unit, dryer, water_heater, pump, pressure_washer, soap_dispenser, coin_acceptor, card_reader, camera, sensor
  assetName: varchar("asset_name").notNull(),
  manufacturer: varchar("manufacturer"),
  model: varchar("model"),
  serialNumber: varchar("serial_number").unique(),
  
  // Purchase info
  purchaseDate: date("purchase_date"),
  purchasePrice: decimal("purchase_price", { precision: 10, scale: 2 }),
  supplier: varchar("supplier"),
  invoiceNumber: varchar("invoice_number"),
  
  // Warranty
  warrantyMonths: integer("warranty_months"),
  warrantyExpiryDate: date("warranty_expiry_date"),
  
  // Depreciation
  depreciationMethod: varchar("depreciation_method"), // straight_line, declining_balance
  depreciationYears: integer("depreciation_years").default(5),
  currentValue: decimal("current_value", { precision: 10, scale: 2 }),
  
  // Operational status
  status: varchar("status").notNull().default("active"), // active, maintenance, broken, replaced, disposed
  installationDate: date("installation_date"),
  lastInspectionDate: date("last_inspection_date"),
  nextInspectionDate: date("next_inspection_date"),
  
  // Maintenance history count
  totalMaintenanceEvents: integer("total_maintenance_events").default(0),
  lastMaintenanceDate: date("last_maintenance_date"),
  
  // Location within station
  locationNotes: text("location_notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_station_assets_station").on(table.stationId),
  index("idx_station_assets_type").on(table.assetType),
  index("idx_station_assets_status").on(table.status),
]);

// Spare Parts Inventory
export const spareParts = pgTable("spare_parts", {
  id: serial("id").primaryKey(),
  
  // Part details
  partNumber: varchar("part_number").unique().notNull(),
  partName: varchar("part_name").notNull(),
  description: text("description"),
  category: varchar("category").notNull(), // pump_parts, electrical, plumbing, filters, nozzles, hoses, sensors, valves
  compatibleAssets: jsonb("compatible_assets"), // Array of asset types this part works with
  
  // Supplier info
  manufacturer: varchar("manufacturer"),
  supplier: varchar("supplier").notNull(),
  supplierPartNumber: varchar("supplier_part_number"),
  
  // Pricing
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("ILS"),
  minimumOrderQuantity: integer("minimum_order_quantity").default(1),
  leadTimeDays: integer("lead_time_days"), // Days to receive after ordering
  
  // Stock levels (central warehouse)
  quantityInStock: integer("quantity_in_stock").default(0),
  minimumStockLevel: integer("minimum_stock_level").default(5),
  reorderPoint: integer("reorder_point").default(10),
  maximumStockLevel: integer("maximum_stock_level").default(50),
  
  // Usage tracking
  averageMonthlyUsage: decimal("average_monthly_usage", { precision: 8, scale: 2 }).default("0"),
  totalUsed: integer("total_used").default(0),
  
  // Status
  isActive: boolean("is_active").default(true),
  isCritical: boolean("is_critical").default(false), // Mission-critical part
  
  // Documentation
  technicalSpecsUrl: varchar("technical_specs_url"),
  installationGuideUrl: varchar("installation_guide_url"),
  imageUrl: varchar("image_url"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_spare_parts_category").on(table.category),
  index("idx_spare_parts_stock").on(table.quantityInStock),
]);

// Station Spare Parts (Parts allocated to specific stations)
export const stationSpareParts = pgTable("station_spare_parts", {
  id: serial("id").primaryKey(),
  stationId: integer("station_id").references(() => petWashStations.id).notNull(),
  sparePartId: integer("spare_part_id").references(() => spareParts.id).notNull(),
  
  // Quantity at this station
  quantity: integer("quantity").notNull().default(0),
  minimumQuantity: integer("minimum_quantity").default(1),
  
  // Location
  storageLocation: varchar("storage_location"), // "Tool box A", "Shelf 2", "Under sink"
  
  // Last restocked
  lastRestockedDate: date("last_restocked_date"),
  lastRestockedQuantity: integer("last_restocked_quantity"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_station_parts_station").on(table.stationId),
  index("idx_station_parts_part").on(table.sparePartId),
]);

// Maintenance Work Orders
export const maintenanceWorkOrders = pgTable("maintenance_work_orders", {
  id: serial("id").primaryKey(),
  workOrderNumber: varchar("work_order_number").unique().notNull(), // WO-2026-001234
  stationId: integer("station_id").references(() => petWashStations.id).notNull(),
  
  // Work details
  workType: varchar("work_type").notNull(), // preventive_maintenance, corrective_repair, emergency_repair, installation, inspection
  priority: varchar("priority").notNull().default("medium"), // low, medium, high, critical
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  
  // Related asset
  assetId: integer("asset_id").references(() => stationAssets.id),
  
  // Scheduling
  requestedDate: timestamp("requested_date").defaultNow(),
  scheduledDate: timestamp("scheduled_date"),
  completedDate: timestamp("completed_date"),
  estimatedDuration: integer("estimated_duration"), // minutes
  actualDuration: integer("actual_duration"), // minutes
  
  // Assignment
  assignedToTechnicianId: varchar("assigned_to_technician_id"), // Employee ID
  technicianNotes: text("technician_notes"),
  
  // Parts used
  partsUsed: jsonb("parts_used"), // [{partId: 123, quantity: 2, cost: 45.50}, ...]
  
  // Costs
  laborCost: decimal("labor_cost", { precision: 10, scale: 2 }).default("0"),
  partsCost: decimal("parts_cost", { precision: 10, scale: 2 }).default("0"),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }).default("0"),
  
  // Status
  status: varchar("status").notNull().default("pending"), // pending, scheduled, in_progress, completed, cancelled
  
  // Follow-up
  followUpRequired: boolean("follow_up_required").default(false),
  followUpNotes: text("follow_up_notes"),
  followUpDate: timestamp("follow_up_date"),
  
  // Photos/documentation
  beforePhotos: jsonb("before_photos"), // Array of URLs
  afterPhotos: jsonb("after_photos"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_work_orders_station").on(table.stationId),
  index("idx_work_orders_status").on(table.status),
  index("idx_work_orders_priority").on(table.priority),
  index("idx_work_orders_technician").on(table.assignedToTechnicianId),
  index("idx_work_orders_scheduled").on(table.scheduledDate),
]);

// =================== SUBSCRIPTIONS & MEMBERSHIPS ===================

// Subscription Plans
export const subscriptionPlans = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  
  // Plan details
  planCode: varchar("plan_code").unique().notNull(), // PREMIUM_MONTHLY, FAMILY_ANNUAL
  name: varchar("name").notNull(),
  nameHe: varchar("name_he").notNull(),
  description: text("description"),
  descriptionHe: text("description_he"),
  
  // Pricing
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("ILS"),
  billingInterval: varchar("billing_interval").notNull(), // monthly, quarterly, annual
  trialDays: integer("trial_days").default(0),
  
  // Benefits
  washCreditsPerMonth: integer("wash_credits_per_month").notNull(), // Included washes
  discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }), // Additional discount on top of credits
  prioritySupport: boolean("priority_support").default(false),
  earlyAccessFeatures: boolean("early_access_features").default(false),
  freeDelivery: boolean("free_delivery").default(false),
  
  // Limits
  maxPets: integer("max_pets"), // NULL = unlimited
  maxFamilyMembers: integer("max_family_members").default(1),
  
  // Availability
  isActive: boolean("is_active").default(true),
  countryId: integer("country_id").references(() => countries.id), // NULL = all countries
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_subscription_plans_active").on(table.isActive),
  index("idx_subscription_plans_country").on(table.countryId),
]);

// User Subscriptions
export const userSubscriptions = pgTable("user_subscriptions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(), // Firebase UID
  planId: integer("plan_id").references(() => subscriptionPlans.id).notNull(),
  
  // Subscription period
  startDate: timestamp("start_date").notNull(),
  currentPeriodStart: timestamp("current_period_start").notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  trialStart: timestamp("trial_start"),
  trialEnd: timestamp("trial_end"),
  
  // Status
  status: varchar("status").notNull().default("active"), // trial, active, paused, cancelled, expired, past_due
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  cancelledAt: timestamp("cancelled_at"),
  cancellationReason: varchar("cancellation_reason"),
  
  // Credits & usage
  washCreditsRemaining: integer("wash_credits_remaining").default(0),
  washCreditsUsed: integer("wash_credits_used").default(0),
  totalWashesCompleted: integer("total_washes_completed").default(0),
  
  // Payment
  lastPaymentDate: timestamp("last_payment_date"),
  lastPaymentAmount: decimal("last_payment_amount", { precision: 10, scale: 2 }),
  nextPaymentDate: timestamp("next_payment_date"),
  paymentMethodId: varchar("payment_method_id"), // Nayax payment method ID
  
  // Billing
  totalPaid: decimal("total_paid", { precision: 12, scale: 2 }).default("0"),
  
  // Payment Gateway Integration (Nayax Israel ONLY)
  nayaxSubscriptionId: varchar("nayax_subscription_id"),
  nayaxCustomerId: varchar("nayax_customer_id"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_user_subscriptions_user").on(table.userId),
  index("idx_user_subscriptions_status").on(table.status),
  index("idx_user_subscriptions_plan").on(table.planId),
  index("idx_user_subscriptions_next_payment").on(table.nextPaymentDate),
]);

// Subscription Usage History
export const subscriptionUsageHistory = pgTable("subscription_usage_history", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id").references(() => userSubscriptions.id).notNull(),
  
  // Usage details
  usageDate: timestamp("usage_date").notNull().defaultNow(),
  stationId: integer("station_id").references(() => petWashStations.id),
  washType: varchar("wash_type"),
  creditsUsed: integer("credits_used").notNull().default(1),
  
  // Value
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }),
  discountedPrice: decimal("discounted_price", { precision: 10, scale: 2 }),
  savingsAmount: decimal("savings_amount", { precision: 10, scale: 2 }),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_subscription_usage_subscription").on(table.subscriptionId),
  index("idx_subscription_usage_date").on(table.usageDate),
]);

// =================== IOT & TELEMETRY ===================

// Station Telemetry (Real-time IoT data)
export const stationTelemetry = pgTable("station_telemetry", {
  id: serial("id").primaryKey(),
  stationId: integer("station_id").references(() => petWashStations.id).notNull(),
  
  // Timestamp
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
  
  // Water system
  waterPressure: decimal("water_pressure", { precision: 6, scale: 2 }), // PSI
  waterTemperature: decimal("water_temperature", { precision: 5, scale: 2 }), // Celsius
  waterFlowRate: decimal("water_flow_rate", { precision: 7, scale: 2 }), // Liters per minute
  waterTankLevel: integer("water_tank_level"), // Percentage 0-100
  
  // Soap/chemical levels
  soapLevel: integer("soap_level"), // Percentage 0-100
  conditionerLevel: integer("conditioner_level"), // Percentage 0-100
  sanitizerLevel: integer("sanitizer_level"), // Percentage 0-100
  
  // Power & energy
  powerConsumption: decimal("power_consumption", { precision: 8, scale: 2 }), // kWh
  voltage: decimal("voltage", { precision: 6, scale: 2 }), // Volts
  current: decimal("current", { precision: 6, scale: 2 }), // Amps
  
  // Environmental
  ambientTemperature: decimal("ambient_temperature", { precision: 5, scale: 2 }), // Celsius
  humidity: integer("humidity"), // Percentage 0-100
  
  // Usage metrics
  activeWashes: integer("active_washes").default(0),
  washesCompletedToday: integer("washes_completed_today").default(0),
  
  // System health
  systemLoad: integer("system_load"), // CPU/processor percentage 0-100
  errorCount: integer("error_count").default(0),
  warningCount: integer("warning_count").default(0),
  
  // Connectivity
  signalStrength: integer("signal_strength"), // Percentage 0-100 or dBm
  networkLatency: integer("network_latency"), // milliseconds
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_telemetry_station").on(table.stationId),
  index("idx_telemetry_recorded_at").on(table.recordedAt),
]);

// Station Alerts (Automated monitoring alerts)
export const stationAlerts = pgTable("station_alerts", {
  id: serial("id").primaryKey(),
  stationId: integer("station_id").references(() => petWashStations.id).notNull(),
  
  // Alert details
  alertType: varchar("alert_type").notNull(), // low_supplies, equipment_failure, offline, maintenance_due, high_usage, temperature_warning
  severity: varchar("severity").notNull(), // info, warning, critical
  title: varchar("title").notNull(),
  message: text("message").notNull(),
  
  // Trigger data
  triggeredAt: timestamp("triggered_at").notNull().defaultNow(),
  triggerValue: varchar("trigger_value"), // The value that triggered the alert
  thresholdValue: varchar("threshold_value"), // The threshold that was crossed
  
  // Status
  status: varchar("status").notNull().default("open"), // open, acknowledged, resolved, ignored
  acknowledgedAt: timestamp("acknowledged_at"),
  acknowledgedBy: varchar("acknowledged_by"), // Employee ID
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by"),
  
  // Actions taken
  workOrderId: integer("work_order_id").references(() => maintenanceWorkOrders.id),
  resolutionNotes: text("resolution_notes"),
  
  // Notifications
  notificationsSent: jsonb("notifications_sent"), // [{type: "email", recipient: "...", sentAt: "..."}]
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_station_alerts_station").on(table.stationId),
  index("idx_station_alerts_severity").on(table.severity),
  index("idx_station_alerts_status").on(table.status),
  index("idx_station_alerts_triggered").on(table.triggeredAt),
]);

// =================== PERFORMANCE & ANALYTICS ===================

// Station Performance Metrics (Daily aggregates)
export const stationPerformanceMetrics = pgTable("station_performance_metrics", {
  id: serial("id").primaryKey(),
  stationId: integer("station_id").references(() => petWashStations.id).notNull(),
  date: date("date").notNull(),
  
  // Usage metrics
  totalWashes: integer("total_washes").default(0),
  totalRevenue: decimal("total_revenue", { precision: 12, scale: 2 }).default("0"),
  averageWashDuration: integer("average_wash_duration"), // minutes
  peakHourStart: integer("peak_hour_start"), // 0-23
  peakHourEnd: integer("peak_hour_end"),
  
  // Customer metrics
  uniqueCustomers: integer("unique_customers").default(0),
  newCustomers: integer("new_customers").default(0),
  returningCustomers: integer("returning_customers").default(0),
  subscriptionUsage: integer("subscription_usage").default(0),
  
  // Resource consumption
  waterUsed: decimal("water_used", { precision: 10, scale: 2 }), // Liters
  soapUsed: decimal("soap_used", { precision: 8, scale: 2 }), // Liters
  electricityUsed: decimal("electricity_used", { precision: 10, scale: 2 }), // kWh
  
  // Operational metrics
  uptime: integer("uptime"), // minutes
  downtime: integer("downtime"), // minutes
  maintenanceTime: integer("maintenance_time"), // minutes
  errorCount: integer("error_count").default(0),
  
  // Financial metrics
  operatingCost: decimal("operating_cost", { precision: 10, scale: 2 }).default("0"),
  profitMargin: decimal("profit_margin", { precision: 5, scale: 2 }),
  
  // Ratings
  averageRating: decimal("average_rating", { precision: 3, scale: 2 }), // 0.00 to 5.00
  totalRatings: integer("total_ratings").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_station_metrics_station").on(table.stationId),
  index("idx_station_metrics_date").on(table.date),
]);

// =================== ROLE-BASED ACCESS CONTROL (RBAC) ===================

// System Roles & Permissions
export const systemRoles = pgTable("system_roles", {
  id: serial("id").primaryKey(),
  roleCode: varchar("role_code").unique().notNull(), // CEO, DIRECTOR, SUPPLIER_MANAGER, FRANCHISE_OWNER, etc.
  roleName: varchar("role_name").notNull(),
  roleNameHe: varchar("role_name_he"),
  
  // Department/Area
  department: varchar("department").notNull(), // executive, k9000_supplier, franchise, operations, finance, legal
  accessLevel: integer("access_level").notNull(), // 1=restricted, 5=department, 10=super_admin
  
  // Permissions (JSON array of permission codes)
  permissions: jsonb("permissions").notNull(), // ["view_documents", "upload_documents", "delete_documents", "manage_users", etc.]
  
  // Access restrictions
  canAccessAllStations: boolean("can_access_all_stations").default(false),
  canAccessFinancials: boolean("can_access_financials").default(false),
  canAccessLegal: boolean("can_access_legal").default(false),
  canAccessK9000Supplier: boolean("can_access_k9000_supplier").default(false),
  canManageFranchises: boolean("can_manage_franchises").default(false),
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User Role Assignments
export const userRoleAssignments = pgTable("user_role_assignments", {
  id: serial("id").primaryKey(),
  
  // User identification
  userId: varchar("user_id").notNull(), // Firebase UID
  userEmail: varchar("user_email").notNull(),
  userName: varchar("user_name").notNull(),
  
  // Role assignment
  roleId: integer("role_id").references(() => systemRoles.id).notNull(),
  
  // Optional: Specific entity access (for franchisees, specific franchises they can access)
  franchiseeId: integer("franchisee_id").references(() => franchisees.id),
  stationIds: jsonb("station_ids"), // Array of station IDs user can access (null = all based on role)
  
  // Status
  isActive: boolean("is_active").default(true),
  assignedBy: varchar("assigned_by").notNull(), // Admin who assigned this role
  assignedAt: timestamp("assigned_at").defaultNow(),
  expiresAt: timestamp("expires_at"), // Optional: temporary access
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_user_roles_user").on(table.userId),
  index("idx_user_roles_email").on(table.userEmail),
  index("idx_user_roles_role").on(table.roleId),
]);

// =================== INTERNAL INVITATIONS ===================
// Invitation-only registration for staff, contractors, and franchisees

export const internalInvites = pgTable("internal_invites", {
  id: serial("id").primaryKey(),
  
  // Invitation token
  token: varchar("token").unique().notNull(), // Unique token for invitation URL
  
  // Invitee information
  email: varchar("email").notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  phone: varchar("phone"),
  
  // Role assignment
  roleCode: varchar("role_code").notNull(), // STAFF, CONTRACTOR, FRANCHISEE, MANAGER, etc.
  roleId: integer("role_id").references(() => systemRoles.id),
  department: varchar("department"), // operations, finance, hr, etc.
  
  // Entity associations
  franchiseeId: integer("franchisee_id").references(() => franchisees.id), // For franchisee staff
  stationIds: jsonb("station_ids"), // Array of station IDs if restricted access
  
  // Status tracking
  status: varchar("status").notNull().default("pending"), // pending, sent, accepted, expired, revoked
  
  // Timing
  expiresAt: timestamp("expires_at").notNull(), // Invitation expiry
  sentAt: timestamp("sent_at"),
  acceptedAt: timestamp("accepted_at"),
  
  // Firebase UID after acceptance
  acceptedByUid: varchar("accepted_by_uid"),
  
  // Audit trail
  createdBy: varchar("created_by").notNull(), // Admin email who created
  createdByUid: varchar("created_by_uid").notNull(), // Admin Firebase UID
  notes: text("notes"), // Internal notes about the invitation
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_invites_token").on(table.token),
  index("idx_invites_email").on(table.email),
  index("idx_invites_status").on(table.status),
  index("idx_invites_role").on(table.roleCode),
]);

// =================== SECURE DOCUMENT MANAGEMENT ===================

// Document Categories
export const documentCategories = pgTable("document_categories", {
  id: serial("id").primaryKey(),
  categoryCode: varchar("category_code").unique().notNull(), // k9000_invoices, k9000_contracts, legal_trademark, etc.
  categoryName: varchar("category_name").notNull(),
  categoryNameHe: varchar("category_name_he"),
  
  // Access control
  department: varchar("department").notNull(), // k9000_supplier, legal, executive, franchise
  requiredAccessLevel: integer("required_access_level").default(5), // Minimum access level to view
  isConfidential: boolean("is_confidential").default(false),
  
  // Storage
  storagePath: varchar("storage_path").notNull(), // GCS bucket path
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Secure Documents Storage
export const secureDocuments = pgTable("secure_documents", {
  id: serial("id").primaryKey(),
  documentNumber: varchar("document_number").unique().notNull(), // DOC-2025-001234
  
  // Document details
  categoryId: integer("category_id").references(() => documentCategories.id).notNull(),
  documentType: varchar("document_type").notNull(), // invoice, contract, agreement, specification, legal, trademark, certificate
  title: varchar("title").notNull(),
  titleHe: varchar("title_he"),
  description: text("description"),
  
  // File information
  fileName: varchar("file_name").notNull(),
  fileType: varchar("file_type").notNull(), // pdf, docx, xlsx, jpg, png
  fileSize: integer("file_size"), // bytes
  fileMimeType: varchar("file_mime_type"),
  
  // Storage locations
  gcsUrl: varchar("gcs_url").notNull(), // Google Cloud Storage URL
  backupGcsUrl: varchar("backup_gcs_url"), // Backup location
  localPath: varchar("local_path"), // Optional local backup
  
  // Related entities
  franchiseeId: integer("franchisee_id").references(() => franchisees.id),
  stationId: integer("station_id").references(() => petWashStations.id),
  supplierId: varchar("supplier_id"), // K9000, etc.
  
  // Financial details (for invoices)
  invoiceNumber: varchar("invoice_number"),
  invoiceDate: date("invoice_date"),
  invoiceAmount: decimal("invoice_amount", { precision: 12, scale: 2 }),
  invoiceCurrency: varchar("invoice_currency", { length: 3 }),
  paymentStatus: varchar("payment_status"), // paid, pending, overdue
  
  // Metadata
  tags: jsonb("tags"), // Array of searchable tags
  relatedDocumentIds: jsonb("related_document_ids"), // Links to related documents
  
  // Access control
  isConfidential: boolean("is_confidential").default(false),
  accessLevel: integer("access_level").default(5), // Who can view this document
  allowedRoles: jsonb("allowed_roles"), // Array of role codes that can access
  allowedUserIds: jsonb("allowed_user_ids"), // Specific users who can access
  
  // Tracking
  uploadedBy: varchar("uploaded_by").notNull(), // User ID who uploaded
  uploadedByEmail: varchar("uploaded_by_email").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  
  // Version control
  version: integer("version").default(1),
  previousVersionId: integer("previous_version_id"),
  
  // Status
  status: varchar("status").notNull().default("active"), // active, archived, deleted
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_documents_category").on(table.categoryId),
  index("idx_documents_type").on(table.documentType),
  index("idx_documents_franchisee").on(table.franchiseeId),
  index("idx_documents_station").on(table.stationId),
  index("idx_documents_status").on(table.status),
  index("idx_documents_uploaded").on(table.uploadedAt),
]);

// Document Access Log (Audit trail)
export const documentAccessLog = pgTable("document_access_log", {
  id: serial("id").primaryKey(),
  
  documentId: integer("document_id").references(() => secureDocuments.id).notNull(),
  
  // User who accessed
  userId: varchar("user_id").notNull(),
  userEmail: varchar("user_email").notNull(),
  userName: varchar("user_name"),
  
  // Access details
  accessType: varchar("access_type").notNull(), // view, download, update, delete
  accessGranted: boolean("access_granted").notNull(),
  denialReason: varchar("denial_reason"), // If access denied
  
  // Context
  ipAddress: varchar("ip_address"),
  userAgent: varchar("user_agent"),
  
  accessedAt: timestamp("accessed_at").defaultNow(),
}, (table) => [
  index("idx_access_log_document").on(table.documentId),
  index("idx_access_log_user").on(table.userId),
  index("idx_access_log_date").on(table.accessedAt),
]);

// =================== K9000 SUPPLIER & FRANCHISE ORDERING ===================

// Franchise Order Requests (Franchises request spare parts/supplies)
export const franchiseOrderRequests = pgTable("franchise_order_requests", {
  id: serial("id").primaryKey(),
  orderNumber: varchar("order_number").unique().notNull(), // FOR-2026-001234
  
  // Requester
  franchiseeId: integer("franchisee_id").references(() => franchisees.id).notNull(),
  stationId: integer("station_id").references(() => petWashStations.id), // Optional: specific station
  requestedBy: varchar("requested_by").notNull(), // Employee name
  requestedByEmail: varchar("requested_by_email").notNull(),
  requestedByPhone: varchar("requested_by_phone"),
  
  // Order details
  orderType: varchar("order_type").notNull(), // spare_parts, supplies, emergency, routine
  priority: varchar("priority").notNull().default("normal"), // low, normal, high, urgent
  requestedItems: jsonb("requested_items").notNull(), // [{sparePartId: 123, quantity: 5, notes: "..."}]
  
  // Pricing
  estimatedTotal: decimal("estimated_total", { precision: 12, scale: 2 }),
  actualTotal: decimal("actual_total", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("ILS"),
  
  // Delivery
  deliveryAddress: text("delivery_address"),
  deliveryCity: varchar("delivery_city"),
  deliveryPostalCode: varchar("delivery_postal_code"),
  requestedDeliveryDate: date("requested_delivery_date"),
  actualDeliveryDate: date("actual_delivery_date"),
  
  // Status tracking
  status: varchar("status").notNull().default("pending"), // pending, approved, processing, shipped, delivered, completed, cancelled, rejected
  approvedBy: varchar("approved_by"), // Admin/manager who approved
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  
  // Fulfillment
  trackingNumber: varchar("tracking_number"),
  shippingCarrier: varchar("shipping_carrier"),
  estimatedArrival: timestamp("estimated_arrival"),
  
  // Payment
  paymentStatus: varchar("payment_status").default("pending"), // pending, paid, invoiced, overdue
  invoiceNumber: varchar("invoice_number"),
  invoiceUrl: varchar("invoice_url"),
  paymentDueDate: date("payment_due_date"),
  paidDate: date("paid_date"),
  
  // Notes
  requestNotes: text("request_notes"),
  adminNotes: text("admin_notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_order_requests_franchisee").on(table.franchiseeId),
  index("idx_order_requests_station").on(table.stationId),
  index("idx_order_requests_status").on(table.status),
  index("idx_order_requests_priority").on(table.priority),
]);

// Stock Transactions (Track all inventory movements)
export const stockTransactions = pgTable("stock_transactions", {
  id: serial("id").primaryKey(),
  transactionNumber: varchar("transaction_number").unique().notNull(), // STX-2026-001234
  
  // Item
  sparePartId: integer("spare_part_id").references(() => spareParts.id).notNull(),
  
  // Transaction details
  transactionType: varchar("transaction_type").notNull(), // purchase, usage, transfer, adjustment, return, damage
  quantity: integer("quantity").notNull(),
  
  // From/To
  fromLocation: varchar("from_location"), // "Central Warehouse", "Station PWS-IL-TLV-001"
  toLocation: varchar("to_location"),
  fromStationId: integer("from_station_id").references(() => petWashStations.id),
  toStationId: integer("to_station_id").references(() => petWashStations.id),
  
  // Cost tracking
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }),
  totalCost: decimal("total_cost", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("ILS"),
  
  // References
  orderRequestId: integer("order_request_id").references(() => franchiseOrderRequests.id),
  workOrderId: integer("work_order_id").references(() => maintenanceWorkOrders.id),
  
  // Metadata
  performedBy: varchar("performed_by").notNull(), // Employee ID or name
  reason: text("reason"),
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_stock_tx_part").on(table.sparePartId),
  index("idx_stock_tx_type").on(table.transactionType),
  index("idx_stock_tx_from_station").on(table.fromStationId),
  index("idx_stock_tx_to_station").on(table.toStationId),
  index("idx_stock_tx_date").on(table.createdAt),
]);

// Supplier Notification Settings (Configure who receives low stock alerts)
export const supplierNotificationSettings = pgTable("supplier_notification_settings", {
  id: serial("id").primaryKey(),
  
  // Notification details
  notificationType: varchar("notification_type").notNull(), // low_stock, critical_stock, order_approved, order_shipped
  isEnabled: boolean("is_enabled").default(true),
  
  // Recipients
  recipientName: varchar("recipient_name").notNull(),
  recipientRole: varchar("recipient_role").notNull(), // K9000 Supplier Manager, Inventory Manager, CEO
  recipientEmail: varchar("recipient_email"),
  recipientPhone: varchar("recipient_phone"), // WhatsApp number in international format
  recipientWhatsApp: varchar("recipient_whatsapp"), // WhatsApp number in international format
  
  // Notification channels
  notifyEmail: boolean("notify_email").default(true),
  notifySMS: boolean("notify_sms").default(false),
  notifyWhatsApp: boolean("notify_whatsapp").default(true),
  
  // Thresholds for low stock alerts
  stockThresholdPercent: integer("stock_threshold_percent"), // Alert when stock drops below X% of max
  criticalThresholdPercent: integer("critical_threshold_percent"), // Critical alert threshold
  
  // Frequency limits (prevent spam)
  maxAlertsPerDay: integer("max_alerts_per_day").default(10),
  lastNotifiedAt: timestamp("last_notified_at"),
  notificationCount: integer("notification_count").default(0),
  
  // Specific parts to monitor (optional - if null, monitors all)
  monitoredPartIds: jsonb("monitored_part_ids"), // Array of spare part IDs, null = all parts
  monitoredCategories: jsonb("monitored_categories"), // Array of part categories
  
  // Active hours
  notifyBetweenHours: jsonb("notify_between_hours"), // {start: "08:00", end: "18:00"}
  notifyOnWeekends: boolean("notify_on_weekends").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_notif_settings_type").on(table.notificationType),
  index("idx_notif_settings_enabled").on(table.isEnabled),
]);

// =================== CUSTOMER EXPERIENCE ===================

// Customer Achievements (Gamification)
export const customerAchievements = pgTable("customer_achievements", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  
  // Achievement details
  achievementType: varchar("achievement_type").notNull(), // first_wash, 10_washes, monthly_streak, referral_master, eco_warrior
  achievementName: varchar("achievement_name").notNull(),
  achievementNameHe: varchar("achievement_name_he").notNull(),
  description: text("description"),
  descriptionHe: text("description_he"),
  
  // Badge/icon
  badgeUrl: varchar("badge_url"),
  tier: varchar("tier"), // bronze, silver, gold, platinum, diamond
  
  // Reward
  rewardType: varchar("reward_type"), // points, discount, free_wash, badge_only
  rewardValue: decimal("reward_value", { precision: 10, scale: 2 }),
  
  // Progress
  unlockedAt: timestamp("unlocked_at").notNull().defaultNow(),
  isDisplayed: boolean("is_displayed").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_achievements_user").on(table.userId),
  index("idx_achievements_type").on(table.achievementType),
]);

// =================== PET WASH™ LTD ORGANIZATIONAL STRUCTURE ===================
// Single Company Architecture - Pet Wash™ Ltd (Israel)
// All 8 platforms operate under ONE legal entity with modular divisions

// Company Profile (Single Company: Pet Wash™ Ltd)
export const companyProfile = pgTable("company_profile", {
  id: serial("id").primaryKey(),
  
  // Legal entity information
  legalName: varchar("legal_name").notNull().default("Pet Wash™ Ltd"), // Always "Pet Wash™ Ltd"
  registrationNumber: varchar("registration_number").unique().notNull(), // Israeli company number
  taxId: varchar("tax_id").unique().notNull(), // VAT number
  country: varchar("country").notNull().default("IL"), // Israel only
  
  // Business details
  brandName: varchar("brand_name").notNull().default("Pet Wash™"),
  tagline: text("tagline"),
  logo: varchar("logo"),
  website: varchar("website").default("https://petwash.co.il"),
  supportEmail: varchar("support_email").default("Support@PetWash.co.il"),
  supportPhone: varchar("support_phone"),
  
  // Address
  headquarters: text("headquarters").notNull(),
  city: varchar("city").notNull(),
  postalCode: varchar("postal_code").notNull(),
  
  // Financial configuration
  defaultCurrency: varchar("default_currency").default("ILS"),
  vatRate: decimal("vat_rate", { precision: 5, scale: 4 }).default("0.18"), // 18% Israeli VAT
  fiscalYearStart: varchar("fiscal_year_start").default("01-01"), // MM-DD format
  
  // Banking (Mizrahi-Tefahot Bank integration)
  primaryBankName: varchar("primary_bank_name"),
  primaryBankAccount: varchar("primary_bank_account"),
  
  // Status
  isActive: boolean("is_active").default(true),
  foundedDate: date("founded_date"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Divisions (8 Pet Wash Platforms)
export const divisions = pgTable("divisions", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companyProfile.id).notNull(),
  
  // Division details
  code: varchar("code").unique().notNull(), // K9000, SITTER, WALKER, PETTREK, ACADEMY, PLUSH, WASH, CLUB
  name: varchar("name").notNull(), // "K9000™ Stations", "The Sitter Suite™", etc.
  nameHe: varchar("name_he").notNull(), // Hebrew name
  description: text("description"),
  descriptionHe: text("description_he"),
  
  // Platform configuration
  platformType: varchar("platform_type").notNull(), // hardware | marketplace | service | digital
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }), // % commission (15% flat for all platforms)
  isMarketplace: boolean("is_marketplace").default(false), // True for Sitter, Walker, PetTrek, Academy
  
  // Financial tracking
  revenueAccount: varchar("revenue_account"), // Ledger account code
  expenseAccount: varchar("expense_account"),
  
  // Status
  isActive: boolean("is_active").default(true),
  launchDate: date("launch_date"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_divisions_company").on(table.companyId),
  index("idx_divisions_code").on(table.code),
]);

// Departments (within divisions)
export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  divisionId: integer("division_id").references(() => divisions.id).notNull(),
  
  // Department details
  code: varchar("code").unique().notNull(), // TECH, OPS, CS, FINANCE, HR, MARKETING
  name: varchar("name").notNull(),
  nameHe: varchar("name_he").notNull(),
  description: text("description"),
  
  // Leadership
  headEmployeeId: varchar("head_employee_id"), // References adminUsers.id
  
  // Budget
  monthlyBudget: decimal("monthly_budget", { precision: 12, scale: 2 }),
  annualBudget: decimal("annual_budget", { precision: 12, scale: 2 }),
  
  // Status
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_departments_division").on(table.divisionId),
]);

// Organizational Roles (unified across all platforms)
export const organizationalRoles = pgTable("organizational_roles", {
  id: serial("id").primaryKey(),
  
  // Role definition
  code: varchar("code").unique().notNull(), // CEO, CFO, COO, TECH_DIR, OPS_MGR, FIELD_TECH, etc.
  title: varchar("title").notNull(),
  titleHe: varchar("title_he").notNull(),
  description: text("description"),
  
  // Hierarchy
  level: integer("level").notNull(), // 0=CEO, 1=C-Level, 2=Directors, 3=Managers, 4=Staff
  reportsToRoleId: integer("reports_to_role_id").references(() => organizationalRoles.id),
  
  // Permissions
  canApproveBudget: decimal("can_approve_budget", { precision: 12, scale: 2 }).default("0"),
  canManageEmployees: boolean("can_manage_employees").default(false),
  canAccessFinancials: boolean("can_access_financials").default(false),
  canManageStations: boolean("can_manage_stations").default(false),
  
  // Status
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Contractor Lifecycle Management (Unified for all platforms)
export const contractorLifecycleRecords = pgTable("contractor_lifecycle_records", {
  id: serial("id").primaryKey(),
  
  // Contractor identity
  userId: varchar("user_id").notNull(), // Firebase UID
  contractorType: varchar("contractor_type").notNull(), // SITTER | WALKER | PETTREK_DRIVER | TRAINER
  divisionId: integer("division_id").references(() => divisions.id).notNull(),
  
  // Application & Onboarding
  applicationStatus: varchar("application_status").notNull().default("pending"), // pending | approved | rejected | waitlisted
  applicationDate: timestamp("application_date").defaultNow(),
  approvedDate: timestamp("approved_date"),
  approvedBy: varchar("approved_by"), // Admin ID
  rejectionReason: text("rejection_reason"),
  
  // Background checks
  backgroundCheckStatus: varchar("background_check_status").default("pending"), // pending | passed | failed
  backgroundCheckDate: timestamp("background_check_date"),
  backgroundCheckProvider: varchar("background_check_provider"),
  
  // Training & Certification
  trainingStatus: varchar("training_status").default("not_started"), // not_started | in_progress | completed | failed
  trainingCompletedDate: timestamp("training_completed_date"),
  certificationLevel: varchar("certification_level"), // basic | advanced | expert | master
  certificationExpiryDate: date("certification_expiry_date"),
  
  // Active status
  contractorStatus: varchar("contractor_status").notNull().default("active"), // active | suspended | deactivated | banned
  activatedDate: timestamp("activated_date"),
  deactivatedDate: timestamp("deactivated_date"),
  deactivationReason: text("deactivation_reason"),
  
  // Performance tracking
  totalEarnings: decimal("total_earnings", { precision: 12, scale: 2 }).default("0"),
  totalBookings: integer("total_bookings").default(0),
  completionRate: decimal("completion_rate", { precision: 5, scale: 2 }).default("0"), // percentage
  averageRating: decimal("average_rating", { precision: 3, scale: 2 }).default("0"),
  totalReviews: integer("total_reviews").default(0),
  
  // Compliance
  lastComplianceCheck: timestamp("last_compliance_check"),
  nextComplianceCheck: timestamp("next_compliance_check"),
  complianceScore: integer("compliance_score").default(100), // 0-100
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_contractor_lifecycle_user").on(table.userId),
  index("idx_contractor_lifecycle_type").on(table.contractorType),
  index("idx_contractor_lifecycle_division").on(table.divisionId),
  index("idx_contractor_lifecycle_status").on(table.contractorStatus),
]);

// Payment Accounts (Nayax Israel gateway)
export const paymentAccounts = pgTable("payment_accounts", {
  id: serial("id").primaryKey(),
  
  // Account identification
  accountCode: varchar("account_code").unique().notNull(), // NAYAX_PRIMARY, ESCROW_HOLD, etc.
  accountName: varchar("account_name").notNull(),
  accountType: varchar("account_type").notNull(), // gateway | escrow | ledger | bank
  
  // Provider details (always Nayax Israel for gateways)
  provider: varchar("provider").notNull().default("NAYAX_ISRAEL"),
  merchantId: varchar("merchant_id"),
  terminalId: varchar("terminal_id"),
  
  // Configuration
  currency: varchar("currency").default("ILS"),
  isDefault: boolean("is_default").default(false),
  
  // Status
  isActive: boolean("is_active").default(true),
  activatedDate: timestamp("activated_date"),
  deactivatedDate: timestamp("deactivated_date"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_payment_accounts_type").on(table.accountType),
  index("idx_payment_accounts_provider").on(table.provider),
]);

// Ledger Transactions (Double-entry bookkeeping)
export const ledgerTransactions = pgTable("ledger_transactions", {
  id: serial("id").primaryKey(),
  
  // Transaction identification
  transactionId: varchar("transaction_id").unique().notNull(), // LDG-YYYY-NNNNNN
  batchId: varchar("batch_id"), // For grouped transactions
  
  // Accounting details
  entryType: varchar("entry_type").notNull(), // DEBIT | CREDIT
  accountCode: varchar("account_code").notNull(), // Chart of accounts code
  divisionId: integer("division_id").references(() => divisions.id),
  
  // Transaction details
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency").default("ILS"),
  
  // Description
  description: text("description").notNull(),
  descriptionHe: text("description_he"),
  
  // Reference
  referenceType: varchar("reference_type"), // BOOKING | INVOICE | PAYMENT | EXPENSE | PAYROLL
  referenceId: varchar("reference_id"), // ID of the source transaction
  
  // Financial period
  fiscalYear: integer("fiscal_year").notNull(),
  fiscalPeriod: integer("fiscal_period").notNull(), // 1-12 for monthly
  transactionDate: timestamp("transaction_date").notNull(),
  
  // Audit
  createdBy: varchar("created_by").notNull(), // Admin or system
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  
  // Status
  status: varchar("status").notNull().default("posted"), // draft | posted | approved | voided
  voidedAt: timestamp("voided_at"),
  voidReason: text("void_reason"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_ledger_tx_id").on(table.transactionId),
  index("idx_ledger_account").on(table.accountCode),
  index("idx_ledger_division").on(table.divisionId),
  index("idx_ledger_date").on(table.transactionDate),
  index("idx_ledger_fiscal").on(table.fiscalYear, table.fiscalPeriod),
  index("idx_ledger_reference").on(table.referenceType, table.referenceId),
]);

// Invoice Headers (All invoices show "Pet Wash™ Ltd" as seller)
export const invoiceHeaders = pgTable("invoice_headers", {
  id: serial("id").primaryKey(),
  
  // Invoice identification
  invoiceNumber: varchar("invoice_number").unique().notNull(), // INV-2025-NNNNNN
  invoiceType: varchar("invoice_type").notNull(), // SALE | CREDIT_NOTE | DEBIT_NOTE | PROFORMA
  
  // Seller (always Pet Wash™ Ltd)
  sellerCompanyId: integer("seller_company_id").references(() => companyProfile.id).notNull(),
  sellerLegalName: varchar("seller_legal_name").notNull().default("Pet Wash™ Ltd"),
  sellerTaxId: varchar("seller_tax_id").notNull(),
  sellerAddress: text("seller_address").notNull(),
  
  // Customer
  customerUid: varchar("customer_uid"), // Firebase UID (if registered)
  customerName: varchar("customer_name").notNull(),
  customerEmail: varchar("customer_email").notNull(),
  customerTaxId: varchar("customer_tax_id"), // For B2B invoices
  customerAddress: text("customer_address"),
  
  // Platform/Division
  divisionId: integer("division_id").references(() => divisions.id).notNull(),
  divisionName: varchar("division_name").notNull(),
  
  // Financial totals
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  vatAmount: decimal("vat_amount", { precision: 12, scale: 2 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency").default("ILS"),
  
  // VAT breakdown (18% on commission only for marketplace platforms)
  baseAmount: decimal("base_amount", { precision: 12, scale: 2 }), // Amount before commission
  commissionAmount: decimal("commission_amount", { precision: 12, scale: 2 }), // Pet Wash commission
  commissionVat: decimal("commission_vat", { precision: 12, scale: 2 }), // VAT on commission (18%)
  
  // Dates
  issueDate: date("issue_date").notNull(),
  dueDate: date("due_date"),
  paidDate: timestamp("paid_date"),
  
  // Payment
  paymentStatus: varchar("payment_status").notNull().default("unpaid"), // unpaid | paid | partially_paid | overdue | cancelled
  paymentMethod: varchar("payment_method"), // nayax | bank_transfer | credit_card
  paymentReference: varchar("payment_reference"),
  
  // Reference to source transaction
  sourceType: varchar("source_type"), // BOOKING | SUBSCRIPTION | WASH | VOUCHER
  sourceId: varchar("source_id"),
  
  // Israeli tax compliance
  taxReported: boolean("tax_reported").default(false),
  taxReportedDate: timestamp("tax_reported_date"),
  taxPeriod: varchar("tax_period"), // YYYY-MM format
  
  // Document
  pdfUrl: varchar("pdf_url"), // Generated PDF invoice
  
  // Status
  status: varchar("status").notNull().default("active"), // draft | active | sent | paid | cancelled | voided
  sentAt: timestamp("sent_at"),
  voidedAt: timestamp("voided_at"),
  voidReason: text("void_reason"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_invoices_number").on(table.invoiceNumber),
  index("idx_invoices_customer").on(table.customerUid),
  index("idx_invoices_division").on(table.divisionId),
  index("idx_invoices_status").on(table.paymentStatus),
  index("idx_invoices_date").on(table.issueDate),
]);

// Invoice Line Items
export const invoiceItems = pgTable("invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").references(() => invoiceHeaders.id).notNull(),
  
  // Line item details
  lineNumber: integer("line_number").notNull(), // Sequential line number
  description: text("description").notNull(),
  descriptionHe: text("description_he"),
  
  // Pricing
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 12, scale: 2 }).default("0"),
  
  // Amounts
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  vatRate: decimal("vat_rate", { precision: 5, scale: 4 }).notNull().default("0.18"),
  vatAmount: decimal("vat_amount", { precision: 12, scale: 2 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  
  // Classification
  itemType: varchar("item_type"), // SERVICE | PRODUCT | FEE | COMMISSION
  accountCode: varchar("account_code"), // Ledger account
  
  // Reference
  referenceType: varchar("reference_type"), // BOOKING | SUBSCRIPTION | WASH | VOUCHER
  referenceId: varchar("reference_id"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_invoice_items_invoice").on(table.invoiceId),
]);

// =================== EXPORTS ===================

export type Country = typeof countries.$inferSelect;
export type InsertCountry = typeof countries.$inferInsert;

export type FranchiseTerritory = typeof franchiseTerritories.$inferSelect;
export type InsertFranchiseTerritory = typeof franchiseTerritories.$inferInsert;

export type Franchisee = typeof franchisees.$inferSelect;
export type InsertFranchisee = typeof franchisees.$inferInsert;

export type PetWashStation = typeof petWashStations.$inferSelect;
export type InsertPetWashStation = typeof petWashStations.$inferInsert;

export type StationBill = typeof stationBills.$inferSelect;
export type InsertStationBill = typeof stationBills.$inferInsert;

export type StationAsset = typeof stationAssets.$inferSelect;
export type InsertStationAsset = typeof stationAssets.$inferInsert;

export type SparePart = typeof spareParts.$inferSelect;
export type InsertSparePart = typeof spareParts.$inferInsert;

export type StationSparePart = typeof stationSpareParts.$inferSelect;
export type InsertStationSparePart = typeof stationSpareParts.$inferInsert;

export type MaintenanceWorkOrder = typeof maintenanceWorkOrders.$inferSelect;
export type InsertMaintenanceWorkOrder = typeof maintenanceWorkOrders.$inferInsert;

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = typeof subscriptionPlans.$inferInsert;

export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type InsertUserSubscription = typeof userSubscriptions.$inferInsert;

export type SubscriptionUsageHistory = typeof subscriptionUsageHistory.$inferSelect;
export type InsertSubscriptionUsageHistory = typeof subscriptionUsageHistory.$inferInsert;

export type StationTelemetry = typeof stationTelemetry.$inferSelect;
export type InsertStationTelemetry = typeof stationTelemetry.$inferInsert;

export type StationAlert = typeof stationAlerts.$inferSelect;
export type InsertStationAlert = typeof stationAlerts.$inferInsert;

export type StationPerformanceMetrics = typeof stationPerformanceMetrics.$inferSelect;
export type InsertStationPerformanceMetrics = typeof stationPerformanceMetrics.$inferInsert;

export type CustomerAchievement = typeof customerAchievements.$inferSelect;
export type InsertCustomerAchievement = typeof customerAchievements.$inferInsert;

export type FranchiseOrderRequest = typeof franchiseOrderRequests.$inferSelect;
export type InsertFranchiseOrderRequest = typeof franchiseOrderRequests.$inferInsert;

export type StockTransaction = typeof stockTransactions.$inferSelect;
export type InsertStockTransaction = typeof stockTransactions.$inferInsert;

export type SupplierNotificationSetting = typeof supplierNotificationSettings.$inferSelect;
export type InsertSupplierNotificationSetting = typeof supplierNotificationSettings.$inferInsert;

export type SystemRole = typeof systemRoles.$inferSelect;
export type InsertSystemRole = typeof systemRoles.$inferInsert;

export type UserRoleAssignment = typeof userRoleAssignments.$inferSelect;
export type InsertUserRoleAssignment = typeof userRoleAssignments.$inferInsert;

export type InternalInvite = typeof internalInvites.$inferSelect;
export type InsertInternalInvite = typeof internalInvites.$inferInsert;

export type DocumentCategory = typeof documentCategories.$inferSelect;
export type InsertDocumentCategory = typeof documentCategories.$inferInsert;

export type SecureDocument = typeof secureDocuments.$inferSelect;
export type InsertSecureDocument = typeof secureDocuments.$inferInsert;

export type DocumentAccessLog = typeof documentAccessLog.$inferSelect;
export type InsertDocumentAccessLog = typeof documentAccessLog.$inferInsert;

// Pet Wash Ltd Organizational Structure types
export type CompanyProfile = typeof companyProfile.$inferSelect;
export type InsertCompanyProfile = typeof companyProfile.$inferInsert;

export type Division = typeof divisions.$inferSelect;
export type InsertDivision = typeof divisions.$inferInsert;

export type Department = typeof departments.$inferSelect;
export type InsertDepartment = typeof departments.$inferInsert;

export type OrganizationalRole = typeof organizationalRoles.$inferSelect;
export type InsertOrganizationalRole = typeof organizationalRoles.$inferInsert;

export type ContractorLifecycleRecord = typeof contractorLifecycleRecords.$inferSelect;
export type InsertContractorLifecycleRecord = typeof contractorLifecycleRecords.$inferInsert;

export type PaymentAccount = typeof paymentAccounts.$inferSelect;
export type InsertPaymentAccount = typeof paymentAccounts.$inferInsert;

export type LedgerTransaction = typeof ledgerTransactions.$inferSelect;
export type InsertLedgerTransaction = typeof ledgerTransactions.$inferInsert;

export type InvoiceHeader = typeof invoiceHeaders.$inferSelect;
export type InsertInvoiceHeader = typeof invoiceHeaders.$inferInsert;

export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type InsertInvoiceItem = typeof invoiceItems.$inferInsert;

// Zod validation schemas
export const insertCountrySchema = createInsertSchema(countries).omit({ id: true, createdAt: true });
export const insertFranchiseTerritorySchema = createInsertSchema(franchiseTerritories).omit({ id: true, createdAt: true });
export const insertFranchiseeSchema = createInsertSchema(franchisees).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPetWashStationSchema = createInsertSchema(petWashStations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertStationBillSchema = createInsertSchema(stationBills).omit({ id: true, createdAt: true, updatedAt: true });
export const insertStationAssetSchema = createInsertSchema(stationAssets).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSparePartSchema = createInsertSchema(spareParts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertStationSparePartSchema = createInsertSchema(stationSpareParts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMaintenanceWorkOrderSchema = createInsertSchema(maintenanceWorkOrders).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserSubscriptionSchema = createInsertSchema(userSubscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSubscriptionUsageHistorySchema = createInsertSchema(subscriptionUsageHistory).omit({ id: true, createdAt: true });
export const insertStationTelemetrySchema = createInsertSchema(stationTelemetry).omit({ id: true, createdAt: true });
export const insertStationAlertSchema = createInsertSchema(stationAlerts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertStationPerformanceMetricsSchema = createInsertSchema(stationPerformanceMetrics).omit({ id: true, createdAt: true });
export const insertCustomerAchievementSchema = createInsertSchema(customerAchievements).omit({ id: true, createdAt: true });
export const insertFranchiseOrderRequestSchema = createInsertSchema(franchiseOrderRequests).omit({ id: true, createdAt: true, updatedAt: true });
export const insertStockTransactionSchema = createInsertSchema(stockTransactions).omit({ id: true, createdAt: true });
export const insertSupplierNotificationSettingSchema = createInsertSchema(supplierNotificationSettings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSystemRoleSchema = createInsertSchema(systemRoles).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserRoleAssignmentSchema = createInsertSchema(userRoleAssignments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertInternalInviteSchema = createInsertSchema(internalInvites).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDocumentCategorySchema = createInsertSchema(documentCategories).omit({ id: true, createdAt: true });
export const insertSecureDocumentSchema = createInsertSchema(secureDocuments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDocumentAccessLogSchema = createInsertSchema(documentAccessLog).omit({ id: true, accessedAt: true });

// Pet Wash Ltd Organizational Structure schemas
export const insertCompanyProfileSchema = createInsertSchema(companyProfile).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDivisionSchema = createInsertSchema(divisions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDepartmentSchema = createInsertSchema(departments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOrganizationalRoleSchema = createInsertSchema(organizationalRoles).omit({ id: true, createdAt: true, updatedAt: true });
export const insertContractorLifecycleRecordSchema = createInsertSchema(contractorLifecycleRecords).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPaymentAccountSchema = createInsertSchema(paymentAccounts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLedgerTransactionSchema = createInsertSchema(ledgerTransactions).omit({ id: true, createdAt: true });
export const insertInvoiceHeaderSchema = createInsertSchema(invoiceHeaders).omit({ id: true, createdAt: true, updatedAt: true });
export const insertInvoiceItemSchema = createInsertSchema(invoiceItems).omit({ id: true, createdAt: true });

// =================== PROVIDER APPLICATION SYSTEM (Pet Wash™) ===================
// Complete 7-stage verification workflow for marketplace providers

// Application stage enum
export const providerApplicationStages = [
  'application_submitted',    // Stage 1: Initial form submitted
  'documents_pending',        // Stage 2: Waiting for document uploads
  'documents_under_review',   // Stage 3: Admin reviewing documents
  'background_check_pending', // Stage 4: Background check initiated
  'background_check_complete',// Stage 5: Background check results received
  'admin_final_review',       // Stage 6: Final admin approval/rejection
  'approved',                 // Stage 7a: Approved - invitation sent
  'rejected',                 // Stage 7b: Rejected - with reason
  'withdrawn'                 // Applicant withdrew
] as const;

// Service types the provider can offer
export const providerServiceTypes = [
  'pet_sitting',      // The Sitter Suite™
  'dog_walking',      // Walk My Pet™
  'pet_transport',    // PetTrek™
  'wash_hub_operator',// K9000™ Station Operator
  'grooming',         // Mobile grooming services
  'training',         // Pet training services
  'veterinary_house_calls' // Home vet visits
] as const;

// Provider Applicants - Main application table
export const providerApplicants = pgTable("provider_applicants", {
  id: serial("id").primaryKey(),
  
  // Applicant identity (linked to Firebase user)
  userId: varchar("user_id").notNull(), // Firebase UID
  email: varchar("email").notNull(),
  
  // Personal Information
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  phoneNumber: varchar("phone_number").notNull(),
  dateOfBirth: date("date_of_birth").notNull(),
  nationalId: varchar("national_id"), // Israeli Teudat Zehut or passport
  gender: varchar("gender", { length: 20 }), // male, female, other, prefer_not_to_say
  
  // Membership
  membershipNumber: varchar("membership_number", { length: 20 }).unique(), // PWP-XXXXXXX (provider class)
  
  // Address
  streetAddress: text("street_address").notNull(),
  city: varchar("city").notNull(),
  postalCode: varchar("postal_code"),
  countryCode: varchar("country_code", { length: 2 }).default("IL"),
  
  // Professional Information
  serviceTypes: text("service_types").array().notNull(), // Array of service types
  yearsExperience: integer("years_experience").default(0),
  certifications: text("certifications").array(), // Pet first aid, grooming certs, etc.
  biography: text("biography"), // About themselves
  languages: text("languages").array().default(sql`ARRAY['he']::text[]`),
  
  // Service Preferences
  serviceRadius: integer("service_radius").default(10), // km
  maxPetsAtOnce: integer("max_pets_at_once").default(3),
  petTypesAccepted: text("pet_types_accepted").array().default(sql`ARRAY['dog', 'cat']::text[]`),
  hasOwnVehicle: boolean("has_own_vehicle").default(false),
  hasHomeSpace: boolean("has_home_space").default(false), // For pet sitting
  
  // Emergency Contact
  emergencyContactName: varchar("emergency_contact_name"),
  emergencyContactPhone: varchar("emergency_contact_phone"),
  emergencyContactRelation: varchar("emergency_contact_relation"),
  
  // Application Status
  stage: varchar("stage").notNull().default("application_submitted"),
  status: varchar("status").notNull().default("pending"), // pending, approved, rejected, withdrawn
  rejectionReason: text("rejection_reason"),
  
  // Interview/Screening
  interviewScheduledAt: timestamp("interview_scheduled_at"),
  interviewCompletedAt: timestamp("interview_completed_at"),
  interviewNotes: text("interview_notes"),
  interviewScore: integer("interview_score"), // 1-10
  
  // Admin Assignment
  assignedReviewerId: varchar("assigned_reviewer_id"), // Admin UID
  reviewerNotes: text("reviewer_notes"),
  
  // Israeli Privacy Law 2025 Compliance
  privacyConsentAt: timestamp("privacy_consent_at"),
  privacyConsentIp: varchar("privacy_consent_ip"),
  marketingConsentAt: timestamp("marketing_consent_at"),
  dataRetentionAcknowledgedAt: timestamp("data_retention_acknowledged_at"),
  
  // Invitation (on approval)
  invitationToken: varchar("invitation_token").unique(),
  invitationSentAt: timestamp("invitation_sent_at"),
  invitationExpiresAt: timestamp("invitation_expires_at"),
  onboardingCompletedAt: timestamp("onboarding_completed_at"),
  
  // Audit Trail
  submittedAt: timestamp("submitted_at").defaultNow(),
  lastUpdatedAt: timestamp("last_updated_at").defaultNow(),
  stageChangedAt: timestamp("stage_changed_at").defaultNow(),
  approvedAt: timestamp("approved_at"),
  rejectedAt: timestamp("rejected_at"),
  
  // Cryptographic Integrity (Israeli Privacy Law 2025)
  contentHash: varchar("content_hash"), // SHA-256 of application data
  auditTrailHash: varchar("audit_trail_hash"), // Chain hash for tamper detection
}, (table) => [
  index("idx_provider_applicants_user").on(table.userId),
  index("idx_provider_applicants_email").on(table.email),
  index("idx_provider_applicants_stage").on(table.stage),
  index("idx_provider_applicants_status").on(table.status),
  index("idx_provider_applicants_reviewer").on(table.assignedReviewerId),
]);

// Document types for provider verification
export const providerDocumentTypes = [
  'national_id',           // Teudat Zehut / Passport
  'drivers_license',       // For transport services
  'criminal_background',   // Police clearance certificate
  'pet_first_aid_cert',    // Pet first aid certification
  'grooming_cert',         // Professional grooming certification
  'veterinary_cert',       // Vet technician license
  'insurance_policy',      // Liability insurance
  'vehicle_registration',  // For transport providers
  'vehicle_insurance',     // Vehicle insurance
  'home_photos',           // For pet sitters - home environment
  'profile_photo',         // Professional headshot
  'gallery_photo',         // Additional public-facing photos (home, pets, environment)
  'tax_registration',      // Israeli Osek Morshe / Osek Patur
  'bank_details',          // For payments
  'references'             // Professional references
] as const;

// Provider Documents - Document uploads with verification
export const providerDocuments = pgTable("provider_documents", {
  id: serial("id").primaryKey(),
  applicantId: integer("applicant_id").references(() => providerApplicants.id),
  
  documentType: varchar("document_type").notNull(),
  fileName: varchar("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type"),
  
  status: varchar("status").default("pending"),
  verifiedBy: varchar("verified_by"),
  verifiedAt: timestamp("verified_at"),
  rejectionReason: text("rejection_reason"),
  
  uploadedAt: timestamp("uploaded_at").defaultNow(),

  metadata: jsonb("metadata"),
  uploadedBy: varchar("uploaded_by"),
}, (table) => [
  index("idx_provider_docs_applicant").on(table.applicantId),
  index("idx_provider_docs_type").on(table.documentType),
]);

// Background Check Results
export const providerBackgroundChecks = pgTable("provider_background_checks", {
  id: serial("id").primaryKey(),
  applicantId: integer("applicant_id").references(() => providerApplicants.id).notNull(),
  
  // Check Type
  checkType: varchar("check_type").notNull(), // criminal, employment, reference, credit
  checkProvider: varchar("check_provider").notNull(), // Service provider name
  
  // Status
  status: varchar("status").notNull().default("pending"), // pending, in_progress, completed, failed, expired
  initiatedAt: timestamp("initiated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  expiresAt: timestamp("expires_at"),
  
  // Results
  resultStatus: varchar("result_status"), // clear, flagged, inconclusive
  resultSummary: text("result_summary"),
  flaggedIssues: jsonb("flagged_issues"), // Array of issues found
  riskScore: integer("risk_score"), // 0-100, lower is better
  
  // Raw Response (encrypted)
  vendorReference: varchar("vendor_reference"), // External reference ID
  vendorResponse: jsonb("vendor_response"), // Full response from vendor
  
  // Admin Review
  reviewedAt: timestamp("reviewed_at"),
  reviewedByUid: varchar("reviewed_by_uid"),
  reviewerDecision: varchar("reviewer_decision"), // accept, reject, request_more_info
  reviewerNotes: text("reviewer_notes"),
  
  // Security
  responseHash: varchar("response_hash"), // SHA-256 of vendor response
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_bg_checks_applicant").on(table.applicantId),
  index("idx_bg_checks_status").on(table.status),
  index("idx_bg_checks_result").on(table.resultStatus),
]);

// Onboarding Tasks Checklist
export const providerOnboardingTasks = pgTable("provider_onboarding_tasks", {
  id: serial("id").primaryKey(),
  applicantId: integer("applicant_id").references(() => providerApplicants.id),
  
  taskKey: varchar("task_key").notNull(),
  taskName: varchar("task_name").notNull(),
  taskNameHe: varchar("task_name_he"),
  description: text("description"),
  descriptionHe: text("description_he"),
  
  stage: varchar("stage").notNull(),
  sortOrder: integer("sort_order").default(0),
  
  isRequired: boolean("is_required").default(true),
  
  status: varchar("status").default("pending"),
  completedAt: timestamp("completed_at"),
  verifiedBy: varchar("verified_by"),
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_onboard_tasks_applicant").on(table.applicantId),
  index("idx_onboard_tasks_stage").on(table.stage),
  index("idx_onboard_tasks_status").on(table.status),
]);

// Stage Transition Audit Log
export const providerStageTransitions = pgTable("provider_stage_transitions", {
  id: serial("id").primaryKey(),
  applicantId: integer("applicant_id").references(() => providerApplicants.id),
  
  fromStage: varchar("from_stage"),
  toStage: varchar("to_stage").notNull(),
  transitionReason: text("transition_reason"),
  
  // Actor
  triggeredByUid: varchar("triggered_by_uid"), // Who triggered the change
  triggeredBySystem: boolean("triggered_by_system").default(false), // Auto-triggered
  
  // Context
  metadata: jsonb("metadata"), // Additional context
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  
  // Cryptographic Chain
  previousHash: varchar("previous_hash"), // Hash of previous transition
  transitionHash: varchar("transition_hash"), // SHA-256 of this transition
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_stage_trans_applicant").on(table.applicantId),
  index("idx_stage_trans_time").on(table.createdAt),
]);

// Provider Application Types
export type ProviderApplicant = typeof providerApplicants.$inferSelect;
export type InsertProviderApplicant = typeof providerApplicants.$inferInsert;

export type ProviderDocument = typeof providerDocuments.$inferSelect;
export type InsertProviderDocument = typeof providerDocuments.$inferInsert;

export type ProviderBackgroundCheck = typeof providerBackgroundChecks.$inferSelect;
export type InsertProviderBackgroundCheck = typeof providerBackgroundChecks.$inferInsert;

export type ProviderOnboardingTask = typeof providerOnboardingTasks.$inferSelect;
export type InsertProviderOnboardingTask = typeof providerOnboardingTasks.$inferInsert;

export type ProviderStageTransition = typeof providerStageTransitions.$inferSelect;
export type InsertProviderStageTransition = typeof providerStageTransitions.$inferInsert;

// Zod Schemas for Provider Application
export const insertProviderApplicantSchema = createInsertSchema(providerApplicants).omit({ 
  id: true, 
  submittedAt: true, 
  lastUpdatedAt: true,
  stageChangedAt: true,
  contentHash: true,
  auditTrailHash: true 
});

export const insertProviderDocumentSchema = createInsertSchema(providerDocuments).omit({ 
  id: true, 
  uploadedAt: true,
});

export const insertProviderBackgroundCheckSchema = createInsertSchema(providerBackgroundChecks).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export const insertProviderOnboardingTaskSchema = createInsertSchema(providerOnboardingTasks).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export const insertProviderStageTransitionSchema = createInsertSchema(providerStageTransitions).omit({ 
  id: true, 
  createdAt: true 
});

// Application form validation schema (for frontend)
export const providerApplicationFormSchema = z.object({
  // Personal Info
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phoneNumber: z.string().min(9, "Phone number must be at least 9 digits"),
  dateOfBirth: z.string().refine((date) => {
    const age = (new Date().getFullYear() - new Date(date).getFullYear());
    return age >= 18;
  }, "You must be at least 18 years old"),
  nationalId: z.string().optional(),
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(),
  
  // Address
  streetAddress: z.string().min(5, "Please enter your full address"),
  city: z.string().min(2, "City is required"),
  postalCode: z.string().optional(),
  
  // Professional
  serviceTypes: z.array(z.string()).min(1, "Select at least one service type"),
  yearsExperience: z.number().min(0).max(50),
  certifications: z.array(z.string()).optional(),
  biography: z.string().min(50, "Tell us about yourself (at least 50 characters)").max(2000),
  languages: z.array(z.string()).min(1, "Select at least one language"),
  
  // Service Preferences
  serviceRadius: z.number().min(1).max(100),
  maxPetsAtOnce: z.number().min(1).max(20),
  petTypesAccepted: z.array(z.string()).min(1, "Select at least one pet type"),
  hasOwnVehicle: z.boolean(),
  hasHomeSpace: z.boolean(),
  
  // Emergency Contact
  emergencyContactName: z.string().min(2, "Emergency contact name is required"),
  emergencyContactPhone: z.string().min(9, "Emergency contact phone is required"),
  emergencyContactRelation: z.string().min(2, "Relationship is required"),
  
  // Consents (Israeli Privacy Law 2025)
  privacyConsent: z.boolean().refine(val => val === true, "You must agree to the privacy policy"),
  marketingConsent: z.boolean().optional(),
  dataRetentionAcknowledged: z.boolean().refine(val => val === true, "You must acknowledge the data retention policy"),
});

export const accountDeletionRequests = pgTable("account_deletion_requests", {
  id: serial("id").primaryKey(),
  requestId: varchar("request_id", { length: 64 }).unique().notNull(),
  userId: integer("user_id").notNull(),
  userEmail: varchar("user_email", { length: 255 }).notNull(),
  userFullName: varchar("user_full_name", { length: 255 }).notNull(),
  userPhone: varchar("user_phone", { length: 50 }),
  userCountry: varchar("user_country", { length: 10 }),
  userLoyaltyTier: varchar("user_loyalty_tier", { length: 50 }),
  userRegisteredAt: timestamp("user_registered_at"),
  reason: text("reason"),
  consentText: text("consent_text").notNull(),
  consentLanguage: varchar("consent_language", { length: 10 }).notNull().default('he'),
  consentCheckbox: boolean("consent_checkbox").notNull().default(false),
  consentTimestamp: timestamp("consent_timestamp").notNull(),
  ipAddress: varchar("ip_address", { length: 64 }),
  userAgent: text("user_agent"),
  deviceFingerprint: varchar("device_fingerprint", { length: 128 }),
  status: varchar("status", { length: 30 }).notNull().default('pending'),
  softDeleteCompletedAt: timestamp("soft_delete_completed_at"),
  hardDeleteScheduledAt: timestamp("hard_delete_scheduled_at"),
  hardDeleteCompletedAt: timestamp("hard_delete_completed_at"),
  dataExportUrl: varchar("data_export_url", { length: 512 }),
  dataExportGeneratedAt: timestamp("data_export_generated_at"),
  legalBasis: varchar("legal_basis", { length: 100 }).notNull().default('user_request'),
  complianceLaw: varchar("compliance_law", { length: 100 }).notNull().default('Israeli Privacy Protection Law 2025'),
  retentionPeriodDays: integer("retention_period_days").notNull().default(90),
  contentHash: varchar("content_hash", { length: 128 }),
  processedBy: varchar("processed_by", { length: 100 }),
  processedAt: timestamp("processed_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const accountDeletionAuditLog = pgTable("account_deletion_audit_log", {
  id: serial("id").primaryKey(),
  requestId: varchar("request_id", { length: 64 }).notNull(),
  userId: integer("user_id").notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  details: jsonb("details"),
  dataCategory: varchar("data_category", { length: 100 }),
  recordsAffected: integer("records_affected").default(0),
  performedBy: varchar("performed_by", { length: 100 }).notNull(),
  ipAddress: varchar("ip_address", { length: 64 }),
  contentHash: varchar("content_hash", { length: 128 }),
  previousHash: varchar("previous_hash", { length: 128 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAccountDeletionRequestSchema = createInsertSchema(accountDeletionRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AccountDeletionRequest = typeof accountDeletionRequests.$inferSelect;
export type InsertAccountDeletionRequest = z.infer<typeof insertAccountDeletionRequestSchema>;

export const insertAccountDeletionAuditLogSchema = createInsertSchema(accountDeletionAuditLog).omit({
  id: true,
  createdAt: true,
});

export type AccountDeletionAuditLog = typeof accountDeletionAuditLog.$inferSelect;
export type InsertAccountDeletionAuditLog = z.infer<typeof insertAccountDeletionAuditLogSchema>;

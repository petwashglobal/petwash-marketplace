/**
 * Home-access / property-authority schema (see migrations/0054_home_access_subsystem.sql).
 * Access details are stored encrypted (AES-256-GCM via server/lib/homeAccessCrypto.ts);
 * every view is logged in home_access_logs.
 */
import { pgTable, serial, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core';

export const customerProperties = pgTable('customer_properties', {
  id: serial('id').primaryKey(),
  propertyId: varchar('property_id').notNull().unique(),
  customerId: varchar('customer_id').notNull(),
  city: varchar('city'),
  apartmentUnit: varchar('apartment_unit'),
  propertyType: varchar('property_type'),
  addressEncrypted: text('address_encrypted'),
  accessMethod: varchar('access_method'),
  accessInstructionsEncrypted: text('access_instructions_encrypted'),
  alarmDisclosed: boolean('alarm_disclosed').notNull().default(false),
  camerasDisclosed: boolean('cameras_disclosed').notNull().default(false),
  restrictedAreas: text('restricted_areas'),
  petsAllowedConfirmed: boolean('pets_allowed_confirmed').notNull().default(false),
  leaseBuildingRulesConfirmed: boolean('lease_building_rules_confirmed').notNull().default(false),
  otherOccupantsInformedConfirmed: boolean('other_occupants_informed_confirmed').notNull().default(false),
  authorityDeclarationSigned: boolean('authority_declaration_signed').notNull().default(false),
  emergencyContactId: varchar('emergency_contact_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const propertyAuthorityDeclarations = pgTable('property_authority_declarations', {
  id: serial('id').primaryKey(),
  declarationId: varchar('declaration_id').notNull().unique(),
  customerId: varchar('customer_id').notNull(),
  propertyId: varchar('property_id').notNull(),
  bookingId: varchar('booking_id'),
  consentRecordId: varchar('consent_record_id'),
  typedFullName: varchar('typed_full_name').notNull(),
  documentVersion: varchar('document_version').notNull(),
  signedAt: timestamp('signed_at', { withTimezone: true }).notNull().defaultNow(),
  ipAddress: varchar('ip_address'),
  userAgent: varchar('user_agent'),
  status: varchar('status').notNull().default('signed'),
});

export const homeAccessLogs = pgTable('home_access_logs', {
  id: serial('id').primaryKey(),
  accessLogId: varchar('access_log_id').notNull().unique(),
  bookingId: varchar('booking_id').notNull(),
  propertyId: varchar('property_id').notNull(),
  providerId: varchar('provider_id'),
  viewedByUserId: varchar('viewed_by_user_id').notNull(),
  reason: varchar('reason'),
  ipAddress: varchar('ip_address'),
  userAgent: varchar('user_agent'),
  viewedAt: timestamp('viewed_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Incident engine + emergency-vet authorization schema
 * (see migrations/0056_incident_engine.sql).
 */
import { pgTable, serial, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core';

export const incidentReports = pgTable('incident_reports', {
  id: serial('id').primaryKey(),
  incidentId: varchar('incident_id').notNull().unique(),
  incidentType: varchar('incident_type').notNull(),
  severity: varchar('severity').notNull().default('medium'),
  status: varchar('status').notNull().default('open'),
  description: text('description'),
  memberId: varchar('member_id'),
  petId: varchar('pet_id'),
  providerId: varchar('provider_id'),
  bookingId: varchar('booking_id'),
  stationId: varchar('station_id'),
  washSessionId: varchar('wash_session_id'),
  paymentId: varchar('payment_id'),
  photoUrls: text('photo_urls'),
  notes: text('notes'),
  emergencyContactCalled: boolean('emergency_contact_called').notNull().default(false),
  vetContacted: boolean('vet_contacted').notNull().default(false),
  authorityContacted: boolean('authority_contacted').notNull().default(false),
  payoutHold: boolean('payout_hold').notNull().default(false),
  reportedBy: varchar('reported_by'),
  adminOwner: varchar('admin_owner'),
  resolution: text('resolution'),
  reportedAt: timestamp('reported_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const emergencyVetAuthorizations = pgTable('emergency_vet_authorizations', {
  id: serial('id').primaryKey(),
  authorizationId: varchar('authorization_id').notNull().unique(),
  bookingId: varchar('booking_id'),
  customerId: varchar('customer_id').notNull(),
  petId: varchar('pet_id'),
  authorized: boolean('authorized').notNull().default(false),
  vetContact: varchar('vet_contact'),
  costResponsibilityAcknowledged: boolean('cost_responsibility_acknowledged').notNull().default(false),
  consentRecordId: varchar('consent_record_id'),
  documentVersion: varchar('document_version'),
  signedAt: timestamp('signed_at', { withTimezone: true }).notNull().defaultNow(),
  ipAddress: varchar('ip_address'),
  userAgent: varchar('user_agent'),
});

import { pgTable, serial, varchar, text, timestamp, boolean, integer, jsonb, index, uniqueIndex, decimal, date } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// =================== THIRD-PARTY PLATFORM INTEGRATIONS ===================

export const airbnbListings = pgTable("airbnb_listings", {
  id: serial("id").primaryKey(),
  listingId: varchar("listing_id").unique().notNull(),
  hostId: varchar("host_id").notNull(),
  title: varchar("title").notNull(),
  description: text("description"),
  propertyType: varchar("property_type").notNull(),
  roomType: varchar("room_type").notNull(),
  maxGuests: integer("max_guests").notNull(),
  bedrooms: integer("bedrooms").notNull(),
  beds: integer("beds").notNull(),
  bathrooms: integer("bathrooms").notNull(),
  amenities: jsonb("amenities"),
  petPolicy: jsonb("pet_policy"),
  pricePerNight: decimal("price_per_night", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency").default("USD"),
  cleaningFee: decimal("cleaning_fee", { precision: 10, scale: 2 }),
  serviceFee: decimal("service_fee", { precision: 10, scale: 2 }),
  location: jsonb("location"),
  images: jsonb("images"),
  calendarUrl: varchar("calendar_url"),
  instantBookEnabled: boolean("instant_book_enabled").default(false),
  isActive: boolean("is_active").default(true),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  listingIdIdx: uniqueIndex("idx_airbnb_listing_id").on(table.listingId),
  hostIdIdx: index("idx_airbnb_host_id").on(table.hostId),
}));

export const airbnbBookings = pgTable("airbnb_bookings", {
  id: serial("id").primaryKey(),
  bookingId: varchar("booking_id").unique().notNull(),
  listingId: varchar("listing_id").references(() => airbnbListings.listingId).notNull(),
  guestId: varchar("guest_id").notNull(),
  guestName: varchar("guest_name").notNull(),
  guestEmail: varchar("guest_email"),
  checkInDate: date("check_in_date").notNull(),
  checkOutDate: date("check_out_date").notNull(),
  numberOfGuests: integer("number_of_guests").notNull(),
  numberOfPets: integer("number_of_pets").default(0),
  petDetails: jsonb("pet_details"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency").default("USD"),
  bookingStatus: varchar("booking_status").notNull(),
  confirmationCode: varchar("confirmation_code"),
  specialRequests: text("special_requests"),
  syncedAt: timestamp("synced_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  bookingIdIdx: uniqueIndex("idx_airbnb_booking_id").on(table.bookingId),
  listingIdIdx: index("idx_airbnb_booking_listing").on(table.listingId),
  guestIdIdx: index("idx_airbnb_booking_guest").on(table.guestId),
  checkInIdx: index("idx_airbnb_checkin").on(table.checkInDate),
}));

export const bookingComListings = pgTable("booking_com_listings", {
  id: serial("id").primaryKey(),
  propertyId: varchar("property_id").unique().notNull(),
  hotelId: varchar("hotel_id").notNull(),
  propertyName: varchar("property_name").notNull(),
  propertyType: varchar("property_type").notNull(),
  description: text("description"),
  address: jsonb("address"),
  coordinates: jsonb("coordinates"),
  starRating: integer("star_rating"),
  reviewScore: decimal("review_score", { precision: 3, scale: 1 }),
  totalReviews: integer("total_reviews").default(0),
  amenities: jsonb("amenities"),
  petPolicy: jsonb("pet_policy"),
  petFees: jsonb("pet_fees"),
  roomTypes: jsonb("room_types"),
  images: jsonb("images"),
  policies: jsonb("policies"),
  calendarUrl: varchar("calendar_url"),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }),
  isActive: boolean("is_active").default(true),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  propertyIdIdx: uniqueIndex("idx_booking_com_property_id").on(table.propertyId),
  hotelIdIdx: index("idx_booking_com_hotel_id").on(table.hotelId),
}));

export const bookingComReservations = pgTable("booking_com_reservations", {
  id: serial("id").primaryKey(),
  reservationId: varchar("reservation_id").unique().notNull(),
  propertyId: varchar("property_id").references(() => bookingComListings.propertyId).notNull(),
  guestName: varchar("guest_name").notNull(),
  guestEmail: varchar("guest_email"),
  guestPhone: varchar("guest_phone"),
  checkInDate: date("check_in_date").notNull(),
  checkOutDate: date("check_out_date").notNull(),
  roomType: varchar("room_type").notNull(),
  numberOfGuests: integer("number_of_guests").notNull(),
  numberOfPets: integer("number_of_pets").default(0),
  petDetails: jsonb("pet_details"),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency").default("USD"),
  commission: decimal("commission", { precision: 10, scale: 2 }),
  reservationStatus: varchar("reservation_status").notNull(),
  confirmationCode: varchar("confirmation_code"),
  specialRequests: text("special_requests"),
  syncedAt: timestamp("synced_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  reservationIdIdx: uniqueIndex("idx_booking_com_reservation_id").on(table.reservationId),
  propertyIdIdx: index("idx_booking_com_reservation_property").on(table.propertyId),
  checkInIdx: index("idx_booking_com_checkin").on(table.checkInDate),
  statusIdx: index("idx_booking_com_status").on(table.reservationStatus),
}));

export const petfinderListings = pgTable("petfinder_listings", {
  id: serial("id").primaryKey(),
  petfinderId: varchar("petfinder_id").unique().notNull(),
  organizationId: varchar("organization_id").notNull(),
  petType: varchar("pet_type").notNull(),
  species: varchar("species").notNull(),
  breed: varchar("breed"),
  color: varchar("color"),
  age: varchar("age"),
  gender: varchar("gender"),
  size: varchar("size"),
  name: varchar("name").notNull(),
  description: text("description"),
  photos: jsonb("photos"),
  videos: jsonb("videos"),
  status: varchar("status").notNull(),
  attributes: jsonb("attributes"),
  environment: jsonb("environment"),
  tags: jsonb("tags"),
  contact: jsonb("contact"),
  publishedAt: timestamp("published_at"),
  lastUpdatedAt: timestamp("last_updated_at"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  petfinderIdIdx: uniqueIndex("idx_petfinder_id").on(table.petfinderId),
  organizationIdIdx: index("idx_petfinder_organization").on(table.organizationId),
  statusIdx: index("idx_petfinder_status").on(table.status),
  speciesIdx: index("idx_petfinder_species").on(table.species),
}));

export const googleCalendarIntegrations = pgTable("google_calendar_integrations", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  userEmail: varchar("user_email").notNull(),
  calendarId: varchar("calendar_id").notNull(),
  calendarName: varchar("calendar_name").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  tokenExpiry: timestamp("token_expiry").notNull(),
  scope: text("scope").notNull(),
  syncEnabled: boolean("sync_enabled").default(true),
  syncDirection: varchar("sync_direction").default("bidirectional"),
  lastSyncedAt: timestamp("last_synced_at"),
  syncErrors: jsonb("sync_errors"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("idx_gcal_user_id").on(table.userId),
  calendarIdIdx: index("idx_gcal_calendar_id").on(table.calendarId),
  userCalendarIdx: uniqueIndex("idx_gcal_user_calendar").on(table.userId, table.calendarId),
}));

export const calendarEvents = pgTable("calendar_events", {
  id: serial("id").primaryKey(),
  eventId: varchar("event_id").unique().notNull(),
  integrationId: integer("integration_id").references(() => googleCalendarIntegrations.id, { onDelete: 'cascade' }).notNull(),
  eventType: varchar("event_type").notNull(),
  title: varchar("title").notNull(),
  description: text("description"),
  location: varchar("location"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  allDay: boolean("all_day").default(false),
  attendees: jsonb("attendees"),
  recurrence: jsonb("recurrence"),
  reminders: jsonb("reminders"),
  status: varchar("status").default("confirmed"),
  visibility: varchar("visibility").default("public"),
  externalEventId: varchar("external_event_id"),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  eventIdIdx: uniqueIndex("idx_calendar_event_id").on(table.eventId),
  integrationIdIdx: index("idx_calendar_integration").on(table.integrationId),
  startTimeIdx: index("idx_calendar_start_time").on(table.startTime),
  eventTypeIdx: index("idx_calendar_event_type").on(table.eventType),
}));

// =================== INSERT SCHEMAS & TYPE EXPORTS ===================

export const insertAirbnbListingSchema = createInsertSchema(airbnbListings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAirbnbListing = z.infer<typeof insertAirbnbListingSchema>;
export type AirbnbListing = typeof airbnbListings.$inferSelect;

export const insertAirbnbBookingSchema = createInsertSchema(airbnbBookings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAirbnbBooking = z.infer<typeof insertAirbnbBookingSchema>;
export type AirbnbBooking = typeof airbnbBookings.$inferSelect;

export const insertBookingComListingSchema = createInsertSchema(bookingComListings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBookingComListing = z.infer<typeof insertBookingComListingSchema>;
export type BookingComListing = typeof bookingComListings.$inferSelect;

export const insertBookingComReservationSchema = createInsertSchema(bookingComReservations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBookingComReservation = z.infer<typeof insertBookingComReservationSchema>;
export type BookingComReservation = typeof bookingComReservations.$inferSelect;

export const insertPetfinderListingSchema = createInsertSchema(petfinderListings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPetfinderListing = z.infer<typeof insertPetfinderListingSchema>;
export type PetfinderListing = typeof petfinderListings.$inferSelect;

export const insertGoogleCalendarIntegrationSchema = createInsertSchema(googleCalendarIntegrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertGoogleCalendarIntegration = z.infer<typeof insertGoogleCalendarIntegrationSchema>;
export type GoogleCalendarIntegration = typeof googleCalendarIntegrations.$inferSelect;

export const insertCalendarEventSchema = createInsertSchema(calendarEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;
export type CalendarEvent = typeof calendarEvents.$inferSelect;

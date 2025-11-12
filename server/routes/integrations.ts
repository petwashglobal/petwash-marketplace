import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import {
  airbnbListings,
  airbnbBookings,
  bookingComListings,
  bookingComReservations,
  petfinderListings,
  googleCalendarIntegrations,
  calendarEvents,
  type InsertAirbnbListing,
  type InsertAirbnbBooking,
  type InsertBookingComListing,
  type InsertBookingComReservation,
  type InsertPetfinderListing,
  type InsertGoogleCalendarIntegration,
  type InsertCalendarEvent,
} from '@shared/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { validateFirebaseToken } from '../middleware/firebase-auth';

const router = Router();

router.get('/airbnb/listings', validateFirebaseToken, async (req, res) => {
  try {
    const { hostId, isActive } = req.query;

    const conditions = [];
    if (hostId) conditions.push(eq(airbnbListings.hostId, hostId as string));
    if (isActive !== undefined) conditions.push(eq(airbnbListings.isActive, isActive === 'true'));

    const listings = await db
      .select()
      .from(airbnbListings)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(airbnbListings.createdAt));

    res.json({ success: true, listings });
  } catch (error: any) {
    console.error('[Integrations] Error fetching Airbnb listings:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch listings' });
  }
});

router.get('/airbnb/bookings', validateFirebaseToken, async (req, res) => {
  try {
    const { listingId, guestId, status, startDate, endDate } = req.query;

    const conditions = [];
    if (listingId) conditions.push(eq(airbnbBookings.listingId, listingId as string));
    if (guestId) conditions.push(eq(airbnbBookings.guestId, guestId as string));
    if (status) conditions.push(eq(airbnbBookings.bookingStatus, status as string));
    if (startDate) conditions.push(gte(airbnbBookings.checkInDate, new Date(startDate as string)));
    if (endDate) conditions.push(lte(airbnbBookings.checkOutDate, new Date(endDate as string)));

    const bookings = await db
      .select()
      .from(airbnbBookings)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(airbnbBookings.checkInDate));

    res.json({ success: true, bookings });
  } catch (error: any) {
    console.error('[Integrations] Error fetching Airbnb bookings:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch bookings' });
  }
});

router.get('/booking-com/listings', validateFirebaseToken, async (req, res) => {
  try {
    const { hotelId, isActive } = req.query;

    const conditions = [];
    if (hotelId) conditions.push(eq(bookingComListings.hotelId, hotelId as string));
    if (isActive !== undefined) conditions.push(eq(bookingComListings.isActive, isActive === 'true'));

    const listings = await db
      .select()
      .from(bookingComListings)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(bookingComListings.createdAt));

    res.json({ success: true, listings });
  } catch (error: any) {
    console.error('[Integrations] Error fetching Booking.com listings:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch listings' });
  }
});

router.get('/booking-com/reservations', validateFirebaseToken, async (req, res) => {
  try {
    const { propertyId, status, startDate, endDate } = req.query;

    const conditions = [];
    if (propertyId) conditions.push(eq(bookingComReservations.propertyId, propertyId as string));
    if (status) conditions.push(eq(bookingComReservations.reservationStatus, status as string));
    if (startDate) conditions.push(gte(bookingComReservations.checkInDate, new Date(startDate as string)));
    if (endDate) conditions.push(lte(bookingComReservations.checkOutDate, new Date(endDate as string)));

    const reservations = await db
      .select()
      .from(bookingComReservations)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(bookingComReservations.checkInDate));

    res.json({ success: true, reservations });
  } catch (error: any) {
    console.error('[Integrations] Error fetching Booking.com reservations:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch reservations' });
  }
});

router.get('/petfinder/listings', validateFirebaseToken, async (req, res) => {
  try {
    const { organizationId, species, status, isActive } = req.query;

    const conditions = [];
    if (organizationId) conditions.push(eq(petfinderListings.organizationId, organizationId as string));
    if (species) conditions.push(eq(petfinderListings.species, species as string));
    if (status) conditions.push(eq(petfinderListings.status, status as string));
    if (isActive !== undefined) conditions.push(eq(petfinderListings.isActive, isActive === 'true'));

    const listings = await db
      .select()
      .from(petfinderListings)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(petfinderListings.publishedAt));

    res.json({ success: true, listings });
  } catch (error: any) {
    console.error('[Integrations] Error fetching PetFinder listings:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch listings' });
  }
});

router.get('/google-calendar/integrations', validateFirebaseToken, async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    const integrations = await db
      .select()
      .from(googleCalendarIntegrations)
      .where(and(
        eq(googleCalendarIntegrations.userId, userId as string),
        eq(googleCalendarIntegrations.isActive, true)
      ))
      .orderBy(desc(googleCalendarIntegrations.createdAt));

    res.json({ success: true, integrations });
  } catch (error: any) {
    console.error('[Integrations] Error fetching Google Calendar integrations:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch integrations' });
  }
});

router.get('/google-calendar/events', validateFirebaseToken, async (req, res) => {
  try {
    const { integrationId, startDate, endDate, eventType } = req.query;

    if (!integrationId) {
      return res.status(400).json({ success: false, error: 'integrationId is required' });
    }

    const conditions = [eq(calendarEvents.integrationId, parseInt(integrationId as string))];
    if (startDate) conditions.push(gte(calendarEvents.startTime, new Date(startDate as string)));
    if (endDate) conditions.push(lte(calendarEvents.endTime, new Date(endDate as string)));
    if (eventType) conditions.push(eq(calendarEvents.eventType, eventType as string));

    const events = await db
      .select()
      .from(calendarEvents)
      .where(and(...conditions))
      .orderBy(calendarEvents.startTime);

    res.json({ success: true, events });
  } catch (error: any) {
    console.error('[Integrations] Error fetching calendar events:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch events' });
  }
});

router.post('/google-calendar/sync', validateFirebaseToken, async (req, res) => {
  try {
    const { userId, calendarId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    const { GoogleCalendarIntegrationService } = await import('../services/GoogleCalendarIntegrationService');
    const service = new GoogleCalendarIntegrationService();
    const result = await service.syncEvents(userId, calendarId || 'primary');
    res.json(result);
  } catch (error: any) {
    console.error('[Integrations] Error syncing Google Calendar:', error);
    res.status(500).json({ success: false, error: 'Failed to sync Google Calendar' });
  }
});

export default router;

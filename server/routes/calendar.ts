import { Router } from 'express';
import { requireAuth } from '../customAuth';
import { calendarIntegrationService, type BookingCalendarEvent } from '../services/CalendarIntegrationService';
import { logger } from '../lib/logger';

const router = Router();

router.get('/status', requireAuth, async (req, res) => {
  try {
    const available = await calendarIntegrationService.isAvailable();
    res.json({ connected: available });
  } catch {
    res.json({ connected: false });
  }
});

router.post('/add-booking', requireAuth, async (req, res) => {
  try {
    const { platform, bookingId, title, description, startTime, endTime, location, customerName, providerName, petName } = req.body;

    if (!bookingId || !startTime || !endTime) {
      return res.status(400).json({ error: 'bookingId, startTime, endTime required' });
    }

    const event: BookingCalendarEvent = {
      platform: platform || 'Pet Wash',
      bookingId,
      title: title || `Pet Wash™ Booking ${bookingId}`,
      description: description || '',
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      location,
      customerName,
      providerName,
      petName,
    };

    const result = await calendarIntegrationService.createBookingEvent(event);

    if (result) {
      res.json({ success: true, eventId: result.eventId, htmlLink: result.htmlLink });
    } else {
      res.json({ success: false, message: 'Calendar not connected or event creation failed' });
    }
  } catch (error) {
    logger.error('[Calendar API] Add booking error', error);
    res.status(500).json({ error: 'Failed to add calendar event' });
  }
});

router.delete('/booking/:bookingId', requireAuth, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const deleted = await calendarIntegrationService.deleteBookingEvent(bookingId);
    res.json({ success: deleted });
  } catch (error) {
    logger.error('[Calendar API] Delete booking error', error);
    res.status(500).json({ error: 'Failed to delete calendar event' });
  }
});

router.get('/upcoming', requireAuth, async (req, res) => {
  try {
    const events = await calendarIntegrationService.listUpcomingBookingEvents(20);
    res.json({ events });
  } catch (error) {
    logger.error('[Calendar API] List upcoming error', error);
    res.status(500).json({ error: 'Failed to list events' });
  }
});

router.post('/generate-links', requireAuth, async (req, res) => {
  try {
    const { platform, bookingId, title, description, startTime, endTime, location, customerName, providerName, petName } = req.body;

    const event: BookingCalendarEvent = {
      platform: platform || 'Pet Wash',
      bookingId: bookingId || 'new',
      title: title || 'Pet Wash™ Booking',
      description: description || '',
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      location,
      customerName,
      providerName,
      petName,
    };

    res.json({
      googleCalendar: calendarIntegrationService.generateICalLink(event),
      outlook: calendarIntegrationService.generateOutlookLink(event),
      apple: calendarIntegrationService.generateAppleCalendarLink(event),
    });
  } catch (error) {
    logger.error('[Calendar API] Generate links error', error);
    res.status(500).json({ error: 'Failed to generate calendar links' });
  }
});

export default router;

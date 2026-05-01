import { google } from 'googleapis';
import { logger } from '../lib/logger';

let connectionSettings: any;

/** Attempt Replit OAuth connector auth (development/Replit only). */
async function getAccessTokenReplit(): Promise<string | null> {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken || !hostname) return null;

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-calendar',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken,
      },
    }
  ).then(res => res.json()).then(data => data.items?.[0]).catch(() => null);

  return connectionSettings?.settings?.access_token
    || connectionSettings?.settings?.oauth?.credentials?.access_token
    || null;
}

/** Build a googleapis auth client using the service account JSON available in Cloud Run. */
function getServiceAccountAuth(): InstanceType<typeof google.auth.JWT> | null {
  const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!rawJson) return null;
  try {
    const credentials = JSON.parse(rawJson);
    return new google.auth.JWT(
      credentials.client_email,
      undefined,
      credentials.private_key,
      ['https://www.googleapis.com/auth/calendar'],
    );
  } catch (err: any) {
    logger.warn('[CalendarIntegration] Service account JSON parse failed', { error: err?.message });
    return null;
  }
}

async function getCalendarClient() {
  // 1. Try Replit connector (dev / Replit environment)
  const replitToken = await getAccessTokenReplit().catch(() => null);
  if (replitToken) {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: replitToken });
    return google.calendar({ version: 'v3', auth: oauth2Client });
  }

  // 2. Try service account (Cloud Run / production — uses GOOGLE_SERVICE_ACCOUNT_JSON)
  const serviceAuth = getServiceAccountAuth();
  if (serviceAuth) {
    return google.calendar({ version: 'v3', auth: serviceAuth as any });
  }

  logger.warn('[CalendarIntegration] No authentication available — Calendar integration disabled. ' +
    'Set GOOGLE_SERVICE_ACCOUNT_JSON in Cloud Run secrets to enable. ' +
    'Grant the service account "Google Calendar API" access in Google Cloud Console.');
  return null;
}

export interface BookingCalendarEvent {
  platform: string;
  bookingId: string;
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  customerName?: string;
  providerName?: string;
  petName?: string;
  /** Both-party calendar sync: include provider and customer email as attendees.
   *  Google Calendar will automatically send invitation emails so the event
   *  appears on each party's personal calendar when they accept.
   *  Blueprint §11: "Calendar sync must happen only after confirmed."
   */
  attendeeEmails?: string[];
}

class CalendarIntegrationService {
  private initialized = false;

  async isAvailable(): Promise<boolean> {
    try {
      const client = await getCalendarClient();
      return client !== null;
    } catch {
      return false;
    }
  }

  async createBookingEvent(event: BookingCalendarEvent): Promise<{ eventId: string; htmlLink: string } | null> {
    try {
      const calendar = await getCalendarClient();
      if (!calendar) {
        // Fail-safe: when no auth is configured, never throw — just log
        // and return null. Callers MUST treat null as "no calendar today,
        // try again next time" and never block a booking on it.
        logger.warn('[Calendar] createBookingEvent skipped — no calendar client', {
          bookingId: event.bookingId,
        });
        return null;
      }

      // Idempotency — search for an existing event tagged with the same
      // petwash_booking_id BEFORE creating. Safe to retry: a network blip,
      // a webhook redelivery, or a "click accept twice" never produces
      // duplicate calendar events.
      try {
        // googleapis type union confuses tsc when callbacks aren't supplied;
        // cast through `any` to match the working pattern used elsewhere in
        // this file (deleteBookingEvent / listUpcomingBookingEvents).
        const existing: any = await (calendar.events as any).list({
          calendarId: 'primary',
          privateExtendedProperty: `petwash_booking_id=${event.bookingId}`,
          maxResults: 1,
          showDeleted: false,
        });
        const found = existing?.data?.items?.[0];
        if (found && found.id) {
          logger.info('[Calendar] createBookingEvent idempotent — existing event found', {
            bookingId: event.bookingId,
            eventId: found.id,
          });
          return {
            eventId: found.id,
            htmlLink: found.htmlLink || '',
          };
        }
      } catch (idemErr: any) {
        // List failure is non-fatal: log + fall through to insert. Worst
        // case we create a duplicate; deleteBookingEvent cleans up by
        // booking_id so the duplicate would still be removed on cancel.
        logger.warn('[Calendar] Idempotency lookup failed (continuing to insert)', {
          bookingId: event.bookingId,
          error: idemErr?.message,
        });
      }

      const calendarEvent = {
        summary: event.title,
        description: this.buildDescription(event),
        start: {
          dateTime: event.startTime.toISOString(),
          timeZone: 'Asia/Jerusalem',
        },
        end: {
          dateTime: event.endTime.toISOString(),
          timeZone: 'Asia/Jerusalem',
        },
        location: event.location || undefined,
        colorId: this.getPlatformColor(event.platform),
        // Both-party sync: add provider and customer as attendees so Google Calendar
        // automatically sends invitation emails and the event appears on their calendars.
        attendees: event.attendeeEmails && event.attendeeEmails.length > 0
          ? event.attendeeEmails.filter(Boolean).map(email => ({ email, responseStatus: 'needsAction' }))
          : undefined,
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 60 },
            { method: 'popup', minutes: 15 },
          ],
        },
        extendedProperties: {
          private: {
            petwash_booking_id: event.bookingId,
            petwash_platform: event.platform,
          },
        },
      };

      const result = await calendar.events.insert({
        calendarId: 'primary',
        // sendUpdates: 'all' causes Google to email invitations to all attendees
        sendUpdates: event.attendeeEmails && event.attendeeEmails.length > 0 ? 'all' : 'none',
        requestBody: calendarEvent,
      });

      logger.info('[Calendar] Event created', {
        eventId: result.data.id,
        bookingId: event.bookingId,
        platform: event.platform,
      });

      return {
        eventId: result.data.id || '',
        htmlLink: result.data.htmlLink || '',
      };
    } catch (error) {
      logger.warn('[Calendar] Failed to create event (non-blocking)', {
        bookingId: event.bookingId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Update an existing calendar event (reschedule path).
   *
   * Looks up the event by booking_id (extendedProperties), patches
   * start/end/title/description/location, and re-sends invitation emails
   * to attendees if any.
   *
   * Idempotent: if no event is found, it falls back to createBookingEvent
   * so calling this on a booking that never had an event still produces
   * the correct end state. Always non-blocking — returns null on failure.
   */
  async updateBookingEvent(event: BookingCalendarEvent): Promise<{ eventId: string; htmlLink: string } | null> {
    try {
      const calendar = await getCalendarClient();
      if (!calendar) {
        logger.warn('[Calendar] updateBookingEvent skipped — no calendar client', {
          bookingId: event.bookingId,
        });
        return null;
      }

      // Same googleapis type-union workaround as in createBookingEvent.
      const existing: any = await (calendar.events as any).list({
        calendarId: 'primary',
        privateExtendedProperty: `petwash_booking_id=${event.bookingId}`,
        maxResults: 1,
        showDeleted: false,
      });
      const found = existing?.data?.items?.[0];

      if (!found || !found.id) {
        // No event yet — degrade to create. Keeps the operation idempotent
        // when called on a booking that never reached the accept handler.
        logger.info('[Calendar] updateBookingEvent — no existing event, creating instead', {
          bookingId: event.bookingId,
        });
        return await this.createBookingEvent(event);
      }

      const patchBody = {
        summary: event.title,
        description: this.buildDescription(event),
        start: {
          dateTime: event.startTime.toISOString(),
          timeZone: 'Asia/Jerusalem',
        },
        end: {
          dateTime: event.endTime.toISOString(),
          timeZone: 'Asia/Jerusalem',
        },
        location: event.location || undefined,
      };

      const result: any = await (calendar.events as any).patch({
        calendarId: 'primary',
        eventId: found.id,
        sendUpdates: event.attendeeEmails && event.attendeeEmails.length > 0 ? 'all' : 'none',
        requestBody: patchBody,
      });

      logger.info('[Calendar] Event updated (reschedule)', {
        eventId: result?.data?.id,
        bookingId: event.bookingId,
      });

      return {
        eventId: result?.data?.id || found.id,
        htmlLink: result?.data?.htmlLink || found.htmlLink || '',
      };
    } catch (error) {
      logger.warn('[Calendar] Failed to update event (non-blocking)', {
        bookingId: event.bookingId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  async deleteBookingEvent(bookingId: string): Promise<boolean> {
    try {
      const calendar = await getCalendarClient();

      const events = await calendar.events.list({
        calendarId: 'primary',
        privateExtendedProperty: `petwash_booking_id=${bookingId}`,
        maxResults: 5,
      });

      if (events.data.items && events.data.items.length > 0) {
        for (const event of events.data.items) {
          if (event.id) {
            await calendar.events.delete({
              calendarId: 'primary',
              eventId: event.id,
            });
          }
        }
        logger.info('[Calendar] Booking events deleted', { bookingId });
        return true;
      }
      return false;
    } catch (error) {
      logger.warn('[Calendar] Failed to delete event', { bookingId });
      return false;
    }
  }

  async listUpcomingBookingEvents(maxResults = 10): Promise<any[]> {
    try {
      const calendar = await getCalendarClient();

      const result = await calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date().toISOString(),
        maxResults,
        singleEvents: true,
        orderBy: 'startTime',
        q: 'Pet Wash',
      });

      return result.data.items || [];
    } catch (error) {
      logger.warn('[Calendar] Failed to list events');
      return [];
    }
  }

  generateICalLink(event: BookingCalendarEvent): string {
    const start = event.startTime.toISOString().replace(/[-:]/g, '').replace('.000', '');
    const end = event.endTime.toISOString().replace(/[-:]/g, '').replace('.000', '');
    const title = encodeURIComponent(event.title);
    const desc = encodeURIComponent(this.buildDescription(event));
    const loc = encodeURIComponent(event.location || '');

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${desc}&location=${loc}&sf=true`;
  }

  generateOutlookLink(event: BookingCalendarEvent): string {
    const start = event.startTime.toISOString();
    const end = event.endTime.toISOString();
    const title = encodeURIComponent(event.title);
    const desc = encodeURIComponent(this.buildDescription(event));
    const loc = encodeURIComponent(event.location || '');

    return `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${start}&enddt=${end}&body=${desc}&location=${loc}`;
  }

  generateAppleCalendarLink(event: BookingCalendarEvent): string {
    const start = event.startTime.toISOString().replace(/[-:]/g, '').replace('.000', '');
    const end = event.endTime.toISOString().replace(/[-:]/g, '').replace('.000', '');
    const title = encodeURIComponent(event.title);

    return `webcal://calendar.google.com/calendar/ical?action=TEMPLATE&text=${title}&dates=${start}/${end}`;
  }

  private buildDescription(event: BookingCalendarEvent): string {
    const lines = [
      `🐾 ⁦Pet Wash™⁩ - ${event.platform}`,
      `📋 Booking: ${event.bookingId}`,
    ];
    if (event.petName) lines.push(`🐕 Pet: ${event.petName}`);
    if (event.customerName) lines.push(`👤 Customer: ${event.customerName}`);
    if (event.providerName) lines.push(`✅ Provider: ${event.providerName}`);
    if (event.description) lines.push('', event.description);
    lines.push('', '---', 'Managed by ⁦Pet Wash™⁩ | petwash.co.il');
    return lines.join('\n');
  }

  private getPlatformColor(platform: string): string {
    const colorMap: Record<string, string> = {
      'sitter-suite': '2',
      'walk-my-pet': '10',
      'pettrek': '3',
      'k9000': '5',
      'academy': '6',
      'plush-lab': '11',
      'wash-hub': '9',
    };
    return colorMap[platform] || '1';
  }
}

export const calendarIntegrationService = new CalendarIntegrationService();

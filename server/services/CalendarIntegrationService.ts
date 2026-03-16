import { google } from 'googleapis';
import { logger } from '../lib/logger';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken || !hostname) {
    logger.warn('[CalendarIntegration] Replit connector not available — Google Calendar integration disabled. Configure GOOGLE_SERVICE_ACCOUNT_JSON for Cloud Run.');
    return null;
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-calendar',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    return null;
  }
  return accessToken;
}

async function getCalendarClient() {
  const accessToken = await getAccessToken();
  if (!accessToken) return null;
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.calendar({ version: 'v3', auth: oauth2Client });
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
}

class CalendarIntegrationService {
  private initialized = false;

  async isAvailable(): Promise<boolean> {
    try {
      await getAccessToken();
      return true;
    } catch {
      return false;
    }
  }

  async createBookingEvent(event: BookingCalendarEvent): Promise<{ eventId: string; htmlLink: string } | null> {
    try {
      const calendar = await getCalendarClient();

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

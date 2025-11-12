import { google } from 'googleapis';
import { db } from '../db';
import {
  googleCalendarIntegrations,
  calendarEvents,
  type InsertGoogleCalendarIntegration,
  type InsertCalendarEvent,
} from '@shared/schema';
import { eq, and, gte, lte } from 'drizzle-orm';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
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

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Calendar not connected');
  }
  return accessToken;
}

async function getUncachableGoogleCalendarClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

export class GoogleCalendarIntegrationService {
  async isConfigured(): Promise<boolean> {
    try {
      await getAccessToken();
      return true;
    } catch {
      return false;
    }
  }

  async syncEvents(userId: string, calendarId: string = 'primary'): Promise<{ success: boolean; count: number; message: string }> {
    try {
      const calendar = await getUncachableGoogleCalendarClient();
      
      const now = new Date();
      const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      const twoMonthsAhead = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

      const eventsResponse = await calendar.events.list({
        calendarId,
        timeMin: twoMonthsAgo.toISOString(),
        timeMax: twoMonthsAhead.toISOString(),
        maxResults: 250,
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = eventsResponse.data.items || [];

      for (const event of events) {
        const eventData: InsertCalendarEvent = {
          eventId: event.id!,
          integrationId: 1,
          eventType: this.determineEventType(event.summary || ''),
          title: event.summary || 'Untitled Event',
          description: event.description,
          location: event.location,
          startTime: new Date(event.start?.dateTime || event.start?.date || now),
          endTime: new Date(event.end?.dateTime || event.end?.date || now),
          allDay: !!event.start?.date,
          attendees: event.attendees || [],
          status: event.status || 'confirmed',
          googleEventId: event.id!,
          icalUid: event.iCalUID,
        };

        const existingEvent = await db
          .select()
          .from(calendarEvents)
          .where(eq(calendarEvents.eventId, event.id!))
          .limit(1);

        if (existingEvent.length > 0) {
          await db
            .update(calendarEvents)
            .set({
              ...eventData,
              updatedAt: new Date(),
            })
            .where(eq(calendarEvents.eventId, event.id!));
        } else {
          await db
            .insert(calendarEvents)
            .values(eventData);
        }
      }

      return {
        success: true,
        count: events.length,
        message: `Successfully synced ${events.length} events from Google Calendar`,
      };
    } catch (error: any) {
      console.error('[Google Calendar] Sync error:', error);
      return {
        success: false,
        count: 0,
        message: `Failed to sync Google Calendar: ${error.message}`,
      };
    }
  }

  async createEvent(data: {
    userId: string;
    calendarId?: string;
    title: string;
    description?: string;
    location?: string;
    startTime: Date;
    endTime: Date;
    allDay?: boolean;
    attendees?: string[];
  }): Promise<{ success: boolean; eventId?: string; message: string }> {
    try {
      const calendar = await getUncachableGoogleCalendarClient();

      const event: any = {
        summary: data.title,
        description: data.description,
        location: data.location,
      };

      if (data.allDay) {
        event.start = { date: data.startTime.toISOString().split('T')[0] };
        event.end = { date: data.endTime.toISOString().split('T')[0] };
      } else {
        event.start = { dateTime: data.startTime.toISOString(), timeZone: 'Asia/Jerusalem' };
        event.end = { dateTime: data.endTime.toISOString(), timeZone: 'Asia/Jerusalem' };
      }

      if (data.attendees && data.attendees.length > 0) {
        event.attendees = data.attendees.map(email => ({ email }));
      }

      const response = await calendar.events.insert({
        calendarId: data.calendarId || 'primary',
        requestBody: event,
      });

      const eventData: InsertCalendarEvent = {
        eventId: response.data.id!,
        integrationId: 1,
        eventType: this.determineEventType(data.title),
        title: data.title,
        description: data.description,
        location: data.location,
        startTime: data.startTime,
        endTime: data.endTime,
        allDay: data.allDay || false,
        attendees: data.attendees || [],
        status: 'confirmed',
        googleEventId: response.data.id!,
        icalUid: response.data.iCalUID,
      };

      await db.insert(calendarEvents).values(eventData);

      return {
        success: true,
        eventId: response.data.id!,
        message: 'Event created successfully',
      };
    } catch (error: any) {
      console.error('[Google Calendar] Create event error:', error);
      return {
        success: false,
        message: `Failed to create event: ${error.message}`,
      };
    }
  }

  async updateEvent(eventId: string, data: {
    title?: string;
    description?: string;
    location?: string;
    startTime?: Date;
    endTime?: Date;
    allDay?: boolean;
    attendees?: string[];
  }): Promise<{ success: boolean; message: string }> {
    try {
      const calendar = await getUncachableGoogleCalendarClient();

      const existingEvent = await db
        .select()
        .from(calendarEvents)
        .where(eq(calendarEvents.eventId, eventId))
        .limit(1);

      if (existingEvent.length === 0) {
        return {
          success: false,
          message: 'Event not found in database',
        };
      }

      const event: any = {};

      if (data.title) event.summary = data.title;
      if (data.description !== undefined) event.description = data.description;
      if (data.location !== undefined) event.location = data.location;

      if (data.startTime && data.endTime) {
        if (data.allDay) {
          event.start = { date: data.startTime.toISOString().split('T')[0] };
          event.end = { date: data.endTime.toISOString().split('T')[0] };
        } else {
          event.start = { dateTime: data.startTime.toISOString(), timeZone: 'Asia/Jerusalem' };
          event.end = { dateTime: data.endTime.toISOString(), timeZone: 'Asia/Jerusalem' };
        }
      }

      if (data.attendees) {
        event.attendees = data.attendees.map(email => ({ email }));
      }

      await calendar.events.patch({
        calendarId: 'primary',
        eventId,
        requestBody: event,
      });

      await db
        .update(calendarEvents)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(calendarEvents.eventId, eventId));

      return {
        success: true,
        message: 'Event updated successfully',
      };
    } catch (error: any) {
      console.error('[Google Calendar] Update event error:', error);
      return {
        success: false,
        message: `Failed to update event: ${error.message}`,
      };
    }
  }

  async deleteEvent(eventId: string): Promise<{ success: boolean; message: string }> {
    try {
      const calendar = await getUncachableGoogleCalendarClient();

      await calendar.events.delete({
        calendarId: 'primary',
        eventId,
      });

      await db.delete(calendarEvents).where(eq(calendarEvents.eventId, eventId));

      return {
        success: true,
        message: 'Event deleted successfully',
      };
    } catch (error: any) {
      console.error('[Google Calendar] Delete event error:', error);
      return {
        success: false,
        message: `Failed to delete event: ${error.message}`,
      };
    }
  }

  async getUpcomingEvents(userId: string, calendarId: string = 'primary', maxResults: number = 10): Promise<any[]> {
    try {
      const calendar = await getUncachableGoogleCalendarClient();

      const now = new Date();
      const oneMonthAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const response = await calendar.events.list({
        calendarId,
        timeMin: now.toISOString(),
        timeMax: oneMonthAhead.toISOString(),
        maxResults,
        singleEvents: true,
        orderBy: 'startTime',
      });

      return response.data.items || [];
    } catch (error: any) {
      console.error('[Google Calendar] Get upcoming events error:', error);
      return [];
    }
  }

  private determineEventType(title: string): string {
    const lowerTitle = title.toLowerCase();
    
    if (lowerTitle.includes('wash') || lowerTitle.includes('groom') || lowerTitle.includes('bath')) {
      return 'wash_appointment';
    }
    if (lowerTitle.includes('walk')) {
      return 'walk_appointment';
    }
    if (lowerTitle.includes('sit') || lowerTitle.includes('sitting')) {
      return 'sitting_appointment';
    }
    if (lowerTitle.includes('transport') || lowerTitle.includes('ride')) {
      return 'transport_appointment';
    }
    if (lowerTitle.includes('vet') || lowerTitle.includes('medical')) {
      return 'vet_appointment';
    }
    
    return 'other';
  }
}

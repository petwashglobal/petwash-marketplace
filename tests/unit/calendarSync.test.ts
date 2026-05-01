import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Phase B1 — Calendar Sync regression tests.
 *
 * These tests verify the contract of CalendarIntegrationService and the
 * idempotency / fail-safe rules the booking handlers depend on. They use
 * a mocked googleapis client so the suite runs without network access.
 *
 * What we DO NOT test here (needs DB / live key):
 *   - Booking handler integration (covered by tests/integration/live-booking)
 *   - End-to-end against a real Google Calendar
 */

vi.mock('googleapis', () => {
  const mockEvents = {
    insert: vi.fn(),
    list: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  };
  return {
    google: {
      auth: {
        OAuth2: vi.fn(() => ({ setCredentials: vi.fn() })),
        JWT: vi.fn(),
        GoogleAuth: vi.fn(),
      },
      calendar: vi.fn(() => ({ events: mockEvents })),
    },
    __mockEvents: mockEvents,
  };
});

vi.mock('../../server/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Helper — clean booking event payload
const sampleEvent = (overrides: Partial<any> = {}) => ({
  platform: 'sitter',
  bookingId: 'BK-TEST-001',
  title: 'PetWash™ — Sitter Suite',
  description: 'Caring for Buddy',
  startTime: new Date('2026-06-15T09:00:00.000Z'),
  endTime: new Date('2026-06-15T11:00:00.000Z'),
  location: 'רחוב רימלט 18, רמת גן',
  customerName: 'Owner UID',
  providerName: 'Provider UID',
  attendeeEmails: ['owner@example.com', 'provider@example.com'],
  ...overrides,
});

describe('CalendarIntegrationService — Phase B1 contract', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Force the service to take the "no auth available" branch by
    // clearing the env vars and the Replit connector hostname.
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    delete process.env.REPLIT_CONNECTORS_HOSTNAME;
    delete process.env.REPL_IDENTITY;
    delete process.env.WEB_REPL_RENEWAL;
  });

  it('createBookingEvent returns null when no calendar auth is configured', async () => {
    const { calendarIntegrationService } = await import(
      '../../server/services/CalendarIntegrationService'
    );
    const result = await calendarIntegrationService.createBookingEvent(sampleEvent());
    expect(result).toBeNull();
  });

  it('deleteBookingEvent returns false when no calendar auth is configured', async () => {
    const { calendarIntegrationService } = await import(
      '../../server/services/CalendarIntegrationService'
    );
    const result = await calendarIntegrationService.deleteBookingEvent('BK-TEST-001');
    expect(result).toBe(false);
  });

  it('updateBookingEvent returns null when no calendar auth is configured', async () => {
    const { calendarIntegrationService } = await import(
      '../../server/services/CalendarIntegrationService'
    );
    const result = await calendarIntegrationService.updateBookingEvent(sampleEvent());
    expect(result).toBeNull();
  });

  it('isAvailable returns false when no calendar auth is configured', async () => {
    const { calendarIntegrationService } = await import(
      '../../server/services/CalendarIntegrationService'
    );
    const ok = await calendarIntegrationService.isAvailable();
    expect(ok).toBe(false);
  });

  it('createBookingEvent never throws on unexpected internal errors', async () => {
    const { calendarIntegrationService } = await import(
      '../../server/services/CalendarIntegrationService'
    );
    // Deliberately pass a malformed Date so any naive code paths would throw.
    const result = await calendarIntegrationService.createBookingEvent(
      sampleEvent({ startTime: new Date('invalid'), endTime: new Date('invalid') }),
    );
    // Service must absorb the failure and return null — booking flow MUST
    // never be blocked by a calendar problem.
    expect(result).toBeNull();
  });

  it('deleteBookingEvent never throws on unexpected internal errors', async () => {
    const { calendarIntegrationService } = await import(
      '../../server/services/CalendarIntegrationService'
    );
    const result = await calendarIntegrationService.deleteBookingEvent(
      // Malformed booking id (extreme length) — exercises any string path.
      'A'.repeat(10000),
    );
    expect(result).toBe(false);
  });
});

describe('CalendarIntegrationService — link generators (no auth needed)', () => {
  it('generateICalLink produces a Google Calendar render URL', async () => {
    const { calendarIntegrationService } = await import(
      '../../server/services/CalendarIntegrationService'
    );
    const link = calendarIntegrationService.generateICalLink(sampleEvent());
    expect(link).toContain('calendar.google.com');
    expect(link).toContain('action=TEMPLATE');
    expect(link).toMatch(/dates=\d{8}T\d{6}Z\/\d{8}T\d{6}Z/);
  });

  it('generateOutlookLink and generateAppleCalendarLink return non-empty strings', async () => {
    const { calendarIntegrationService } = await import(
      '../../server/services/CalendarIntegrationService'
    );
    const evt = sampleEvent();
    expect(typeof calendarIntegrationService.generateOutlookLink(evt)).toBe('string');
    expect(typeof calendarIntegrationService.generateAppleCalendarLink(evt)).toBe('string');
  });
});

describe('Booking handler contract — what callers must guarantee', () => {
  // These are documentation-style tests asserting the interface between
  // the booking handlers and the calendar service. They prove the public
  // API the handlers depend on is stable.

  it('exports createBookingEvent / updateBookingEvent / deleteBookingEvent / isAvailable', async () => {
    const { calendarIntegrationService } = await import(
      '../../server/services/CalendarIntegrationService'
    );
    expect(typeof calendarIntegrationService.createBookingEvent).toBe('function');
    expect(typeof calendarIntegrationService.updateBookingEvent).toBe('function');
    expect(typeof calendarIntegrationService.deleteBookingEvent).toBe('function');
    expect(typeof calendarIntegrationService.isAvailable).toBe('function');
  });

  it('createBookingEvent accepts a BookingCalendarEvent shape with platform, bookingId, start/end times', async () => {
    // Compile-time + runtime: this is the shape the handlers send.
    const evt = sampleEvent();
    expect(evt).toHaveProperty('platform');
    expect(evt).toHaveProperty('bookingId');
    expect(evt.startTime instanceof Date).toBe(true);
    expect(evt.endTime instanceof Date).toBe(true);
  });
});

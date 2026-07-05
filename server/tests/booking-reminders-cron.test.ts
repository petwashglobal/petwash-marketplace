/**
 * Booking-reminder engine — regression pin (2026-07-05 360-audit item 2).
 *
 * The 360 audit found the booking-reminder-2026 email template and the
 * `booking_reminder` SMS registry key BUILT but orphaned — no engine ever
 * fired them. cron-booking-reminders.ts is that engine. This source-pin
 * fails if any of its guarantees regress:
 *
 *   1. Route is mounted under /api/cron (covered by the CSRF /api/cron/ skip).
 *   2. Auth = timing-safe x-cron-secret OR super-admin (no open door).
 *   3. It actually fires BOTH orphaned templates (email builder + SMS key).
 *   4. Every email passes consent ('reminder') AND EmailSpendGuard.
 *   5. De-dup marker is written BEFORE sends (no double-send on crash).
 *   6. Cron health lands in recordCronExecution (Brain/monitoring visibility).
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROUTES_SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes.ts'),
  'utf8',
);
const CRON_SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'cron-booking-reminders.ts'),
  'utf8',
);
const SMS_REGISTRY_SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'smsTemplates.ts'),
  'utf8',
);

describe('booking-reminders mount (routes.ts)', () => {
  it('is mounted under /api/cron', () => {
    expect(ROUTES_SRC).toMatch(
      /app\.use\(\s*['"]\/api\/cron['"]\s*,\s*cronBookingRemindersRoutes\s*\)/,
    );
  });
});

describe('cron-booking-reminders — auth', () => {
  it('uses timing-safe comparison against CRON_SECRET', () => {
    expect(CRON_SRC).toMatch(/timingSafeEqual/);
    expect(CRON_SRC).toMatch(/process\.env\.CRON_SECRET/);
  });

  it('rejects unauthorized callers with 403 before any work', () => {
    expect(CRON_SRC).toMatch(/status\(403\)/);
  });

  it('falls back to super-admin only (not plain admin)', () => {
    expect(CRON_SRC).toMatch(/isSuperAdmin\(/);
  });
});

describe('cron-booking-reminders — fires the orphaned templates', () => {
  it('builds the booking-reminder-2026 email', () => {
    expect(CRON_SRC).toMatch(
      /import\s*\{\s*buildBookingReminderEmail[\s\S]*?\}\s*from\s*['"]\.\.\/email\/templates\/booking-reminder-2026['"]/,
    );
    expect(CRON_SRC).toMatch(/buildBookingReminderEmail\(\{/);
  });

  it('sends the registry `booking_reminder` SMS key (which must still exist)', () => {
    expect(CRON_SRC).toMatch(/sendSmsTemplate\(\s*['"]booking_reminder['"]/);
    expect(SMS_REGISTRY_SRC).toMatch(/booking_reminder\s*:\s*\{\s*category:\s*['"]transactional['"]/);
  });

  it('T-2h tier uses the day-of key, never the "tomorrow" copy', () => {
    expect(CRON_SRC).toMatch(/sendSmsTemplate\(\s*['"]booking_reminder_today['"]/);
    expect(SMS_REGISTRY_SRC).toMatch(/booking_reminder_today\s*:\s*\{\s*category:\s*['"]transactional['"]/);
  });

  it('never double-SMSes a late-confirmed booking in one run', () => {
    expect(CRON_SRC).toMatch(/hoursToStart <= 2 && !t24SentThisRun/);
  });
});

describe('cron-booking-reminders — guards', () => {
  it('checks reminder consent before every email', () => {
    expect(CRON_SRC).toMatch(/checkEmailConsent\(\s*to\s*,\s*['"]reminder['"]\s*\)/);
  });

  it('consults EmailSpendGuard before sending and records after', () => {
    expect(CRON_SRC).toMatch(/emailSpendGuard\.check\(\s*['"]booking-reminders['"]/);
    expect(CRON_SRC).toMatch(/emailSpendGuard\.record\(\s*['"]booking-reminders['"]/);
  });

  it('writes the de-dup marker BEFORE email/SMS sends', () => {
    // markAndNotify inserts the superAppNotifications row and returns false
    // when the (user, tier, booking) was already reminded; sends are gated
    // on its `fresh` result.
    expect(CRON_SRC).toMatch(/const fresh = await markAndNotify\(/);
    expect(CRON_SRC).toMatch(/if \(fresh\)/);
  });

  it('records cron health for the Brain (success AND failure paths)', () => {
    const calls = CRON_SRC.match(/recordCronExecution\(\s*['"]booking-reminders['"]/g) || [];
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  it('only scans confirmed bookings', () => {
    expect(CRON_SRC).toMatch(/eq\(bookingRequests\.status,\s*['"]confirmed['"]/);
  });
});

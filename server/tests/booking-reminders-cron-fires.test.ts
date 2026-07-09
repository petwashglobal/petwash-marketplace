/**
 * Booking reminders actually fire — regression pin (2026-07-09).
 *
 * CEO: keep users in the loop. The booking-reminder logic (T-24h full reminder +
 * T-2h nudge, email+SMS+inbox) existed only as an HTTP route (cron-booking-
 * reminders.ts) that needed an external Cloud Scheduler to hit it — and nothing
 * did, so confirmed bookings never got a reminder.
 *
 * Fix: extract the run into an exported callable (runBookingRemindersCron), keep
 * the HTTP route as a thin wrapper, and schedule it IN-PROCESS in backgroundJobs
 * hourly (mirrors runWashReminderCron) so it fires without a Cloud Scheduler job.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const CRON = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'cron-booking-reminders.ts'),
  'utf8',
);
const JOBS = fs.readFileSync(
  path.resolve(__dirname, '..', 'backgroundJobs.ts'),
  'utf8',
);

describe('booking reminders are scheduled in-process (2026-07-09)', () => {
  it('exposes a self-contained callable (like runWashReminderCron)', () => {
    expect(CRON).toMatch(/export async function runBookingRemindersCron\(\)/);
    // the HTTP route is now a thin wrapper that calls it
    expect(CRON).toMatch(/const result = await runBookingRemindersCron\(\)/);
  });

  it('backgroundJobs imports and schedules it hourly with a lock', () => {
    expect(JOBS).toMatch(/import \{ runBookingRemindersCron \}/);
    expect(JOBS).toMatch(/acquireLock\('bookingReminders'\)/);
    expect(JOBS).toMatch(/await runBookingRemindersCron\(\)/);
    // hourly tick
    expect(JOBS).toMatch(/cron\.schedule\('0 \* \* \* \*'/);
  });

  it('is on by default with a kill switch', () => {
    expect(JOBS).toMatch(/BOOKING_REMINDER_CRON_ENABLED !== 'false'/);
  });
});

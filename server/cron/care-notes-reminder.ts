/**
 * Care-Notes Reminder Cron — nudge customers to finish pet care details on a
 * paid, confirmed booking before the service starts, escalating over time.
 *
 * From the CEO's "Payment Received / Booking Confirmed" spec §8:
 *   1. 6 hours after confirmation, if care notes incomplete → push reminder.
 *   2. 24 hours before the booking starts, if still incomplete → SMS + email
 *      reminder, AND an admin support alert (so ops has visibility before the
 *      provider shows up without the information they need).
 *
 * LEGAL NOTE: this is a TRANSACTIONAL reminder tied to an already-paid,
 * already-confirmed booking — not a דבר פרסומת (advertisement). It does NOT
 * require marketing consent under Communications Law §30א (contrast with
 * server/cron/wash-reminder.ts, which is marketing and IS consent-gated).
 * Both event types below are registered in TRANSACTIONAL_EVENTS in
 * PetWashNotificationEngine.ts so they always deliver.
 *
 * "Care notes complete" definition (no single boolean exists on the schema,
 * so this is the conservative bar — adjust here if the CEO wants a stricter
 * or looser rule): the pet has an emergency/vet contact (pets.vet_phone OR
 * the owner's users.emergency_contact_phone) AND at least one care-detail
 * field is filled in (allergies, medications, special_needs, or notes).
 *
 * Idempotency: dispatchNotifications() dedupes per channel via
 * notificationLogs.idempotencyKey — no separate dedupe table needed here.
 * The admin alert is deduped via AlertEngine's dedupeKey upsert.
 *
 * OFF by default behind CARE_NOTES_REMINDER_CRON_ENABLED, matching the
 * wash-reminder / birthday-SMS convention for new notification crons.
 *
 * This module ONLY exposes runCareNotesReminderCron(). It does NOT schedule
 * itself — backgroundJobs.ts registers it under acquireLock('careNotesReminder').
 */

import { pool } from '../db';
import { dispatchNotifications } from '../services/PetWashNotificationEngine';
import { renderSms } from '../services/smsTemplates';
import { createOrUpdateAlert } from '../services/AlertEngine';
import { logger } from '../lib/logger';

const MAX_BATCH = 300;

interface CareRow {
  booking_id: string;
  booking_number: string;
  user_id: string;
  start_time: Date;
  pet_id: number;
  pet_name: string;
  vet_phone: string | null;
  allergies: string | null;
  medications: string | null;
  special_needs: string | null;
  notes: string | null;
  emergency_contact_phone: string | null;
  first_name: string | null;
  phone: string | null;
  email: string | null;
  language: string | null;
}

export interface CareNotesReminderResult {
  enabled: boolean;
  checked6h: number;
  sent6h: number;
  checked24h: number;
  sent24h: number;
  alertsRaised: number;
  errors: number;
}

/** Conservative completeness bar — see file header for rationale. */
function isCareNotesComplete(row: CareRow): boolean {
  const hasEmergencyContact = Boolean(row.vet_phone) || Boolean(row.emergency_contact_phone);
  const hasCareDetail = Boolean(row.allergies) || Boolean(row.medications) || Boolean(row.special_needs) || Boolean(row.notes);
  return hasEmergencyContact && hasCareDetail;
}

async function run6hBucket(result: CareNotesReminderResult): Promise<void> {
  const res = await pool.query<CareRow>(
    `SELECT b.id AS booking_id, b.booking_number, b.user_id, b.start_time,
            p.id AS pet_id, p.name AS pet_name, p.vet_phone, p.allergies,
            p.medications, p.special_needs, p.notes,
            u.emergency_contact_phone, u.first_name, u.phone, u.email, u.language
       FROM bookings b
       JOIN booking_pets bp ON bp.booking_id = b.id
       JOIN pets p          ON p.id = bp.pet_id
       JOIN users u         ON u.id = b.user_id
      WHERE b.status = 'confirmed'
        AND b.confirmed_at IS NOT NULL
        AND b.confirmed_at <= NOW() - INTERVAL '6 hours'
        AND b.start_time > NOW()
      LIMIT $1`,
    [MAX_BATCH]
  );

  const incomplete = res.rows.filter((r) => !isCareNotesComplete(r));
  result.checked6h = res.rows.length;

  for (const row of incomplete) {
    try {
      const isHe = (row.language ?? 'he') !== 'en';
      const title = isHe ? `תזכורת: פרטי טיפול ל${row.pet_name}` : `Reminder: care details for ${row.pet_name}`;
      const body = isHe
        ? `ההזמנה שלך אושרה. נא להשלים פרטי טיפול ל${row.pet_name} לפני התחלת השירות.`
        : `Your booking is confirmed. Please complete care details for ${row.pet_name} before the service starts.`;

      await dispatchNotifications({
        userId: row.user_id,
        eventType: 'care_notes_reminder_6h',
        templateKey: 'care_notes.reminder_6h',
        channels: ['push'],
        bookingId: row.booking_id,
        idempotencyKey: `care_notes_6h:${row.booking_id}:${row.pet_id}`,
        push: {
          userId: row.user_id,
          title,
          body,
          data: { type: 'care_notes_reminder', bookingId: row.booking_id, petId: String(row.pet_id) },
        },
      });
      result.sent6h++;
    } catch (err: any) {
      result.errors++;
      logger.error('[CareNotesReminder] 6h send failed', {
        bookingId: row.booking_id, petId: row.pet_id, error: err?.message,
      });
    }
  }
}

async function run24hBucket(result: CareNotesReminderResult): Promise<void> {
  const res = await pool.query<CareRow>(
    `SELECT b.id AS booking_id, b.booking_number, b.user_id, b.start_time,
            p.id AS pet_id, p.name AS pet_name, p.vet_phone, p.allergies,
            p.medications, p.special_needs, p.notes,
            u.emergency_contact_phone, u.first_name, u.phone, u.email, u.language
       FROM bookings b
       JOIN booking_pets bp ON bp.booking_id = b.id
       JOIN pets p          ON p.id = bp.pet_id
       JOIN users u         ON u.id = b.user_id
      WHERE b.status = 'confirmed'
        AND b.confirmed_at IS NOT NULL
        AND b.start_time > NOW()
        AND b.start_time <= NOW() + INTERVAL '24 hours'
      LIMIT $1`,
    [MAX_BATCH]
  );

  const incomplete = res.rows.filter((r) => !isCareNotesComplete(r));
  result.checked24h = res.rows.length;

  for (const row of incomplete) {
    try {
      const lang: 'he' | 'en' = (row.language ?? 'he') === 'en' ? 'en' : 'he';
      const rendered = renderSms('care_notes_reminder_24h', { pet_name: row.pet_name, link: 'petwash.co.il/me' }, lang);

      if (rendered && row.phone) {
        const emailHtml = `<!DOCTYPE html><html lang="${lang}" dir="${lang === 'he' ? 'rtl' : 'ltr'}"><body style="font-family:Arial;padding:24px;color:#111;background:#fff;">
<h2 style="margin-bottom:16px;">PetWash™</h2>
<p>${lang === 'he'
    ? `ההזמנה שלך מתחילה בפחות מ-24 שעות. נא להשלים את פרטי הטיפול ל${row.pet_name} כדי שהספק יהיה מוכן.`
    : `Your booking starts in under 24 hours. Please complete ${row.pet_name}'s care details so the provider is ready.`}</p>
<p style="margin-top:20px;"><a href="https://petwash.co.il/me" style="background:#000;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;">${lang === 'he' ? 'השלמת פרטי טיפול' : 'Complete care notes'}</a></p>
<p style="margin-top:24px;font-size:12px;color:#888;">PetWash Ltd — support@petwash.co.il</p>
</body></html>`;

        await dispatchNotifications({
          userId: row.user_id,
          eventType: 'care_notes_reminder_24h',
          templateKey: 'care_notes.reminder_24h',
          channels: row.email ? ['sms', 'email'] : ['sms'],
          bookingId: row.booking_id,
          idempotencyKey: `care_notes_24h:${row.booking_id}:${row.pet_id}`,
          sms: { to: row.phone, text: rendered.body },
          email: row.email ? {
            to: row.email,
            subject: lang === 'he' ? `תזכורת: פרטי טיפול ל${row.pet_name} — 24 שעות לתחילת ההזמנה` : `Reminder: care details for ${row.pet_name} — booking starts in 24h`,
            html: emailHtml,
          } : undefined,
        });
        result.sent24h++;
      }

      // Support alert — spec §8: "service starts within 24 hours and care
      // notes incomplete" → this bucket's condition already IS that state.
      // Idempotent upsert: safe to call every sweep until the alert is
      // resolved or the booking's care notes are completed.
      await createOrUpdateAlert({
        dedupeKey: `care_notes_incomplete:${row.booking_id}`,
        category: 'support',
        severity: 'warning',
        title: `Care notes incomplete — booking starts within 24h`,
        message: `Booking ${row.booking_number} for ${row.pet_name} starts within 24 hours with incomplete care notes (missing emergency contact and/or care details).`,
        linkedEntityType: 'booking',
        linkedEntityId: row.booking_id,
        source: 'care_notes_reminder_cron',
      });
      result.alertsRaised++;
    } catch (err: any) {
      result.errors++;
      logger.error('[CareNotesReminder] 24h send failed', {
        bookingId: row.booking_id, petId: row.pet_id, error: err?.message,
      });
    }
  }
}

export async function runCareNotesReminderCron(): Promise<CareNotesReminderResult> {
  const result: CareNotesReminderResult = {
    enabled: false, checked6h: 0, sent6h: 0, checked24h: 0, sent24h: 0, alertsRaised: 0, errors: 0,
  };

  if (process.env.CARE_NOTES_REMINDER_CRON_ENABLED !== 'true') {
    logger.info('[CareNotesReminder] disabled (flag off)');
    return result;
  }
  result.enabled = true;

  try {
    await run6hBucket(result);
  } catch (err: any) {
    result.errors++;
    logger.error('[CareNotesReminder] 6h bucket failed', { error: err?.message });
  }

  try {
    await run24hBucket(result);
  } catch (err: any) {
    result.errors++;
    logger.error('[CareNotesReminder] 24h bucket failed', { error: err?.message });
  }

  logger.info('[CareNotesReminder] complete', result);
  return result;
}

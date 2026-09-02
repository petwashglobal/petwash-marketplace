/**
 * Wash-Reminder Cron — "your dog is due for a wash" nudge.
 *
 * ⚖️  LEGAL FRAME (Israel Spam Law — Communications Law §30א):
 *     A "your pet is due for a wash, book now" message promotes a PAID service,
 *     so it is a דבר פרסומת (advertisement) and REQUIRES prior, explicit MARKETING
 *     consent — per channel. This is NOT a transactional reminder.
 *
 *     Therefore this cron:
 *       1. is OFF by default behind WASH_REMINDER_CRON_ENABLED.
 *       2. gates on MARKETING consent per channel (mirrors CampaignDeliveryService):
 *            SMS  → notification_preferences.marketing_sms_consent_at  IS NOT NULL
 *                   AND the sms master toggle is on AND marketing toggle on.
 *            push → notification_preferences.marketing_push_consent_at IS NOT NULL
 *                   AND push_device_permission_status = 'granted'
 *                   AND the push master toggle is on AND marketing toggle on.
 *       3. respects the pet's own reminderEnabled flag.
 *       4. is idempotent via campaign_trigger_log (campaign_type='wash_reminder'):
 *            never re-sends within REMINDER_DUE_DAYS for the same user.
 *       5. carries the §30א opt-out line in the message body.
 *
 * IDENTITY NOTE (see RETURN doc): customer_pets.customer_id → customers.id (a
 * marketing/CRM row), while notification_preferences.user_id and the SMS send path
 * are keyed by the Firebase users.id (text UID). The two are linked ONLY by the
 * shared unique email. So the join chain is:
 *     customer_pets → customers (by id) → users (by email) → notification_preferences (by user_id)
 * Pets whose owner has no matching Firebase users row, or no phone, are skipped
 * (counted as skippedNoConsent) — we never send to an unidentifiable owner.
 *
 * This module ONLY exposes runWashReminderCron(). It does NOT schedule itself —
 * backgroundJobs.ts registers it under acquireLock('washReminder').
 */

import { pool } from '../db';
import { twilioSMSService } from '../services/TwilioSMSService';
import { dispatchNotifications } from '../services/PetWashNotificationEngine';
import { logger } from '../lib/logger';

// ── Tunables (env-overridable) ───────────────────────────────────────────────
const REMINDER_DUE_DAYS = Number(process.env.WASH_REMINDER_DUE_DAYS) || 28;
const MAX_BATCH = 500;

// §30א opt-out line. Matches the canonical platform opt-out target used in the
// marketing email footer + CampaignDeliveryService (petwash.co.il/unsubscribe).
// NOTE: the pet-birthday SMS does NOT itself carry a §30א opt-out line, so there
// was no exact SMS phrase to reuse — this adapts the canonical email-footer
// wording ("להסרה מרשימת תפוצה") for SMS. See RETURN notes.
const OPT_OUT_LINE = 'להסרה מרשימת תפוצה: petwash.co.il/unsubscribe';

interface DuePetRow {
  pet_id: number;
  pet_name: string;
  last_wash_date: Date;
  user_id: string;
  phone: string | null;
}

interface ConsentRow {
  marketing_sms_consent_at: Date | null;
  marketing_push_consent_at: Date | null;
  push_device_permission_status: string | null;
  sms: boolean;
  push: boolean;
  marketing: boolean;
}

type Channel = 'sms' | 'push';

export interface WashReminderResult {
  enabled: boolean;
  due: number;
  sent: number;
  skippedNoConsent: number;
  skippedRecent: number;
  errors: number;
}

/**
 * Pick the marketing-consented channel for this owner, or null if none allowed.
 * Mirrors CampaignDeliveryService.isChannelAllowed semantics exactly.
 */
function pickChannel(c: ConsentRow | null): Channel | null {
  if (!c) return null;
  // Marketing master toggle must be on for any דבר פרסומת.
  if (c.marketing === false) return null;

  if (c.marketing_sms_consent_at != null && c.sms !== false) return 'sms';

  if (
    c.marketing_push_consent_at != null &&
    c.push_device_permission_status === 'granted' &&
    c.push !== false
  ) {
    return 'push';
  }
  return null;
}

export async function runWashReminderCron(): Promise<WashReminderResult> {
  const result: WashReminderResult = {
    enabled: false,
    due: 0,
    sent: 0,
    skippedNoConsent: 0,
    skippedRecent: 0,
    errors: 0,
  };

  // ── 1. FLAG GATE — OFF by default ──────────────────────────────────────────
  if (process.env.WASH_REMINDER_CRON_ENABLED !== 'true') {
    logger.info('[WashReminder] disabled (flag off)');
    return result;
  }
  result.enabled = true;

  try {
    // ── 2. DUE QUERY ─────────────────────────────────────────────────────────
    // Pets with reminders on, that have actually been washed, and whose last
    // wash is older than the due window. Joined to the Firebase user (by email)
    // so we have a user_id + phone for consent + send.
    const dueRes = await pool.query<DuePetRow>(
      `SELECT cp.id            AS pet_id,
              cp.name          AS pet_name,
              cp.last_wash_date AS last_wash_date,
              u.id             AS user_id,
              COALESCE(u.phone, cust.phone) AS phone
         FROM customer_pets cp
         JOIN customers cust ON cust.id = cp.customer_id
         JOIN users     u    ON lower(u.email) = lower(cust.email)
        WHERE cp.reminder_enabled = true
          AND cp.last_wash_date IS NOT NULL
          AND cp.last_wash_date < NOW() - ($1 || ' days')::interval
        ORDER BY cp.last_wash_date ASC
        LIMIT $2`,
      [REMINDER_DUE_DAYS, MAX_BATCH + 1]
    );

    let rows = dueRes.rows;
    if (rows.length > MAX_BATCH) {
      logger.warn('[WashReminder] batch capped', { cap: MAX_BATCH, found: rows.length });
      rows = rows.slice(0, MAX_BATCH);
    }
    result.due = rows.length;

    if (rows.length === 0) {
      logger.info('[WashReminder] no pets due', { dueDays: REMINDER_DUE_DAYS });
      return result;
    }

    // De-dupe per user within this run (a user may have several due pets — one nudge).
    const handledUsers = new Set<string>();

    for (const row of rows) {
      try {
        if (handledUsers.has(row.user_id)) {
          // Already nudged this owner in this run for another pet.
          continue;
        }
        handledUsers.add(row.user_id);

        // ── 4a. IDEMPOTENCY — skip if nudged within the due window ─────────────
        const recent = await pool.query(
          `SELECT 1 FROM campaign_trigger_log
            WHERE campaign_type = 'wash_reminder'
              AND user_id = $1
              AND sent_at > NOW() - ($2 || ' days')::interval
            LIMIT 1`,
          [row.user_id, REMINDER_DUE_DAYS]
        );
        if (recent.rows.length > 0) {
          result.skippedRecent++;
          continue;
        }

        // ── 3. CONSENT — load notification_preferences, pick channel ──────────
        const consentRes = await pool.query<ConsentRow>(
          `SELECT marketing_sms_consent_at, marketing_push_consent_at,
                  push_device_permission_status, sms, push, marketing
             FROM notification_preferences
            WHERE user_id = $1
            LIMIT 1`,
          [row.user_id]
        );
        const consent = consentRes.rows[0] ?? null;
        const channel = pickChannel(consent);

        if (!channel || (channel === 'sms' && !row.phone)) {
          result.skippedNoConsent++;
          logger.info('[WashReminder] skip — no marketing consent / channel', {
            userId: row.user_id,
            channel,
          });
          // Audit trail of the block (best-effort; never throws out of the loop).
          try {
            await pool.query(
              `INSERT INTO campaign_trigger_log
                 (campaign_type, user_id, coupon_id, channel, status, sent_at)
               VALUES ('wash_reminder', $1, NULL, $2, 'blocked_no_consent', NOW())`,
              [row.user_id, channel ?? 'none']
            );
          } catch { /* non-blocking audit */ }
          continue;
        }

        // ── 5. MESSAGE (Hebrew, no coupon, with §30א opt-out) ─────────────────
        const days = Math.floor(
          (Date.now() - new Date(row.last_wash_date).getTime()) / (1000 * 60 * 60 * 24)
        );
        const petName = row.pet_name || 'חיית המחמד שלך';

        let delivered = false;

        if (channel === 'sms') {
          const smsBody =
            `🐾 ${petName} לא התרחץ כבר ${days} ימים. רוצה רחצה רעננה?\n` +
            `לקביעת תור: petwash.co.il\n` +
            OPT_OUT_LINE;

          // AUDIT-SMS-5 (#221): booking-reminder per-UID budget.
          const { SMS_PURPOSES: _P } = await import('../lib/perUidSmsBudget');
          const sendRes = await twilioSMSService.sendSMS(row.phone as string, smsBody, {
            userId: row.user_id,
            purpose: _P.BOOKING_REMINDER,
          });
          delivered = sendRes.success;
          if (!delivered) {
            logger.warn('[WashReminder] SMS send failed', {
              userId: row.user_id,
              error: sendRes.error,
            });
          }
        } else {
          // push — short title + body. Opt-out handled by the in-app notification
          // center; push payload stays short.
          await dispatchNotifications({
            userId: row.user_id,
            eventType: 'wash_reminder',
            templateKey: 'wash.reminder',
            channels: ['push'],
            idempotencyKey: `wash_reminder:${row.user_id}:${REMINDER_DUE_DAYS}d:${new Date(
              row.last_wash_date
            )
              .toISOString()
              .slice(0, 10)}`,
            push: {
              userId: row.user_id,
              title: `🐾 הגיע הזמן לרחצה ל${petName}`,
              body: `${petName} לא התרחץ כבר ${days} ימים. לקביעת תור ב-PetWash.`,
              data: { type: 'wash_reminder', petId: String(row.pet_id) },
            },
            debugPayload: { petName, days, days_due: REMINDER_DUE_DAYS },
          });
          // dispatchNotifications resolves on dispatch attempt; treat as delivered.
          delivered = true;
        }

        if (delivered) {
          // ── 4b. IDEMPOTENCY ANCHOR — record the send ──────────────────────
          await pool.query(
            `INSERT INTO campaign_trigger_log
               (campaign_type, user_id, coupon_id, channel, status, sent_at)
             VALUES ('wash_reminder', $1, NULL, $2, 'sent', NOW())`,
            [row.user_id, channel]
          );
          result.sent++;
          logger.info('[WashReminder] sent', { userId: row.user_id, channel, days });
        } else {
          result.errors++;
        }
      } catch (err: any) {
        result.errors++;
        logger.error('[WashReminder] error processing pet', {
          petId: row.pet_id,
          userId: row.user_id,
          error: err?.message,
        });
      }
    }

    logger.info('[WashReminder] complete', {
      dueDays: REMINDER_DUE_DAYS,
      ...result,
    });
    return result;
  } catch (err: any) {
    result.errors++;
    logger.error('[WashReminder] job failed', { error: err?.message });
    return result;
  }
}

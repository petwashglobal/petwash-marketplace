/**
 * RECOVERY AUTOMATION CRON
 * PETWASH SYSTEM INTELLIGENCE SPEC — Recovery System
 *
 * Three recovery flows:
 *
 *  1. Incomplete signup      → user created >2 hours ago, never became 'active'
 *                              Send one reminder email (deduped via notificationLogs idempotencyKey)
 *
 *  2. Abandoned booking      → booking_request status='pending', updatedAt >45 min ago
 *                              Send one follow-up email (deduped same way)
 *
 * Schedule:
 *   Every 60 minutes — incomplete signup scan
 *   Every 30 minutes — abandoned booking scan
 */

import cron from 'node-cron';
import { db } from '../db';
import { users, bookingRequests, notificationLogs } from '@shared/schema';
import { and, eq, lt, ne, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { dispatchNotification } from '../lib/notificationDispatcher';

// ── dedup helper ───────────────────────────────────────────────────────────

async function alreadyQueued(idempotencyKey: string): Promise<boolean> {
  const rows = await db
    .select({ id: notificationLogs.id })
    .from(notificationLogs)
    .where(eq(notificationLogs.idempotencyKey, idempotencyKey))
    .limit(1);
  return rows.length > 0;
}

async function markQueued(
  idempotencyKey: string,
  userId: string,
  email: string,
  templateKey: string,
): Promise<void> {
  await db.insert(notificationLogs).values({
    templateKey,
    channel: 'email',
    recipientUserId: userId,
    recipientEmail: email,
    status: 'queued',
    idempotencyKey,
    eventType: 'recovery',
  });
}

// ── Job 1: Incomplete signups ─────────────────────────────────────────────

async function runIncompleteSignupRecovery() {
  const TWO_HOURS_AGO = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const ONE_DAY_AGO   = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const incomplete = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
    })
    .from(users)
    .where(
      and(
        ne(users.activationStatus, 'active'),
        ne(users.activationStatus, 'suspended'),
        ne(users.activationStatus, 'deleted'),
        lt(users.createdAt, TWO_HOURS_AGO),
        sql`${users.createdAt} > ${ONE_DAY_AGO}`
      )
    )
    .limit(50);

  let sent = 0, skipped = 0;

  for (const user of incomplete) {
    if (!user.email) { skipped++; continue; }

    const key = `recovery_signup_${user.id}`;
    if (await alreadyQueued(key)) { skipped++; continue; }

    const name = user.firstName || 'שלום';

    try {
      await markQueued(key, user.id, user.email, 'recovery_incomplete_signup');

      await dispatchNotification({
        uid: user.id,
        email: user.email,
        type: 'system',
        title: 'השלם את הרישום שלך ב-PetWash™',
        bodyHtml: `
          <p>שלום ${name},</p>
          <p>התחלת להירשם ל-PetWash™ אך לא סיימת את התהליך.</p>
          <p>לחץ על הכפתור להשלמת הפרופיל שלך וגישה לכל השירותים.</p>
        `,
        ctaText: 'להשלמת הרישום',
        ctaUrl: 'https://petwash.co.il/complete-registration',
        channels: ['email'],
        locale: 'he',
      });

      sent++;
      logger.info('[RecoveryAutomation] Incomplete signup reminder sent', { userId: user.id });
    } catch (err: any) {
      logger.error('[RecoveryAutomation] Failed to send signup reminder', {
        userId: user.id,
        err: err.message,
      });
    }
  }

  if (sent > 0 || incomplete.length > 0) {
    logger.info('[RecoveryAutomation] Incomplete signup scan complete', {
      scanned: incomplete.length, sent, skipped,
    });
  }
}

// ── Job 2: Abandoned bookings ─────────────────────────────────────────────

async function runAbandonedBookingRecovery() {
  const FORTY_FIVE_MINUTES_AGO = new Date(Date.now() - 45 * 60 * 1000);
  const SIX_HOURS_AGO          = new Date(Date.now() - 6 * 60 * 60 * 1000);

  const abandoned = await db
    .select({
      requestId: bookingRequests.requestId,
      ownerId: bookingRequests.ownerId,
      serviceType: bookingRequests.serviceType,
      totalCents: bookingRequests.totalCents,
    })
    .from(bookingRequests)
    .where(
      and(
        eq(bookingRequests.status, 'pending'),
        lt(bookingRequests.updatedAt, FORTY_FIVE_MINUTES_AGO),
        sql`${bookingRequests.updatedAt} > ${SIX_HOURS_AGO}`
      )
    )
    .limit(50);

  let sent = 0, skipped = 0;

  for (const booking of abandoned) {
    const key = `recovery_booking_${booking.requestId}`;
    if (await alreadyQueued(key)) { skipped++; continue; }

    const [owner] = await db
      .select({ email: users.email, firstName: users.firstName })
      .from(users)
      .where(eq(users.id, booking.ownerId))
      .limit(1);

    if (!owner?.email) { skipped++; continue; }

    const amountILS = (booking.totalCents / 100).toFixed(2);
    const name      = owner.firstName || 'שלום';

    try {
      await markQueued(key, booking.ownerId, owner.email, 'recovery_abandoned_booking');

      await dispatchNotification({
        uid: booking.ownerId,
        email: owner.email,
        type: 'system',
        title: 'ההזמנה שלך מחכה לך ב-PetWash™',
        bodyHtml: `
          <p>שלום ${name},</p>
          <p>התחלת הזמנה עבור שירות <strong>${booking.serviceType}</strong> בסכום של ₪${amountILS}.</p>
          <p>ההזמנה עדיין ממתינה — לחץ להשלמת ההזמנה.</p>
        `,
        ctaText: 'להשלמת ההזמנה',
        ctaUrl: `https://petwash.co.il/booking/${booking.requestId}`,
        channels: ['email'],
        locale: 'he',
      });

      sent++;
      logger.info('[RecoveryAutomation] Abandoned booking follow-up sent', {
        requestId: booking.requestId,
      });
    } catch (err: any) {
      logger.error('[RecoveryAutomation] Failed to send booking follow-up', {
        requestId: booking.requestId,
        err: err.message,
      });
    }
  }

  if (sent > 0 || abandoned.length > 0) {
    logger.info('[RecoveryAutomation] Abandoned booking scan complete', {
      scanned: abandoned.length, sent, skipped,
    });
  }
}

// ── Job 3: Re-engagement — inactive 30+ days ─────────────────────────────

async function runInactiveUserReengagement() {
  const THIRTY_DAYS_AGO  = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const NINETY_DAYS_AGO  = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const inactive = await db
    .select({
      id:        users.id,
      email:     users.email,
      firstName: users.firstName,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .where(
      and(
        eq(users.activationStatus, 'active'),
        lt(users.lastLoginAt, THIRTY_DAYS_AGO),
        sql`${users.lastLoginAt} > ${NINETY_DAYS_AGO}`,
      )
    )
    .limit(100);

  let sent = 0, skipped = 0;

  for (const user of inactive) {
    if (!user.email) { skipped++; continue; }

    const key = `recovery_winback_30d_${user.id}`;
    if (await alreadyQueued(key)) { skipped++; continue; }

    try {
      await markQueued(key, user.id, user.email, 'winback_30d');

      await dispatchNotification({
        uid:      user.id,
        email:    user.email,
        type:     'winback_30d',
        title:    '🐾 חסרים לנו!',
        bodyHtml: `
          <p>שלום ${user.firstName ?? 'חבר PetWash'},</p>
          <p>לא ראינו אותך כבר 30 יום — הכלב שלך בוודאי מתגעגע לטיפול.</p>
          <p>חזור עכשיו וקבל עדיפות בהזמנה הבאה שלך.</p>
        `,
        channels: ['email'],
        locale:   'he',
      });

      sent++;
    } catch (err: any) {
      logger.error('[RecoveryAutomation] Failed to send winback email', {
        userId: user.id,
        err: err.message,
      });
    }
  }

  if (sent > 0 || inactive.length > 0) {
    logger.info('[RecoveryAutomation] Inactive 30-day re-engagement scan complete', {
      scanned: inactive.length, sent, skipped,
    });
  }
}

// ── Cron registration ─────────────────────────────────────────────────────

export function startRecoveryAutomationCron() {
  cron.schedule('0 * * * *', async () => {
    try { await runIncompleteSignupRecovery(); }
    catch (err: any) {
      logger.error('[RecoveryAutomation] Signup recovery job failed', { err: err.message });
    }
  });

  cron.schedule('*/30 * * * *', async () => {
    try { await runAbandonedBookingRecovery(); }
    catch (err: any) {
      logger.error('[RecoveryAutomation] Booking recovery job failed', { err: err.message });
    }
  });

  // Daily at 10:00 AM — re-engage users inactive for 30+ days
  cron.schedule('0 10 * * *', async () => {
    try { await runInactiveUserReengagement(); }
    catch (err: any) {
      logger.error('[RecoveryAutomation] Winback 30d job failed', { err: err.message });
    }
  });

  logger.info('[RecoveryAutomation] Cron jobs registered (signup: 60min, booking: 30min, winback: daily 10:00)');
}

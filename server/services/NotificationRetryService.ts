/**
 * PETWASH™ NOTIFICATION RETRY SERVICE
 *
 * Background sweeper that retries failed notifications.
 *
 * Lifecycle per log row:
 *   queued      → send attempt → sent | failed
 *   failed      → nextRetryAt elapses → retry attempt → sent | failed (retryCount++)
 *   failed (retryCount >= maxRetries) → permanently_failed
 *
 * Backoff schedule (retryCount before this attempt):
 *   0 → 5 min, 1 → 15 min, 2 → 45 min  (then permanently_failed)
 *
 * Run via: NotificationRetryService.startSweeper()
 *   Called once at server startup; runs every 2 minutes.
 */

import { db } from '../db';
import { notificationLogs } from '@shared/schema';
import { and, eq, lte, lt, not } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { twilioSMSService } from './TwilioSMSService';
import { FCMService } from './FCMService';
import { createMailService } from '../lib/sendgrid';

const SWEEPER_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
const BATCH_SIZE = 20; // rows per sweep cycle

function nextRetryDelay(retryCount: number): number {
  return Math.min(5 * Math.pow(3, retryCount), 180) * 60 * 1000;
}

async function retryRow(row: {
  id: number;
  channel: string;
  recipientEmail: string | null;
  recipientPhone: string | null;
  recipientUserId: string | null;
  payload: unknown;
  retryCount: number;
  maxRetries: number;
  eventType: string | null;
}): Promise<void> {
  const newRetryCount = row.retryCount + 1;
  const isLastAttempt = newRetryCount >= row.maxRetries;

  let sent = false;
  let providerMessageId: string | null = null;
  let failureReason: string | null = null;

  try {
    if (row.channel === 'email') {
      const payload = row.payload as Record<string, any> | null;
      const emailTo      = payload?.emailTo      as string | undefined;
      const emailSubject = payload?.emailSubject as string | undefined;
      const emailHtml    = payload?.emailHtml    as string | undefined;
      const emailText    = payload?.emailText    as string | undefined;

      if (emailTo && emailSubject && emailHtml) {
        const sg = createMailService();
        const ok = await sg.send({ to: emailTo, subject: emailSubject, html: emailHtml, text: emailText });
        sent = ok;
        if (!sent) failureReason = 'SendGrid returned failure on retry';
      } else if (row.recipientEmail && emailSubject && emailHtml) {
        // Fallback: to address from dedicated column
        const sg = createMailService();
        const ok = await sg.send({ to: row.recipientEmail, subject: emailSubject, html: emailHtml, text: emailText });
        sent = ok;
        if (!sent) failureReason = 'SendGrid returned failure on retry (fallback to column)';
      } else {
        failureReason = 'Email payload incomplete — emailTo/emailSubject/emailHtml missing from payload';
        logger.warn('[RetryService] Email retry skipped — payload missing email fields', {
          id: row.id, hasTo: !!emailTo, hasSubject: !!emailSubject, hasHtml: !!emailHtml,
        });
      }
    }

    if (row.channel === 'sms' && row.recipientPhone && row.recipientUserId) {
      const payload = row.payload as Record<string, any> | null;
      const text = payload?.smsText as string | undefined;
      if (text) {
        const result = await twilioSMSService.sendSMS(row.recipientPhone, text, {
          userId: row.recipientUserId,
        });
        sent = result.success;
        providerMessageId = result.messageId ?? null;
        if (!sent) failureReason = 'Twilio returned failure on retry';
      } else {
        failureReason = 'SMS text not found in payload — cannot retry';
      }
    }

    if (row.channel === 'push' && row.recipientUserId) {
      const payload = row.payload as Record<string, any> | null;
      const title = payload?.pushTitle as string | undefined;
      const body = payload?.pushBody as string | undefined;
      const data = payload?.pushData as Record<string, string> | undefined;

      if (title && body) {
        sent = await FCMService.sendToUser({
          userId: row.recipientUserId,
          title,
          body,
          data,
        });
        if (!sent) failureReason = 'FCM returned failure on retry';
      } else {
        failureReason = 'Push payload not found — cannot retry';
      }
    }
  } catch (err: any) {
    failureReason = err?.message ?? 'Retry attempt threw';
    logger.error('[RetryService] Retry attempt threw', { id: row.id, channel: row.channel, error: failureReason });
  }

  // Determine final status
  let newStatus: string;
  if (sent) {
    newStatus = 'sent';
  } else if (isLastAttempt) {
    newStatus = 'permanently_failed';
  } else {
    newStatus = 'failed';
  }

  await db.update(notificationLogs)
    .set({
      status: newStatus,
      retryCount: newRetryCount,
      sentAt: sent ? new Date() : undefined,
      failureReason: sent ? null : failureReason,
      nextRetryAt: (sent || isLastAttempt) ? null : new Date(Date.now() + nextRetryDelay(newRetryCount)),
      permanentlyFailed: newStatus === 'permanently_failed',
      providerMessageId: providerMessageId ?? undefined,
    })
    .where(eq(notificationLogs.id, row.id));

  logger.info('[RetryService] Row processed', {
    id: row.id,
    channel: row.channel,
    newStatus,
    retryCount: newRetryCount,
    providerMessageId,
  });
}

async function sweep(): Promise<void> {
  try {
    const now = new Date();

    // Fetch failed rows that are due for retry and not permanently failed
    const rows = await db
      .select({
        id: notificationLogs.id,
        channel: notificationLogs.channel,
        recipientEmail: notificationLogs.recipientEmail,
        recipientPhone: notificationLogs.recipientPhone,
        recipientUserId: notificationLogs.recipientUserId,
        payload: notificationLogs.payload,
        retryCount: notificationLogs.retryCount,
        maxRetries: notificationLogs.maxRetries,
        eventType: notificationLogs.eventType,
      })
      .from(notificationLogs)
      .where(
        and(
          eq(notificationLogs.status, 'failed'),
          eq(notificationLogs.permanentlyFailed, false),
          lte(notificationLogs.nextRetryAt, now),
          lt(notificationLogs.retryCount, notificationLogs.maxRetries),
        )
      )
      .limit(BATCH_SIZE);

    if (rows.length === 0) return;

    logger.info('[RetryService] Sweep found rows to retry', { count: rows.length });

    await Promise.allSettled(rows.map((row) => retryRow(row)));
  } catch (err: any) {
    logger.error('[RetryService] Sweep failed', { error: err?.message });
  }
}

let sweeperHandle: ReturnType<typeof setInterval> | null = null;

export const NotificationRetryService = {
  /**
   * Start the background sweeper. Safe to call multiple times — only one interval runs.
   */
  startSweeper(): void {
    if (sweeperHandle) return;
    logger.info('[RetryService] Sweeper started', { intervalMs: SWEEPER_INTERVAL_MS });
    sweeperHandle = setInterval(sweep, SWEEPER_INTERVAL_MS);
    // Unref so Node doesn't keep process alive for this alone
    if (typeof sweeperHandle === 'object' && sweeperHandle && 'unref' in sweeperHandle) {
      (sweeperHandle as any).unref();
    }
  },

  /** Stop the sweeper (useful in tests). */
  stopSweeper(): void {
    if (sweeperHandle) {
      clearInterval(sweeperHandle);
      sweeperHandle = null;
    }
  },

  /** Manually trigger one sweep cycle (for admin/testing). */
  async runOnce(): Promise<void> {
    await sweep();
  },
};

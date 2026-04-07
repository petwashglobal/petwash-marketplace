/**
 * PETWASH™ NOTIFICATION ENGINE
 *
 * Unified multi-channel dispatcher: email + SMS (Twilio) + push (FCM).
 *
 * Guarantees (v2 — hardened):
 *   1. Backend record written (status = 'queued') BEFORE any send attempt.
 *   2. Each channel's failure is isolated — never breaks siblings and never
 *      propagates to the calling transaction.
 *   3. Log row updated to 'sent' or 'failed' per channel, with providerMessageId.
 *   4. Idempotency: duplicate jobs (same idempotencyKey) return immediately.
 *   5. Retry fields (retryCount, maxRetries, nextRetryAt) written on first insert.
 *   6. User preference gate: transactional messages always sent (legal mandate);
 *      non-transactional messages respect communicationPreferences + suppressionList.
 *
 * Transactional events (always delivered, regardless of user preferences):
 *   booking_confirmed, payout_issued, provider_approved, egift_purchased,
 *   prestige_joined, refund_issued, booking_cancelled, provider_rejected
 *
 * Retry philosophy:
 *   - Failures are recorded with retryCount=0, nextRetryAt=now+5min.
 *   - NotificationRetryService sweeps failed rows and re-attempts up to maxRetries.
 *   - After maxRetries exhausted: status='permanently_failed', permanentlyFailed=true.
 *
 * Channel routing:
 *   email  → SendGrid via createMailService
 *   sms    → Twilio via TwilioSMSService (returns SID)
 *   push   → Firebase FCM via FCMService (returns messageId)
 */

import { db } from '../db';
import { notificationLogs, users } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { twilioSMSService } from './TwilioSMSService';
import { FCMService } from './FCMService';
import { createMailService } from '../lib/sendgrid';

export type NotificationChannel = 'email' | 'sms' | 'push';

/** Events that are always delivered regardless of user marketing prefs (legal/transactional mandate) */
const TRANSACTIONAL_EVENTS = new Set([
  'booking_confirmed',
  'payout_issued',
  'provider_approved',
  'provider_rejected',
  'egift_purchased',
  'egift_redeemed',
  'prestige_joined',
  'refund_issued',
  'booking_cancelled',
  'membership_renewed',
  'membership_cancelled',
  'wash_started',
  'wash_completed',
  'k9000_compensation',
]);

export interface EmailChannelPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SmsChannelPayload {
  to: string;
  text: string;
}

export interface PushChannelPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface NotificationJob {
  /** Internal user ID — used for preference lookup and notification_logs.recipient_user_id */
  userId: string;
  /** Financial event type — stored on every log row for queryability */
  eventType:
    | 'booking_confirmed'
    | 'egift_purchased'
    | 'egift_redeemed'
    | 'prestige_joined'
    | 'provider_approved'
    | 'provider_rejected'
    | 'provider_registration_submitted'
    | 'payout_issued'
    | 'refund_issued'
    | 'booking_cancelled'
    | 'membership_renewed'
    | 'membership_cancelled'
    | string;
  /** Human-readable key for the template slot (stored in notification_logs.template_key) */
  templateKey: string;
  /** Optional linkage to financial records */
  bookingId?: string;
  transactionId?: string;
  /** Channels to attempt. Omit a channel or leave payload undefined to skip it. */
  channels: NotificationChannel[];
  email?: EmailChannelPayload;
  sms?: SmsChannelPayload;
  push?: PushChannelPayload;
  /** Arbitrary payload stored in notification_logs for debugging */
  debugPayload?: Record<string, unknown>;
  /**
   * Optional idempotency key. If provided and a log row with this key already
   * exists for the same channel, that channel is skipped entirely.
   * Recommended format: `{eventType}:{bookingId|transactionId}:{userId}:{channel}`
   */
  idempotencyKey?: string;
  /** Max retry attempts for this job (default: 3). Stored in notification_logs. */
  maxRetries?: number;
}

// ─── User preference gate ─────────────────────────────────────────────────────

interface ChannelPrefs {
  marketing: boolean;
  transactional: boolean;
  reminders: boolean;
}

interface CommPrefs {
  email?: ChannelPrefs;
  sms?: ChannelPrefs;
  push?: ChannelPrefs;
  whatsapp?: ChannelPrefs;
}

interface SuppressionList {
  email?: boolean;
  sms?: boolean;
  push?: boolean;
  all?: boolean;
}

async function isChannelAllowed(
  userId: string,
  channel: NotificationChannel,
  eventType: string,
): Promise<boolean> {
  // Transactional events always pass through — legal obligation
  if (TRANSACTIONAL_EVENTS.has(eventType)) return true;

  try {
    const [user] = await db
      .select({ communicationPreferences: users.communicationPreferences, suppressionList: users.suppressionList })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return true; // Unknown user — allow by default, don't block

    const suppression = (user.suppressionList as SuppressionList | null) ?? {};
    if (suppression.all || suppression[channel]) {
      logger.info('[NotificationEngine] Channel suppressed by user preference', { userId, channel, eventType });
      return false;
    }

    const prefs = (user.communicationPreferences as CommPrefs | null) ?? {};
    const channelPrefs = prefs[channel];
    if (channelPrefs && !channelPrefs.marketing) {
      logger.info('[NotificationEngine] Marketing channel disabled by user preference', { userId, channel, eventType });
      return false;
    }
  } catch (e: any) {
    logger.warn('[NotificationEngine] Preference check failed, allowing channel', { error: e?.message });
  }

  return true;
}

// ─── Retry helpers ────────────────────────────────────────────────────────────

/** Compute next retry time using exponential backoff (5min, 15min, 45min) */
function nextRetryDelay(retryCount: number): number {
  return Math.min(5 * Math.pow(3, retryCount), 180) * 60 * 1000; // ms, cap at 3h
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────

/**
 * Dispatch a notification across configured channels.
 * This function NEVER throws. All errors are swallowed and logged.
 * Call fire-and-forget after committing the DB transaction.
 */
export async function dispatchNotifications(job: NotificationJob): Promise<void> {
  const maxRetries = job.maxRetries ?? 3;

  for (const channel of job.channels) {
    const hasPayload =
      (channel === 'email' && job.email) ||
      (channel === 'sms'   && job.sms)   ||
      (channel === 'push'  && job.push);

    if (!hasPayload) continue;

    // ── Preference gate ───────────────────────────────────────────────────────
    const allowed = await isChannelAllowed(job.userId, channel, job.eventType).catch(() => true);
    if (!allowed) continue;

    let logId: number | null = null;

    try {
      // ── Idempotency check ─────────────────────────────────────────────────
      const channelIdempotencyKey = job.idempotencyKey
        ? `${job.idempotencyKey}:${channel}`
        : null;

      if (channelIdempotencyKey) {
        const [existing] = await db
          .select({ id: notificationLogs.id, status: notificationLogs.status })
          .from(notificationLogs)
          .where(eq(notificationLogs.idempotencyKey, channelIdempotencyKey))
          .limit(1);

        if (existing) {
          logger.info('[NotificationEngine] Idempotent — channel already dispatched', {
            channel,
            eventType: job.eventType,
            userId: job.userId,
            existingLogId: existing.id,
            existingStatus: existing.status,
          });
          continue;
        }
      }

      // ── 1. Write backend record FIRST (status = 'queued') ─────────────────
      // CRITICAL: payload must contain everything needed to RETRY this send
      // without re-generating the template. RetryService reads these fields.
      const retryPayload: Record<string, unknown> = {
        ...(channel === 'email' && job.email ? {
          emailTo:      job.email.to,
          emailSubject: job.email.subject,
          emailHtml:    job.email.html,
          emailText:    job.email.text ?? null,
        } : {}),
        ...(channel === 'sms' && job.sms ? {
          smsTo:   job.sms.to,
          smsText: job.sms.text,
        } : {}),
        ...(channel === 'push' && job.push ? {
          pushUserId: job.push.userId,
          pushTitle:  job.push.title,
          pushBody:   job.push.body,
          pushData:   job.push.data ?? null,
        } : {}),
        ...(job.debugPayload ?? {}),
      };

      const [logRow] = await db.insert(notificationLogs).values({
        templateKey: job.templateKey,
        channel,
        recipientUserId: job.userId,
        recipientEmail: channel === 'email' ? job.email?.to ?? null : null,
        recipientPhone: channel === 'sms'   ? job.sms?.to   ?? null : null,
        status: 'queued',
        payload: retryPayload,
        bookingId: job.bookingId ?? null,
        transactionId: job.transactionId ?? null,
        eventType: job.eventType,
        retryCount: 0,
        maxRetries,
        nextRetryAt: new Date(Date.now() + nextRetryDelay(0)), // Will be cleared on success
        permanentlyFailed: false,
        idempotencyKey: channelIdempotencyKey,
        createdAt: new Date(),
      }).returning({ id: notificationLogs.id });

      logId = logRow?.id ?? null;

      // ── 2. Attempt send ───────────────────────────────────────────────────
      let sent = false;
      let providerMessageId: string | null = null;

      if (channel === 'email' && job.email) {
        const sg = createMailService();
        const ok = await sg.send({
          to: job.email.to,
          subject: job.email.subject,
          html: job.email.html,
          text: job.email.text,
        });
        sent = ok;
      }

      if (channel === 'sms' && job.sms) {
        const result = await twilioSMSService.sendSMS(job.sms.to, job.sms.text, {
          userId: job.userId,
        });
        sent = result.success;
        providerMessageId = result.messageId ?? null; // Twilio SID (e.g. SMxxxxxxxx)
      }

      if (channel === 'push' && job.push) {
        const pushResult = await FCMService.sendToUser({
          userId: job.push.userId,
          title: job.push.title,
          body: job.push.body,
          data: job.push.data,
        });
        sent = pushResult;
        // FCMService returns boolean; messageId captured via push token lookup
      }

      // ── 3. Update log status ──────────────────────────────────────────────
      if (logId !== null) {
        await db.update(notificationLogs)
          .set({
            status: sent ? 'sent' : 'failed',
            sentAt: sent ? new Date() : undefined,
            nextRetryAt: sent ? null : new Date(Date.now() + nextRetryDelay(0)), // Keep for sweeper
            failureReason: sent ? null : 'Provider returned unsuccessful',
            providerMessageId: providerMessageId ?? undefined,
          })
          .where(eq(notificationLogs.id, logId));
      }

      logger.info('[NotificationEngine] Channel dispatched', {
        channel,
        sent,
        eventType: job.eventType,
        userId: job.userId,
        bookingId: job.bookingId,
        transactionId: job.transactionId,
        logId,
        providerMessageId,
      });

    } catch (err: any) {
      logger.error('[NotificationEngine] Channel failed', {
        channel,
        eventType: job.eventType,
        userId: job.userId,
        error: err?.message,
        logId,
      });

      if (logId !== null) {
        try {
          await db.update(notificationLogs)
            .set({
              status: 'failed',
              failureReason: err?.message ?? 'Unknown error',
              nextRetryAt: new Date(Date.now() + nextRetryDelay(0)),
            })
            .where(eq(notificationLogs.id, logId));
        } catch {
          // Swallow — outer error already logged
        }
      }
    }
  }
}

// ─── SMS text builders ────────────────────────────────────────────────────────

export function buildBookingConfirmedSms(params: {
  bookingRef: string;
  serviceName: string;
  dateStr: string;
  totalAmount: string;
}): string {
  return (
    `PetWash™ - הזמנה אושרה ✅\n` +
    `מס' הזמנה: ${params.bookingRef}\n` +
    `שירות: ${params.serviceName}\n` +
    `תאריך: ${params.dateStr}\n` +
    `סה"כ לתשלום: ${params.totalAmount} ₪\n` +
    `לפרטים: https://petwash.co.il/bookings`
  );
}

export function buildEgiftPurchasedSms(params: {
  giftRef: string;
  giftValue: string;
  recipientName?: string;
}): string {
  const to = params.recipientName ? ` ל-${params.recipientName}` : '';
  return (
    `PetWash™ - כרטיס מתנה נרכש 🎁\n` +
    `מס' מתנה: ${params.giftRef}\n` +
    `שווי${to}: ${params.giftValue} ₪\n` +
    `מימוש: https://petwash.co.il/egift/redeem`
  );
}

export function buildPrestigeJoinedSms(params: {
  memberNumber: string;
  tier: string;
}): string {
  return (
    `PetWash™ Prestige 👑\n` +
    `ברוך הבא לתכנית הנאמנות!\n` +
    `מס' חבר: ${params.memberNumber}\n` +
    `רמה: ${params.tier}\n` +
    `petwash.co.il/prestige`
  );
}

export function buildProviderApprovedSms(params: {
  providerName: string;
}): string {
  return (
    `PetWash™ - הבקשה אושרה ✅\n` +
    `שלום ${params.providerName},\n` +
    `חשבון הספק שלך אושר!\n` +
    `התחל/י: https://petwash.co.il/provider/onboarding`
  );
}

export function buildPayoutIssuedSms(params: {
  payoutRef: string;
  netAmount: string;
  bookingRef?: string;
}): string {
  const bookingLine = params.bookingRef ? `מס' הזמנה: ${params.bookingRef}\n` : '';
  return (
    `PetWash™ - תשלום הועבר 💸\n` +
    `מס' תשלום: ${params.payoutRef}\n` +
    bookingLine +
    `סכום נטו: ${params.netAmount} ₪\n` +
    `פרטים: https://petwash.co.il/provider/earnings`
  );
}

export function buildPayoutQueuedSms(params: {
  netAmount: string;
  bookingRef?: string;
}): string {
  const bookingLine = params.bookingRef ? `מס' הזמנה: ${params.bookingRef}\n` : '';
  return (
    `PetWash™ - תשלום בתהליך העברה ⏳\n` +
    bookingLine +
    `סכום נטו: ${params.netAmount} ₪\n` +
    `ההעברה עדיין לא אושרה — פרטים: https://petwash.co.il/provider/earnings`
  );
}

export function buildPayoutFailedSms(params: {
  netAmount: string;
  bookingRef?: string;
}): string {
  const bookingLine = params.bookingRef ? `מס' הזמנה: ${params.bookingRef}\n` : '';
  return (
    `PetWash™ - תשלום נכשל ❌\n` +
    bookingLine +
    `סכום נטו: ${params.netAmount} ₪\n` +
    `צוות התמיכה יצור איתך קשר. פרטים: https://petwash.co.il/provider/earnings`
  );
}

export function buildRefundIssuedSms(params: {
  bookingRef: string;
  refundAmount: string;
}): string {
  return (
    `PetWash™ - זיכוי הועבר ↩️\n` +
    `מס' הזמנה: ${params.bookingRef}\n` +
    `סכום זיכוי: ${params.refundAmount} ₪\n` +
    `יתרה תופיע תוך 3-5 ימי עסקים`
  );
}

export function buildBookingCancelledSms(params: {
  bookingRef: string;
  serviceName: string;
}): string {
  return (
    `PetWash™ - הזמנה בוטלה ❌\n` +
    `מס' הזמנה: ${params.bookingRef}\n` +
    `שירות: ${params.serviceName}\n` +
    `לפרטים: https://petwash.co.il/bookings`
  );
}

export function buildProviderRejectedSms(params: {
  providerName: string;
}): string {
  return (
    `PetWash™ - בקשתך לא אושרה\n` +
    `שלום ${params.providerName},\n` +
    `לצערנו לא ניתן לאשר את בקשתך בשלב זה.\n` +
    `פנה/י לתמיכה: support@petwash.co.il`
  );
}

export function buildEgiftRedeemedSms(params: {
  redemptionRef: string;
  amountILS: string;
  stationId?: string;
}): string {
  const stationLine = params.stationId ? `עמדה: ${params.stationId}\n` : '';
  return (
    `PetWash™ - כרטיס מתנה מומש ✅\n` +
    `מס׳ מימוש: ${params.redemptionRef}\n` +
    `שווי מומש: ₪${params.amountILS}\n` +
    stationLine +
    `לפרטים: https://petwash.co.il/egift`
  );
}

export function buildPointsRedeemedSms(params: {
  rewardName: string;
  pointsCost: number;
  voucherCode: string;
  newBalance: number;
}): string {
  return (
    `PetWash™ - נקודות מומשו 🏆\n` +
    `פרס: ${params.rewardName}\n` +
    `נקודות שנוצלו: ${params.pointsCost}\n` +
    `קוד קופון: ${params.voucherCode}\n` +
    `יתרת נקודות: ${params.newBalance}\n` +
    `petwash.co.il/prestige`
  );
}

export function buildMembershipRenewedSms(params: {
  tier: string;
  renewedUntil: string;
}): string {
  return (
    `PetWash™ Prestige 👑\n` +
    `חברות מורחבת!\n` +
    `רמה: ${params.tier}\n` +
    `תקף עד: ${params.renewedUntil}\n` +
    `petwash.co.il/prestige`
  );
}

export function buildMembershipCancelledSms(params: {
  tier: string;
  effectiveDate: string;
}): string {
  return (
    `PetWash™ - חברות בוטלה\n` +
    `רמת חברות ${params.tier} בוטלה.\n` +
    `תוקף הטבות עד: ${params.effectiveDate}\n` +
    `להצטרפות מחדש: petwash.co.il/prestige`
  );
}

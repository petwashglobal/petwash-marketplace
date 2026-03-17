/**
 * PetWash™ Unified Notification Dispatcher
 *
 * Single function that simultaneously:
 *  1. Writes a message to the user's Firestore inbox
 *  2. Sends an HTML email via SendGrid
 *  3. Sends an SMS via Twilio (if phone provided)
 *
 * All three channels are fire-and-forget after the inbox write succeeds.
 * The inbox write is authoritative; email/SMS failures are logged but not fatal.
 */

import { randomUUID } from 'crypto';
import { db as firestoreDb } from './firebase-admin';
import { FIRESTORE_PATHS } from '../../shared/firestore-schema';
import { logger } from './logger';
import { isSendGridConfigured, sgMail } from './sendgrid';
import { twilioSMSService } from '../services/TwilioSMSService';

export type NotificationChannel = 'inbox' | 'email' | 'sms';
export type NotificationMessageType = 'voucher' | 'system' | 'receipt' | 'promo';

export interface DispatchOptions {
  uid: string;
  email?: string;
  phone?: string;
  locale?: 'he' | 'en';
  type: NotificationMessageType;
  title: string;
  bodyHtml: string;
  bodyText?: string;    // Plain-text fallback for SMS/email; auto-derived if omitted
  ctaText?: string;
  ctaUrl?: string;
  priority?: number;
  meta?: {
    voucherCode?: string;
    discountPercent?: number;
    expiry?: Date;
    transactionId?: string;
    bookingId?: string;
    amount?: number;
    currency?: string;
  };
  channels?: NotificationChannel[];  // defaults to ['inbox', 'email', 'sms']
}

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@petwash.co.il';
const FROM_NAME  = 'PetWash™';

/**
 * Strip HTML tags to produce a plain-text version for SMS.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Wrap bodyHtml in a minimal PetWash™ branded email shell.
 */
function buildEmailHtml(title: string, bodyHtml: string, ctaText?: string, ctaUrl?: string): string {
  const cta = ctaText && ctaUrl
    ? `<div style="text-align:center;margin:32px 0"><a href="${ctaUrl}" style="background:#000;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600">${ctaText}</a></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;direction:rtl">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;max-width:600px">
        <tr><td style="background:#000;padding:24px 32px;text-align:center">
          <span style="color:#fff;font-size:22px;font-weight:700;letter-spacing:1px">PetWash™</span>
        </td></tr>
        <tr><td style="padding:32px">
          <h2 style="margin:0 0 16px;font-size:20px;color:#111">${title}</h2>
          <div style="color:#444;font-size:15px;line-height:1.7">${bodyHtml}</div>
          ${cta}
        </td></tr>
        <tr><td style="background:#f9f9f9;padding:16px 32px;text-align:center;font-size:12px;color:#888">
          PetWash™ Ltd · VAT 516788400 · <a href="https://petwash.co.il" style="color:#888">petwash.co.il</a><br>
          <a href="https://petwash.co.il/unsubscribe" style="color:#aaa">Unsubscribe</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Core dispatch function.
 * Returns { ok: true, inboxId, emailSent, smsSent }
 */
export async function dispatchNotification(opts: DispatchOptions): Promise<{
  ok: boolean;
  inboxId: string;
  emailSent: boolean;
  smsSent: boolean;
  errors: string[];
}> {
  const {
    uid,
    email,
    phone,
    locale = 'he',
    type,
    title,
    bodyHtml,
    bodyText,
    ctaText,
    ctaUrl,
    priority = 0,
    meta,
    channels = ['inbox', 'email', 'sms'],
  } = opts;

  const errors: string[] = [];
  const inboxId = randomUUID();
  let emailSent = false;
  let smsSent = false;

  // ── 1. Write to Firestore inbox (primary, always attempted) ──────────────
  if (channels.includes('inbox')) {
    try {
      const inboxRef = firestoreDb.doc(FIRESTORE_PATHS.USER_INBOX(uid, inboxId));
      await inboxRef.set({
        id: inboxId,
        title,
        bodyHtml,
        type,
        ctaText: ctaText || null,
        ctaUrl: ctaUrl || null,
        createdAt: new Date(),
        readAt: null,
        locale,
        priority,
        attachments: [],
        meta: {
          ...(meta || {}),
          expiry: meta?.expiry || null,
        },
      });
      logger.info('[NotificationDispatcher] Inbox message written', { uid, inboxId, type });
    } catch (err) {
      const msg = `Inbox write failed: ${err instanceof Error ? err.message : err}`;
      errors.push(msg);
      logger.error('[NotificationDispatcher] ' + msg, err);
    }
  }

  // ── 2. Send email via SendGrid ───────────────────────────────────────────
  if (channels.includes('email') && email) {
    try {
      if (!isSendGridConfigured()) {
        errors.push('SendGrid not configured — email skipped');
      } else {
        const htmlBody = buildEmailHtml(title, bodyHtml, ctaText, ctaUrl);
        const plainText = bodyText || stripHtml(bodyHtml) + (ctaText && ctaUrl ? `\n\n${ctaText}: ${ctaUrl}` : '');

        await sgMail.send({
          to: email,
          from: { email: FROM_EMAIL, name: FROM_NAME },
          subject: title,
          html: htmlBody,
          text: plainText,
        });
        emailSent = true;
        logger.info('[NotificationDispatcher] Email sent', { uid, email, type });
      }
    } catch (err) {
      const msg = `Email send failed: ${err instanceof Error ? err.message : err}`;
      errors.push(msg);
      logger.error('[NotificationDispatcher] ' + msg);
    }
  }

  // ── 3. Send SMS via Twilio ───────────────────────────────────────────────
  if (channels.includes('sms') && phone) {
    try {
      const smsBody = bodyText || stripHtml(bodyHtml);
      const truncated = smsBody.length > 300 ? smsBody.slice(0, 297) + '...' : smsBody;
      const result = await twilioSMSService.sendSMS(phone, truncated, { userId: uid });
      smsSent = result.success;
      if (!result.success) errors.push(`SMS failed: ${result.error || 'unknown'}`);
      else logger.info('[NotificationDispatcher] SMS sent', { uid, type });
    } catch (err) {
      const msg = `SMS send failed: ${err instanceof Error ? err.message : err}`;
      errors.push(msg);
      logger.error('[NotificationDispatcher] ' + msg);
    }
  }

  return { ok: true, inboxId, emailSent, smsSent, errors };
}

// ── Convenience wrappers ───────────────────────────────────────────────────

/** Send a transaction receipt to user (inbox + email + SMS) */
export async function sendTransactionReceipt(params: {
  uid: string;
  email?: string;
  phone?: string;
  locale?: 'he' | 'en';
  transactionId: string;
  bookingId?: string;
  amount: number;
  currency?: string;
  serviceName: string;
  providerName?: string;
  receiptUrl?: string;
}) {
  const { locale = 'he', amount, currency = 'ILS', serviceName, providerName, receiptUrl, transactionId } = params;
  const amountStr = `${currency} ${amount.toFixed(2)}`;

  const title = locale === 'he'
    ? `✅ קבלה על ${serviceName}`
    : `✅ Receipt for ${serviceName}`;

  const bodyHtml = locale === 'he'
    ? `<p>תודה על הזמנתך! הרכישה הושלמה בהצלחה.</p>
       <p><strong>שירות:</strong> ${serviceName}<br>
       ${providerName ? `<strong>ספק:</strong> ${providerName}<br>` : ''}
       <strong>סכום:</strong> ${amountStr}<br>
       <strong>מזהה עסקה:</strong> ${transactionId}</p>`
    : `<p>Thank you for your purchase! The transaction was completed successfully.</p>
       <p><strong>Service:</strong> ${serviceName}<br>
       ${providerName ? `<strong>Provider:</strong> ${providerName}<br>` : ''}
       <strong>Amount:</strong> ${amountStr}<br>
       <strong>Transaction ID:</strong> ${transactionId}</p>`;

  return dispatchNotification({
    uid: params.uid,
    email: params.email,
    phone: params.phone,
    locale,
    type: 'receipt',
    title,
    bodyHtml,
    ctaText: receiptUrl ? (locale === 'he' ? 'הצג קבלה' : 'View Receipt') : undefined,
    ctaUrl: receiptUrl,
    priority: 10,
    meta: { transactionId, bookingId: params.bookingId, amount, currency },
    channels: ['inbox', 'email', 'sms'],
  });
}

/** Send a promo/voucher code to a user (inbox + email only — SMS is opt-in) */
export async function sendPromoCode(params: {
  uid: string;
  email?: string;
  phone?: string;
  locale?: 'he' | 'en';
  code: string;
  discountPercent: number;
  expiresAt: string;
  reason: string;    // "birthday", "summer", "winter", "loyalty"
  calendarLink?: string;
}) {
  const { locale = 'he', code, discountPercent, expiresAt, reason } = params;

  const reasonLabels: Record<string, { he: string; en: string }> = {
    birthday: { he: 'יום הולדת 🎂', en: 'Birthday 🎂' },
    summer:   { he: 'קיץ ☀️', en: 'Summer ☀️' },
    winter:   { he: 'חורף ❄️', en: 'Winter ❄️' },
    loyalty:  { he: 'נאמנות ⭐', en: 'Loyalty ⭐' },
  };
  const label = reasonLabels[reason] ?? { he: reason, en: reason };

  const title = locale === 'he'
    ? `🎁 קוד הנחה ${label.he} — ${discountPercent}% הנחה`
    : `🎁 ${label.en} Discount Code — ${discountPercent}% off`;

  const bodyHtml = locale === 'he'
    ? `<p>קוד ההנחה האישי שלך:</p>
       <p style="font-size:24px;font-weight:700;letter-spacing:4px;text-align:center;padding:16px;background:#f0f0f0;border-radius:8px">${code}</p>
       <p>✅ שימוש אחד בלבד · תקף עד ${expiresAt} · אישי ואינו ניתן להעברה</p>
       ${params.calendarLink ? `<p><a href="${params.calendarLink}">הוסף תזכורת ליומן Google</a></p>` : ''}`
    : `<p>Your personal discount code:</p>
       <p style="font-size:24px;font-weight:700;letter-spacing:4px;text-align:center;padding:16px;background:#f0f0f0;border-radius:8px">${code}</p>
       <p>✅ Single use · Valid until ${expiresAt} · Personal, non-transferable</p>
       ${params.calendarLink ? `<p><a href="${params.calendarLink}">Add reminder to Google Calendar</a></p>` : ''}`;

  return dispatchNotification({
    uid: params.uid,
    email: params.email,
    phone: params.phone,
    locale,
    type: 'promo',
    title,
    bodyHtml,
    ctaText: locale === 'he' ? 'הזמן עכשיו' : 'Book Now',
    ctaUrl: `https://petwash.co.il/book?promo=${code}`,
    priority: 5,
    meta: { voucherCode: code, discountPercent, expiry: new Date(expiresAt) },
    channels: ['inbox', 'email'],
  });
}

/** Send a system alert (inbox + email) */
export async function sendSystemAlert(params: {
  uid: string;
  email?: string;
  locale?: 'he' | 'en';
  title: string;
  bodyHtml: string;
  ctaText?: string;
  ctaUrl?: string;
}) {
  return dispatchNotification({
    uid: params.uid,
    email: params.email,
    locale: params.locale || 'he',
    type: 'system',
    title: params.title,
    bodyHtml: params.bodyHtml,
    ctaText: params.ctaText,
    ctaUrl: params.ctaUrl,
    priority: 1,
    channels: ['inbox', 'email'],
  });
}

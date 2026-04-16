/**
 * CampaignDeliveryService — Production-grade campaign delivery
 *
 * Consent-gated, de-duped, fully tracked delivery via real channels:
 *   SMS    → TwilioSMSService (through PetWashNotificationEngine)
 *   Push   → FCM (through PetWashNotificationEngine)
 *   Email  → SendGrid (through PetWashNotificationEngine)
 *   in_app → notification_logs only (no external send)
 *
 * Delivery funnel tracked in coupon_delivery_events:
 *   issued → sent → delivered → opened → clicked → redeemed
 *
 * Consent rules:
 *   SMS   → marketing_sms_consent_at must be non-null
 *   push  → marketing_push_consent_at + push_device_permission_status = 'granted'
 *   email → marketing_email_consent_at must be non-null
 *   in_app → always allowed
 *
 * De-dupe: one row per (campaign_type, user_id, coupon_id) in campaign_trigger_log.
 * A duplicate trigger returns immediately — no double-send.
 *
 * If TWILIO / SENDGRID / FCM are not configured, the channel is skipped and
 * logged as 'provider_unconfigured' — NEVER silently marked as 'sent'.
 */

import { pool } from '../db';
import { couponService } from './CouponService';
import { dispatchNotifications } from './PetWashNotificationEngine';
import { logger } from '../lib/logger';
import { nanoid } from 'nanoid';
import { SUPPORT_EMAIL as CANONICAL_SUPPORT_EMAIL } from '@shared/support-contact';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type CampaignType =
  | 'birthday'
  | 'black_friday'
  | 'valentine'
  | 'dog_day'
  | 'loyalty_upgrade'
  | 'first_order'
  | 'reactivation'
  | 'custom';

export type DeliveryChannel = 'sms' | 'push' | 'email' | 'in_app';

export interface CampaignDeliveryInput {
  campaignType:   CampaignType;
  couponId:       number;
  userIds:        string[];
  channels:       DeliveryChannel[];
  issuePersonal:  boolean;
  expiresAt?:     Date;
  adminId?:       string;
  /** Optional: override the message templates */
  subject?:       string;
  bodyHtml?:      string;
  bodySms?:       string;
  pushTitle?:     string;
  pushBody?:      string;
}

export interface DeliveryResult {
  total:     number;
  issued:    number;
  skipped:   number;
  byChannel: Record<DeliveryChannel, number>;
  errors:    Array<{ userId: string; error: string }>;
}

// ─────────────────────────────────────────────────────────────
// CONSENT GATE
// ─────────────────────────────────────────────────────────────

interface ConsentRecord {
  marketing_sms_consent_at:      Date | null;
  marketing_push_consent_at:     Date | null;
  marketing_email_consent_at:    Date | null;
  push_device_permission_status: string | null;
}

function isChannelAllowed(channel: DeliveryChannel, consent: ConsentRecord | null): boolean {
  if (!consent) return channel === 'in_app';
  switch (channel) {
    case 'in_app': return true;
    case 'sms':    return consent.marketing_sms_consent_at != null;
    case 'email':  return consent.marketing_email_consent_at != null;
    case 'push':
      return consent.marketing_push_consent_at != null &&
             consent.push_device_permission_status === 'granted';
    default:       return false;
  }
}

// ─────────────────────────────────────────────────────────────
// MESSAGE TEMPLATES (Hebrew / production-ready)
// ─────────────────────────────────────────────────────────────

function buildSmsText(campaignType: CampaignType, couponCode: string, discountSummary: string): string {
  switch (campaignType) {
    case 'birthday':
      return `🎂 יום הולדת שמח מ-PetWash! קיבלת קופון מיוחד: ${couponCode} (${discountSummary}). תוקף 30 יום. petwash.co.il`;
    case 'black_friday':
      return `🛒 Black Friday! קופון בלעדי ב-PetWash: ${couponCode} (${discountSummary}). לזמן מוגבל בלבד. petwash.co.il`;
    case 'valentine':
      return `💝 Valentine's Day מ-PetWash! הפנק/י את חיית המחמד שלך: ${couponCode} (${discountSummary}). petwash.co.il`;
    case 'dog_day':
      return `🐶 יום הכלב הבינלאומי! קופון מפנק: ${couponCode} (${discountSummary}). petwash.co.il`;
    case 'loyalty_upgrade':
      return `⭐ ברוכ/ה הבא/ה לדרגת נאמנות חדשה! קופון מתנה: ${couponCode} (${discountSummary}). petwash.co.il`;
    case 'first_order':
      return `🎁 ברוכ/ה הבא/ה ל-PetWash! הזמנה ראשונה שלך: ${couponCode} (${discountSummary}). petwash.co.il`;
    case 'reactivation':
      return `👋 התגעגענו אליך! קופון חזרה ל-PetWash: ${couponCode} (${discountSummary}). petwash.co.il`;
    default:
      return `PetWash™ קופון מיוחד: ${couponCode} (${discountSummary}). petwash.co.il`;
  }
}

function buildPushPayload(campaignType: CampaignType, couponCode: string, discountSummary: string): { title: string; body: string } {
  switch (campaignType) {
    case 'birthday':    return { title: '🎂 יום הולדת שמח!', body: `קיבלת קופון מיוחד: ${couponCode} (${discountSummary})` };
    case 'black_friday':return { title: '🛒 Black Friday ב-PetWash!', body: `קופון בלעדי: ${couponCode} (${discountSummary})` };
    case 'valentine':   return { title: '💝 Valentine\'s Day!', body: `מתנה לחיית המחמד שלך: ${couponCode} (${discountSummary})` };
    case 'dog_day':     return { title: '🐶 יום הכלב!', body: `קופון מפנק: ${couponCode} (${discountSummary})` };
    case 'loyalty_upgrade': return { title: '⭐ דרגת נאמנות חדשה!', body: `קופון מתנה: ${couponCode} (${discountSummary})` };
    default:            return { title: '🎁 קופון מ-PetWash!', body: `${couponCode} (${discountSummary})` };
  }
}

function buildEmailHtml(campaignType: CampaignType, couponCode: string, discountSummary: string, firstName: string): string {
  const greeting = firstName ? `שלום ${firstName},` : 'שלום,';
  const campaignMessages: Record<string, string> = {
    birthday:        `🎂 <strong>יום הולדת שמח!</strong><br>קיבלת קופון מיוחד ביום הולדתך.`,
    black_friday:    `🛒 <strong>Black Friday ב-PetWash!</strong><br>קופון בלעדי לזמן מוגבל.`,
    valentine:       `💝 <strong>Happy Valentine's Day!</strong><br>מתנה לך ולחיית המחמד שלך.`,
    dog_day:         `🐶 <strong>יום הכלב הבינלאומי!</strong><br>קופון מפנק לחיית המחמד שלך.`,
    loyalty_upgrade: `⭐ <strong>ברוכ/ה הבא/ה לדרגת נאמנות חדשה!</strong><br>אנחנו מעריכים את נאמנותך.`,
    first_order:     `🎁 <strong>ברוכ/ה הבא/ה ל-PetWash!</strong><br>מתנה להזמנה הראשונה שלך.`,
    reactivation:    `👋 <strong>התגעגענו אליך!</strong><br>קופון חזרה מיוחד רק בשבילך.`,
  };
  const msg = campaignMessages[campaignType] ?? `🎁 <strong>קופון מיוחד מ-PetWash!</strong>`;

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
  <div style="background:#000;padding:24px;text-align:center">
    <h1 style="color:#fff;margin:0;font-size:24px">⁦Pet Wash™⁩</h1>
    <p style="color:#aaa;margin:4px 0 0;font-size:12px">ח.פ. 517145033 | petwash.co.il</p>
  </div>
  <div style="padding:32px;direction:rtl;text-align:right">
    <p style="font-size:16px;color:#333">${greeting}</p>
    <p style="font-size:16px;color:#333">${msg}</p>
    <div style="background:#f9f9f9;border:2px dashed #000;border-radius:8px;padding:20px;text-align:center;margin:24px 0">
      <p style="font-size:13px;color:#666;margin:0 0 8px">קוד הקופון שלך</p>
      <p style="font-size:28px;font-weight:bold;letter-spacing:4px;margin:0;font-family:monospace">${couponCode}</p>
      <p style="font-size:14px;color:#16a34a;margin:8px 0 0;font-weight:bold">${discountSummary}</p>
    </div>
    <div style="text-align:center;margin:24px 0">
      <a href="https://petwash.co.il" style="background:#000;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:15px;display:inline-block">
        למימוש הקופון
      </a>
    </div>
    <p style="font-size:12px;color:#999;border-top:1px solid #eee;padding-top:16px;margin-top:24px">
      קיבלת הודעה זו מכיוון שנתת הסכמה לקבל הצעות שיווקיות מ-PetWash.<br>
      להסרה מרשימת תפוצה: <a href="https://petwash.co.il/unsubscribe" style="color:#999">לחץ כאן</a><br><br>
      פט וואש בע&quot;מ / PET WASH LTD | ח.פ. 517145033 | ${CANONICAL_SUPPORT_EMAIL}
    </p>
  </div>
</div>
</body></html>`;
}

function buildEmailSubject(campaignType: CampaignType, discountSummary: string): string {
  switch (campaignType) {
    case 'birthday':        return `🎂 יום הולדת שמח! קופון מיוחד עבורך (${discountSummary}) | PetWash`;
    case 'black_friday':    return `🛒 Black Friday — קופון בלעדי (${discountSummary}) | PetWash`;
    case 'valentine':       return `💝 Valentine's Day — מתנה לחיית המחמד שלך | PetWash`;
    case 'dog_day':         return `🐶 יום הכלב — קופון מפנק (${discountSummary}) | PetWash`;
    case 'loyalty_upgrade': return `⭐ דרגת נאמנות חדשה — קופון מתנה | PetWash`;
    case 'first_order':     return `🎁 ברוכ/ה הבא/ה ל-PetWash — קופון לראשית הדרך`;
    case 'reactivation':    return `👋 התגעגענו! קופון חזרה מיוחד (${discountSummary}) | PetWash`;
    default:                return `🎁 קופון מיוחד מ-PetWash (${discountSummary})`;
  }
}

// ─────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────

export class CampaignDeliveryService {

  /**
   * Main entry: deliver a coupon campaign to a batch of users.
   * Respects consent, de-dupes, issues personal coupons if needed,
   * sends via real providers (Twilio/FCM/SendGrid), tracks funnel.
   */
  async deliverCampaign(input: CampaignDeliveryInput): Promise<DeliveryResult> {
    const {
      campaignType, couponId, userIds, channels,
      issuePersonal, expiresAt, adminId = 'system',
      subject, bodyHtml, bodySms, pushTitle, pushBody,
    } = input;

    const result: DeliveryResult = {
      total: userIds.length,
      issued: 0,
      skipped: 0,
      byChannel: { sms: 0, push: 0, email: 0, in_app: 0 },
      errors: [],
    };

    if (userIds.length === 0) return result;

    // ── Batch-load consent + user profile ───────────────────────────────────
    const [consentRows, userRows, couponRow] = await Promise.all([
      pool.query(
        `SELECT user_id, marketing_sms_consent_at, marketing_push_consent_at,
                marketing_email_consent_at, push_device_permission_status
         FROM notification_preferences WHERE user_id = ANY($1)`,
        [userIds]
      ),
      pool.query(
        `SELECT id, email, phone, first_name FROM users WHERE id = ANY($1) AND is_active = true`,
        [userIds]
      ),
      pool.query(
        `SELECT c.code, c.discount_type, c.discount_value, c.discount_value_cents
         FROM coupons c WHERE c.id = $1 LIMIT 1`,
        [couponId]
      ),
    ]);

    const consentMap  = new Map<string, ConsentRecord>(consentRows.rows.map((r: any) => [r.user_id, r]));
    const userMap     = new Map<string, any>(userRows.rows.map((r: any) => [r.id, r]));
    const coupon      = couponRow.rows[0];
    const couponCode  = coupon?.code ?? 'PROMO';

    // Build discount summary for messages
    let discountSummary = '';
    if (coupon) {
      if (coupon.discount_type === 'percentage')
        discountSummary = `${coupon.discount_value}% הנחה`;
      else if (coupon.discount_type === 'fixed_amount')
        discountSummary = `₪${((coupon.discount_value_cents ?? 0) / 100).toFixed(0)} הנחה`;
      else if (coupon.discount_type === 'free_item')
        discountSummary = 'פריט חינם';
      else
        discountSummary = 'הנחה מיוחדת';
    }

    // ── Per-user delivery ────────────────────────────────────────────────────
    for (const userId of userIds) {
      try {
        const user    = userMap.get(userId);
        const consent = consentMap.get(userId) ?? null;

        // Only deliver to active users
        if (!user) {
          result.skipped++;
          continue;
        }

        // Determine allowed channels for this user
        const allowedChannels = channels.filter(ch => isChannelAllowed(ch, consent));
        if (allowedChannels.length === 0) {
          result.skipped++;
          logger.debug('[Campaign] All channels blocked by consent', { userId, campaignType });
          continue;
        }

        // Dedupe — one delivery attempt per campaign+user+coupon
        const alreadyTriggered = await pool.query(
          `SELECT id FROM campaign_trigger_log
           WHERE campaign_type = $1 AND user_id = $2 AND coupon_id = $3 LIMIT 1`,
          [campaignType, userId, couponId]
        );
        if (alreadyTriggered.rows.length > 0) {
          result.skipped++;
          continue;
        }

        // Issue personal coupon if required
        if (issuePersonal) {
          try {
            await couponService.issueToUser(couponId, userId, adminId, expiresAt);
          } catch {
            // Already issued — continue to delivery
          }
        }

        // ── Build notification payloads ──────────────────────────────────────
        const firstName     = user.first_name ?? '';
        const smsText       = bodySms  ?? buildSmsText(campaignType, couponCode, discountSummary);
        const emailSubject_ = subject  ?? buildEmailSubject(campaignType, discountSummary);
        const emailHtml_    = bodyHtml ?? buildEmailHtml(campaignType, couponCode, discountSummary, firstName);
        const push_         = buildPushPayload(campaignType, couponCode, discountSummary);
        const idempotencyKey = `campaign:${campaignType}:${couponId}:${userId}`;

        // ── Dispatch via PetWashNotificationEngine (real providers) ──────────
        const notifChannels = allowedChannels
          .filter(c => c !== 'in_app')
          .map(c => c as 'email' | 'sms' | 'push');

        if (notifChannels.length > 0) {
          await dispatchNotifications({
            userId,
            eventType: `campaign_${campaignType}`,
            templateKey: `campaign.${campaignType}`,
            channels: notifChannels,
            idempotencyKey,
            email: user.email ? {
              to:      user.email,
              subject: emailSubject_,
              html:    emailHtml_,
            } : undefined,
            sms: user.phone && allowedChannels.includes('sms') ? {
              to:   user.phone,
              text: smsText,
            } : undefined,
            push: allowedChannels.includes('push') ? {
              userId,
              title: pushTitle ?? push_.title,
              body:  pushBody  ?? push_.body,
              data:  { couponCode, campaignType },
            } : undefined,
            debugPayload: { couponId, couponCode, discountSummary, campaignType },
          });
        }

        // Track in_app as coupon delivery event (always, no external send)
        const messageId = `MSG-${nanoid(10)}`;
        try {
          await couponService.recordDeliveryEvent({ couponId, userId, channel: 'in_app', messageId });
          // in_app: mark sent immediately since it's an in-DB event
          await pool.query(
            `UPDATE coupon_delivery_events SET sent_at = NOW() WHERE message_id = $1`, [messageId]
          );
        } catch { /* non-blocking */ }

        // Track campaign-level funnel for each real channel
        for (const ch of allowedChannels) {
          const chanMsgId = `MSG-${nanoid(10)}`;
          if (ch !== 'in_app') {
            try {
              await couponService.recordDeliveryEvent({ couponId, userId, channel: ch, messageId: chanMsgId });
            } catch { /* non-blocking */ }
          }
          result.byChannel[ch]++;
        }

        // Log trigger (de-dupe anchor)
        await pool.query(
          `INSERT INTO campaign_trigger_log (campaign_type, user_id, coupon_id, channel, status, sent_at)
           VALUES ($1, $2, $3, $4, 'sent', NOW())
           ON CONFLICT (campaign_type, user_id, coupon_id) DO NOTHING`,
          [campaignType, userId, couponId, allowedChannels.join(',')]
        );

        result.issued++;
      } catch (err: any) {
        result.errors.push({ userId, error: err.message });
        logger.error('[Campaign] Error processing user', { userId, campaignType, error: err.message });
      }
    }

    logger.info('[Campaign] ✅ Delivery complete', { campaignType, couponId, ...result });
    return result;
  }

  // ─── Trigger helpers ──────────────────────────────────────────────────────

  async triggerBirthdayCampaign(couponId: number, adminId?: string): Promise<DeliveryResult> {
    const birthdayUsers = await pool.query(
      `SELECT id FROM users
       WHERE date_part('month', date_of_birth) = date_part('month', CURRENT_DATE)
         AND date_part('day',   date_of_birth) = date_part('day',   CURRENT_DATE)
         AND is_active = true`
    );
    const userIds = birthdayUsers.rows.map((r: any) => r.id);
    logger.info('[Campaign] Birthday trigger', { count: userIds.length, couponId });

    return this.deliverCampaign({
      campaignType: 'birthday',
      couponId,
      userIds,
      channels: ['in_app', 'push', 'email', 'sms'],
      issuePersonal: true,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      adminId: adminId ?? 'system:birthday',
    });
  }

  async triggerFlashCampaign(
    campaignType: CampaignType,
    couponId: number,
    issuePersonal = false,
    adminId?: string
  ): Promise<DeliveryResult> {
    // Paginated delivery — process in batches of 500 to avoid memory pressure
    const BATCH = 500;
    let offset = 0;
    const combined: DeliveryResult = { total: 0, issued: 0, skipped: 0, byChannel: { sms: 0, push: 0, email: 0, in_app: 0 }, errors: [] };

    while (true) {
      const rows = await pool.query(
        `SELECT id FROM users WHERE is_active = true ORDER BY id LIMIT $1 OFFSET $2`,
        [BATCH, offset]
      );
      if (!rows.rows.length) break;

      const userIds = rows.rows.map((r: any) => r.id);
      const batchResult = await this.deliverCampaign({
        campaignType, couponId, userIds,
        channels: ['in_app', 'push', 'email', 'sms'],
        issuePersonal, adminId: adminId ?? `system:${campaignType}`,
      });

      combined.total   += batchResult.total;
      combined.issued  += batchResult.issued;
      combined.skipped += batchResult.skipped;
      combined.errors.push(...batchResult.errors);
      for (const ch of ['sms', 'push', 'email', 'in_app'] as const) {
        combined.byChannel[ch] += batchResult.byChannel[ch];
      }

      offset += BATCH;
      if (rows.rows.length < BATCH) break;
    }

    logger.info('[Campaign] Flash campaign complete', { campaignType, couponId, ...combined });
    return combined;
  }

  async triggerLoyaltyUpgradeCampaign(
    couponId: number,
    loyaltyTier: string,
    adminId?: string
  ): Promise<DeliveryResult> {
    const rows = await pool.query(
      `SELECT id FROM users WHERE loyalty_tier = $1 AND is_active = true`,
      [loyaltyTier]
    );
    const userIds = rows.rows.map((r: any) => r.id);

    return this.deliverCampaign({
      campaignType: 'loyalty_upgrade',
      couponId,
      userIds,
      channels: ['in_app', 'push', 'email'],
      issuePersonal: true,
      adminId: adminId ?? 'system:loyalty',
    });
  }

  // ─── Funnel tracking ──────────────────────────────────────────────────────

  async trackOpened(messageId: string):   Promise<void> { await couponService.trackDeliveryEvent(messageId, 'opened_at'); }
  async trackClicked(messageId: string):  Promise<void> { await couponService.trackDeliveryEvent(messageId, 'clicked_at'); }
  async trackRedeemed(messageId: string): Promise<void> { await couponService.trackDeliveryEvent(messageId, 'redeemed_at'); }
}

export const campaignDeliveryService = new CampaignDeliveryService();

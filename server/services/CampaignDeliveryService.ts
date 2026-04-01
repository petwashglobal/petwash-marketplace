/**
 * CampaignDeliveryService — Priority 3
 * Consent-gated campaign delivery with full funnel tracking.
 *
 * Campaign types: birthday, black_friday, valentine, dog_day, loyalty, custom
 * Channel rules:
 *   SMS   → marketing_sms_consent_at must be non-null
 *   push  → marketing_push_consent_at + device permission = 'granted'
 *   email → marketing_email_consent_at must be non-null
 *   in_app → always allowed
 *
 * Full delivery funnel tracked in coupon_delivery_events:
 *   issued → sent → delivered → opened → clicked → redeemed
 */

import { pool } from '../db';
import { couponService } from './CouponService';
import { logger } from '../lib/logger';
import { nanoid } from 'nanoid';

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
  campaignType:  CampaignType;
  couponId:      number;
  userIds:       string[];
  channels:      DeliveryChannel[];
  issuePersonal: boolean;   // if true, issue personal coupon_issuance per user
  expiresAt?:    Date;
  adminId?:      string;
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
  marketing_sms_consent_at:   Date | null;
  marketing_push_consent_at:  Date | null;
  marketing_email_consent_at: Date | null;
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
// SERVICE
// ─────────────────────────────────────────────────────────────

export class CampaignDeliveryService {

  /**
   * Main entry: deliver a coupon campaign to a list of users.
   * Respects consent, de-dupes, issues personal coupons if needed, logs delivery.
   */
  async deliverCampaign(input: CampaignDeliveryInput): Promise<DeliveryResult> {
    const { campaignType, couponId, userIds, channels, issuePersonal, expiresAt, adminId = 'system' } = input;

    const result: DeliveryResult = {
      total: userIds.length,
      issued: 0,
      skipped: 0,
      byChannel: { sms: 0, push: 0, email: 0, in_app: 0 },
      errors: [],
    };

    // Batch-load consent records
    const consentRows = await pool.query(
      `SELECT user_id, marketing_sms_consent_at, marketing_push_consent_at,
              marketing_email_consent_at, push_device_permission_status
       FROM notification_preferences WHERE user_id = ANY($1)`,
      [userIds]
    );
    const consentMap = new Map<string, ConsentRecord>();
    for (const r of consentRows.rows) consentMap.set(r.user_id, r);

    for (const userId of userIds) {
      try {
        const consent = consentMap.get(userId) ?? null;

        // Determine allowed channels for this user
        const allowedChannels = channels.filter(ch => isChannelAllowed(ch, consent));
        if (allowedChannels.length === 0) {
          result.skipped++;
          logger.debug('[Campaign] All channels blocked by consent', { userId, campaignType });
          continue;
        }

        // Dedupe: skip if already triggered for this campaign+user+coupon
        const alreadyTriggered = await pool.query(
          `SELECT id FROM campaign_trigger_log WHERE campaign_type = $1 AND user_id = $2 AND coupon_id = $3 LIMIT 1`,
          [campaignType, userId, couponId]
        );
        if (alreadyTriggered.rows.length > 0) {
          result.skipped++;
          continue;
        }

        // Issue personal coupon if required
        let issuanceId: number | undefined;
        if (issuePersonal) {
          try {
            const issued = await couponService.issueToUser(couponId, userId, adminId, expiresAt);
            issuanceId = issued.issuanceId;
          } catch (e: any) {
            // Already issued is fine — continue to delivery
          }
        }

        // Record delivery event for each allowed channel
        for (const channel of allowedChannels) {
          const messageId = `MSG-${nanoid(10)}`;
          try {
            await couponService.recordDeliveryEvent({ couponId, userId, channel, messageId });

            // In a real system: call SMS/Push/Email provider here.
            // For now we log the intent and mark as 'sent' synchronously.
            await pool.query(
              `UPDATE coupon_delivery_events SET sent_at = NOW() WHERE message_id = $1`,
              [messageId]
            );

            result.byChannel[channel]++;
          } catch (e: any) {
            logger.warn('[Campaign] Failed to record delivery event', { userId, channel, error: e.message });
          }
        }

        // Log trigger
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

    logger.info('[Campaign] Delivery complete', { campaignType, couponId, ...result });
    return result;
  }

  // ─── Trigger helpers ─────────────────────────────────────

  /**
   * Birthday campaign: find users whose birthday is today and send them the specified coupon.
   */
  async triggerBirthdayCampaign(couponId: number, adminId?: string): Promise<DeliveryResult> {
    // Users with birthday today (month + day match)
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
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      adminId: adminId ?? 'system:birthday',
    });
  }

  /**
   * Flash campaign: deliver to all active users with consent.
   * e.g. Black Friday, Valentine's Day, Dog Day
   */
  async triggerFlashCampaign(
    campaignType: CampaignType,
    couponId: number,
    issuePersonal = false,
    adminId?: string
  ): Promise<DeliveryResult> {
    const allUsers = await pool.query(
      `SELECT id FROM users WHERE is_active = true LIMIT 50000`
    );
    const userIds = allUsers.rows.map((r: any) => r.id);
    logger.info('[Campaign] Flash trigger', { campaignType, count: userIds.length, couponId });

    return this.deliverCampaign({
      campaignType,
      couponId,
      userIds,
      channels: ['in_app', 'push', 'email', 'sms'],
      issuePersonal,
      adminId: adminId ?? `system:${campaignType}`,
    });
  }

  /**
   * Loyalty upgrade campaign: users who just crossed a tier threshold.
   */
  async triggerLoyaltyUpgradeCampaign(
    couponId: number,
    loyaltyTier: string,
    adminId?: string
  ): Promise<DeliveryResult> {
    const users = await pool.query(
      `SELECT id FROM users WHERE loyalty_tier = $1 AND is_active = true`,
      [loyaltyTier]
    );
    const userIds = users.rows.map((r: any) => r.id);

    return this.deliverCampaign({
      campaignType: 'loyalty_upgrade',
      couponId,
      userIds,
      channels: ['in_app', 'push', 'email'],
      issuePersonal: true,
      adminId: adminId ?? 'system:loyalty',
    });
  }

  // ─── Funnel event tracking ────────────────────────────────

  async trackOpened(messageId: string): Promise<void> {
    await couponService.trackDeliveryEvent(messageId, 'opened_at');
  }

  async trackClicked(messageId: string): Promise<void> {
    await couponService.trackDeliveryEvent(messageId, 'clicked_at');
  }

  async trackRedeemed(messageId: string): Promise<void> {
    await couponService.trackDeliveryEvent(messageId, 'redeemed_at');
  }
}

export const campaignDeliveryService = new CampaignDeliveryService();

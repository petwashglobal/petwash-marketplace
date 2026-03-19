/**
 * winbackChannel.ts — Phase 6.12
 *
 * Multi-channel dispatch for the winback engine.
 * Handles SMS and WhatsApp sends with:
 *   - Tracking links (JWT-signed, short-lived)
 *   - Hebrew copy per variant
 *   - Daily cost caps enforced from experiment_events
 *   - Graceful degradation when Twilio is not configured
 *
 * Channels: 'inapp' (existing) | 'sms' | 'whatsapp'
 */

import twilio from 'twilio';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { experimentEvents } from '@shared/schema';
import { sql } from 'drizzle-orm';
import { logger } from '../lib/logger';

export type Channel = 'inapp' | 'sms' | 'whatsapp';
export type WinbackVariant = 'ctrl' | 'v1' | 'v2';
export type WinbackTrigger = 'winback_14d' | 'winback_30d' | 'winback_60d';

// ── Config ────────────────────────────────────────────────────────────────────

const MAX_SMS_PER_DAY       = Number(process.env.WINBACK_MAX_SMS_PER_DAY       ?? 50);
const MAX_WHATSAPP_PER_DAY  = Number(process.env.WINBACK_MAX_WHATSAPP_PER_DAY  ?? 30);
const TRACKING_BASE         = process.env.WINBACK_TRACKING_BASE ?? 'https://petwash.co.il';
const LINK_SECRET           = process.env.WINBACK_LINK_SECRET
                           ?? process.env.COOKIE_SECRET
                           ?? 'petwash-winback-link';
const LINK_TTL_DAYS         = 30;

// WhatsApp sandbox / approved content SID
// Set TWILIO_WHATSAPP_CONTENT_SID to an approved WhatsApp template SID.
// Until approved, sends are sandbox only.
const WA_FROM = process.env.TWILIO_WHATSAPP_FROM ?? 'whatsapp:+14155238886'; // Twilio sandbox default
const WA_CONTENT_SID = process.env.TWILIO_WHATSAPP_CONTENT_SID ?? null;

// ── Twilio client (shared, lazy) ──────────────────────────────────────────────

let _twilioClient: twilio.Twilio | null = null;

function getTwilioClient(): twilio.Twilio | null {
  if (_twilioClient) return _twilioClient;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const tok = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !tok) return null;
  try {
    _twilioClient = twilio(sid, tok);
    return _twilioClient;
  } catch {
    return null;
  }
}

function getSmsSender(): string {
  return process.env.TWILIO_PHONE_NUMBER
      ?? process.env.TWILIO_MESSAGING_SERVICE_SID
      ?? '';
}

// ── Tracking link ─────────────────────────────────────────────────────────────

export function buildTrackingLink(opts: {
  userId:      string;
  expKey:      string;
  variant:     WinbackVariant;
  channel:     Channel;
}): string {
  const token = jwt.sign(
    { uid: opts.userId, e: opts.expKey, v: opts.variant, c: opts.channel },
    LINK_SECRET,
    { expiresIn: `${LINK_TTL_DAYS}d` },
  );
  const params = new URLSearchParams({
    e: opts.expKey,
    v: opts.variant,
    c: opts.channel,
    t: token,
  });
  return `${TRACKING_BASE}/w?${params.toString()}`;
}

export function verifyTrackingToken(token: string): {
  userId: string;
  expKey: string;
  variant: string;
  channel: Channel;
} | null {
  try {
    const payload = jwt.verify(token, LINK_SECRET) as any;
    return { userId: payload.uid, expKey: payload.e, variant: payload.v, channel: payload.c };
  } catch {
    return null;
  }
}

// ── Hebrew SMS copy per trigger + variant ─────────────────────────────────────

function buildSmsText(
  trigger:   WinbackTrigger,
  variant:   WinbackVariant,
  creditIls: string,
  link:      string,
): string {
  const dayLabel: Record<WinbackTrigger, string> = {
    winback_14d: 'שבועיים',
    winback_30d: 'חודש',
    winback_60d: 'חודשיים',
  };
  const days = dayLabel[trigger];

  if (variant === 'v1') {
    // Urgency
    return `PetWash™: ₪${creditIls} קרדיט שלך פג בעוד 48 שעות ⏰ הזמן עכשיו לפני שיפוג → ${link}`;
  }
  if (variant === 'v2') {
    // Social proof
    return `PetWash™: אלפי בעלי חיות שבו החודש 🐾 ₪${creditIls} קרדיט ממתין לך → ${link}`;
  }
  // ctrl
  return `PetWash™: עברו ${days} מאז הביקור האחרון. ₪${creditIls} קרדיט מחכה לך → ${link}`;
}

// ── Daily send cap check ───────────────────────────────────────────────────────

export async function getChannelDailyCount(channel: 'sms' | 'whatsapp'): Promise<number> {
  const result = await db.execute<{ cnt: number }>(sql`
    SELECT count(*)::int AS cnt
    FROM experiment_events
    WHERE experiment_key LIKE 'winback_%'
      AND event          = 'notification_sent'
      AND channel        = ${channel}
      AND created_at    >= current_date
  `);
  return result.rows[0]?.cnt ?? 0;
}

// ── SMS send ──────────────────────────────────────────────────────────────────

export interface ChannelSendResult {
  sent:    boolean;
  channel: Channel;
  sid?:    string;
  reason?: string;
}

export async function sendWinbackSms(opts: {
  userId:    string;
  phone:     string;
  expKey:    string;
  trigger:   WinbackTrigger;
  variant:   WinbackVariant;
  creditIls: string;
}): Promise<ChannelSendResult> {
  const client = getTwilioClient();
  if (!client) {
    return { sent: false, channel: 'sms', reason: 'twilio_not_configured' };
  }

  const dailyCount = await getChannelDailyCount('sms');
  if (dailyCount >= MAX_SMS_PER_DAY) {
    logger.info('[WinbackChannel] SMS daily cap reached', { cap: MAX_SMS_PER_DAY, dailyCount });
    return { sent: false, channel: 'sms', reason: `daily_cap_${MAX_SMS_PER_DAY}` };
  }

  const link = buildTrackingLink({ userId: opts.userId, expKey: opts.expKey, variant: opts.variant, channel: 'sms' });
  const body = buildSmsText(opts.trigger, opts.variant, opts.creditIls, link);

  const from = getSmsSender();
  if (!from) {
    return { sent: false, channel: 'sms', reason: 'no_sender_configured' };
  }

  const toPhone = opts.phone.startsWith('+') ? opts.phone : `+${opts.phone.replace(/[^\d]/g, '')}`;

  try {
    const params: Parameters<typeof client.messages.create>[0] = from.startsWith('MG')
      ? { body, to: toPhone, messagingServiceSid: from }
      : { body, to: toPhone, from };

    const msg = await client.messages.create(params);
    logger.info('[WinbackChannel] SMS sent', { userId: opts.userId, expKey: opts.expKey, sid: msg.sid });
    return { sent: true, channel: 'sms', sid: msg.sid };
  } catch (err: any) {
    logger.error('[WinbackChannel] SMS send failed', { userId: opts.userId, error: err.message, code: err.code });
    return { sent: false, channel: 'sms', reason: err.message };
  }
}

// ── WhatsApp send ─────────────────────────────────────────────────────────────

export async function sendWinbackWhatsApp(opts: {
  userId:    string;
  phone:     string;
  expKey:    string;
  trigger:   WinbackTrigger;
  variant:   WinbackVariant;
  creditIls: string;
}): Promise<ChannelSendResult> {
  const client = getTwilioClient();
  if (!client) {
    return { sent: false, channel: 'whatsapp', reason: 'twilio_not_configured' };
  }

  const dailyCount = await getChannelDailyCount('whatsapp');
  if (dailyCount >= MAX_WHATSAPP_PER_DAY) {
    logger.info('[WinbackChannel] WhatsApp daily cap reached', { cap: MAX_WHATSAPP_PER_DAY, dailyCount });
    return { sent: false, channel: 'whatsapp', reason: `daily_cap_${MAX_WHATSAPP_PER_DAY}` };
  }

  const toRaw    = opts.phone.startsWith('+') ? opts.phone : `+${opts.phone.replace(/[^\d]/g, '')}`;
  const toWa     = `whatsapp:${toRaw}`;
  const link     = buildTrackingLink({ userId: opts.userId, expKey: opts.expKey, variant: opts.variant, channel: 'whatsapp' });
  const body     = buildSmsText(opts.trigger, opts.variant, opts.creditIls, link);

  try {
    const params: Parameters<typeof client.messages.create>[0] = WA_CONTENT_SID
      ? {
          contentSid: WA_CONTENT_SID,
          contentVariables: JSON.stringify({ '1': opts.creditIls, '2': link }),
          to: toWa,
          from: WA_FROM,
        }
      : { body, to: toWa, from: WA_FROM };

    const msg = await client.messages.create(params);
    logger.info('[WinbackChannel] WhatsApp sent', { userId: opts.userId, expKey: opts.expKey, sid: msg.sid });
    return { sent: true, channel: 'whatsapp', sid: msg.sid };
  } catch (err: any) {
    logger.error('[WinbackChannel] WhatsApp send failed', { userId: opts.userId, error: err.message, code: err.code });
    return { sent: false, channel: 'whatsapp', reason: err.message };
  }
}

/**
 * WINBACK PROCESSOR — Phase 6.13 (Revenue Optimization)
 *
 * Three-pass run:
 *   Pass 1 (INITIAL): Pending rows → award credit + send in-app notification,
 *                     schedule SMS/WhatsApp escalation via timing variant.
 *   Pass 2 (SMS ESC): Sent rows where sms_escalation_at <= now AND no 'opened' event.
 *   Pass 3 (WA ESC):  Sent rows where whatsapp_escalation_at <= now AND no 'clicked' event.
 *
 * Phase 6.13 additions:
 *   - True Control Group:       10% of users (hash % 10 === 0) receive NO winback.
 *   - Over-messaging Protection: Max 2 winbacks per user per 30 days (all triggers).
 *   - Smart Send Timing:        Defer send to 18:00–21:00 IL window if outside it.
 *   - Channel Escalation A/B:   3 timing variants (t0: 6h/24h, t1: 2h/12h, t2: 12h/36h).
 *   - Offer Sizing:             LTV-based credit multiplier (0.75× / 1.0× / 1.5×).
 */

import { db } from '../db';
import {
  users, loyaltyRules, experimentEvents, experimentDecisions, winbackQueue,
} from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { awardLoyaltyCredit } from '../utils/loyaltyLedger';
import { dispatchNotification } from '../lib/notificationDispatcher';
import { runExperimentDecisionJob } from './experiment-decision';
import {
  sendWinbackSms, sendWinbackWhatsApp,
  buildTrackingLink, Channel,
} from '../services/winbackChannel';

const BATCH_SIZE = 50;

type WinbackTrigger = 'winback_14d' | 'winback_30d' | 'winback_60d';
type Variant        = 'ctrl' | 'v1' | 'v2';

// ── Phase 6.13: Control group ─────────────────────────────────────────────────

/** Deterministic: 10% of users receive no winback to measure true incremental lift. */
function isControlGroup(userId: string): boolean {
  let h = 5381;
  for (const c of userId) h = ((h * 33) ^ c.charCodeAt(0)) & 0x7fffffff;
  return (h % 10) === 0;
}

// ── Phase 6.13: Channel timing variant (escalation A/B) ─────────────────────

const TIMING_VARIANTS = [
  { name: 't0', smsH: 6,  waH: 24 },  // baseline
  { name: 't1', smsH: 2,  waH: 12 },  // aggressive
  { name: 't2', smsH: 12, waH: 36 },  // patient
] as const;

function assignTimingVariant(userId: string) {
  let h = 0x811c9dc5;
  for (const c of userId) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
  return TIMING_VARIANTS[h % 3];
}

// ── Phase 6.13: Smart send timing ────────────────────────────────────────────

/**
 * Returns the next 18:00–21:00 Israel time window start (UTC+2, non-DST).
 * If current IL hour is already 18–20, returns now immediately.
 */
function nextOptimalSendAt(): Date | null {
  const now      = new Date();
  const ilOffset = 2; // UTC+2 standard (close enough for scheduling)
  const ilHour   = (now.getUTCHours() + ilOffset) % 24;

  if (ilHour >= 18 && ilHour < 21) return null; // already in window → send now

  const target = new Date(now);
  // Set to 18:00 IL (= 16:00 UTC)
  target.setUTCHours(16, 0, 0, 0);
  if (target <= now) target.setUTCDate(target.getUTCDate() + 1); // tomorrow 18:00 IL
  return target;
}

// ── Phase 6.13: LTV-based offer sizing ──────────────────────────────────────

async function getLtvMultiplier(userId: string): Promise<{ multiplier: number; ltv: number }> {
  try {
    const res = await db.execute<{ ltv: number }>(sql`
      SELECT COALESCE(SUM(CAST(total_amount AS numeric)), 0)::float AS ltv
      FROM booking_requests
      WHERE owner_id = ${userId}
        AND status IN ('completed','reviewed')
    `);
    const ltv = res.rows[0]?.ltv ?? 0;
    const multiplier = ltv >= 1000 ? 1.5 : ltv >= 200 ? 1.0 : 0.75;
    return { multiplier, ltv };
  } catch {
    return { multiplier: 1.0, ltv: 0 };
  }
}

// ── A/B variant assignment (deterministic hash) ───────────────────────────────

function assignVariant(userId: string): Variant {
  let hash = 0;
  for (const c of userId) hash = (hash * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return (['ctrl', 'v1', 'v2'] as Variant[])[hash % 3];
}

// ── Hebrew notification copy per tier + variant ───────────────────────────────

function buildNotifCopy(
  trigger:   WinbackTrigger,
  creditIls: string,
  firstName: string | null,
  variant:   Variant,
  trackLink: string,
) {
  const name = firstName ?? 'שלום';
  const dayLabel: Record<WinbackTrigger, string> = {
    winback_14d: 'שבועיים',
    winback_30d: 'חודש',
    winback_60d: 'חודשיים',
  };
  const days    = dayLabel[trigger];
  const ctaText = 'הזמן עכשיו';
  const ctaUrl  = trackLink;

  if (variant === 'v1') {
    return {
      title:    `${name}, הקרדיט שלך יפוג בעוד 48 שעות! ⏰`,
      bodyHtml: `<p>הוספנו לחשבונך <strong>₪${creditIls} קרדיט נאמנות</strong>.</p><p>הקרדיט תקף ל-48 שעות בלבד.</p>`,
      bodyText: `יש לך ₪${creditIls} קרדיט שיפוג בעוד 48 שעות — הזמן עכשיו.`,
      ctaText, ctaUrl,
    };
  }
  if (variant === 'v2') {
    return {
      title:    `${name}, ${days} לא ראינו אותך! 🐾`,
      bodyHtml: `<p>אלפי בעלי חיות מחמד שבו ל-PetWash™.</p><p>הוספנו <strong>₪${creditIls} קרדיט</strong>.</p>`,
      bodyText: `אלפי לקוחות שבו החודש — יש לך ₪${creditIls} קרדיט. הזמן עכשיו.`,
      ctaText, ctaUrl,
    };
  }
  return {
    title:    `${name}, התגעגענו אליך! 🐾`,
    bodyHtml: `<p>עברו ${days} מאז הביקור האחרון.</p><p>הוספנו <strong>₪${creditIls} קרדיט</strong>.</p>`,
    bodyText: `עברו ${days}. ₪${creditIls} קרדיט מחכה לך.`,
    ctaText, ctaUrl,
  };
}

// ── Shared guard helpers ───────────────────────────────────────────────────────

interface Guards {
  ruleMap:         Map<string, { armed: boolean; dailySendCap: number | null; enabled: boolean }>;
  decisionMap:     Map<string, { winnerVariant: string | null; promotedAt: Date | null; pausedVariants: string[] }>;
  recentSentSet:   Set<string>;   // sent within 14 days (frequency cap)
  winbacks30dMap:  Map<string, number>; // Phase 6.13: count of winbacks per user in last 30 days
  todaySent:       Map<string, number>;
  batchSent:       Map<string, number>;
}

async function loadGuards(): Promise<Guards> {
  const ruleRows = await db
    .select({
      ruleKey:     loyaltyRules.ruleKey,
      armed:       loyaltyRules.armed,
      dailySendCap: loyaltyRules.dailySendCap,
      enabled:     loyaltyRules.enabled,
    })
    .from(loyaltyRules);

  const decisionRows = await db.select().from(experimentDecisions);

  const todaySentRes = await db.execute<{ trigger: string; cnt: number }>(sql`
    SELECT trigger, count(*)::int AS cnt
    FROM winback_queue
    WHERE status = 'sent' AND sent_at >= current_date
    GROUP BY trigger
  `);

  const recentSent = await db.execute<{ user_id: string }>(sql`
    SELECT DISTINCT user_id FROM winback_queue
    WHERE status = 'sent' AND sent_at > now() - interval '14 days'
  `);

  // Phase 6.13: Over-messaging protection — count per user in last 30 days
  const recent30d = await db.execute<{ user_id: string; cnt: number }>(sql`
    SELECT user_id, count(*)::int AS cnt FROM winback_queue
    WHERE status IN ('sent','converted') AND sent_at > now() - interval '30 days'
    GROUP BY user_id
  `);

  return {
    ruleMap:        new Map(ruleRows.map(r => [r.ruleKey, r])),
    decisionMap:    new Map(decisionRows.map(d => [d.experimentKey, d])),
    todaySent:      new Map((todaySentRes.rows ?? []).map(r => [r.trigger, r.cnt])),
    batchSent:      new Map(),
    recentSentSet:  new Set((recentSent.rows ?? []).map(r => r.user_id)),
    winbacks30dMap: new Map((recent30d.rows ?? []).map(r => [r.user_id, r.cnt])),
  };
}

// ── PASS 1: Initial in-app send ───────────────────────────────────────────────

async function runInitialPass(guards: Guards): Promise<{ awarded: number; errors: number }> {
  const { ruleMap, decisionMap, recentSentSet, winbacks30dMap, todaySent, batchSent } = guards;

  const pendingRows = await db.execute<{
    id: number; user_id: string; trigger: WinbackTrigger;
    last_booking_at: Date | null; experiment_variant: string | null;
  }>(sql`
    SELECT id, user_id, trigger, last_booking_at, experiment_variant
    FROM winback_queue
    WHERE status = 'pending'
      AND scheduled_at <= now()
      AND paused_at IS NULL
    ORDER BY scheduled_at ASC
    LIMIT ${BATCH_SIZE}
  `);

  if (!pendingRows.rows?.length) {
    logger.info('[WinbackProcessor:P1] No pending entries');
    return { awarded: 0, errors: 0 };
  }

  let awarded = 0;
  let errors  = 0;

  for (const row of pendingRows.rows) {
    try {
      const { id: queueId, user_id: userId, trigger, last_booking_at, experiment_variant } = row;
      const expKey    = `winback_${trigger}` as const;
      const guardrail = ruleMap.get(trigger);
      const decision  = decisionMap.get(expKey);

      if (!guardrail?.armed) { continue; }

      // Phase 6.13: Daily send cap
      if (guardrail.dailySendCap != null) {
        const today = (todaySent.get(trigger) ?? 0) + (batchSent.get(trigger) ?? 0);
        if (today >= guardrail.dailySendCap) { continue; }
      }

      // Phase 6.13: True control group — skip 10% to measure incremental lift
      if (isControlGroup(userId)) {
        await db.execute(sql`UPDATE winback_queue SET status = 'suppressed', pause_reason = 'control_group' WHERE id = ${queueId}`);
        await db.insert(experimentEvents).values({
          experimentKey: expKey, userId, variant: 'ctrl', event: 'control_skip', channel: 'inapp',
        });
        logger.info('[WinbackProcessor:P1] Control group skip', { userId, queueId });
        continue;
      }

      // Phase 6.13: Over-messaging protection (max 2 per 30 days)
      const winbacks30d = winbacks30dMap.get(userId) ?? 0;
      if (winbacks30d >= 2) {
        await db.execute(sql`UPDATE winback_queue SET status = 'suppressed', pause_reason = 'over_messaged' WHERE id = ${queueId}`);
        logger.info('[WinbackProcessor:P1] Over-messaging skip', { userId, winbacks30d, queueId });
        continue;
      }

      // 14-day frequency cap
      if (recentSentSet.has(userId)) {
        await db.execute(sql`UPDATE winback_queue SET status = 'suppressed' WHERE id = ${queueId}`);
        continue;
      }

      // Phase 6.13: Smart send timing — defer to 18:00–21:00 IL window
      const deferTo = nextOptimalSendAt();
      if (deferTo) {
        await db.execute(sql`UPDATE winback_queue SET scheduled_at = ${deferTo.toISOString()} WHERE id = ${queueId}`);
        logger.info('[WinbackProcessor:P1] Deferred to optimal window', { userId, deferTo, queueId });
        continue;
      }

      // Variant assignment
      let variant: Variant;
      if (decision?.promotedAt && decision.winnerVariant) {
        variant = decision.winnerVariant as Variant;
      } else {
        variant = (experiment_variant as Variant | null) ?? assignVariant(userId);
      }

      const pausedVariants: string[] = decision?.pausedVariants ?? [];
      if (pausedVariants.includes(variant)) {
        await db.execute(sql`UPDATE winback_queue SET paused_at = now(), pause_reason = 'losing' WHERE id = ${queueId}`);
        continue;
      }

      if (!experiment_variant || experiment_variant !== variant) {
        await db.execute(sql`UPDATE winback_queue SET experiment_variant = ${variant} WHERE id = ${queueId}`);
      }

      // Dormancy check
      if (last_booking_at) {
        const newer = await db.execute<{ cnt: number }>(sql`
          SELECT count(*)::int AS cnt FROM booking_requests
          WHERE owner_id = ${userId} AND status IN ('completed','reviewed')
            AND updated_at > ${last_booking_at} LIMIT 1
        `);
        if ((newer.rows[0]?.cnt ?? 0) > 0) {
          await db.execute(sql`UPDATE winback_queue SET status = 'converted', converted_at = now() WHERE id = ${queueId}`);
          continue;
        }
      }

      const [rule] = await db.select().from(loyaltyRules).where(eq(loyaltyRules.ruleKey, trigger)).limit(1);
      if (!rule || !rule.enabled) {
        await db.execute(sql`UPDATE winback_queue SET status = 'suppressed' WHERE id = ${queueId}`);
        continue;
      }

      const [user] = await db
        .select({ id: users.id, email: users.email, phone: users.phone, firstName: users.firstName })
        .from(users).where(eq(users.id, userId)).limit(1);
      if (!user) continue;

      // Phase 6.13: Offer sizing — scale credit by LTV tier
      const { multiplier, ltv } = await getLtvMultiplier(userId);
      const rawCreditCents = Math.round(rule.rewardCents * multiplier);
      const creditIls      = (rawCreditCents / 100).toFixed(0);

      await awardLoyaltyCredit({ userId, ruleKey: trigger, fingerprint: `${trigger}:${userId}` });

      const trackLink = buildTrackingLink({ userId, expKey, variant, channel: 'inapp' });
      const copy      = buildNotifCopy(trigger, creditIls, user.firstName, variant, trackLink);

      await dispatchNotification({
        uid: userId, email: user.email ?? undefined, phone: user.phone ?? undefined,
        locale: 'he', type: 'voucher',
        title: copy.title, bodyHtml: copy.bodyHtml, bodyText: copy.bodyText,
        ctaText: copy.ctaText, ctaUrl: copy.ctaUrl, priority: 2,
        meta: { amount: rawCreditCents / 100, currency: 'ILS' },
        channels: ['inbox', 'email'],
      });

      // Phase 6.13: Timing variant for escalation delays
      const timing = assignTimingVariant(userId);
      await db.execute(sql`
        UPDATE winback_queue
        SET status = 'sent', sent_at = now(), experiment_variant = ${variant},
            sms_escalation_at      = now() + (${timing.smsH} || ' hours')::interval,
            whatsapp_escalation_at = now() + (${timing.waH}  || ' hours')::interval
        WHERE id = ${queueId}
      `);

      await db.insert(experimentEvents).values({
        experimentKey: expKey, userId, variant, event: 'notification_sent', channel: 'inapp',
      });

      awarded++;
      batchSent.set(trigger, (batchSent.get(trigger) ?? 0) + 1);
      logger.info('[WinbackProcessor:P1] Sent', { userId, trigger, variant, timing: timing.name, ltv: ltv.toFixed(0), multiplier, queueId });
    } catch (err: any) {
      errors++;
      logger.error('[WinbackProcessor:P1] Row error', { queueId: row.id, error: err.message });
    }
  }

  logger.info('[WinbackProcessor:P1] Complete', { awarded, errors });
  return { awarded, errors };
}

// ── PASS 2: SMS escalation ────────────────────────────────────────────────────

async function runSmsEscalationPass(): Promise<{ sent: number; skipped: number; errors: number }> {
  const escalationRows = await db.execute<{
    id: number; user_id: string; trigger: WinbackTrigger; experiment_variant: string;
  }>(sql`
    SELECT wq.id, wq.user_id, wq.trigger, wq.experiment_variant
    FROM winback_queue wq
    WHERE wq.status = 'sent'
      AND wq.sms_escalation_at IS NOT NULL
      AND wq.sms_escalation_at <= now()
      AND wq.sms_sent_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM experiment_events ee
        WHERE ee.experiment_key = 'winback_' || wq.trigger
          AND ee.user_id        = wq.user_id
          AND ee.event          = 'opened'
      )
    ORDER BY wq.sms_escalation_at ASC
    LIMIT ${BATCH_SIZE}
  `);

  if (!escalationRows.rows?.length) {
    logger.info('[WinbackProcessor:P2-SMS] No rows ready for SMS escalation');
    return { sent: 0, skipped: 0, errors: 0 };
  }

  let sent = 0; let skipped = 0; let errors = 0;

  for (const row of escalationRows.rows) {
    try {
      const { id: queueId, user_id: userId, trigger, experiment_variant: variant } = row;
      const expKey = `winback_${trigger}` as const;

      const [user] = await db
        .select({ phone: users.phone, firstName: users.firstName })
        .from(users).where(eq(users.id, userId)).limit(1);

      if (!user?.phone) { skipped++; continue; }

      const [rule] = await db.select({ rewardCents: loyaltyRules.rewardCents })
        .from(loyaltyRules).where(eq(loyaltyRules.ruleKey, trigger)).limit(1);

      const { multiplier } = await getLtvMultiplier(userId);
      const creditIls = rule ? ((Math.round(rule.rewardCents * multiplier)) / 100).toFixed(0) : '10';

      const result = await sendWinbackSms({
        userId, phone: user.phone, expKey, trigger,
        variant: (variant as Variant) ?? 'ctrl', creditIls,
      });

      if (result.sent) {
        await db.execute(sql`
          UPDATE winback_queue SET sms_sent_at = now() WHERE id = ${queueId}
        `);
        await db.insert(experimentEvents).values({
          experimentKey: expKey, userId, variant: variant ?? 'ctrl',
          event: 'notification_sent', channel: 'sms',
        });
        sent++;
        logger.info('[WinbackProcessor:P2-SMS] SMS escalation sent', { userId, expKey, queueId });
      } else {
        skipped++;
        logger.info('[WinbackProcessor:P2-SMS] SMS skipped', { userId, reason: result.reason });
      }
    } catch (err: any) {
      errors++;
      logger.error('[WinbackProcessor:P2-SMS] Row error', { queueId: row.id, error: err.message });
    }
  }

  logger.info('[WinbackProcessor:P2-SMS] Complete', { sent, skipped, errors });
  return { sent, skipped, errors };
}

// ── PASS 3: WhatsApp escalation ───────────────────────────────────────────────

async function runWhatsAppEscalationPass(): Promise<{ sent: number; skipped: number; errors: number }> {
  const escalationRows = await db.execute<{
    id: number; user_id: string; trigger: WinbackTrigger; experiment_variant: string;
  }>(sql`
    SELECT wq.id, wq.user_id, wq.trigger, wq.experiment_variant
    FROM winback_queue wq
    WHERE wq.status = 'sent'
      AND wq.whatsapp_escalation_at IS NOT NULL
      AND wq.whatsapp_escalation_at <= now()
      AND wq.whatsapp_sent_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM experiment_events ee
        WHERE ee.experiment_key = 'winback_' || wq.trigger
          AND ee.user_id        = wq.user_id
          AND ee.event          = 'clicked'
      )
    ORDER BY wq.whatsapp_escalation_at ASC
    LIMIT ${BATCH_SIZE}
  `);

  if (!escalationRows.rows?.length) {
    logger.info('[WinbackProcessor:P3-WA] No rows ready for WhatsApp escalation');
    return { sent: 0, skipped: 0, errors: 0 };
  }

  let sent = 0; let skipped = 0; let errors = 0;

  for (const row of escalationRows.rows) {
    try {
      const { id: queueId, user_id: userId, trigger, experiment_variant: variant } = row;
      const expKey = `winback_${trigger}` as const;

      const [user] = await db
        .select({ phone: users.phone })
        .from(users).where(eq(users.id, userId)).limit(1);

      if (!user?.phone) { skipped++; continue; }

      const [rule] = await db.select({ rewardCents: loyaltyRules.rewardCents })
        .from(loyaltyRules).where(eq(loyaltyRules.ruleKey, trigger)).limit(1);

      const { multiplier } = await getLtvMultiplier(userId);
      const creditIls = rule ? ((Math.round(rule.rewardCents * multiplier)) / 100).toFixed(0) : '10';

      const result = await sendWinbackWhatsApp({
        userId, phone: user.phone, expKey, trigger,
        variant: (variant as Variant) ?? 'ctrl', creditIls,
      });

      if (result.sent) {
        await db.execute(sql`
          UPDATE winback_queue SET whatsapp_sent_at = now() WHERE id = ${queueId}
        `);
        await db.insert(experimentEvents).values({
          experimentKey: expKey, userId, variant: variant ?? 'ctrl',
          event: 'notification_sent', channel: 'whatsapp',
        });
        sent++;
        logger.info('[WinbackProcessor:P3-WA] WhatsApp escalation sent', { userId, expKey, queueId });
      } else {
        skipped++;
        logger.info('[WinbackProcessor:P3-WA] WhatsApp skipped', { userId, reason: result.reason });
      }
    } catch (err: any) {
      errors++;
      logger.error('[WinbackProcessor:P3-WA] Row error', { queueId: row.id, error: err.message });
    }
  }

  logger.info('[WinbackProcessor:P3-WA] Complete', { sent, skipped, errors });
  return { sent, skipped, errors };
}

// ── Phase 6.14: Channel ROI calculation ──────────────────────────────────────
//
// Queries the last 14 days of experiment_events to estimate ROI per paid channel.
// ROI% = ( completions × AVG_BOOKING_VALUE_ILS − sends × CHANNEL_COST_ILS )
//        / ( sends × CHANNEL_COST_ILS ) × 100
//
// Conservative cost/revenue constants — update if Twilio pricing changes:
const AVG_BOOKING_VALUE_ILS = 100;   // ₪100 avg booking value attributed to winback
const SMS_COST_ILS          = 0.03;  // ₪0.03 per SMS (≈ $0.0075 at 4 ILS/USD)
const WHATSAPP_COST_ILS     = 0.02;  // ₪0.02 per WhatsApp message

interface ChannelRoi { roi: number | null; sent: number; completed: number }

async function loadChannelRoi(): Promise<Map<'sms' | 'whatsapp', ChannelRoi>> {
  const rows = await db.execute<{ channel: string; sent: string; completed: string }>(sql`
    SELECT
      ee.channel,
      COUNT(*)  FILTER (WHERE ee.event = 'notification_sent') AS sent,
      COUNT(*)  FILTER (WHERE ee.event = 'completed')         AS completed
    FROM experiment_events ee
    WHERE ee.created_at > now() - interval '14 days'
      AND ee.channel IN ('sms', 'whatsapp')
    GROUP BY ee.channel
  `);

  const result = new Map<'sms' | 'whatsapp', ChannelRoi>();

  for (const row of rows.rows ?? []) {
    const ch        = row.channel as 'sms' | 'whatsapp';
    const sent      = parseInt(row.sent, 10)      || 0;
    const completed = parseInt(row.completed, 10) || 0;
    const costIls   = ch === 'sms' ? SMS_COST_ILS : WHATSAPP_COST_ILS;

    if (sent === 0) {
      result.set(ch, { roi: null, sent: 0, completed: 0 });
      continue;
    }

    const revenuIls = completed * AVG_BOOKING_VALUE_ILS;
    const costTotal = sent * costIls;
    const roi       = ((revenuIls - costTotal) / costTotal) * 100;
    result.set(ch, { roi, sent, completed });
  }

  // Ensure both channels have an entry
  if (!result.has('sms'))      result.set('sms',      { roi: null, sent: 0, completed: 0 });
  if (!result.has('whatsapp')) result.set('whatsapp', { roi: null, sent: 0, completed: 0 });

  return result;
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function runWinbackProcessor(): Promise<void> {
  logger.info('[WinbackProcessor] Starting multi-channel run (Phase 6.14)');

  const [guards, channelRoi] = await Promise.all([
    loadGuards(),
    loadChannelRoi(),
  ]);

  // Phase 6.14: ROI floor — skip paid channels when return is negative.
  // null ROI (no data yet) means we allow the channel (don't cut with no evidence).
  const smsRoi = channelRoi.get('sms')!;
  const waRoi  = channelRoi.get('whatsapp')!;

  const runSms = smsRoi.roi === null || smsRoi.roi >= 0;
  const runWa  = waRoi.roi  === null || waRoi.roi  >= 0;

  if (!runSms) {
    logger.warn('[WinbackProcessor] Skipping SMS pass — ROI below floor (ROI_FLOOR_PCT=0%)', {
      smsRoi: smsRoi.roi?.toFixed(1), sent: smsRoi.sent, completed: smsRoi.completed,
    });
  }
  if (!runWa) {
    logger.warn('[WinbackProcessor] Skipping WhatsApp pass — ROI below floor (ROI_FLOOR_PCT=0%)', {
      waRoi: waRoi.roi?.toFixed(1), sent: waRoi.sent, completed: waRoi.completed,
    });
  }

  // Phase 6.14: Budget-aware ordering — when both paid channels are eligible,
  // run the higher-ROI channel first so it exhausts its eligible rows before the lower-ROI one.
  // (Passes operate on different queue rows so sequential ordering, not parallel, is intentional.)
  const paidPasses: Array<() => Promise<{ sent: number; skipped: number; errors: number }>> = [];

  if (runSms && runWa) {
    // Sort by ROI descending (null = no data → treat as 0 for ordering)
    const smsFirst = (smsRoi.roi ?? 0) >= (waRoi.roi ?? 0);
    if (smsFirst) {
      paidPasses.push(runSmsEscalationPass, runWhatsAppEscalationPass);
    } else {
      paidPasses.push(runWhatsAppEscalationPass, runSmsEscalationPass);
    }
    logger.info('[WinbackProcessor] ROI-ordered paid passes', {
      order: smsFirst ? ['sms', 'whatsapp'] : ['whatsapp', 'sms'],
      smsRoi: smsRoi.roi?.toFixed(1) ?? 'null', waRoi: waRoi.roi?.toFixed(1) ?? 'null',
    });
  } else {
    if (runSms) paidPasses.push(runSmsEscalationPass);
    if (runWa)  paidPasses.push(runWhatsAppEscalationPass);
  }

  // Run in-app pass + (ordered) paid escalation passes
  const p1 = await runInitialPass(guards);

  // Run paid passes in ROI-priority order (sequential to respect ordering intent)
  let p2: { sent: number; skipped: number; errors: number } = { sent: 0, skipped: 0, errors: 0 };
  let p3: { sent: number; skipped: number; errors: number } = { sent: 0, skipped: 0, errors: 0 };

  for (const passFn of paidPasses) {
    const r = await passFn();
    // Assign results back to p2/p3 for logging (first paid = p2, second = p3)
    if (p2.sent === 0 && p2.errors === 0 && p2.skipped === 0 && r.sent + r.errors + r.skipped > 0) {
      p2 = r;
    } else {
      p3 = r;
    }
  }

  const totalErrors  = p1.errors + p2.errors + p3.errors;

  logger.info('[WinbackProcessor] Run complete', {
    inApp:    { awarded: p1.awarded, errors: p1.errors },
    sms:      runSms ? { sent: p2.sent, skipped: p2.skipped, errors: p2.errors } : 'skipped(ROI)',
    whatsapp: runWa  ? { sent: p3.sent, skipped: p3.skipped, errors: p3.errors } : 'skipped(ROI)',
    totalErrors,
    channelRoi: {
      sms:      `${smsRoi.roi?.toFixed(1) ?? 'null'}% (${smsRoi.sent} sent, ${smsRoi.completed} completed)`,
      whatsapp: `${waRoi.roi?.toFixed(1)  ?? 'null'}% (${waRoi.sent}  sent, ${waRoi.completed}  completed)`,
    },
  });

  if (p1.awarded > 0) {
    runExperimentDecisionJob().catch(err =>
      logger.warn('[WinbackProcessor] Decision job error (non-blocking)', { error: err.message }),
    );
  }
}

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

// ── Phase 6.15: Emergency paid-channel kill switch ───────────────────────────
//
// When a loyalty_rules row with ruleKey = 'winback_paid_kill' has enabled = true,
// ALL paid escalation passes (SMS + WhatsApp) are immediately halted.
// The row is created / toggled via POST /api/admin/loyalty/paid-channel-kill-switch.
// This is a hard stop — no ROI check, no ordering — just a blanket bypass.

export const PAID_KILL_SWITCH_RULE = 'winback_paid_kill' as const;

async function isPaidKillSwitchActive(): Promise<boolean> {
  try {
    const [row] = await db
      .select({ enabled: loyaltyRules.enabled })
      .from(loyaltyRules)
      .where(eq(loyaltyRules.ruleKey, PAID_KILL_SWITCH_RULE))
      .limit(1);
    return row?.enabled ?? false;
  } catch {
    return false; // fail open (don't kill paid channels on DB error)
  }
}

// ── Phase 6.15: Queue health checks ──────────────────────────────────────────

export interface QueueHealthCheck {
  name:      string;
  status:    'ok' | 'warn' | 'critical';
  message:   string;
  detail?:   Record<string, unknown>;
}

export interface QueueHealthReport {
  checks:          QueueHealthCheck[];
  generatedAt:     string;
  autoPromotedToday: number;
  pausedToday:     number;
}

const STUCK_PENDING_HOURS   = 6;    // pending row older than this = stuck
const HIGH_PAUSED_RATIO     = 0.40; // 40%+ paused rows = alert
const ZERO_CONV_MIN_SENDS   = 100;  // sends threshold before we flag zero completions
const ROI_COLLAPSE_THRESHOLD = 30;  // drop of 30+ pct-points vs prior 7d = collapse

export async function loadQueueHealth(): Promise<QueueHealthReport> {
  const checks: QueueHealthCheck[] = [];

  // ─ 1. Stuck pending rows ─────────────────────────────────────────
  const stuckRes = await db.execute<{ trigger: string; cnt: string }>(sql`
    SELECT trigger, COUNT(*)::text AS cnt
    FROM winback_queue
    WHERE status = 'pending'
      AND scheduled_at < now() - (${STUCK_PENDING_HOURS} || ' hours')::interval
    GROUP BY trigger
  `);
  const stuckRows = stuckRes.rows ?? [];
  const totalStuck = stuckRows.reduce((s, r) => s + parseInt(r.cnt, 10), 0);

  checks.push(
    totalStuck === 0
      ? { name: 'stuck_pending', status: 'ok',      message: 'אין שורות pending תקועות' }
      : totalStuck <= 10
        ? { name: 'stuck_pending', status: 'warn',   message: `${totalStuck} שורות pending תקועות מעל ${STUCK_PENDING_HOURS}ש'`,     detail: Object.fromEntries(stuckRows.map(r => [r.trigger, r.cnt])) }
        : { name: 'stuck_pending', status: 'critical', message: `${totalStuck} שורות pending תקועות — ייתכן תקלה ב-cron`,            detail: Object.fromEntries(stuckRows.map(r => [r.trigger, r.cnt])) },
  );

  // ─ 2. High paused ratio ─────────────────────────────────────────
  const ratioRes = await db.execute<{ trigger: string; total: string; paused: string }>(sql`
    SELECT trigger,
      COUNT(*)::text AS total,
      COUNT(*) FILTER (WHERE paused_at IS NOT NULL)::text AS paused
    FROM winback_queue
    WHERE status != 'converted'
    GROUP BY trigger
  `);
  const highPaused = (ratioRes.rows ?? []).filter(r => {
    const total  = parseInt(r.total,  10);
    const paused = parseInt(r.paused, 10);
    return total > 0 && (paused / total) > HIGH_PAUSED_RATIO;
  });

  checks.push(
    highPaused.length === 0
      ? { name: 'paused_ratio', status: 'ok',   message: 'יחס השהיות תקין' }
      : { name: 'paused_ratio', status: 'warn', message: `טריגרים עם > ${HIGH_PAUSED_RATIO * 100}% שהייה: ${highPaused.map(r => r.trigger).join(', ')}`,
          detail: Object.fromEntries(highPaused.map(r => [r.trigger, `${r.paused}/${r.total}`])) },
  );

  // ─ 3. Zero completions after enough sends ───────────────────────
  const convRes = await db.execute<{ experiment_key: string; sent: string; completed: string }>(sql`
    SELECT
      experiment_key,
      COUNT(*) FILTER (WHERE event = 'notification_sent')::text AS sent,
      COUNT(*) FILTER (WHERE event = 'completed')::text         AS completed
    FROM experiment_events
    WHERE created_at > now() - interval '7 days'
    GROUP BY experiment_key
    HAVING COUNT(*) FILTER (WHERE event = 'notification_sent') >= ${ZERO_CONV_MIN_SENDS}
       AND COUNT(*) FILTER (WHERE event = 'completed') = 0
  `);
  const zeroConvKeys = (convRes.rows ?? []).map(r => r.experiment_key);

  checks.push(
    zeroConvKeys.length === 0
      ? { name: 'zero_completions', status: 'ok',       message: 'כל הניסויים הפעילים מראים המרות' }
      : { name: 'zero_completions', status: 'critical', message: `0 המרות לאחר >= ${ZERO_CONV_MIN_SENDS} שליחות ב-7 ימים: ${zeroConvKeys.join(', ')}` },
  );

  // ─ 4. ROI collapse (7d vs prior 7d) ─────────────────────────────
  const roiRes = await db.execute<{
    channel:     string;
    sent_cur:    string; completed_cur:  string;
    sent_prior:  string; completed_prior: string;
  }>(sql`
    SELECT channel,
      COUNT(*) FILTER (WHERE event='notification_sent' AND created_at > now() - interval '7 days')::text  AS sent_cur,
      COUNT(*) FILTER (WHERE event='completed'         AND created_at > now() - interval '7 days')::text  AS completed_cur,
      COUNT(*) FILTER (WHERE event='notification_sent' AND created_at BETWEEN now() - interval '14 days' AND now() - interval '7 days')::text AS sent_prior,
      COUNT(*) FILTER (WHERE event='completed'         AND created_at BETWEEN now() - interval '14 days' AND now() - interval '7 days')::text AS completed_prior
    FROM experiment_events
    WHERE channel IN ('sms','whatsapp')
    GROUP BY channel
  `);

  const roiCollapseChannels: string[] = [];
  for (const r of roiRes.rows ?? []) {
    const sentCur    = parseInt(r.sent_cur,    10) || 0;
    const compCur    = parseInt(r.completed_cur, 10) || 0;
    const sentPrior  = parseInt(r.sent_prior,  10) || 0;
    const compPrior  = parseInt(r.completed_prior, 10) || 0;
    if (sentCur < 20 || sentPrior < 20) continue; // not enough data
    const roiCur   = (compCur   / sentCur)   * 100;
    const roiPrior = (compPrior / sentPrior) * 100;
    if ((roiPrior - roiCur) >= ROI_COLLAPSE_THRESHOLD) roiCollapseChannels.push(r.channel);
  }

  checks.push(
    roiCollapseChannels.length === 0
      ? { name: 'roi_collapse', status: 'ok',   message: 'אין ירידת ROI חדה' }
      : { name: 'roi_collapse', status: 'warn', message: `ירידת המרה חדה ב: ${roiCollapseChannels.join(', ')} — בדוק טריגרים ו-copy` },
  );

  // ─ 5. Daily ops indicators ──────────────────────────────────────
  const [apRes, ppRes] = await Promise.all([
    db.execute<{ cnt: string }>(sql`
      SELECT COUNT(*)::text AS cnt FROM experiment_decisions
      WHERE promoted_at >= current_date AND decided_by = 'auto-promote'
    `),
    db.execute<{ cnt: string }>(sql`
      SELECT COUNT(*)::text AS cnt FROM winback_queue
      WHERE paused_at >= current_date
    `),
  ]);

  const autoPromotedToday = parseInt(apRes.rows?.[0]?.cnt ?? '0', 10);
  const pausedToday       = parseInt(ppRes.rows?.[0]?.cnt ?? '0', 10);

  return { checks, generatedAt: new Date().toISOString(), autoPromotedToday, pausedToday };
}

// ── Phase 6.15: Channel ROI detail (admin-facing) ─────────────────────────────

export interface ChannelRoiDetail {
  channel:       'sms' | 'whatsapp';
  sent24h:       number; completed24h: number; roi24h: number | null;
  sent7d:        number; completed7d:  number; roi7d:  number | null;
  costIls24h:    number;
  revenueIls24h: number;
  costIls7d:     number;
  revenueIls7d:  number;
}

export async function getChannelRoiDetail(): Promise<ChannelRoiDetail[]> {
  const res = await db.execute<{
    channel:         string;
    sent_24h:        string; completed_24h: string;
    sent_7d:         string; completed_7d:  string;
  }>(sql`
    SELECT
      channel,
      COUNT(*) FILTER (WHERE event='notification_sent' AND created_at > now() - interval '24 hours')::text AS sent_24h,
      COUNT(*) FILTER (WHERE event='completed'         AND created_at > now() - interval '24 hours')::text AS completed_24h,
      COUNT(*) FILTER (WHERE event='notification_sent' AND created_at > now() - interval '7 days')::text   AS sent_7d,
      COUNT(*) FILTER (WHERE event='completed'         AND created_at > now() - interval '7 days')::text   AS completed_7d
    FROM experiment_events
    WHERE channel IN ('sms','whatsapp')
    GROUP BY channel
  `);

  const COST: Record<'sms' | 'whatsapp', number> = { sms: SMS_COST_ILS, whatsapp: WHATSAPP_COST_ILS };

  return (['sms', 'whatsapp'] as const).map(ch => {
    const row         = (res.rows ?? []).find(r => r.channel === ch);
    const sent24h     = parseInt(row?.sent_24h        ?? '0', 10);
    const comp24h     = parseInt(row?.completed_24h   ?? '0', 10);
    const sent7d      = parseInt(row?.sent_7d         ?? '0', 10);
    const comp7d      = parseInt(row?.completed_7d    ?? '0', 10);
    const costPer     = COST[ch];
    const rev24h      = comp24h  * AVG_BOOKING_VALUE_ILS;
    const cost24h     = sent24h  * costPer;
    const rev7d       = comp7d   * AVG_BOOKING_VALUE_ILS;
    const cost7d      = sent7d   * costPer;
    return {
      channel:       ch,
      sent24h, completed24h: comp24h,
      roi24h:   sent24h === 0 ? null : ((rev24h  - cost24h)  / Math.max(cost24h,  0.001)) * 100,
      sent7d,  completed7d: comp7d,
      roi7d:    sent7d  === 0 ? null : ((rev7d   - cost7d)   / Math.max(cost7d,   0.001)) * 100,
      costIls24h: cost24h, revenueIls24h: rev24h,
      costIls7d:  cost7d,  revenueIls7d:  rev7d,
    };
  });
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
  logger.info('[WinbackProcessor] Starting multi-channel run (Phase 6.15)');

  const [guards, channelRoi, killSwitchOn] = await Promise.all([
    loadGuards(),
    loadChannelRoi(),
    isPaidKillSwitchActive(),
  ]);

  // Phase 6.15: Emergency kill switch — hard stop all paid channels immediately.
  if (killSwitchOn) {
    logger.warn('[WinbackProcessor] ⚠️ PAID CHANNEL KILL SWITCH IS ACTIVE — skipping all SMS + WhatsApp passes');
    const p1 = await runInitialPass(guards);
    logger.info('[WinbackProcessor] Run complete (kill switch mode)', {
      inApp: { awarded: p1.awarded, errors: p1.errors },
      sms: 'KILLED', whatsapp: 'KILLED',
    });
    if (p1.awarded > 0) {
      runExperimentDecisionJob().catch(err =>
        logger.warn('[WinbackProcessor] Decision job error (non-blocking)', { error: err.message }),
      );
    }
    return;
  }

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

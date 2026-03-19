/**
 * WINBACK PROCESSOR — Phase 6.12 (Multi-channel)
 *
 * Three-pass run:
 *   Pass 1 (INITIAL): Pending rows → award credit + send in-app notification,
 *                     schedule SMS escalation at sentAt + 6h.
 *   Pass 2 (SMS ESC): Sent rows where sms_escalation_at <= now AND user has
 *                     not opened → send SMS via Twilio.
 *   Pass 3 (WA ESC):  Sent rows where whatsapp_escalation_at <= now AND user
 *                     has not clicked → send WhatsApp via Twilio.
 *
 * All three passes respect the same guardrails:
 *   - armed flag       (rule must be explicitly armed)
 *   - daily send cap   (per-trigger in-app cap from loyalty_rules)
 *   - frequency cap    (14-day global per-user)
 *   - paused variants  (from experiment_decisions)
 *   - winner override  (promoted variant replaces hash assignment)
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

const BATCH_SIZE          = 50;
const SMS_DELAY_HOURS     = 6;
const WHATSAPP_DELAY_HOURS = 24;

type WinbackTrigger = 'winback_14d' | 'winback_30d' | 'winback_60d';
type Variant        = 'ctrl' | 'v1' | 'v2';

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
  const ctaUrl  = trackLink; // tracked link replaces static URL

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
  // ctrl
  return {
    title:    `${name}, התגעגענו אליך! 🐾`,
    bodyHtml: `<p>עברו ${days} מאז הביקור האחרון.</p><p>הוספנו <strong>₪${creditIls} קרדיט</strong>.</p>`,
    bodyText: `עברו ${days}. ₪${creditIls} קרדיט מחכה לך.`,
    ctaText, ctaUrl,
  };
}

// ── Shared guard helpers ───────────────────────────────────────────────────────

interface Guards {
  ruleMap:       Map<string, { armed: boolean; dailySendCap: number | null; enabled: boolean }>;
  decisionMap:   Map<string, { winnerVariant: string | null; promotedAt: Date | null; pausedVariants: string[] }>;
  recentSentSet: Set<string>;
  todaySent:     Map<string, number>;
  batchSent:     Map<string, number>;
}

async function loadGuards(): Promise<Guards> {
  const ruleRows = await db
    .select({ ruleKey: loyaltyRules.ruleKey, armed: loyaltyRules.armed, dailySendCap: loyaltyRules.dailySendCap, enabled: loyaltyRules.enabled })
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

  return {
    ruleMap:       new Map(ruleRows.map(r => [r.ruleKey, r])),
    decisionMap:   new Map(decisionRows.map(d => [d.experimentKey, d])),
    todaySent:     new Map((todaySentRes.rows ?? []).map(r => [r.trigger, r.cnt])),
    batchSent:     new Map(),
    recentSentSet: new Set((recentSent.rows ?? []).map(r => r.user_id)),
  };
}

// ── PASS 1: Initial in-app send ───────────────────────────────────────────────

async function runInitialPass(guards: Guards): Promise<{ awarded: number; errors: number }> {
  const { ruleMap, decisionMap, recentSentSet, todaySent, batchSent } = guards;

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

      if (guardrail.dailySendCap != null) {
        const today = (todaySent.get(trigger) ?? 0) + (batchSent.get(trigger) ?? 0);
        if (today >= guardrail.dailySendCap) { continue; }
      }

      if (recentSentSet.has(userId)) {
        await db.execute(sql`UPDATE winback_queue SET status = 'suppressed' WHERE id = ${queueId}`);
        continue;
      }

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

      await awardLoyaltyCredit({ userId, ruleKey: trigger, fingerprint: `${trigger}:${userId}` });

      const creditIls  = (rule.rewardCents / 100).toFixed(0);
      const trackLink  = buildTrackingLink({ userId, expKey, variant, channel: 'inapp' });
      const copy       = buildNotifCopy(trigger, creditIls, user.firstName, variant, trackLink);

      await dispatchNotification({
        uid: userId, email: user.email ?? undefined, phone: user.phone ?? undefined,
        locale: 'he', type: 'voucher',
        title: copy.title, bodyHtml: copy.bodyHtml, bodyText: copy.bodyText,
        ctaText: copy.ctaText, ctaUrl: copy.ctaUrl, priority: 2,
        meta: { amount: rule.rewardCents / 100, currency: 'ILS' },
        channels: ['inbox', 'email'],
      });

      // Schedule SMS escalation 6h from now
      await db.execute(sql`
        UPDATE winback_queue
        SET status = 'sent', sent_at = now(), experiment_variant = ${variant},
            sms_escalation_at = now() + interval '${sql.raw(String(SMS_DELAY_HOURS))} hours'
        WHERE id = ${queueId}
      `);

      await db.insert(experimentEvents).values({
        experimentKey: expKey, userId, variant, event: 'notification_sent', channel: 'inapp',
      });

      awarded++;
      batchSent.set(trigger, (batchSent.get(trigger) ?? 0) + 1);
      logger.info('[WinbackProcessor:P1] Sent', { userId, trigger, variant, queueId });
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
      -- No 'opened' event recorded for this user + experiment
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

      const creditIls = rule ? (rule.rewardCents / 100).toFixed(0) : '10';

      const result = await sendWinbackSms({
        userId, phone: user.phone, expKey, trigger,
        variant: (variant as Variant) ?? 'ctrl', creditIls,
      });

      if (result.sent) {
        await db.execute(sql`
          UPDATE winback_queue
          SET sms_sent_at = now(),
              whatsapp_escalation_at = now() + interval '${sql.raw(String(WHATSAPP_DELAY_HOURS))} hours'
          WHERE id = ${queueId}
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
        // Still schedule WhatsApp regardless of SMS failure
        await db.execute(sql`
          UPDATE winback_queue
          SET whatsapp_escalation_at = now() + interval '${sql.raw(String(WHATSAPP_DELAY_HOURS))} hours'
          WHERE id = ${queueId} AND whatsapp_escalation_at IS NULL
        `);
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
      -- No 'clicked' event recorded for this user + experiment
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

      const creditIls = rule ? (rule.rewardCents / 100).toFixed(0) : '10';

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

// ── Main entry point ──────────────────────────────────────────────────────────

export async function runWinbackProcessor(): Promise<void> {
  logger.info('[WinbackProcessor] Starting multi-channel run');

  const guards = await loadGuards();

  const [p1, p2, p3] = await Promise.all([
    runInitialPass(guards),
    runSmsEscalationPass(),
    runWhatsAppEscalationPass(),
  ]);

  const totalAwarded = p1.awarded;
  const totalErrors  = p1.errors + p2.errors + p3.errors;

  logger.info('[WinbackProcessor] Run complete', {
    inApp:    { awarded: p1.awarded, errors: p1.errors },
    sms:      { sent: p2.sent, skipped: p2.skipped, errors: p2.errors },
    whatsapp: { sent: p3.sent, skipped: p3.skipped, errors: p3.errors },
    totalErrors,
  });

  if (totalAwarded > 0) {
    runExperimentDecisionJob().catch(err =>
      logger.warn('[WinbackProcessor] Decision job error (non-blocking)', { error: err.message }),
    );
  }
}

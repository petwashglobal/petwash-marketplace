/**
 * WINBACK PROCESSOR
 *
 * Runs nightly after the populator. Picks up pending winback_queue rows,
 * awards the matching loyalty credit, and dispatches a Hebrew in-app
 * (+ email) notification to re-engage the dormant pet owner.
 *
 * Processing order per entry:
 *   1. Verify user is still dormant (no newer completed booking since queued)
 *   2. Look up credit amount from loyalty_rules (must be enabled)
 *   3. Award credit via awardLoyaltyCredit (idempotent)
 *   4. Dispatch notification via dispatchNotification
 *   5. Mark winback_queue.status = 'sent', sent_at = now()
 *
 * Errors per row are logged and do not abort the batch.
 */

import { db } from '../db';
import { users, loyaltyRules, experimentEvents, experimentDecisions, winbackQueue } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { awardLoyaltyCredit } from '../utils/loyaltyLedger';
import { dispatchNotification } from '../lib/notificationDispatcher';
import { runExperimentDecisionJob } from './experiment-decision';

const BATCH_SIZE = 50;

type WinbackTrigger = 'winback_14d' | 'winback_30d' | 'winback_60d';
type Variant = 'ctrl' | 'v1' | 'v2';

// ── A/B Variant Assignment ────────────────────────────────────────────────────
// Deterministic hash so the same user always gets the same variant.
// ctrl  → baseline copy (control group)
// v1    → urgency framing ("offer expires in 48 hours")
// v2    → social proof framing ("join X owners who returned this week")

function assignVariant(userId: string): Variant {
  let hash = 0;
  for (const c of userId) hash = (hash * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return (['ctrl', 'v1', 'v2'] as Variant[])[hash % 3];
}

// ── Hebrew notification copy per tier + variant ───────────────────────────────

function buildNotifCopy(
  trigger: WinbackTrigger,
  creditIls: string,
  firstName: string | null,
  variant: Variant,
) {
  const name = firstName ?? 'שלום';

  const dayLabel: Record<WinbackTrigger, string> = {
    winback_14d: 'שבועיים',
    winback_30d: 'חודש',
    winback_60d: 'חודשיים',
  };
  const days = dayLabel[trigger];

  // Shared base
  const ctaText = 'הזמן עכשיו';
  const ctaUrl  = 'https://petwash.co.il/marketplace';

  if (variant === 'v1') {
    // Urgency variant — emphasise 48-hour expiry
    return {
      title:    `${name}, הקרדיט שלך יפוג בעוד 48 שעות! ⏰`,
      bodyHtml: `
        <p>הוספנו לחשבונך <strong>₪${creditIls} קרדיט נאמנות</strong>.</p>
        <p>הקרדיט תקף ל-48 שעות בלבד — השתמש בו עכשיו לפני שיפוג.</p>
      `,
      bodyText: `יש לך ₪${creditIls} קרדיט שיפוג בעוד 48 שעות — הזמן עכשיו.`,
      ctaText,
      ctaUrl,
    };
  }

  if (variant === 'v2') {
    // Social proof variant
    return {
      title:    `${name}, ${days} לא ראינו אותך! 🐾`,
      bodyHtml: `
        <p>אלפי בעלי חיות מחמד שבו ל-PetWash™ החודש.</p>
        <p>הוספנו לחשבונך <strong>₪${creditIls} קרדיט נאמנות</strong> כדי שתוכל לחזור בקלות.</p>
      `,
      bodyText: `אלפי לקוחות שבו החודש — יש לך ₪${creditIls} קרדיט לחזרה. הזמן עכשיו.`,
      ctaText,
      ctaUrl,
    };
  }

  // ctrl — baseline
  return {
    title:    `${name}, התגעגענו אליך! 🐾`,
    bodyHtml: `
      <p>עברו ${days} מאז הביקור האחרון שלך ב-PetWash™.</p>
      <p>הוספנו לחשבונך <strong>₪${creditIls} קרדיט נאמנות</strong> — מתנה מאיתנו.</p>
      <p>השתמש בו בהזמנה הבאה שלך לפני שיפוג.</p>
    `,
    bodyText: `עברו ${days} מאז הביקור האחרון. הוספנו ₪${creditIls} קרדיט לחשבונך — השתמש בו בהזמנה הבאה.`,
    ctaText,
    ctaUrl,
  };
}

export async function runWinbackProcessor(): Promise<void> {
  logger.info('[WinbackProcessor] Starting run');

  let processed = 0;
  let awarded   = 0;
  let errors    = 0;

  // ── Load loyalty rules — armed flag + daily send cap ─────────────────────
  const ruleRows = await db
    .select({
      ruleKey:      loyaltyRules.ruleKey,
      armed:        loyaltyRules.armed,
      dailySendCap: loyaltyRules.dailySendCap,
      enabled:      loyaltyRules.enabled,
    })
    .from(loyaltyRules);
  const ruleMap = new Map(ruleRows.map(r => [r.ruleKey, r]));

  // ── Daily sends already dispatched today per trigger ──────────────────────
  const todaySentRes = await db.execute<{ trigger: string; cnt: number }>(sql`
    SELECT trigger, count(*)::int AS cnt
    FROM winback_queue
    WHERE status = 'sent'
      AND sent_at >= current_date
    GROUP BY trigger
  `);
  const todaySent = new Map<string, number>(
    (todaySentRes.rows ?? []).map(r => [r.trigger, r.cnt]),
  );
  // Track additional sends during THIS batch so cap is respected within the run
  const batchSent = new Map<string, number>();

  // ── Load experiment_decisions — authoritative winner/pause state ──────────
  // Key: experimentKey (e.g. 'winback_14d'), Value: decision row
  const decisionRows = await db
    .select()
    .from(experimentDecisions);

  const decisionMap = new Map(decisionRows.map(d => [d.experimentKey, d]));

  logger.info('[WinbackProcessor] Experiment decisions loaded', {
    count: decisionRows.length,
    keys:  decisionRows.map(d => `${d.experimentKey}:winner=${d.winnerVariant ?? 'none'}`),
  });

  // ── Frequency cap: collect user IDs that already received a send in last 14d ──
  const recentSent = await db.execute<{ user_id: string }>(sql`
    SELECT DISTINCT user_id
    FROM winback_queue
    WHERE status = 'sent'
      AND sent_at > now() - interval '14 days'
  `);
  const recentSentSet = new Set((recentSent.rows ?? []).map(r => r.user_id));

  // ── Fetch pending batch (exclude paused rows) ─────────────────────────────
  const pendingRows = await db.execute<{
    id: number;
    user_id: string;
    trigger: WinbackTrigger;
    last_booking_at: Date | null;
    experiment_variant: string | null;
    paused_at: Date | null;
  }>(sql`
    SELECT id, user_id, trigger, last_booking_at, experiment_variant, paused_at
    FROM winback_queue
    WHERE status = 'pending'
      AND scheduled_at <= now()
      AND paused_at IS NULL
    ORDER BY scheduled_at ASC
    LIMIT ${BATCH_SIZE}
  `);

  if (!pendingRows.rows || pendingRows.rows.length === 0) {
    logger.info('[WinbackProcessor] No pending entries — nothing to do');
    return;
  }

  logger.info('[WinbackProcessor] Processing batch', { count: pendingRows.rows.length });

  for (const row of pendingRows.rows) {
    processed++;
    try {
      const { id: queueId, user_id: userId, trigger, last_booking_at, experiment_variant } = row;

      const expKey   = `winback_${trigger}` as const;
      const decision = decisionMap.get(expKey);
      const guardrail = ruleMap.get(trigger);

      // ── 0a. Armed guardrail — rule must be explicitly armed for sends ──────
      if (!guardrail?.armed) {
        // Leave row pending — admin may arm the rule later
        logger.debug('[WinbackProcessor] Trigger not armed, skipping row', { trigger, queueId });
        continue;
      }

      // ── 0b. Daily send cap ────────────────────────────────────────────────
      if (guardrail.dailySendCap != null) {
        const todayCount  = todaySent.get(trigger) ?? 0;
        const batchCount  = batchSent.get(trigger) ?? 0;
        if (todayCount + batchCount >= guardrail.dailySendCap) {
          logger.info('[WinbackProcessor] Daily send cap reached', { trigger, cap: guardrail.dailySendCap, todayCount, batchCount });
          continue; // Leave pending — will be picked up tomorrow
        }
      }

      // ── 0c. Frequency cap ─────────────────────────────────────────────────
      if (recentSentSet.has(userId)) {
        await db.execute(sql`
          UPDATE winback_queue SET status = 'suppressed' WHERE id = ${queueId}
        `);
        logger.info('[WinbackProcessor] Frequency cap suppression', { userId, queueId });
        continue;
      }

      // ── 0b. Assign A/B variant — winner override or deterministic hash ────
      let variant: Variant;
      if (decision?.promotedAt && decision.winnerVariant) {
        // Winner has been promoted → everyone gets the winner variant
        variant = decision.winnerVariant as Variant;
      } else {
        variant = (experiment_variant as Variant | null | undefined) ?? assignVariant(userId);
      }

      // ── 0c. Check if this variant is paused in experiment_decisions ───────
      const pausedVariants: string[] = decision?.pausedVariants ?? [];
      if (pausedVariants.includes(variant)) {
        await db.execute(sql`
          UPDATE winback_queue
          SET paused_at = now(), pause_reason = 'losing'
          WHERE id = ${queueId}
        `);
        logger.info('[WinbackProcessor] Variant paused, suppressing row', { userId, variant, expKey, queueId });
        continue;
      }

      // ── 0d. Persist assigned variant if not already set ───────────────────
      if (!experiment_variant || experiment_variant !== variant) {
        await db.execute(sql`
          UPDATE winback_queue
          SET experiment_variant = ${variant}
          WHERE id = ${queueId}
        `);
      }

      // ── 1. Verify still dormant ─────────────────────────────────────────
      if (last_booking_at) {
        const newerBooking = await db.execute<{ cnt: number }>(sql`
          SELECT count(*)::int AS cnt
          FROM booking_requests
          WHERE owner_id = ${userId}
            AND status IN ('completed', 'reviewed')
            AND updated_at > ${last_booking_at}
          LIMIT 1
        `);
        if ((newerBooking.rows[0]?.cnt ?? 0) > 0) {
          // User already came back — mark converted
          await db.execute(sql`
            UPDATE winback_queue
            SET status = 'converted', converted_at = now()
            WHERE id = ${queueId}
          `);
          logger.info('[WinbackProcessor] User already re-engaged, marking converted', { userId, queueId });
          continue;
        }
      }

      // ── 2. Lookup loyalty rule (must be enabled) ────────────────────────
      const [rule] = await db
        .select()
        .from(loyaltyRules)
        .where(eq(loyaltyRules.ruleKey, trigger))
        .limit(1);

      if (!rule || !rule.enabled) {
        // Rule disabled — skip silently (don't block queue)
        await db.execute(sql`
          UPDATE winback_queue
          SET status = 'suppressed'
          WHERE id = ${queueId}
        `);
        logger.info('[WinbackProcessor] Rule disabled, suppressing entry', { trigger, queueId });
        continue;
      }

      // ── 3. Fetch user info ──────────────────────────────────────────────
      const [user] = await db
        .select({
          id: users.id,
          email: users.email,
          phone: users.phone,
          firstName: users.firstName,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        logger.warn('[WinbackProcessor] User not found, skipping', { userId, queueId });
        continue;
      }

      // ── 4. Award credit (idempotent) ────────────────────────────────────
      const fingerprint = `${trigger}:${userId}`;
      await awardLoyaltyCredit({
        userId,
        ruleKey: trigger,
        fingerprint,
      });

      // ── 5. Dispatch notification ────────────────────────────────────────
      const creditIls = (rule.rewardCents / 100).toFixed(0);
      const copy = buildNotifCopy(trigger, creditIls, user.firstName, variant);

      await dispatchNotification({
        uid: userId,
        email: user.email ?? undefined,
        phone: user.phone ?? undefined,
        locale: 'he',
        type: 'voucher',
        title: copy.title,
        bodyHtml: copy.bodyHtml,
        bodyText: copy.bodyText,
        ctaText: copy.ctaText,
        ctaUrl: copy.ctaUrl,
        priority: 2,
        meta: {
          amount: rule.rewardCents / 100,
          currency: 'ILS',
        },
        channels: ['inbox', 'email'],
      });

      // ── 6. Mark sent ────────────────────────────────────────────────────
      await db.execute(sql`
        UPDATE winback_queue
        SET status = 'sent', sent_at = now(), experiment_variant = ${variant}
        WHERE id = ${queueId}
      `);

      // ── 7. Record experiment event: notification_sent ───────────────────
      await db.insert(experimentEvents).values({
        experimentKey: `winback_${trigger}`,
        userId,
        variant,
        event: 'notification_sent',
      });

      awarded++;
      batchSent.set(trigger, (batchSent.get(trigger) ?? 0) + 1);
      logger.info('[WinbackProcessor] Win-back sent', {
        userId,
        trigger,
        variant,
        creditCents: rule.rewardCents,
        queueId,
      });
    } catch (err: any) {
      errors++;
      logger.error('[WinbackProcessor] Row error', {
        queueId: row.id,
        userId: row.user_id,
        error: err.message,
      });
    }
  }

  logger.info('[WinbackProcessor] Run complete', { processed, awarded, errors });

  // ── Post-batch: run statistical decision job to update experiment_decisions ──
  // Non-blocking — errors here should not affect the batch result.
  if (awarded > 0) {
    runExperimentDecisionJob().catch(err =>
      logger.warn('[WinbackProcessor] Decision job post-run error (non-blocking)', { error: err.message }),
    );
  }
}

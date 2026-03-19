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
import { users, loyaltyRules, experimentEvents } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { awardLoyaltyCredit } from '../utils/loyaltyLedger';
import { dispatchNotification } from '../lib/notificationDispatcher';

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

  // ── Fetch pending batch ───────────────────────────────────────────────────
  const pendingRows = await db.execute<{
    id: number;
    user_id: string;
    trigger: WinbackTrigger;
    last_booking_at: Date | null;
    experiment_variant: string | null;
  }>(sql`
    SELECT id, user_id, trigger, last_booking_at, experiment_variant
    FROM winback_queue
    WHERE status = 'pending'
      AND scheduled_at <= now()
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

      // ── 0. Assign A/B variant (deterministic, idempotent) ─────────────────
      const variant: Variant = (experiment_variant as Variant) ?? assignVariant(userId);
      if (!experiment_variant) {
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
}

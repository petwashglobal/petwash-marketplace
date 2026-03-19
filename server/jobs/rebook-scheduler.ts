/**
 * REBOOK SCHEDULER — Smart re-engagement engine
 *
 * Runs every 5 minutes. For each due rebook_trigger:
 *   1. Check suppression rules
 *   2. Emit in-app superAppNotification
 *   3. Mark fired_at
 *
 * Trigger types:
 *   post_completion   — 24 h after service completed
 *   weekly_rebook     — 7 d after completion (same weekday / hour reminder)
 *   cancelled_recovery — 2 h after provider-cancelled booking
 *   declined_recovery  — 1 h after provider-declined booking
 */

import { db } from '../db';
import { rebookTriggers, superAppNotifications, bookingRequests } from '@shared/schema';
import { eq, and, lte, isNull, inArray, gte, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';

/* ── Copy ────────────────────────────────────────────────────────────────── */

type TriggerType = 'post_completion' | 'weekly_rebook' | 'cancelled_recovery' | 'declined_recovery';

interface NotifCopy {
  title: string;
  titleHe: string;
  body: string;
  bodyHe: string;
  actionType: string;
}

function buildCopy(type: TriggerType, providerName: string | null, serviceType: string | null): NotifCopy {
  const provider = providerName || 'הספק שלך';
  const serviceLabel = serviceType === 'pet_sitting' ? 'שמירה' : serviceType === 'dog_walking' ? 'הליכה' : 'השירות';

  switch (type) {
    case 'post_completion':
      return {
        title: `How was it? Book ${providerName ?? 'your provider'} again 🐾`,
        titleHe: `איך היה? הזמן שוב את ${provider} 🐾`,
        body: `Your pet loved it! One tap to book the same ${serviceLabel || 'service'} again.`,
        bodyHe: `הכלב שלך אהב! לחיצה אחת להזמנת ${serviceLabel} מחדש.`,
        actionType: 'rebook',
      };
    case 'weekly_rebook':
      return {
        title: `Same day, same time — ${providerName ?? 'your provider'} is ready`,
        titleHe: `אותו יום, אותה שעה — ${provider} מוכנ/ת`,
        body: `Keep the routine going. Book your regular ${serviceLabel || 'session'} for this week.`,
        bodyHe: `שמרו על השגרה. הזמינו את ${serviceLabel} השבועי.`,
        actionType: 'rebook',
      };
    case 'cancelled_recovery':
      return {
        title: 'Still need help? We found similar providers',
        titleHe: 'עדיין צריך עזרה? מצאנו ספקים דומים',
        body: 'Browse trusted providers available near you now.',
        bodyHe: 'עיין בספקים מהימנים הזמינים בקרבתך עכשיו.',
        actionType: 'find_provider',
      };
    case 'declined_recovery':
      return {
        title: 'Try another trusted provider',
        titleHe: 'נסה ספק מהימן נוסף',
        body: 'We have other great providers ready to help — no need to start from scratch.',
        bodyHe: 'יש לנו ספקים מעולים נוספים — אין צורך להתחיל מהתחלה.',
        actionType: 'find_provider',
      };
  }
}

function buildActionUrl(type: TriggerType, requestId: string | null, serviceType: string | null): string {
  if (type === 'post_completion' || type === 'weekly_rebook') {
    if (requestId) return `/booking/confirmation/${requestId}?rebook=1`;
    const route = serviceType === 'pet_sitting' ? '/sitter-suite' : serviceType === 'dog_walking' ? '/walk-my-pet' : '/';
    return route;
  }
  if (requestId) return `/booking/confirmation/${requestId}`;
  return '/';
}

/* ── Suppression ─────────────────────────────────────────────────────────── */

async function isSuppressed(
  userId: string,
  type: TriggerType,
): Promise<{ suppressed: boolean; reason?: string }> {
  const now = new Date();

  // Rule 1: user already has an active future booking
  const active = await db
    .select({ id: bookingRequests.id })
    .from(bookingRequests)
    .where(
      and(
        eq(bookingRequests.ownerId, userId),
        inArray(bookingRequests.status, ['pending', 'accepted', 'confirmed', 'meet_greet_scheduled', 'in_progress'] as any[]),
        gte(bookingRequests.startDate, now),
      ),
    )
    .limit(1);

  if (active.length > 0) {
    return { suppressed: true, reason: 'active_future_booking' };
  }

  // Rule 2: same trigger type already fired within last 7 days
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recentFired = await db
    .select({ id: rebookTriggers.id })
    .from(rebookTriggers)
    .where(
      and(
        eq(rebookTriggers.userId, userId),
        eq(rebookTriggers.triggerType, type),
        eq(rebookTriggers.suppressed, false),
        gte(rebookTriggers.firedAt, sevenDaysAgo),
      ),
    )
    .limit(1);

  if (recentFired.length > 0) {
    return { suppressed: true, reason: 'recently_fired_same_type' };
  }

  return { suppressed: false };
}

/* ── Processor ───────────────────────────────────────────────────────────── */

async function processRebookTriggers(): Promise<void> {
  const now = new Date();

  const due = await db
    .select()
    .from(rebookTriggers)
    .where(
      and(
        lte(rebookTriggers.scheduledAt, now),
        isNull(rebookTriggers.firedAt),
        eq(rebookTriggers.suppressed, false),
      ),
    )
    .limit(50);

  if (due.length === 0) return;

  logger.info('[RebookScheduler] Processing due triggers', { count: due.length });

  for (const trigger of due) {
    const type = trigger.triggerType as TriggerType;

    try {
      const { suppressed, reason } = await isSuppressed(trigger.userId, type);

      if (suppressed) {
        await db
          .update(rebookTriggers)
          .set({ suppressed: true, suppressionReason: reason, firedAt: now })
          .where(eq(rebookTriggers.id, trigger.id));
        logger.info('[RebookScheduler] Trigger suppressed', { id: trigger.id, type, reason });
        continue;
      }

      const copy = buildCopy(type, trigger.providerName, trigger.serviceType);
      const actionUrl = buildActionUrl(type, trigger.requestId, trigger.serviceType);

      const [notif] = await db
        .insert(superAppNotifications)
        .values({
          userId: trigger.userId,
          type: `rebook_reminder_${type}`,
          title: copy.title,
          titleHe: copy.titleHe,
          body: copy.body,
          bodyHe: copy.bodyHe,
          actionUrl,
          actionType: copy.actionType,
          channels: ['in_app'],
          isRead: false,
          metadata: { rebookTriggerId: trigger.id },
          createdAt: now,
        })
        .returning({ id: superAppNotifications.id });

      await db
        .update(rebookTriggers)
        .set({ firedAt: now, notificationId: notif?.id ?? null })
        .where(eq(rebookTriggers.id, trigger.id));

      logger.info('[RebookScheduler] Trigger fired', { id: trigger.id, type, userId: trigger.userId });
    } catch (err: any) {
      logger.error('[RebookScheduler] Trigger processing error', { id: trigger.id, error: err.message });
    }
  }
}

/* ── Export ──────────────────────────────────────────────────────────────── */

export function startRebookScheduler(): void {
  logger.info('[RebookScheduler] Started — polling every 5m');

  // Run immediately on startup to catch any missed triggers
  processRebookTriggers().catch((err) =>
    logger.warn('[RebookScheduler] Initial cycle error', err),
  );

  setInterval(async () => {
    try {
      await processRebookTriggers();
    } catch (err: any) {
      logger.error('[RebookScheduler] Cycle error', { error: err.message });
    }
  }, 5 * 60 * 1000);
}

/* ── Helper — called from booking-requests.ts at transition points ─────── */

export async function scheduleRebookTrigger(
  type: TriggerType,
  opts: {
    userId: string;
    requestId?: string;
    providerId?: string;
    providerName?: string;
    serviceType?: string;
    serviceDate?: Date;
    delayMs: number;
  },
): Promise<void> {
  const scheduledAt = new Date(Date.now() + opts.delayMs);

  await db.insert(rebookTriggers).values({
    userId: opts.userId,
    triggerType: type,
    requestId: opts.requestId ?? null,
    providerId: opts.providerId ?? null,
    providerName: opts.providerName ?? null,
    serviceType: opts.serviceType ?? null,
    serviceDate: opts.serviceDate ?? null,
    scheduledAt,
  });

  logger.info('[RebookScheduler] Trigger scheduled', {
    type,
    userId: opts.userId,
    requestId: opts.requestId,
    scheduledAt: scheduledAt.toISOString(),
  });
}

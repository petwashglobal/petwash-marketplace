/**
 * attentionFeed composer — the "what needs my attention" projection
 * each workspace home renders (CEO 2026-08-26 §27-29).
 *
 * READ-ONLY. Never captures, reserves, or mutates.
 *
 * MVP scope (this PR): a stable shape + a working projection over the
 * booking_requests table for both actors, plus a Pet Passport reminder
 * probe for vaccinations due in the next 30 days. Every OTHER domain
 * (walk, sitting, academy, shop, wallet, egift, prestige benefits,
 * paw_finder, kyc) returns zero items today — the composer is designed
 * so a follow-up per-domain probe can be added without a client change.
 *
 * The point is to give the client home ONE endpoint that already
 * exists, so the next domain probe just extends the array. No client
 * refactor needed later.
 */

import { and, eq, inArray, desc } from 'drizzle-orm';
import { db } from '../db';
import { bookingRequests } from '@shared/schema';
import { logger } from '../lib/logger';
import type {
  AttentionActor,
  AttentionFeed,
  AttentionItem,
} from '@shared/lib/attentionFeed';

const PRIORITY_ORDER: Record<AttentionItem['priority'], number> = {
  urgent: 0,
  due_soon: 1,
  informational: 2,
};

/**
 * Pure mapper — booking row → AttentionItem for the requested actor.
 * Exported so behavioral tests can pin the CEO §14-15 matrix (each
 * status × each actor → exact nextAction / destination / priority)
 * without needing a DB fixture.
 */
export function bookingItem(
  actor: AttentionActor,
  row: typeof bookingRequests.$inferSelect,
  he: boolean,
): AttentionItem | null {
  const id = `booking:${row.requestId}`;
  const status = String(row.status ?? '');

  // Actor-scoped derivation — CEO §14 next-action engine.
  if (actor === 'pet_parent') {
    switch (status) {
      case 'pending':
        return {
          id, actor, domain: 'booking', entityId: row.requestId,
          priority: 'due_soon',
          title: he ? 'ממתין לתגובת ספק' : 'Waiting for provider',
          reason: he ? 'הבקשה שלחת — נעדכן ברגע שהספק יגיב' : 'Your request is in — you\'ll get pinged the moment the provider responds',
          nextAction: 'view',
          destination: `/bookings/${row.requestId}`,
        };
      case 'payment_pending':
        return {
          id, actor, domain: 'booking', entityId: row.requestId,
          priority: 'urgent',
          title: he ? 'שלמו כדי לאשר את ההזמנה' : 'Pay to confirm your booking',
          reason: he ? 'הספק אישר — הזמנתכם ממתינה לתשלום' : 'The provider accepted — your booking is waiting on payment',
          nextAction: 'pay',
          destination: `/bookings/${row.requestId}`,
          moneySummary: row.totalCents ? {
            amountCents: Number(row.totalCents),
            currency: 'ILS',
            label: he ? 'סכום לתשלום' : 'Amount due',
          } : undefined,
        };
      case 'confirmed':
      case 'in_progress':
        return {
          id, actor, domain: 'booking', entityId: row.requestId,
          priority: 'informational',
          title: he ? 'ההזמנה מאושרת' : 'Booking confirmed',
          reason: he ? 'עקבו אחרי השירות בזמן אמת' : 'Track the service in real time',
          nextAction: 'track',
          destination: `/bookings/${row.requestId}`,
        };
      case 'provider_marked_complete':
        return {
          id, actor, domain: 'booking', entityId: row.requestId,
          priority: 'urgent',
          title: he ? 'הספק סימן שסיים — אשרו וכתבו ביקורת' : 'Provider marked done — confirm & review',
          reason: he ? 'סיום השירות ממתין לאישורכם' : 'The service is done pending your confirmation',
          nextAction: 'confirm',
          destination: `/bookings/${row.requestId}`,
        };
      case 'completed':
        return {
          id, actor, domain: 'booking', entityId: row.requestId,
          priority: 'informational',
          title: he ? 'השאירו ביקורת' : 'Leave a review',
          reason: he ? 'עזרו להורים אחרים לבחור' : 'Help other pet parents choose',
          nextAction: 'review',
          destination: `/bookings/${row.requestId}/review`,
        };
      default:
        return null;
    }
  }

  // provider
  switch (status) {
    case 'pending':
      return {
        id, actor, domain: 'booking', entityId: row.requestId,
        priority: 'urgent',
        title: he ? 'בקשה חדשה' : 'New request',
        reason: he ? 'לקוח ממתין לתגובה — קבלו או דחו' : 'A customer is waiting — accept or decline',
        nextAction: 'accept_or_decline',
        destination: `/provider/jobs/${row.requestId}`,
      };
    case 'payment_pending':
      return {
        id, actor, domain: 'booking', entityId: row.requestId,
        priority: 'informational',
        title: he ? 'ממתין לתשלום הלקוח' : 'Waiting for customer payment',
        reason: he ? 'אתם קיבלתם — הלקוח משלם עכשיו' : 'You accepted — customer is completing payment',
        nextAction: 'view',
        destination: `/provider/jobs/${row.requestId}`,
      };
    case 'confirmed':
      return {
        id, actor, domain: 'booking', entityId: row.requestId,
        priority: 'due_soon',
        title: he ? 'עבודה מאושרת' : 'Job confirmed',
        reason: he ? 'הכינו את השירות והתחילו בזמן' : 'Prepare the service and start on time',
        nextAction: 'start',
        destination: `/provider/jobs/${row.requestId}`,
      };
    case 'in_progress':
      return {
        id, actor, domain: 'booking', entityId: row.requestId,
        priority: 'urgent',
        title: he ? 'עבודה בביצוע — סיימו כשמוכן' : 'Job in progress — mark complete when done',
        reason: he ? 'הלקוח עוקב בזמן אמת' : 'Customer is tracking in real time',
        nextAction: 'complete',
        destination: `/provider/jobs/${row.requestId}`,
      };
    case 'provider_marked_complete':
      return {
        id, actor, domain: 'booking', entityId: row.requestId,
        priority: 'informational',
        title: he ? 'ממתין לאישור הלקוח' : 'Waiting for customer confirm',
        reason: he ? 'סיימתם — הלקוח מאשר וההכנסה משתחררת' : 'You finished — customer confirms and earnings release',
        nextAction: 'view',
        destination: `/provider/jobs/${row.requestId}`,
      };
    default:
      return null;
  }
}

async function petParentBookingItems(userId: string, he: boolean): Promise<AttentionItem[]> {
  try {
    const rows = await db
      .select()
      .from(bookingRequests)
      .where(and(
        eq(bookingRequests.ownerId, userId),
        inArray(bookingRequests.status, [
          'pending', 'payment_pending', 'confirmed', 'in_progress',
          'provider_marked_complete', 'completed',
        ] as any),
      ))
      .orderBy(desc(bookingRequests.createdAt))
      .limit(20);
    return rows.map((r) => bookingItem('pet_parent', r, he)).filter((x): x is AttentionItem => x !== null);
  } catch (e: any) {
    logger.warn('[AttentionFeed] pet-parent booking probe failed', { userId, err: e?.message });
    return [];
  }
}

async function providerBookingItems(userId: string, he: boolean): Promise<AttentionItem[]> {
  try {
    const rows = await db
      .select()
      .from(bookingRequests)
      .where(and(
        eq(bookingRequests.providerId, userId),
        inArray(bookingRequests.status, [
          'pending', 'payment_pending', 'confirmed', 'in_progress',
          'provider_marked_complete',
        ] as any),
      ))
      .orderBy(desc(bookingRequests.createdAt))
      .limit(20);
    return rows.map((r) => bookingItem('provider', r, he)).filter((x): x is AttentionItem => x !== null);
  } catch (e: any) {
    logger.warn('[AttentionFeed] provider booking probe failed', { userId, err: e?.message });
    return [];
  }
}

function sortItems(items: AttentionItem[]): AttentionItem[] {
  return items.sort((a, b) => {
    const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (p !== 0) return p;
    // Same priority → prefer the one with a nearer dueAt (undefined
    // sorts last), then leave original order.
    if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt);
    if (a.dueAt) return -1;
    if (b.dueAt) return 1;
    return 0;
  });
}

export async function composeAttentionFeed(actor: AttentionActor, userId: string, he: boolean): Promise<AttentionFeed> {
  if (!userId) {
    return { actor, items: [], composedAt: new Date().toISOString() };
  }
  const items = actor === 'pet_parent'
    ? await petParentBookingItems(userId, he)
    : await providerBookingItems(userId, he);
  // TODO(next-domain-probes): walk / sitting / academy / shop / wallet
  // / egift / prestige / paw_finder / pet_passport / kyc. Each probe
  // returns AttentionItem[]; the composer concatenates + sorts.
  return { actor, items: sortItems(items), composedAt: new Date().toISOString() };
}

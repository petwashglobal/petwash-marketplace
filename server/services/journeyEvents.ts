/**
 * CEO MASTER 2026-08-28 §24 §25 §66 §67 §68 — journey action-event
 * store (Journey Brain Phase 6).
 *
 * A minimal, structured telemetry surface. Each row is a small typed
 * envelope: reasonCode + eventType + actionType + source + entityRef.
 * NEVER a chain-of-thought dump, NEVER a free-text field.
 *
 * The composer eventually reads aggregates ("this user consistently
 * dismisses PRESTIGE_BENEFIT_AVAILABLE — down-rank it") and the
 * proactive-timing engine reads shown/click ratios per hour.
 */
import { and, count, desc, eq, gt } from 'drizzle-orm';
import { db } from '../db';
import { journeyActionEvents, type InsertJourneyActionEvent, type JourneyActionEvent } from '@shared/schema';
import { randomUUID } from 'crypto';

export type JourneyEventType =
  | 'shown'
  | 'clicked'
  | 'dismissed'
  | 'not_interested'
  | 'forget_reason'
  | 'completed';

export interface RecordEventInput {
  userUid: string;
  actor: 'pet_parent' | 'provider';
  reasonCode: string;
  eventType: JourneyEventType;
  actionType?: string;
  source?: string;
  entityRef?: string | null;
  metadata?: Record<string, unknown>;
}

export async function recordJourneyEvent(input: RecordEventInput): Promise<JourneyActionEvent> {
  if (!input.userUid)    throw new Error('journeyEvents: userUid required');
  if (!input.actor)      throw new Error('journeyEvents: actor required');
  if (!input.reasonCode) throw new Error('journeyEvents: reasonCode required');
  if (!input.eventType)  throw new Error('journeyEvents: eventType required');
  const values: InsertJourneyActionEvent = {
    eventId: randomUUID(),
    userUid: input.userUid,
    actor: input.actor,
    reasonCode: input.reasonCode.slice(0, 64),
    eventType: input.eventType,
    actionType: input.actionType ? input.actionType.slice(0, 32) : null,
    source: input.source ? input.source.slice(0, 64) : null,
    entityRef: input.entityRef ? input.entityRef.slice(0, 200) : null,
    metadata: (input.metadata ?? {}) as any,
    createdAt: new Date(),
  };
  const [row] = await db.insert(journeyActionEvents).values(values).returning();
  return row;
}

/**
 * "Recent dismisses" — the composer uses this to soften a reason
 * the user has told us they're not interested in. Default window
 * is 30 days.
 */
export async function countRecentDismisses(
  userUid: string,
  reasonCode: string,
  windowMs: number = 30 * 24 * 60 * 60 * 1000,
): Promise<number> {
  if (!userUid || !reasonCode) return 0;
  const since = new Date(Date.now() - windowMs);
  const rows = await db
    .select({ n: count() })
    .from(journeyActionEvents)
    .where(and(
      eq(journeyActionEvents.userUid, userUid),
      eq(journeyActionEvents.reasonCode, reasonCode),
      eq(journeyActionEvents.eventType, 'dismissed'),
      gt(journeyActionEvents.createdAt, since),
    ));
  return Number(rows[0]?.n ?? 0);
}

/**
 * "Forget this reason for me" — CEO §55. Deletes every telemetry row
 * for (user, reason) so an aggregate re-derived tomorrow does not
 * carry the ghost of the removed preference.
 */
export async function forgetReason(userUid: string, reasonCode: string): Promise<void> {
  if (!userUid || !reasonCode) return;
  await db
    .delete(journeyActionEvents)
    .where(and(
      eq(journeyActionEvents.userUid, userUid),
      eq(journeyActionEvents.reasonCode, reasonCode),
    ));
}

/**
 * Small feed for debugging + the "why this?" panel — most recent
 * events for the caller.
 */
export async function listRecentJourneyEvents(userUid: string, limit: number = 25): Promise<JourneyActionEvent[]> {
  if (!userUid) return [];
  return db
    .select()
    .from(journeyActionEvents)
    .where(eq(journeyActionEvents.userUid, userUid))
    .orderBy(desc(journeyActionEvents.createdAt))
    .limit(Math.max(1, Math.min(100, limit)));
}

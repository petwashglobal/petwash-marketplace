/**
 * chatThreadService — the spine of the PetWash Communication Hub.
 *
 * Enforces the CEO core rule: EVERY thread links to a REAL entity. A thread cannot
 * be created without the entity anchor that its thread_type requires. This is the
 * single place booking/support/incident/K9000/paw-finder/shop/gift/application/admin
 * conversations are created, so no orphan messages are possible.
 *
 * Phase 1 = the model + get-or-create. The inbox status-badge / smart-action layer,
 * AI risk flags, notification routing, and calls build ON this (later phases).
 */
import { db } from '../db';
import { and, eq } from 'drizzle-orm';
import { chatThreads, CHAT_THREAD_TYPES, type ChatThread, type ChatThreadType } from '@shared/schema-chat';
import crypto from 'crypto';

/** Which entity field anchors each thread_type (the one that MUST be present). */
const REQUIRED_ANCHOR: Record<ChatThreadType, keyof typeof chatThreads.$inferInsert> = {
  BOOKING: 'bookingId',
  SUPPORT: 'caseId',
  INCIDENT: 'caseId',
  K9000: 'stationId',
  PAW_FINDER: 'caseId',
  SHOP_ORDER: 'orderId',
  GIFT: 'giftId',
  PROVIDER_APPLICATION: 'applicationId',
  FRANCHISE: 'applicationId', // franchise enquiry/application id
  ADMIN: 'caseId',
};

export interface GetOrCreateThreadInput {
  threadType: ChatThreadType;
  bookingId?: string | null;
  caseId?: string | null;
  orderId?: string | null;
  giftId?: string | null;
  stationId?: string | null;
  applicationId?: string | null;
  petId?: string | null;
  customerUserId?: string | null;
  providerUserId?: string | null;
  supportOwnerId?: string | null;
}

function isValidType(t: string): t is ChatThreadType {
  return (CHAT_THREAD_TYPES as readonly string[]).includes(t);
}

/**
 * Get the existing thread for an entity, or create one. Throws if the thread_type
 * is unknown or its required entity anchor is missing — so a thread can NEVER exist
 * without a real record behind it.
 */
export async function getOrCreateThread(input: GetOrCreateThreadInput): Promise<ChatThread> {
  if (!isValidType(input.threadType)) {
    throw new Error(`Unknown thread_type: ${input.threadType}`);
  }
  const anchorField = REQUIRED_ANCHOR[input.threadType];
  const anchorValue = (input as any)[anchorField];
  if (!anchorValue) {
    throw new Error(`thread_type ${input.threadType} requires ${String(anchorField)} (every thread must link to a real entity)`);
  }

  // Find an existing thread for the same type + anchor entity.
  const [existing] = await db
    .select()
    .from(chatThreads)
    .where(and(
      eq(chatThreads.threadType, input.threadType),
      eq(chatThreads[anchorField as 'bookingId'], anchorValue),
    ))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(chatThreads)
    .values({
      threadId: crypto.randomUUID(),
      threadType: input.threadType,
      bookingId: input.bookingId ?? null,
      caseId: input.caseId ?? null,
      orderId: input.orderId ?? null,
      giftId: input.giftId ?? null,
      stationId: input.stationId ?? null,
      applicationId: input.applicationId ?? null,
      petId: input.petId ?? null,
      customerUserId: input.customerUserId ?? null,
      providerUserId: input.providerUserId ?? null,
      supportOwnerId: input.supportOwnerId ?? null,
      status: 'active',
    })
    .returning();
  return created;
}

/** Fetch a thread by its public threadId. */
export async function getThreadById(threadId: string): Promise<ChatThread | null> {
  const [t] = await db.select().from(chatThreads).where(eq(chatThreads.threadId, threadId)).limit(1);
  return t ?? null;
}

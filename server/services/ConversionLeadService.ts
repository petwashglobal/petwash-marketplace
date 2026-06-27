/**
 * ConversionLeadService — the brain of Booking Rescue (CEO spec 2026-06-27).
 *
 * recordIntent() logs a user_intent_event and upserts the matching conversion_lead
 * with a fresh score + status + next-action time. Money-SAFE: writes only the
 * additive conversion_* tables; value_estimate is analytics, never a charge. The
 * actual reminder SENDS (push/SMS/email) are a later layer gated by
 * CONVERSION_RESCUE_ENABLED — this layer just builds the lead pipeline.
 */
import { db } from "../db";
import {
  userIntentEvents, conversionLeads,
  type IntentEventType, type LeadType, type LeadStatus,
} from "../../shared/schema-conversion";
import { eq, and, desc, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { nanoid } from "nanoid";

const PLATFORM_TO_LEAD: Record<string, LeadType> = {
  SITTER_SUITE: "PET_SITTER_BOOKING",
  WALK_MY_PET: "WALK_MY_PET_BOOKING",
  ACADEMY: "ACADEMY_COURSE",
  SHOP: "SHOP_CART",
  GIFT: "GIFT_PURCHASE",
  PAW_FINDER: "PAW_FINDER_REPORT",
  PETTREK: "PETTREK_WAITLIST",
  K9000: "K9000_PAYMENT",
};

// §8 — later-stage intent = higher score (closer to converting / more to lose).
const EVENT_SCORE: Partial<Record<IntentEventType, number>> = {
  SERVICE_VIEWED: 10, PROVIDER_SEARCHED: 15, PROVIDER_PROFILE_VIEWED: 20,
  SHOP_PRODUCT_VIEWED: 15, PETTREK_WAITLIST_VIEWED: 15,
  PROVIDER_MESSAGED: 45, BOOKING_STARTED: 45, BOOKING_FORM_PARTIAL: 50,
  WAITLIST_STARTED: 40, GIFT_STARTED: 45, PAW_FINDER_REPORT_STARTED: 55,
  SHOP_CART_ABANDONED: 55, GIFT_ABANDONED: 55, WAITLIST_ABANDONED: 45,
  PAW_FINDER_REPORT_ABANDONED: 60,
  BOOKING_ENQUIRY_SENT: 65, PROVIDER_NO_REPLY: 70,
  PROVIDER_ACCEPTED_WAITING_PAYMENT: 85, PAYMENT_STARTED: 80,
  PAYMENT_FAILED: 90, PAYMENT_ABANDONED: 80,
  K9000_PAYMENT_FAILED: 75, K9000_REDEMPTION_FAILED: 75,
  BOOKING_EXPIRED: 30, BOOKING_CANCELLED_BEFORE_PAYMENT: 25,
};

// §4 — when the rescue engine should next act on this lead.
const NEXT_ACTION_MINUTES: Partial<Record<IntentEventType, number>> = {
  PROVIDER_NO_REPLY: 120, BOOKING_ENQUIRY_SENT: 120,
  PROVIDER_ACCEPTED_WAITING_PAYMENT: 30, PAYMENT_FAILED: 10, PAYMENT_ABANDONED: 30,
  BOOKING_STARTED: 30, BOOKING_FORM_PARTIAL: 30,
  SHOP_CART_ABANDONED: 120, GIFT_ABANDONED: 60,
  PAW_FINDER_REPORT_ABANDONED: 15, WAITLIST_ABANDONED: 1440, PETTREK_WAITLIST_VIEWED: 1440,
};

function statusForEvent(e: IntentEventType): LeadStatus {
  if (["PROVIDER_ACCEPTED_WAITING_PAYMENT", "PAYMENT_STARTED", "PAYMENT_FAILED", "PAYMENT_ABANDONED"].includes(e)) return "PAYMENT_PENDING";
  if (["BOOKING_ENQUIRY_SENT", "PROVIDER_MESSAGED", "PROVIDER_NO_REPLY"].includes(e)) return "WAITING_PROVIDER";
  if (["BOOKING_EXPIRED", "BOOKING_CANCELLED_BEFORE_PAYMENT"].includes(e)) return "LOST";
  return "ACTIVE";
}

export interface RecordIntentInput {
  eventType: IntentEventType;
  userId?: string | null;
  guestId?: string | null;
  sessionId?: string;
  platformKey?: string;
  relatedProviderId?: string;
  relatedBookingId?: string;
  relatedPetId?: string;
  relatedProductId?: string;
  relatedStationId?: string;
  city?: string;
  country?: string;
  device?: string;
  sourcePage?: string;
  valueEstimateCents?: number;
  metadata?: Record<string, any>;
}

export async function recordIntent(input: RecordIntentInput): Promise<{ leadId: number | null }> {
  // 1) Always log the raw intent event (cheap, append-only).
  try {
    await db.insert(userIntentEvents).values({
      eventKey: `UIE-${Date.now()}-${nanoid(8)}`,
      userId: input.userId ?? null,
      guestId: input.guestId ?? null,
      sessionId: input.sessionId,
      platformKey: input.platformKey,
      eventType: input.eventType,
      relatedProviderId: input.relatedProviderId,
      relatedBookingId: input.relatedBookingId,
      relatedPetId: input.relatedPetId,
      relatedProductId: input.relatedProductId,
      relatedStationId: input.relatedStationId,
      city: input.city,
      country: input.country,
      device: input.device,
      sourcePage: input.sourcePage,
      metadataJson: input.metadata ?? null,
    } as any);
  } catch (e: any) {
    logger.error("[Conversion] intent insert failed", { eventType: input.eventType, error: e?.message });
  }

  // 2) Upsert the lead. Terminal/low-value views don't open a lead.
  const leadType = PLATFORM_TO_LEAD[input.platformKey || ""] || null;
  if (!leadType) return { leadId: null };
  if (!input.userId && !input.guestId) return { leadId: null };

  const score = (EVENT_SCORE[input.eventType] ?? 10) + (input.userId ? 20 : 0);
  const status = statusForEvent(input.eventType);
  const nextMins = NEXT_ACTION_MINUTES[input.eventType];
  const now = new Date();
  const nextDue = nextMins ? new Date(now.getTime() + nextMins * 60_000) : null;
  const owner = input.userId ?? input.guestId!;

  try {
    // Find an open lead for (owner, leadType, booking).
    const [existing] = await db.select().from(conversionLeads).where(and(
      input.userId ? eq(conversionLeads.userId, input.userId) : eq(conversionLeads.guestId, input.guestId!),
      eq(conversionLeads.leadType, leadType),
      input.relatedBookingId ? eq(conversionLeads.relatedBookingId, input.relatedBookingId) : sql`related_booking_id IS NULL`,
    )).orderBy(desc(conversionLeads.createdAt)).limit(1);

    if (existing) {
      // Don't resurrect a converted/lost lead from a stray late event.
      if (["CONVERTED", "CLOSED"].includes(existing.status)) return { leadId: existing.id };
      await db.update(conversionLeads).set({
        score: Math.max(existing.score, score),
        status,
        lastEventType: input.eventType,
        lastActionAt: now,
        nextActionDueAt: nextDue ?? existing.nextActionDueAt,
        valueEstimateCents: input.valueEstimateCents ?? existing.valueEstimateCents,
        relatedProviderId: input.relatedProviderId ?? existing.relatedProviderId,
        city: input.city ?? existing.city,
        updatedAt: now,
      }).where(eq(conversionLeads.id, existing.id));
      return { leadId: existing.id };
    }

    const [row] = await db.insert(conversionLeads).values({
      leadKey: `LEAD-${Date.now()}-${nanoid(8)}`,
      userId: input.userId ?? null,
      guestId: input.guestId ?? null,
      platformKey: input.platformKey,
      leadType,
      relatedBookingId: input.relatedBookingId,
      relatedProviderId: input.relatedProviderId,
      score, status,
      valueEstimateCents: input.valueEstimateCents ?? 0,
      city: input.city,
      lastEventType: input.eventType,
      lastActionAt: now,
      nextActionDueAt: nextDue,
    } as any).returning({ id: conversionLeads.id });
    return { leadId: row?.id ?? null };
  } catch (e: any) {
    logger.error("[Conversion] lead upsert failed", { owner, leadType, error: e?.message });
    return { leadId: null };
  }
}

/** Mark a lead converted/lost when the booking pays / cancels (called from Deal Gate). */
export async function closeLead(params: {
  userId?: string | null; guestId?: string | null; leadType: LeadType;
  relatedBookingId?: string; outcome: "CONVERTED" | "LOST";
}): Promise<void> {
  try {
    await db.update(conversionLeads).set({ status: params.outcome, nextActionDueAt: null, updatedAt: new Date() }).where(and(
      params.userId ? eq(conversionLeads.userId, params.userId) : (params.guestId ? eq(conversionLeads.guestId, params.guestId) : sql`1=0`),
      eq(conversionLeads.leadType, params.leadType),
      params.relatedBookingId ? eq(conversionLeads.relatedBookingId, params.relatedBookingId) : sql`true`,
    ));
  } catch (e: any) {
    logger.error("[Conversion] closeLead failed", { error: e?.message });
  }
}

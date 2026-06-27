/**
 * CommunicationEventService — best-effort writer for the unified
 * communication_events log (CEO comms master spec §10).
 *
 * Every booking-linked communication (chat, push, SMS, email, call, system,
 * support) should call logCommunicationEvent() so admin/legal can reconstruct
 * the full timeline per booking. CRITICAL: logging is fire-and-forget and MUST
 * NEVER throw or block the actual send — a failed log is swallowed (and noted),
 * never propagated. Keep content_summary short and non-sensitive (no full PII
 * message bodies); the channel systems keep the full content.
 */
import { db } from "../db";
import { communicationEvents, type CommunicationChannel } from "@shared/schema";
import { logger } from "../lib/logger";

export interface CommunicationEventInput {
  channel: CommunicationChannel;
  eventType: string;
  bookingId?: string | null;
  threadId?: string | null;
  senderUserId?: string | null;
  receiverUserId?: string | null;
  contentSummary?: string | null;
  externalMessageId?: string | null;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** Append a communication event. Never throws; returns false on failure. */
export async function logCommunicationEvent(input: CommunicationEventInput): Promise<boolean> {
  try {
    await db.insert(communicationEvents).values({
      channel: input.channel,
      eventType: input.eventType,
      bookingId: input.bookingId ?? null,
      threadId: input.threadId ?? null,
      senderUserId: input.senderUserId ?? null,
      receiverUserId: input.receiverUserId ?? null,
      // never store full bodies — clamp to a short summary
      contentSummary: input.contentSummary ? String(input.contentSummary).slice(0, 280) : null,
      externalMessageId: input.externalMessageId ?? null,
      status: input.status ?? null,
      metadataJson: (input.metadata ?? null) as any,
    });
    return true;
  } catch (err) {
    // Logging the log must not break the send. Note and move on.
    logger.debug?.("[CommunicationEvents] log failed (non-blocking)", {
      channel: input.channel,
      eventType: input.eventType,
      error: (err as Error)?.message,
    });
    return false;
  }
}

/** Fire-and-forget variant for hot paths that don't want to await the insert. */
export function logCommunicationEventAsync(input: CommunicationEventInput): void {
  void logCommunicationEvent(input).catch(() => {});
}

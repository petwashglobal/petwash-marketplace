import { db } from '../db';
import { 
  bookingConversations, 
  bookingMessages, 
  bookings,
  walkBookings,
  sitterBookings
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { logger } from './logger';
import { 
  broadcastBookingChatStatus, 
  broadcastBookingChatMessage 
} from '../websocket';

/**
 * Helper to map booking status to chat status
 */
function getChatStatusFromBookingStatus(bookingStatus: string): 'active' | 'read_only' | 'locked' {
  switch (bookingStatus) {
    case 'draft':
    case 'pending_payment':
    case 'pending_provider':
    case 'declined':
      return 'locked';
    case 'confirmed':
    case 'in_progress':
      return 'active';
    case 'completed':
    case 'cancelled':
    case 'refunded':
    case 'disputed':
    case 'expired':
    case 'no_show':
      return 'read_only';
    default:
      return 'locked';
  }
}

/**
 * Helper to get closed reason from booking status
 */
function getClosedReason(status: string): string | null {
  if (['completed', 'cancelled', 'refunded', 'disputed', 'expired', 'no_show'].includes(status)) {
    return status;
  }
  return null;
}

/**
 * Inject a system message into a conversation
 */
export async function injectChatSystemMessage(
  conversationId: string,
  systemEventType: string,
  content: string,
  participantUids: string[]
): Promise<void> {
  const messageId = `BM-${nanoid()}`;
  const [newMessage] = await db.insert(bookingMessages).values({
    messageId,
    conversationId,
    senderUid: 'system',
    senderRole: 'system',
    messageType: 'system_event',
    systemEventType,
    content,
    createdAt: new Date(),
  }).returning();

  broadcastBookingChatMessage(conversationId, newMessage, participantUids);
}

/**
 * Sync chat state to booking status change
 */
export async function syncChatToBookingStatus(
  bookingId: string,
  newBookingStatus: string,
  platform: string
): Promise<void> {
  try {
    logger.info(`[ChatSync] Syncing booking ${bookingId} to status ${newBookingStatus} on ${platform}`);

    // 1. Find conversation
    let [conversation] = await db.select()
      .from(bookingConversations)
      .where(eq(bookingConversations.bookingId, bookingId))
      .limit(1);

    let customerId: string | null = conversation?.customerId || null;
    let providerId: string | null = conversation?.providerId || null;

    // 2. If no conversation exists and status is active, create it
    if (!conversation && ['confirmed', 'in_progress'].includes(newBookingStatus)) {
      logger.info(`[ChatSync] No conversation found for ${bookingId}, attempting auto-creation`);
      
      let bookingData: any;
      if (platform === 'walk_my_pet') {
        [bookingData] = await db.select().from(walkBookings).where(eq(walkBookings.bookingId, bookingId)).limit(1);
        if (bookingData) {
          customerId = bookingData.ownerId;
          providerId = bookingData.walkerId;
        }
      } else if (platform === 'sitter_suite') {
        [bookingData] = await db.select().from(sitterBookings).where(eq(sitterBookings.bookingId, bookingId)).limit(1);
        if (bookingData) {
          customerId = bookingData.ownerId;
          providerId = bookingData.sitterId?.toString() || null;
        }
      }

      if (!customerId || !providerId) {
        logger.warn(`[ChatSync] Could not find participants for booking ${bookingId} on ${platform}`);
        return;
      }

      const conversationId = `BC-${nanoid()}`;
      [conversation] = await db.insert(bookingConversations).values({
        conversationId,
        bookingId,
        platform,
        customerId,
        providerId,
        chatStatus: 'active',
        customerUnread: 0,
        providerUnread: 0,
        lastMessageAt: new Date(),
      }).returning();
      
      logger.info(`[ChatSync] Auto-created conversation ${conversation.conversationId} for ${bookingId}`);
    }

    if (!conversation) return;

    const conversationId = conversation.conversationId;
    customerId = conversation.customerId;
    providerId = conversation.providerId;
    const participantUids = [customerId, providerId];

    // 3. Get new chatStatus
    const newChatStatus = getChatStatusFromBookingStatus(newBookingStatus);
    const closedReason = getClosedReason(newBookingStatus);
    const isTerminal = !!closedReason;

    // 4. Update conversation
    await db.update(bookingConversations)
      .set({ 
        chatStatus: newChatStatus, 
        closedReason, 
        closedAt: isTerminal ? new Date() : null,
        updatedAt: new Date()
      })
      .where(eq(bookingConversations.conversationId, conversationId));

    // 5. System message mapping
    const systemMessages: Record<string, { type: string, content: string }> = {
      'confirmed': { type: 'booking_confirmed', content: 'Your booking has been confirmed. You can now message each other.' },
      'in_progress': { type: 'in_progress', content: 'Your service has started.' },
      'completed': { type: 'completed', content: 'Your booking is complete. This chat is now closed.' },
      'cancelled': { type: 'cancelled', content: 'This booking has been cancelled. The chat is now closed.' },
      'disputed': { type: 'dispute_opened', content: 'A dispute has been opened for this booking. The chat has been archived for review.' },
      'refunded': { type: 'refunded', content: 'A refund has been issued. This chat is now closed.' },
      'no_show': { type: 'no_show', content: 'A no-show has been recorded for this booking.' },
      'expired': { type: 'expired', content: 'This booking has expired. The chat is now closed.' },
    };

    const msg = systemMessages[newBookingStatus];
    if (msg) {
      await injectChatSystemMessage(conversationId, msg.type, msg.content, participantUids);
    }

    // 6. Broadcast status change
    broadcastBookingChatStatus(conversationId, newChatStatus, participantUids);

  } catch (error) {
    logger.error(`[ChatSync] Error syncing chat for booking ${bookingId}`, error);
  }
}

/**
 * Check if a booking is within the free cancellation window
 */
export function checkCancellationWindow(booking: any, platform: string): { allowed: boolean; lateCancel: boolean; feeApplies: boolean; reason?: string } {
  const now = new Date();
  const scheduledStart = new Date(booking.scheduledDate);
  
  if (platform === 'walk_my_pet') {
    // Walk bookings: free cancellation > 1 hour before scheduled start
    const oneHourBefore = new Date(scheduledStart.getTime() - 1 * 60 * 60 * 1000);
    if (now > oneHourBefore) {
      return { allowed: true, lateCancel: true, feeApplies: true, reason: 'Cancellation within 1 hour of walk' };
    }
  } else if (platform === 'sitter_suite') {
    // Sitter bookings: free cancellation > 24 hours before scheduled start
    const twentyFourHoursBefore = new Date(scheduledStart.getTime() - 24 * 60 * 60 * 1000);
    if (now > twentyFourHoursBefore) {
      return { allowed: true, lateCancel: true, feeApplies: true, reason: 'Cancellation within 24 hours of sitting' };
    }
  }
  
  return { allowed: true, lateCancel: false, feeApplies: false };
}

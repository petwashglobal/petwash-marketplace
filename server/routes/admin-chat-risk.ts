/**
 * /api/admin/chat-risk — admin review of flagged chat messages.
 *
 * Surfaces the ADVISORY flags raised by chatRiskScanner (off-platform payment,
 * private-number sharing, pet danger, etc.) so a human can review them. Read-only:
 * the AI/rules flag; staff decide. Mounted behind validateFirebaseToken + requireAdmin.
 *
 * No migration: flags already live on booking_messages.is_flagged / flagged_reason.
 */
import { Router } from 'express';
import { db } from '../db';
import { eq, desc } from 'drizzle-orm';
import { bookingMessages, bookingConversations } from '@shared/schema';
import { logger } from '../lib/logger';

const router = Router();

/** GET /flagged — most recent flagged chat messages with booking context. */
router.get('/flagged', async (_req, res) => {
  try {
    const rows = await db
      .select({
        messageId: bookingMessages.messageId,
        conversationId: bookingMessages.conversationId,
        senderRole: bookingMessages.senderRole,
        senderUid: bookingMessages.senderUid,
        flaggedReason: bookingMessages.flaggedReason,
        content: bookingMessages.content,
        createdAt: bookingMessages.createdAt,
        bookingId: bookingConversations.bookingId,
        platform: bookingConversations.platform,
        customerId: bookingConversations.customerId,
        providerId: bookingConversations.providerId,
      })
      .from(bookingMessages)
      .leftJoin(
        bookingConversations,
        eq(bookingMessages.conversationId, bookingConversations.conversationId),
      )
      .where(eq(bookingMessages.isFlagged, true))
      .orderBy(desc(bookingMessages.createdAt))
      .limit(100);

    res.json({ ok: true, count: rows.length, flagged: rows });
  } catch (e: any) {
    logger.error('[AdminChatRisk] flagged query failed', { error: e?.message });
    res.status(500).json({ ok: false, error: 'Failed to load flagged messages' });
  }
});

export default router;

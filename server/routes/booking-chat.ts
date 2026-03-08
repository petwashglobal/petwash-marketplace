import { Router } from 'express';
import { db } from '../db';
import { 
  bookingConversations, 
  bookingMessages, 
  bookings,
  walkBookings,
  sitterBookings,
  userBlocks,
  superAppNotifications,
  insertBookingConversationSchema,
  insertBookingMessageSchema 
} from '@shared/schema';
import { eq, and, or, desc, lt, sql } from 'drizzle-orm';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { logger } from '../lib/logger';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { 
  broadcastBookingChatMessage, 
  broadcastBookingChatRead, 
  broadcastBookingChatUnread,
  isUserConnected
} from '../websocket';
import { syncChatToBookingStatus } from '../lib/booking-chat-sync';
import { auth as firebaseAuth } from '../lib/firebase-admin';
import sgMail from '../lib/sendgrid';

const router = Router();

// Helper functions
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
      return 'read_only';
    default:
      return 'locked';
  }
}

function getClosedReasonFromBookingStatus(status: string): string | null {
  if (['completed', 'cancelled', 'refunded', 'disputed'].includes(status)) {
    return status;
  }
  return null;
}

// Section 7: Detect phone, email, URL, and @social handles
const contactInfoPattern = /(\+?[\d\s\-\(\)]{7,})|([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})|(https?:\/\/[^\s]+)|(www\.[^\s]+)|(@[a-zA-Z0-9_]{2,})/i;

// Section 6: Strip HTML/XSS from message content before storing
function sanitizeMessageContent(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .trim();
}

// Section 6: In-memory rate limiter — max 10 messages per user per conversation per 60s
const sendRateLimits = new Map<string, { count: number; resetAt: number }>();
function checkSendRateLimit(uid: string, conversationId: string): boolean {
  const key = `${uid}:${conversationId}`;
  const now = Date.now();
  const entry = sendRateLimits.get(key);
  if (!entry || now > entry.resetAt) {
    sendRateLimits.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

// Detect specific flag reason for contact info violations (§7)
function detectFlagReason(content: string): string {
  if (/(\+?[\d\s\-\(\)]{7,})/.test(content)) return 'phone_number';
  if (/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/.test(content)) return 'email_address';
  if (/https?:\/\/[^\s]+/.test(content) || /www\.[^\s]+/.test(content)) return 'external_url';
  if (/@[a-zA-Z0-9_]{2,}/.test(content)) return 'social_handle';
  return 'contact_info';
}

// All routes are protected
router.use(validateFirebaseToken);

/**
 * GET /api/booking-chat/inbox
 */
router.get('/inbox', async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const conversations = await db
      .select()
      .from(bookingConversations)
      .where(or(
        eq(bookingConversations.customerId, uid),
        eq(bookingConversations.providerId, uid)
      ))
      .orderBy(desc(bookingConversations.lastMessageAt));

    res.json(conversations);
  } catch (error) {
    logger.error('Error fetching booking chat inbox', error);
    res.status(500).json({ error: 'Failed to fetch inbox' });
  }
});

/**
 * POST /api/booking-chat/:bookingId/open
 */
router.post('/:bookingId/open', async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { bookingId } = req.params;

    // 1. Find booking — check generic table first, then platform-specific tables
    let customerId: string | null = null;
    let providerId: string | null = null;
    let bookingStatus: string | null = null;
    let platform = 'walk_my_pet';

    const [genericBooking] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
    if (genericBooking) {
      customerId = genericBooking.userId;
      providerId = genericBooking.providerId;
      bookingStatus = genericBooking.status;
      platform = (genericBooking as any).platformId || 'walk_my_pet';
    } else {
      // Fall back to walk_bookings
      const [walkB] = await db.select().from(walkBookings).where(eq(walkBookings.bookingId, bookingId)).limit(1);
      if (walkB) {
        customerId = walkB.ownerId;
        providerId = walkB.walkerId;
        bookingStatus = walkB.status;
        platform = 'walk_my_pet';
      } else {
        // Fall back to sitter_bookings
        const [sitterB] = await db.select().from(sitterBookings).where(eq(sitterBookings.bookingId, bookingId)).limit(1);
        if (sitterB) {
          customerId = sitterB.ownerId;
          providerId = sitterB.sitterId?.toString() ?? null;
          bookingStatus = sitterB.status;
          platform = 'sitter_suite';
        }
      }
    }

    if (!customerId || !providerId) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // 2. Verify participant
    if (customerId !== uid && providerId !== uid) {
      return res.status(403).json({ error: 'Not a participant in this booking' });
    }

    // 3. Verify status — only confirmed or in_progress may open chat
    if (bookingStatus !== 'confirmed' && bookingStatus !== 'in_progress') {
      return res.status(400).json({ error: 'Chat can only be opened for confirmed or in-progress bookings' });
    }

    // 4. Check if conversation already exists
    const [existingConv] = await db
      .select()
      .from(bookingConversations)
      .where(eq(bookingConversations.bookingId, bookingId))
      .limit(1);

    if (existingConv) {
      return res.json({ conversationId: existingConv.conversationId });
    }

    // 5. Create conversation (exactly one per booking — UNIQUE INDEX enforces this)
    const conversationId = `BC-${nanoid()}`;
    const newConv = {
      conversationId,
      bookingId,
      platform,
      customerId,
      providerId,
      chatStatus: 'active',
      customerUnread: 0,
      providerUnread: 0,
      lastMessageAt: new Date(),
    };

    await db.insert(bookingConversations).values(newConv);

    // 6. Insert system message
    const messageId = `BM-${nanoid()}`;
    await db.insert(bookingMessages).values({
      messageId,
      conversationId,
      senderUid: 'system',
      senderRole: 'system',
      messageType: 'system_event',
      systemEventType: 'booking_confirmed',
      content: 'Chat opened. You can now message each other about your booking.',
      createdAt: new Date(),
    });

    res.json({ conversationId });
  } catch (error) {
    logger.error('Error opening booking chat', error);
    res.status(500).json({ error: 'Failed to open chat' });
  }
});

/**
 * GET /api/booking-chat/:bookingId
 */
router.get('/:bookingId', async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { bookingId } = req.params;
    const isAdmin = (req as any).firebaseUser?.claims?.role === 'admin';

    const [conv] = await db
      .select()
      .from(bookingConversations)
      .where(eq(bookingConversations.bookingId, bookingId))
      .limit(1);

    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (!isAdmin && conv.customerId !== uid && conv.providerId !== uid) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const messages = await db
      .select()
      .from(bookingMessages)
      .where(eq(bookingMessages.conversationId, conv.conversationId))
      .orderBy(desc(bookingMessages.createdAt))
      .limit(30);

    res.json({
      conversation: conv,
      messages: messages.reverse(),
    });
  } catch (error) {
    logger.error('Error fetching booking chat', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

/**
 * GET /api/booking-chat/:bookingId/messages
 */
router.get('/:bookingId/messages', async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { bookingId } = req.params;
    const { beforeMessageId } = req.query;
    const isAdmin = (req as any).firebaseUser?.claims?.role === 'admin';

    const [conv] = await db
      .select()
      .from(bookingConversations)
      .where(eq(bookingConversations.bookingId, bookingId))
      .limit(1);

    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (!isAdmin && conv.customerId !== uid && conv.providerId !== uid) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let query = db
      .select()
      .from(bookingMessages)
      .where(eq(bookingMessages.conversationId, conv.conversationId));

    if (beforeMessageId) {
      const [beforeMsg] = await db
        .select()
        .from(bookingMessages)
        .where(eq(bookingMessages.messageId, String(beforeMessageId)))
        .limit(1);

      if (beforeMsg) {
        query = db
          .select()
          .from(bookingMessages)
          .where(and(
            eq(bookingMessages.conversationId, conv.conversationId),
            lt(bookingMessages.createdAt, beforeMsg.createdAt)
          ));
      }
    }

    const messages = await query
      .orderBy(desc(bookingMessages.createdAt))
      .limit(30);

    res.json(messages.reverse());
  } catch (error) {
    logger.error('Error fetching booking chat messages', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

/**
 * POST /api/booking-chat/:bookingId/send
 */
router.post('/:bookingId/send', async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { bookingId } = req.params;
    const { content, messageType = 'text' } = req.body;

    // 1. Participant check
    const [conv] = await db
      .select()
      .from(bookingConversations)
      .where(eq(bookingConversations.bookingId, bookingId))
      .limit(1);

    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const isCustomer = conv.customerId === uid;
    const isProvider = conv.providerId === uid;

    if (!isCustomer && !isProvider) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // 2. chatStatus check
    if (conv.chatStatus !== 'active') {
      return res.status(403).json({ error: 'Conversation is not active' });
    }

    // 3. Rate limit check (§6 — max 10 msg/user/conversation/60s)
    if (!checkSendRateLimit(uid, conv.conversationId)) {
      return res.status(429).json({ error: 'Too many messages. Please wait before sending again.' });
    }

    // 4. Validation
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Message content is required' });
    }

    // 5. XSS sanitization (§6 — strip all HTML before storing)
    const safeContent = sanitizeMessageContent(content);
    if (!safeContent || safeContent.length === 0) {
      return res.status(400).json({ error: 'Message content cannot be empty after sanitization' });
    }
    if (safeContent.length > 2000) {
      return res.status(400).json({ error: 'Message exceeds 2000 character limit' });
    }

    // 6. Idempotency — prevent duplicate sends (§6)
    const { clientMessageId } = req.body;
    if (clientMessageId) {
      const [existing] = await db
        .select({ messageId: bookingMessages.messageId })
        .from(bookingMessages)
        .where(and(
          eq(bookingMessages.conversationId, conv.conversationId),
          eq(bookingMessages.senderUid, uid),
          sql`metadata->>'clientMessageId' = ${clientMessageId}`
        ))
        .limit(1)
        .catch(() => [null]);
      if (existing) {
        return res.status(200).json({ deduplicated: true, messageId: existing.messageId });
      }
    }

    // 7. Contact info + URL + @handle detection (§7)
    const isFlagged = contactInfoPattern.test(safeContent);
    const flagReason = isFlagged ? detectFlagReason(safeContent) : null;

    // 8. Insert message
    const messageId = `BM-${nanoid()}`;
    const senderRole = isCustomer ? 'customer' : 'provider';
    const newMessage = {
      messageId,
      conversationId: conv.conversationId,
      senderUid: uid,
      senderRole,
      messageType,
      content: safeContent,
      isFlagged,
      flaggedReason: flagReason,
      createdAt: new Date(),
    };

    const [insertedMessage] = await db.insert(bookingMessages).values(newMessage).returning();

    // 6. Update conversation
    const unreadUpdate = isCustomer 
      ? { providerUnread: conv.providerUnread + 1 }
      : { customerUnread: conv.customerUnread + 1 };

    await db.update(bookingConversations)
      .set({
        ...unreadUpdate,
        lastMessageAt: new Date(),
        lastMessagePreview: content.substring(0, 120),
      })
      .where(eq(bookingConversations.conversationId, conv.conversationId));

    // 7. Broadcast
    const participantUids = [conv.customerId, conv.providerId];
    broadcastBookingChatMessage(conv.conversationId, insertedMessage, participantUids);
    broadcastBookingChatUnread(
      conv.conversationId, 
      isCustomer ? conv.customerUnread : conv.customerUnread + 1,
      isProvider ? conv.providerUnread : conv.providerUnread + 1,
      participantUids
    );

    // 9. Notification cascade: in-app → push → email (§9)
    try {
      const recipientUid = isCustomer ? conv.providerId : conv.customerId;

      // 9a. Always create an in-app notification record (§9a)
      await db.insert(superAppNotifications).values({
        userId: recipientUid,
        type: 'booking_chat_message',
        title: 'New message',
        titleHe: 'הודעה חדשה',
        body: `You have a new message about booking ${bookingId}`,
        bodyHe: `יש לך הודעה חדשה לגבי הזמנה ${bookingId}`,
        actionUrl: `/booking-chat/${bookingId}`,
        actionType: 'open_chat',
        bookingId: bookingId,
        relatedId: conv.conversationId,
        channels: ['in_app'],
        isRead: false,
        createdAt: new Date(),
      }).catch(err => logger.warn('[ChatNotification] In-app record insert failed', err));

      // 9b & 9c. If recipient is offline, try push then email
      if (!isUserConnected(recipientUid)) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (!conv.lastMessageAt || conv.lastMessageAt < oneHourAgo) {
          const recipient = await firebaseAuth.getUser(recipientUid);

          // 9b. FCM push notification if token available (§9b)
          const customClaims = recipient.customClaims as Record<string, any> | undefined;
          const fcmToken = customClaims?.fcmToken;
          if (fcmToken) {
            try {
              const admin = await import('firebase-admin').then(m => m.default);
              await admin.messaging().send({
                token: fcmToken,
                notification: {
                  title: 'New message about your booking',
                  body: `You have a new message for booking ${bookingId}`,
                },
                data: {
                  type: 'booking_chat_message',
                  bookingId,
                  conversationId: conv.conversationId,
                  actionUrl: `/booking-chat/${bookingId}`,
                },
              });
              logger.info('[ChatNotification] FCM push sent', { recipientUid, bookingId });
            } catch (fcmErr) {
              logger.warn('[ChatNotification] FCM push failed', fcmErr);
            }
          }

          // 9c. Email fallback (§9c)
          if (recipient.email) {
            try {
              await sgMail.send({
                to: recipient.email,
                from: 'noreply@petwash.co.il',
                subject: 'New message about your booking',
                text: `You have a new message about booking ${bookingId}. Log in to reply.`,
                html: `<p>You have a new message about booking <strong>${bookingId}</strong>.</p><p><a href="https://petwash.co.il/booking-chat/${bookingId}">Log in to reply</a>.</p>`,
              });
              logger.info('[ChatNotification] Offline email fallback sent', { recipientUid, bookingId });
            } catch (emailErr) {
              logger.warn('[ChatNotification] Email fallback failed', emailErr);
            }
          }
        }
      }
    } catch (notifErr) {
      logger.warn('[ChatNotification] Notification cascade failed', notifErr);
    }

    logger.info(`[BookingChat] Message sent in ${conv.conversationId}`);

    res.json(insertedMessage);
  } catch (error) {
    logger.error('Error sending booking chat message', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

/**
 * PUT /api/booking-chat/:bookingId/read
 */
router.put('/:bookingId/read', async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { bookingId } = req.params;

    const [conv] = await db
      .select()
      .from(bookingConversations)
      .where(eq(bookingConversations.bookingId, bookingId))
      .limit(1);

    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const isCustomer = conv.customerId === uid;
    const isProvider = conv.providerId === uid;

    if (!isCustomer && !isProvider) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const now = new Date();
    if (isCustomer) {
      await db.update(bookingConversations)
        .set({ customerUnread: 0 })
        .where(eq(bookingConversations.conversationId, conv.conversationId));
      
      await db.update(bookingMessages)
        .set({ readByCustomerAt: now })
        .where(and(
          eq(bookingMessages.conversationId, conv.conversationId),
          sql`${bookingMessages.readByCustomerAt} IS NULL`
        ));
    } else {
      await db.update(bookingConversations)
        .set({ providerUnread: 0 })
        .where(eq(bookingConversations.conversationId, conv.conversationId));

      await db.update(bookingMessages)
        .set({ readByProviderAt: now })
        .where(and(
          eq(bookingMessages.conversationId, conv.conversationId),
          sql`${bookingMessages.readByProviderAt} IS NULL`
        ));
    }

    const participantUids = [conv.customerId, conv.providerId];
    broadcastBookingChatRead(conv.conversationId, isCustomer ? 'customer' : 'provider', now.toISOString(), participantUids);
    
    const updatedConv = isCustomer ? { customerUnread: 0, providerUnread: conv.providerUnread } : { customerUnread: conv.customerUnread, providerUnread: 0 };
    broadcastBookingChatUnread(conv.conversationId, updatedConv.customerUnread, updatedConv.providerUnread, participantUids);

    res.json(updatedConv);
  } catch (error) {
    logger.error('Error marking booking chat as read', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

/**
 * POST /api/booking-chat/:bookingId/report
 */
router.post('/:bookingId/report', async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { bookingId } = req.params;
    const { messageId, reason, blockUser } = req.body;

    const [conv] = await db
      .select()
      .from(bookingConversations)
      .where(eq(bookingConversations.bookingId, bookingId))
      .limit(1);

    if (!conv || (conv.customerId !== uid && conv.providerId !== uid)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (messageId) {
      await db.update(bookingMessages)
        .set({ isFlagged: true, flaggedReason: reason })
        .where(eq(bookingMessages.messageId, messageId));
    }

    if (blockUser) {
      const blockedUid = uid === conv.customerId ? conv.providerId : conv.customerId;
      await db.insert(userBlocks).values({
        blockerUid: uid,
        blockedUid,
        reason: reason || 'Blocked from chat report',
      });
      logger.info(`[ChatReport] User ${uid} blocked ${blockedUid}`);
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error reporting booking chat message', error);
    res.status(500).json({ error: 'Failed to report message' });
  }
});

/**
 * POST /api/booking-chat/:bookingId/provider-arriving
 * §5: Provider signals they are on their way — injects provider_arriving system message
 */
router.post('/:bookingId/provider-arriving', async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { bookingId } = req.params;

    const [conv] = await db
      .select()
      .from(bookingConversations)
      .where(eq(bookingConversations.bookingId, bookingId))
      .limit(1);

    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Only the provider may signal arriving
    if (conv.providerId !== uid) {
      return res.status(403).json({ error: 'Only the assigned provider can signal arrival' });
    }

    if (conv.chatStatus !== 'active') {
      return res.status(403).json({ error: 'Chat is not active' });
    }

    const messageId = `BM-${nanoid()}`;
    const [sysMsg] = await db.insert(bookingMessages).values({
      messageId,
      conversationId: conv.conversationId,
      senderUid: 'system',
      senderRole: 'system',
      messageType: 'system_event',
      content: 'Your provider is on the way!',
      systemEventType: 'provider_arriving',
      isFlagged: false,
      createdAt: new Date(),
    }).returning();

    const participantUids = [conv.customerId, conv.providerId];
    broadcastBookingChatMessage(conv.conversationId, sysMsg, participantUids);

    res.json({ success: true, message: sysMsg });
  } catch (error) {
    logger.error('Error signaling provider arriving', error);
    res.status(500).json({ error: 'Failed to signal provider arriving' });
  }
});

/**
 * POST /api/booking-chat/:bookingId/no-show
 * Report a no-show for a booking
 */
router.post('/:bookingId/no-show', async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { bookingId } = req.params;
    const { reportedBy, reason } = req.body;

    // 1. Find booking
    let platform = '';
    let booking: any = null;

    const [walkBooking] = await db.select().from(walkBookings).where(eq(walkBookings.bookingId, bookingId)).limit(1);
    if (walkBooking) {
      booking = walkBooking;
      platform = 'walk_my_pet';
    } else {
      const [sitterBooking] = await db.select().from(sitterBookings).where(eq(sitterBookings.bookingId, bookingId)).limit(1);
      if (sitterBooking) {
        booking = sitterBooking;
        platform = 'sitter_suite';
      }
    }

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // 2. Auth check
    const isCustomer = (platform === 'walk_my_pet' ? booking.ownerId : booking.ownerId) === uid;
    const isProvider = (platform === 'walk_my_pet' ? booking.walkerId : booking.sitterId?.toString()) === uid;

    if (!isCustomer && !isProvider) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // 3. Update status
    if (platform === 'walk_my_pet') {
      await db.update(walkBookings).set({ status: 'no_show', updatedAt: new Date() }).where(eq(walkBookings.bookingId, bookingId));
    } else {
      await db.update(sitterBookings).set({ status: 'no_show', updatedAt: new Date() }).where(eq(sitterBookings.bookingId, bookingId));
    }

    // 4. Sync chat
    await syncChatToBookingStatus(bookingId, 'no_show', platform);

    res.json({ success: true });
  } catch (error) {
    logger.error('Error reporting no-show', error);
    res.status(500).json({ error: 'Failed to report no-show' });
  }
});

/**
 * POST /api/booking-chat/:bookingId/dispute
 * Open a dispute for a booking
 */
router.post('/:bookingId/dispute', async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { bookingId } = req.params;
    const { reason, category } = req.body;

    // 1. Find booking
    let platform = '';
    let booking: any = null;

    const [walkBooking] = await db.select().from(walkBookings).where(eq(walkBookings.bookingId, bookingId)).limit(1);
    if (walkBooking) {
      booking = walkBooking;
      platform = 'walk_my_pet';
    } else {
      const [sitterBooking] = await db.select().from(sitterBookings).where(eq(sitterBookings.bookingId, bookingId)).limit(1);
      if (sitterBooking) {
        booking = sitterBooking;
        platform = 'sitter_suite';
      }
    }

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // 2. Auth check
    const isCustomer = (platform === 'walk_my_pet' ? booking.ownerId : booking.ownerId) === uid;
    const isProvider = (platform === 'walk_my_pet' ? booking.walkerId : booking.sitterId?.toString()) === uid;

    if (!isCustomer && !isProvider) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // 3. Update status
    if (platform === 'walk_my_pet') {
      await db.update(walkBookings).set({ status: 'disputed', updatedAt: new Date() }).where(eq(walkBookings.bookingId, bookingId));
    } else {
      await db.update(sitterBookings).set({ status: 'disputed', updatedAt: new Date() }).where(eq(sitterBookings.bookingId, bookingId));
    }

    // 4. Sync chat
    await syncChatToBookingStatus(bookingId, 'disputed', platform);

    // 5. Audit log (logger)
    logger.info(`[Dispute] Dispute opened for booking ${bookingId}`, { uid, platform, reason, category });

    res.json({ success: true, disputeId: `DISP-${nanoid(8)}` });
  } catch (error) {
    logger.error('Error opening dispute', error);
    res.status(500).json({ error: 'Failed to open dispute' });
  }
});

/**
 * ADMIN: GET /api/admin/booking-chat/:bookingId
 */
router.get('/admin/:bookingId', async (req, res) => {
  try {
    const claims = (req as any).firebaseUser?.claims;
    if (claims?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { bookingId } = req.params;
    const [conv] = await db
      .select()
      .from(bookingConversations)
      .where(eq(bookingConversations.bookingId, bookingId))
      .limit(1);

    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const messages = await db
      .select()
      .from(bookingMessages)
      .where(eq(bookingMessages.conversationId, conv.conversationId))
      .orderBy(desc(bookingMessages.createdAt));

    const sanitizedMessages = messages.map(m => {
      if (m.isDeleted) {
        return { ...m, content: '[Message removed]' };
      }
      return m;
    });

    res.json({
      conversation: conv,
      messages: sanitizedMessages.reverse(),
    });
  } catch (error) {
    logger.error('Admin error fetching booking chat', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * ADMIN: POST /api/admin/booking-chat/messages/:messageId/moderate
 */
router.post('/admin/messages/:messageId/moderate', async (req, res) => {
  try {
    const claims = (req as any).firebaseUser?.claims;
    const uid = req.firebaseUser!.uid;
    if (claims?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { messageId } = req.params;
    // §10: Supported actions: delete | clear_flag | flag | hide | add_review_note
    const { action, reason, reviewNotes } = req.body;

    if (action === 'delete') {
      // Soft delete — history preserved for legal review (§10)
      await db.update(bookingMessages)
        .set({ isDeleted: true, deletedBy: uid, moderatedBy: uid })
        .where(eq(bookingMessages.messageId, messageId));

    } else if (action === 'clear_flag') {
      await db.update(bookingMessages)
        .set({ isFlagged: false, flaggedReason: null, moderatedBy: uid })
        .where(eq(bookingMessages.messageId, messageId));

    } else if (action === 'flag') {
      // Admin flags message manually with a reason
      await db.update(bookingMessages)
        .set({ isFlagged: true, flaggedReason: reason || 'admin_flagged', moderatedBy: uid })
        .where(eq(bookingMessages.messageId, messageId));

    } else if (action === 'hide') {
      // Soft delete but flag as hidden (alias to soft delete)
      await db.update(bookingMessages)
        .set({ isDeleted: true, deletedBy: uid, moderatedBy: uid, flaggedReason: 'hidden_by_admin' })
        .where(eq(bookingMessages.messageId, messageId));

    } else if (action === 'add_review_note') {
      // §10: Attach dispute review notes to the conversation (not message)
      if (!reviewNotes) {
        return res.status(400).json({ error: 'reviewNotes is required for add_review_note action' });
      }
      const [msg] = await db
        .select({ conversationId: bookingMessages.conversationId })
        .from(bookingMessages)
        .where(eq(bookingMessages.messageId, messageId))
        .limit(1);
      if (!msg) {
        return res.status(404).json({ error: 'Message not found' });
      }
      await db.update(bookingConversations)
        .set({ reviewNotes })
        .where(eq(bookingConversations.conversationId, msg.conversationId));

    } else {
      return res.status(400).json({ error: 'Invalid moderation action. Use: delete | clear_flag | flag | hide | add_review_note' });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Admin error moderating message', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

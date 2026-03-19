import { Router } from 'express';
import multer from 'multer';
import { db } from '../db';
import { 
  bookingConversations, 
  bookingMessages, 
  bookings,
  walkBookings,
  sitterBookings,
  userBlocks,
  superAppNotifications,
  sessionCareLogs,
  insertBookingConversationSchema,
  insertBookingMessageSchema,
  insertSessionCareLogSchema,
} from '@shared/schema';
import { eq, and, or, desc, lt, sql } from 'drizzle-orm';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { logger } from '../lib/logger';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
import { 
  broadcastBookingChatMessage, 
  broadcastBookingChatRead, 
  broadcastBookingChatUnread,
  broadcastReaction,
  isUserConnected
} from '../websocket';
import { syncChatToBookingStatus } from '../lib/booking-chat-sync';
import { auth as firebaseAuth, storage as firebaseStorage } from '../lib/firebase-admin';
import sgMail from '../lib/sendgrid';

// Multer for in-memory image upload (max 8MB)
const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// Multer for in-memory audio upload (max 5MB, voice messages)
const audioUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) cb(null, true);
    else cb(new Error('Only audio files are allowed'));
  },
});

// In-memory payment CTA cooldown (conversationId → last CTA timestamp)
const paymentCtaCooldowns = new Map<string, number>();
const PAYMENT_CTA_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

async function checkPaymentIntent(
  conversationId: string,
  content: string,
  conv: { customerId: string; providerId: string },
  bookingId: string
) {
  const lastCta = paymentCtaCooldowns.get(conversationId) || 0;
  if (Date.now() - lastCta < PAYMENT_CTA_COOLDOWN_MS) return;

  try {
    const genAI = new GoogleGenAI(process.env.AI_INTEGRATIONS_GEMINI_API_KEY || '');
    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [{ text: `You are analyzing a chat message in a pet care service app. Detect if the message implies a tip, payment, extra service request, or upgrade. Reply with JSON only: {"intent": true/false, "ctaType": "tip"|"upgrade"|"package"|null, "ctaText": "short friendly CTA (max 10 words)"|null}. Message: "${content.slice(0, 300)}"` }]
      }],
    });
    const raw = result.text?.trim() || '';
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    if (!parsed.intent) return;

    paymentCtaCooldowns.set(conversationId, Date.now());

    const [ctaMsg] = await db.insert(bookingMessages).values({
      messageId: `BM-${nanoid()}`,
      conversationId,
      senderUid: 'system',
      senderRole: 'system',
      messageType: 'payment_cta',
      content: parsed.ctaText || 'Quick payment option available',
      isFlagged: false,
      createdAt: new Date(),
      metadata: { ctaType: parsed.ctaType, bookingId },
    }).returning();

    const participantUids = [conv.customerId, conv.providerId];
    broadcastBookingChatMessage(conversationId, ctaMsg, participantUids);
  } catch {
    // best-effort only, never throw
  }
}

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

/**
 * §6 SEND RATE LIMITER — 10 messages per user per conversation per 60 seconds.
 *
 * CURRENT IMPLEMENTATION: in-memory Map (single-instance safe only).
 *
 * Limitation: state lives in process memory. Under horizontal scaling (multiple
 * Node.js instances behind a load balancer), each instance maintains its own
 * independent counter, so a user can send up to 10 × N messages per window
 * across N instances. This is acceptable for single-instance production launch.
 *
 * REDIS MIGRATION PLAN (required before horizontal scaling):
 * Replace the Map with an atomic Redis INCR + EXPIRE pattern:
 *
 *   const key = `chat:rl:${uid}:${conversationId}`;
 *   const count = await redis.incr(key);
 *   if (count === 1) await redis.expire(key, 60);   // set TTL only on first increment
 *   if (count > 10) throw new RateLimitError();
 *
 * INCR is atomic — no race condition between read and write. The counter expires
 * automatically after 60s. With Redis, all instances share one counter, so the
 * 10-msg/60s limit applies across the entire cluster.
 *
 * Redis client to add: `ioredis` package + REDIS_URL secret.
 * Wrapper function signature stays identical — only the body changes.
 * No endpoint changes or schema changes required.
 */
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

/*
 * REDIS MIGRATION — drop-in replacement for checkSendRateLimit above.
 * Uncomment and wire in a Redis client (ioredis) when moving to multi-instance:
 *
 * import Redis from 'ioredis';
 * const redis = new Redis(process.env.REDIS_URL!);
 *
 * async function checkSendRateLimitRedis(uid: string, conversationId: string): Promise<boolean> {
 *   const key = `chat:rl:${uid}:${conversationId}`;
 *   const count = await redis.incr(key);
 *   if (count === 1) await redis.expire(key, 60);
 *   return count <= 10;
 * }
 *
 * Then in the send handler, replace:
 *   if (!checkSendRateLimit(uid, conv.conversationId)) { ... }
 * with:
 *   if (!await checkSendRateLimitRedis(uid, conv.conversationId)) { ... }
 */

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

// ── Static notification routes MUST be before /:bookingId* to avoid Express ──
// ── treating "notifications" as a bookingId parameter.                       ──

/**
 * GET /api/booking-chat/notifications/grouped
 * Wave 1 #4: Return in-app notifications grouped by bookingId.
 */
router.get('/notifications/grouped', async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const rawNotifs = await db
      .select()
      .from(superAppNotifications)
      .where(
        and(
          eq(superAppNotifications.userId, uid),
          sql`${superAppNotifications.createdAt} > NOW() - INTERVAL '30 days'`
        )
      )
      .orderBy(desc(superAppNotifications.createdAt))
      .limit(100);

    const groupMap = new Map<string, {
      bookingId: string | null; platform: string | null;
      notificationType: string | null;
      totalCount: number; unreadCount: number;
      latestTitle: string; latestBody: string;
      latestAt: Date | null; ids: string[]; actionUrl: string | null;
      rebookTriggerId?: number | null;
    }>();

    for (const n of rawNotifs) {
      const key = n.bookingId ?? `__other__${n.type}__${n.id}`;
      const existing = groupMap.get(key);
      const meta = n.metadata as Record<string, any> | null;
      if (!existing) {
        groupMap.set(key, {
          bookingId: n.bookingId ?? null, platform: null,
          notificationType: n.type ?? null,
          totalCount: 1, unreadCount: n.isRead ? 0 : 1,
          latestTitle: n.title, latestBody: n.body,
          latestAt: n.createdAt, ids: [n.id], actionUrl: n.actionUrl ?? null,
          rebookTriggerId: meta?.rebookTriggerId ?? null,
        });
      } else {
        existing.totalCount++;
        if (!n.isRead) existing.unreadCount++;
        if (n.createdAt && (!existing.latestAt || n.createdAt > existing.latestAt)) {
          existing.latestTitle = n.title; existing.latestBody = n.body;
          existing.latestAt = n.createdAt; existing.actionUrl = n.actionUrl ?? existing.actionUrl;
          existing.notificationType = n.type ?? existing.notificationType;
          if (meta?.rebookTriggerId) existing.rebookTriggerId = meta.rebookTriggerId;
        }
        existing.ids.push(n.id);
      }
    }

    const bookingIds = [...groupMap.keys()].filter(k => !k.startsWith('__other__'));
    if (bookingIds.length > 0) {
      const convs = await db
        .select({ bookingId: bookingConversations.bookingId, platform: bookingConversations.platform })
        .from(bookingConversations)
        .where(sql`${bookingConversations.bookingId} = ANY(${bookingIds})`);
      for (const c of convs) {
        const grp = groupMap.get(c.bookingId);
        if (grp) grp.platform = c.platform;
      }
    }

    const groups = [...groupMap.values()]
      .filter(g => g.totalCount > 0)
      .sort((a, b) => (b.latestAt?.getTime() ?? 0) - (a.latestAt?.getTime() ?? 0));

    res.json({ groups, totalUnread: rawNotifs.filter(n => !n.isRead).length });
  } catch (error) {
    logger.error('Error fetching grouped notifications', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/**
 * PUT /api/booking-chat/notifications/mark-read
 * Wave 1 #4: Mark notification IDs as read.
 */
router.put('/notifications/mark-read', async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { ids, bookingId } = req.body as { ids?: string[]; bookingId?: string };
    if (bookingId) {
      await db.update(superAppNotifications)
        .set({ isRead: true, readAt: new Date() })
        .where(and(eq(superAppNotifications.userId, uid), eq(superAppNotifications.bookingId, bookingId)));
    } else if (ids?.length) {
      await db.update(superAppNotifications)
        .set({ isRead: true, readAt: new Date() })
        .where(and(eq(superAppNotifications.userId, uid), sql`${superAppNotifications.id} = ANY(${ids})`));
    }
    res.json({ ok: true });
  } catch (error) {
    logger.error('Error marking notifications read', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// ── Dynamic /:bookingId routes below this line ─────────────────────────────

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

    // 5b. Conflict-safe insert — bc_booking_idx (UNIQUE on booking_id) is the enforcer.
    //     Under concurrent /open requests for the same booking, exactly one INSERT wins;
    //     the rest return nothing from RETURNING. We then fall back to SELECT to get the
    //     winner's conversationId. This is fully atomic — no race window.
    const [inserted] = await db
      .insert(bookingConversations)
      .values(newConv)
      .onConflictDoNothing()
      .returning();

    if (!inserted) {
      // Another concurrent request already created the conversation — return it cleanly.
      const [existing] = await db
        .select({ conversationId: bookingConversations.conversationId })
        .from(bookingConversations)
        .where(eq(bookingConversations.bookingId, bookingId))
        .limit(1);
      return res.json({ conversationId: existing!.conversationId });
    }

    // 6. Insert system message (only for the winning insert — not for concurrent losers)
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
    const { content, messageType = 'text', replyToMessageId } = req.body;

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
      replyToMessageId: replyToMessageId || null,
      createdAt: new Date(),
      // §6 Idempotency: store clientMessageId in metadata so duplicate sends can be detected
      metadata: clientMessageId ? { clientMessageId } : null,
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

    // 7b. Async payment intent detection (T009) — fire-and-forget, never blocks response
    if (messageType === 'text' && content.trim().length > 5) {
      setImmediate(() => checkPaymentIntent(conv.conversationId, content, conv, bookingId));
    }

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

    const { lat, lng } = req.body;
    const hasGps = typeof lat === 'number' && typeof lng === 'number';

    const messageId = `BM-${nanoid()}`;
    const [sysMsg] = await db.insert(bookingMessages).values({
      messageId,
      conversationId: conv.conversationId,
      senderUid: 'system',
      senderRole: 'system',
      messageType: hasGps ? 'gps_card' : 'system_event',
      content: 'Your provider is on the way!',
      systemEventType: 'provider_arriving',
      isFlagged: false,
      createdAt: new Date(),
      metadata: hasGps ? { lat, lng, providerUid: uid } : null,
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
 * POST /api/booking-chat/:bookingId/upload
 * §5: Upload an image file → Firebase Storage → return imageUrl
 * §9: Image upload from camera or gallery
 * §16: image upload failure handling
 */
router.post('/:bookingId/upload', uploadMiddleware.single('image'), async (req: any, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { bookingId } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const [conv] = await db
      .select()
      .from(bookingConversations)
      .where(eq(bookingConversations.bookingId, bookingId))
      .limit(1);

    if (!conv || (conv.customerId !== uid && conv.providerId !== uid)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (conv.chatStatus !== 'active') {
      return res.status(403).json({ error: 'Chat is read-only' });
    }

    // Upload to Firebase Storage
    const ext = req.file.mimetype === 'image/png' ? 'png' : req.file.mimetype === 'image/webp' ? 'webp' : 'jpg';
    const fileName = `chat-images/${conv.conversationId}/${nanoid()}.${ext}`;
    const bucket = firebaseStorage.bucket();
    const fileRef = bucket.file(fileName);

    await fileRef.save(req.file.buffer, {
      metadata: {
        contentType: req.file.mimetype,
        metadata: { uploadedBy: uid, conversationId: conv.conversationId },
      },
    });

    // Make publicly readable
    await fileRef.makePublic();
    const imageUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

    logger.info(`[ChatUpload] Image uploaded for booking ${bookingId} by ${uid}: ${imageUrl}`);

    // Gemini auto-caption for provider session photos
    let aiCaption: string | null = null;
    const isProvider = conv.providerId === uid;
    if (isProvider) {
      try {
        const genAI = new GoogleGenAI(process.env.AI_INTEGRATIONS_GEMINI_API_KEY || '');
        const imageBytes = req.file.buffer.toString('base64');
        const result = await genAI.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            { role: 'user', parts: [
              { inlineData: { mimeType: req.file.mimetype, data: imageBytes } },
              { text: 'You are captioning a pet care session photo for a premium pet service app. Write a warm, short caption (max 12 words) that could be shown to the pet owner. Focus on the pet\'s mood or activity. Add one relevant emoji at the end. Do not describe the human, only the pet.' }
            ]}
          ],
        });
        aiCaption = result.text?.trim() || null;
      } catch (captionErr) {
        logger.warn('[ChatUpload] Gemini caption failed', captionErr);
      }
    }

    res.json({ imageUrl, aiCaption });
  } catch (error) {
    logger.error('Error uploading chat image', error);
    res.status(500).json({ error: 'Image upload failed' });
  }
});

/**
 * POST /api/booking-chat/:bookingId/upload-audio
 * Upload a voice message (WebM/mp4, max 5MB) → Firebase Storage + Gemini transcription
 */
router.post('/:bookingId/upload-audio', audioUploadMiddleware.single('audio'), async (req: any, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { bookingId } = req.params;

    if (!req.file) return res.status(400).json({ error: 'No audio file provided' });

    const [conv] = await db.select().from(bookingConversations)
      .where(eq(bookingConversations.bookingId, bookingId)).limit(1);

    if (!conv || (conv.customerId !== uid && conv.providerId !== uid)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (conv.chatStatus !== 'active') {
      return res.status(403).json({ error: 'Chat is read-only' });
    }

    const ext = req.file.mimetype.includes('mp4') ? 'mp4' : 'webm';
    const fileName = `chat-audio/${conv.conversationId}/${nanoid()}.${ext}`;
    const bucket = firebaseStorage.bucket();
    const fileRef = bucket.file(fileName);

    await fileRef.save(req.file.buffer, {
      metadata: { contentType: req.file.mimetype, metadata: { uploadedBy: uid } },
    });
    await fileRef.makePublic();
    const audioUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

    let transcript: string | null = null;
    try {
      const genAI = new GoogleGenAI(process.env.AI_INTEGRATIONS_GEMINI_API_KEY || '');
      const audioBytes = req.file.buffer.toString('base64');
      const result = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType: req.file.mimetype, data: audioBytes } },
            { text: 'Transcribe this voice message accurately. Return only the transcribed text with no preamble.' },
          ]
        }],
      });
      transcript = result.text?.trim() || null;
    } catch {
      logger.warn('[AudioUpload] Gemini transcription failed');
    }

    res.json({ audioUrl, transcript });
  } catch (error) {
    logger.error('Error uploading chat audio', error);
    res.status(500).json({ error: 'Audio upload failed' });
  }
});

/**
 * POST /api/booking-chat/:bookingId/ai-summarize
 * §14: Gemini summarizes the conversation for user/provider — never auto-sends.
 */
router.post('/:bookingId/ai-summarize', async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { bookingId } = req.params;

    const [conv] = await db
      .select()
      .from(bookingConversations)
      .where(eq(bookingConversations.bookingId, bookingId))
      .limit(1);

    if (!conv || (conv.customerId !== uid && conv.providerId !== uid)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const messages = await db
      .select()
      .from(bookingMessages)
      .where(eq(bookingMessages.conversationId, conv.conversationId))
      .orderBy(desc(bookingMessages.createdAt))
      .limit(30);

    messages.reverse();

    const isProvider = conv.providerId === uid;
    const myRole = isProvider ? 'provider' : 'customer';
    const otherRole = isProvider ? 'customer' : 'provider';

    const conversationText = messages
      .filter(m => !m.isDeleted)
      .map(m => {
        const roleLabel = m.senderRole === 'system' ? 'SYSTEM' : (m.senderUid === uid ? `ME (${myRole})` : `THEM (${otherRole})`);
        return `${roleLabel}: ${m.content}`;
      })
      .join('\n');

    const prompt = `You are a helpful assistant for a pet care marketplace called PetWash.
Summarize this conversation in 2-4 concise bullet points in the same language as the conversation.
Focus on: what was discussed, any commitments made, any open items.

Conversation:
${conversationText || '(no messages yet)'}

Summary (bullet points):`;

    const genAI = new GoogleGenAI(process.env.AI_INTEGRATIONS_GEMINI_API_KEY || '');
    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const summary = response.text?.trim() || '';
    res.json({ summary });
  } catch (error) {
    logger.error('Error generating AI summary', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

/**
 * POST /api/booking-chat/:bookingId/ai-draft
 * Ask Gemini to draft a polite, contextual reply — never auto-sends.
 */
router.post('/:bookingId/ai-draft', async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { bookingId } = req.params;

    const [conv] = await db
      .select()
      .from(bookingConversations)
      .where(eq(bookingConversations.bookingId, bookingId))
      .limit(1);

    if (!conv || (conv.customerId !== uid && conv.providerId !== uid)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const recentMessages = await db
      .select()
      .from(bookingMessages)
      .where(eq(bookingMessages.conversationId, conv.conversationId))
      .orderBy(desc(bookingMessages.createdAt))
      .limit(10);

    recentMessages.reverse();

    const isProvider = conv.providerId === uid;
    const myRole = isProvider ? 'provider' : 'customer';
    const otherRole = isProvider ? 'customer' : 'provider';

    const conversationText = recentMessages
      .map(m => {
        const roleLabel = m.senderRole === 'system' ? 'SYSTEM' : (m.senderUid === uid ? `ME (${myRole})` : `THEM (${otherRole})`);
        return `${roleLabel}: ${m.content}`;
      })
      .join('\n');

    const prompt = `You are a helpful assistant for a pet care marketplace called PetWash.
A ${myRole} needs help drafting a polite, professional, and brief reply in the same language as the conversation.
Keep the reply concise (1-3 sentences). Do not include greetings or sign-offs — just the reply body.
Do not auto-share any personal contact information.

Recent conversation:
${conversationText}

Draft a reply for the ${myRole}:`;

    const genAI = new GoogleGenAI(process.env.AI_INTEGRATIONS_GEMINI_API_KEY || '');
    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const draft = response.text?.trim() || '';
    res.json({ draft });
  } catch (error) {
    logger.error('Error generating AI draft', error);
    res.status(500).json({ error: 'Failed to generate draft' });
  }
});

/**
 * POST /api/booking-chat/:bookingId/messages/:messageId/translate
 * T010: Gemini auto-detects source language and translates to the target language.
 */
router.post('/:bookingId/messages/:messageId/translate', async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { bookingId, messageId } = req.params;
    const { targetLang = 'en' } = req.body;

    const [conv] = await db.select().from(bookingConversations)
      .where(eq(bookingConversations.bookingId, bookingId)).limit(1);
    if (!conv || (conv.customerId !== uid && conv.providerId !== uid)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [msg] = await db.select().from(bookingMessages)
      .where(eq(bookingMessages.messageId, messageId)).limit(1);
    if (!msg || !msg.content) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const LANG_NAMES: Record<string, string> = { en: 'English', he: 'Hebrew', ar: 'Arabic', ru: 'Russian' };
    const targetName = LANG_NAMES[targetLang] || 'English';

    const genAI = new GoogleGenAI(process.env.AI_INTEGRATIONS_GEMINI_API_KEY || '');
    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [{ text: `Translate the following message to ${targetName}. Return ONLY the translated text with no explanation, preamble, or quotation marks.\n\nMessage: ${msg.content}` }]
      }],
    });
    const translated = result.text?.trim() || msg.content;
    res.json({ translated, sourceContent: msg.content });
  } catch (error) {
    logger.error('Error translating message', error);
    res.status(500).json({ error: 'Translation failed' });
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

/**
 * POST /api/booking-chat/:bookingId/care-log
 * Provider submits pet health summary after session. Gemini generates customer-facing prose.
 */
router.post('/:bookingId/care-log', async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { bookingId } = req.params;

    const [conv] = await db
      .select()
      .from(bookingConversations)
      .where(eq(bookingConversations.bookingId, bookingId))
      .limit(1);

    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    if (conv.providerId !== uid) return res.status(403).json({ error: 'Only providers can submit care logs' });

    const parsed = insertSessionCareLogSchema.safeParse({
      bookingId: parseInt(bookingId) || 0,
      petId: req.body.petId ? parseInt(req.body.petId) : null,
      providerUid: uid,
      mood: req.body.mood,
      energyLevel: parseInt(req.body.energyLevel) || 3,
      ateWell: Boolean(req.body.ateWell),
      drankWater: Boolean(req.body.drankWater),
      usedToilet: Boolean(req.body.usedToilet),
      played: Boolean(req.body.played),
      notes: req.body.notes || null,
    });

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid care log data', issues: parsed.error.issues });
    }

    const moodEmoji: Record<string, string> = { happy: '😄', calm: '😌', anxious: '😰', tired: '😴' };
    const moodText: Record<string, string> = { happy: 'happy and playful', calm: 'calm and relaxed', anxious: 'a little anxious', tired: 'tired but content' };

    let geminiSummary: string | null = null;
    try {
      const genAI = new GoogleGenAI(process.env.AI_INTEGRATIONS_GEMINI_API_KEY || '');
      const data = parsed.data;
      const prompt = `You are writing a warm, premium care summary for a pet owner. Be concise (2-3 sentences), emotional, and use the pet care details below. Do not mention that this was AI-generated.
Mood: ${data.mood} (${moodText[data.mood] || data.mood})
Energy level: ${data.energyLevel}/5
Ate well: ${data.ateWell ? 'Yes' : 'No'}
Drank water: ${data.drankWater ? 'Yes' : 'No'}
Used toilet: ${data.usedToilet ? 'Yes' : 'No'}
Played: ${data.played ? 'Yes' : 'No'}
Provider notes: ${data.notes || 'No additional notes'}
Write a 2-3 sentence summary starting with the pet's session highlights. End with one warm reassuring sentence.`;
      const result = await genAI.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
      geminiSummary = result.text?.trim() ?? null;
    } catch (aiErr) {
      logger.warn('[CareLog] Gemini summary failed', aiErr);
      const d = parsed.data;
      geminiSummary = `Your pet had a ${moodText[d.mood] || d.mood} session ${moodEmoji[d.mood] || ''}. ${d.ateWell && d.drankWater ? 'They ate and drank well.' : ''} ${d.notes ? `Provider note: ${d.notes}` : ''}`.trim();
    }

    const [careLog] = await db.insert(sessionCareLogs)
      .values({ ...parsed.data, geminiSummary })
      .returning();

    const messageId = `BM-${nanoid()}`;
    const [careSummaryMsg] = await db.insert(bookingMessages).values({
      messageId,
      conversationId: conv.conversationId,
      senderUid: 'system',
      senderRole: 'system',
      messageType: 'care_summary',
      content: geminiSummary || 'Session care summary submitted.',
      metadata: { careLogId: careLog.id, mood: parsed.data.mood, energyLevel: parsed.data.energyLevel },
    }).returning();

    const participantUids = [conv.customerId, conv.providerId];
    broadcastBookingChatMessage(conv.conversationId, careSummaryMsg, participantUids);

    res.json({ success: true, careLogId: careLog.id, summary: geminiSummary });
  } catch (error) {
    logger.error('Error submitting care log', error);
    res.status(500).json({ error: 'Failed to submit care log' });
  }
});

/**
 * POST /api/booking-chat/:bookingId/messages/:messageId/react
 * Toggle a reaction on a message (insert or delete on conflict).
 */
router.post('/:bookingId/messages/:messageId/react', async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { bookingId, messageId } = req.params;
    const { reaction } = req.body;

    const VALID_REACTIONS = ['❤️', '🐾', '👍', '⭐', '✅', '🎉'];
    if (!VALID_REACTIONS.includes(reaction)) {
      return res.status(400).json({ error: 'Invalid reaction' });
    }

    const [conv] = await db
      .select()
      .from(bookingConversations)
      .where(eq(bookingConversations.bookingId, bookingId))
      .limit(1);

    if (!conv || (conv.customerId !== uid && conv.providerId !== uid)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Toggle: try insert, on conflict delete (remove reaction)
    const existing = await db.execute(
      sql`SELECT id FROM message_reactions WHERE message_id = ${messageId} AND user_id = ${uid} AND reaction = ${reaction} LIMIT 1`
    );
    
    let action: 'added' | 'removed';
    if (existing.rows.length > 0) {
      await db.execute(sql`DELETE FROM message_reactions WHERE message_id = ${messageId} AND user_id = ${uid} AND reaction = ${reaction}`);
      action = 'removed';
    } else {
      await db.execute(sql`INSERT INTO message_reactions (message_id, user_id, reaction) VALUES (${messageId}, ${uid}, ${reaction}) ON CONFLICT DO NOTHING`);
      action = 'added';
    }

    // Get updated counts for this message
    const countsResult = await db.execute(
      sql`SELECT reaction, COUNT(*)::int AS count FROM message_reactions WHERE message_id = ${messageId} GROUP BY reaction`
    );
    const counts: Record<string, number> = {};
    countsResult.rows.forEach((r: any) => { counts[r.reaction] = r.count; });

    // Broadcast to both participants
    const participantUids = [conv.customerId, conv.providerId];
    broadcastReaction(conv.conversationId, messageId, reaction, uid, counts, participantUids);

    res.json({ success: true, action, counts });
  } catch (error) {
    logger.error('Error toggling reaction', error);
    res.status(500).json({ error: 'Failed to toggle reaction' });
  }
});

/**
 * GET /api/booking-chat/:bookingId/messages/:messageId/reactions
 * Get reaction counts for a message.
 */
router.get('/:bookingId/messages/:messageId/reactions', async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { bookingId, messageId } = req.params;

    const [conv] = await db
      .select()
      .from(bookingConversations)
      .where(eq(bookingConversations.bookingId, bookingId))
      .limit(1);

    if (!conv || (conv.customerId !== uid && conv.providerId !== uid)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const countsResult = await db.execute(
      sql`SELECT reaction, COUNT(*)::int AS count FROM message_reactions WHERE message_id = ${messageId} GROUP BY reaction`
    );
    const myReactionsResult = await db.execute(
      sql`SELECT reaction FROM message_reactions WHERE message_id = ${messageId} AND user_id = ${uid}`
    );

    const counts: Record<string, number> = {};
    countsResult.rows.forEach((r: any) => { counts[r.reaction] = r.count; });
    const myReactions = myReactionsResult.rows.map((r: any) => r.reaction);

    res.json({ counts, myReactions });
  } catch (error) {
    logger.error('Error fetching reactions', error);
    res.status(500).json({ error: 'Failed to fetch reactions' });
  }
});

export default router;

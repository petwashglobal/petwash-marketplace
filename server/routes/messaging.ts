import { Router, Request, Response } from 'express';
import { db } from '../lib/firebase-admin';
import { Storage } from '@google-cloud/storage';
import multer from 'multer';
import { nanoid } from 'nanoid';
import { 
  teamMessageSchema,
  conversationSchema,
  insertTeamMessageSchema,
  insertConversationSchema,
  FIRESTORE_PATHS,
  type TeamMessage,
  type Conversation,
  type InsertTeamMessage,
  type InsertConversation,
  type MessageAttachment
} from '@shared/firestore-schema';
import { loadEmployeeProfile } from '../middleware/roleAuth';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { logger } from '../lib/logger';
import { z } from 'zod';
import { broadcastNewMessage, notifyConversationUpdate } from '../websocket';

const router = Router();

// Initialize Google Cloud Storage
const storage = new Storage();
const MESSAGE_ATTACHMENTS_BUCKET = process.env.GCS_MESSAGE_ATTACHMENTS_BUCKET || 'petwash-message-attachments';

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
  fileFilter: (req, file, cb) => {
    // Allow documents, images, and videos (SVG blocked due to XSS risk)
    const allowedMimeTypes = [
      // Images (NO SVG - XSS risk)
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      // Videos
      'video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm',
      // Documents
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain', 'text/csv',
      // Archives (consider security scanning)
      'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
    ];

    // Block SVG explicitly (stored XSS risk)
    if (file.mimetype === 'image/svg+xml' || file.originalname.toLowerCase().endsWith('.svg')) {
      return cb(new Error('SVG files are not allowed due to security risks'));
    }

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});

// All messaging routes require authentication
router.use(validateFirebaseToken);
router.use(loadEmployeeProfile);

/**
 * GET /api/messaging/conversations - List all conversations for the current user
 */
router.get('/conversations', async (req: Request, res: Response) => {
  try {
    const uid = req.firebaseUser!.uid;
    
    const conversationsSnapshot = await db
      .collection('conversations')
      .where('participants', 'array-contains', uid)
      .orderBy('lastMessageAt', 'desc')
      .get();

    const conversations: any[] = [];
    conversationsSnapshot.forEach((doc) => {
      const data = doc.data();
      conversations.push({
        ...data,
        id: doc.id,
        createdAt: data.createdAt?.toDate(),
        lastMessageAt: data.lastMessageAt?.toDate(),
      });
    });

    res.json({ conversations });
  } catch (error) {
    logger.error('Error listing conversations:', error);
    res.status(500).json({ error: 'Failed to list conversations' });
  }
});

/**
 * GET /api/messaging/conversations/:id - Get specific conversation
 */
router.get('/conversations/:id', async (req: Request, res: Response) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { id } = req.params;

    const conversationDoc = await db
      .collection('conversations')
      .doc(id)
      .get();

    if (!conversationDoc.exists) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const data = conversationDoc.data();
    
    // Check if user is a participant
    if (!data?.participants?.includes(uid)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const conversation = {
      ...data,
      id: conversationDoc.id,
      createdAt: data?.createdAt?.toDate(),
      lastMessageAt: data?.lastMessageAt?.toDate(),
    };

    res.json({ conversation });
  } catch (error) {
    logger.error('Error fetching conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

/**
 * POST /api/messaging/conversations - Create a new conversation
 */
router.post('/conversations', async (req: Request, res: Response) => {
  try {
    const uid = req.firebaseUser!.uid;
    const employeeProfile = req.employee!;

    // Validate request body
    const bodySchema = insertConversationSchema.extend({
      participants: z.array(z.string()).min(1, { message: "At least one participant is required" }),
    });

    const validation = bodySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validation.error.errors
      });
    }
    
    const validatedData = validation.data;

    // Ensure creator is in participants
    if (!validatedData.participants.includes(uid)) {
      validatedData.participants.push(uid);
    }

    // For direct messages, check if conversation already exists
    if (validatedData.type === 'direct' && validatedData.participants.length === 2) {
      const existingSnapshot = await db
        .collection('conversations')
        .where('type', '==', 'direct')
        .where('participants', 'array-contains', uid)
        .get();

      for (const doc of existingSnapshot.docs) {
        const data = doc.data();
        const otherParticipant = validatedData.participants.find(p => p !== uid);
        if (data.participants.includes(otherParticipant)) {
          // Conversation already exists
          return res.json({
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate(),
            lastMessageAt: data.lastMessageAt?.toDate(),
          });
        }
      }
    }

    const conversationId = nanoid();
    const now = new Date();

    const conversationData: Conversation = {
      id: conversationId,
      type: validatedData.type,
      participants: validatedData.participants,
      title: validatedData.title,
      createdBy: uid,
      createdAt: now,
      lastMessageAt: now,
      unreadCount: {},
      archived: [],
      pinned: [],
      pinnedMessageId: null,
      pinnedBy: null,
      pinnedAt: null,
    };

    await db
      .collection('conversations')
      .doc(conversationId)
      .set(conversationData);

    logger.info(`[Messaging] Conversation created: ${conversationId} by ${employeeProfile.fullName}`);

    res.json({ ...conversationData, id: conversationId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    logger.error('Error creating conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

/**
 * GET /api/messaging/conversations/:id/messages - Get messages in a conversation
 */
router.get('/conversations/:id/messages', async (req: Request, res: Response) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const before = req.query.before as string; // Message ID for pagination

    // Verify user is participant
    const conversationDoc = await db.collection('conversations').doc(id).get();
    if (!conversationDoc.exists) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const conversationData = conversationDoc.data();
    if (!conversationData?.participants?.includes(uid)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let query = db
      .collection(FIRESTORE_PATHS.MESSAGES(id))
      .where('deletedAt', '==', null)
      .orderBy('createdAt', 'desc')
      .limit(limit);

    if (before) {
      const beforeDoc = await db.collection(FIRESTORE_PATHS.MESSAGES(id)).doc(before).get();
      if (beforeDoc.exists) {
        query = query.startAfter(beforeDoc);
      }
    }

    const messagesSnapshot = await query.get();

    const messages: any[] = [];
    messagesSnapshot.forEach((doc) => {
      const data = doc.data();
      messages.push({
        ...data,
        id: doc.id,
        createdAt: data.createdAt?.toDate(),
        editedAt: data.editedAt?.toDate(),
        deletedAt: data.deletedAt?.toDate(),
        attachments: data.attachments?.map((att: any) => ({
          ...att,
          uploadedAt: att.uploadedAt?.toDate(),
        })),
        readBy: data.readBy?.map((rb: any) => ({
          ...rb,
          readAt: rb.readAt?.toDate(),
        })),
        reactions: data.reactions?.map((r: any) => ({
          ...r,
          createdAt: r.createdAt?.toDate(),
        })),
      });
    });

    // Reverse to get chronological order
    messages.reverse();

    res.json({ messages });
  } catch (error) {
    logger.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

/**
 * POST /api/messaging/conversations/:id/messages - Send a message
 */
router.post('/conversations/:id/messages', upload.array('attachments', 10), async (req: Request, res: Response) => {
  try {
    const uid = req.firebaseUser!.uid;
    const employeeProfile = req.employee!;
    const { id: conversationId } = req.params;

    // Verify user is participant
    const conversationDoc = await db.collection('conversations').doc(conversationId).get();
    if (!conversationDoc.exists) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const conversationData = conversationDoc.data();
    if (!conversationData?.participants?.includes(uid)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Parse message data
    const { content, priority = 'normal' } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    // Upload attachments to GCS
    const attachments: MessageAttachment[] = [];
    const files = req.files as Express.Multer.File[];

    if (files && files.length > 0) {
      const bucket = storage.bucket(MESSAGE_ATTACHMENTS_BUCKET);

      for (const file of files) {
        const attachmentId = nanoid();
        const fileName = `${conversationId}/${attachmentId}-${file.originalname}`;
        const gcsFile = bucket.file(fileName);

        // Security: Force attachment download for SVG/HTML to prevent XSS
        const dangerousMimeTypes = ['image/svg+xml', 'text/html', 'application/xhtml+xml'];
        const contentDisposition = dangerousMimeTypes.includes(file.mimetype)
          ? `attachment; filename="${file.originalname}"`
          : 'inline';

        await gcsFile.save(file.buffer, {
          metadata: {
            contentType: file.mimetype,
            contentDisposition,
            cacheControl: 'public, max-age=31536000', // 1 year cache for immutable files
          },
        });

        // Make file publicly readable
        await gcsFile.makePublic();

        const publicUrl = `https://storage.googleapis.com/${MESSAGE_ATTACHMENTS_BUCKET}/${fileName}`;

        attachments.push({
          id: attachmentId,
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          gcsUrl: publicUrl,
          uploadedAt: new Date(),
        });
      }
    }

    const messageId = nanoid();
    const now = new Date();

    const messageData: TeamMessage = {
      id: messageId,
      conversationId,
      senderId: uid,
      senderName: employeeProfile.fullName,
      content: content.trim(),
      priority: priority as any,
      attachments,
      createdAt: now,
      editedAt: null,
      deletedAt: null,
      readBy: [{ uid, readAt: now }], // Sender has read their own message
      reactions: [],
    };

    // Save message
    await db
      .collection(FIRESTORE_PATHS.MESSAGES(conversationId))
      .doc(messageId)
      .set(messageData);

    // Update conversation's lastMessage
    const participants = conversationData.participants || [];
    const unreadCount: Record<string, number> = conversationData.unreadCount || {};

    // Increment unread count for all participants except sender
    participants.forEach((participantUid: string) => {
      if (participantUid !== uid) {
        unreadCount[participantUid] = (unreadCount[participantUid] || 0) + 1;
      }
    });

    await db.collection('conversations').doc(conversationId).update({
      lastMessageAt: now,
      lastMessagePreview: content.substring(0, 100),
      unreadCount,
    });

    logger.info(`[Messaging] Message sent in conversation ${conversationId} by ${employeeProfile.fullName}`);

    // Broadcast message via WebSocket to online participants
    try {
      broadcastNewMessage(conversationId, messageData, participants);
      
      // Notify other participants about unread count increase
      participants.forEach((participantUid: string) => {
        if (participantUid !== uid) {
          notifyConversationUpdate(participantUid, conversationId, {
            unreadCount: unreadCount[participantUid] || 0,
            lastMessagePreview: content.substring(0, 100),
            lastMessageAt: now
          });
        }
      });
    } catch (wsError) {
      // Don't fail the request if WebSocket broadcast fails
      logger.warn('[Messaging] WebSocket broadcast failed', { error: wsError });
    }

    res.json({ ...messageData, id: messageId });
  } catch (error) {
    logger.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

/**
 * POST /api/messaging/conversations/:id/messages/:messageId/read - Mark message as read
 */
router.post('/conversations/:id/messages/:messageId/read', async (req: Request, res: Response) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { id: conversationId, messageId } = req.params;

    // Verify user is participant
    const conversationDoc = await db.collection('conversations').doc(conversationId).get();
    if (!conversationDoc.exists) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const conversationData = conversationDoc.data();
    if (!conversationData?.participants?.includes(uid)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const messageDoc = await db
      .collection(FIRESTORE_PATHS.MESSAGES(conversationId))
      .doc(messageId)
      .get();

    if (!messageDoc.exists) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const messageData = messageDoc.data();
    const readBy = messageData?.readBy || [];

    // Check if already read
    const alreadyRead = readBy.some((r: any) => r.uid === uid);
    if (!alreadyRead) {
      readBy.push({ uid, readAt: new Date() });

      await db
        .collection(FIRESTORE_PATHS.MESSAGES(conversationId))
        .doc(messageId)
        .update({ readBy });

      // Decrement unread count
      const unreadCount: Record<string, number> = conversationData.unreadCount || {};
      if (unreadCount[uid] && unreadCount[uid] > 0) {
        unreadCount[uid] = unreadCount[uid] - 1;
        await db.collection('conversations').doc(conversationId).update({ unreadCount });
      }
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error marking message as read:', error);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

/**
 * POST /api/messaging/conversations/:id/read-all - Mark all messages as read in a conversation
 */
router.post('/conversations/:id/read-all', async (req: Request, res: Response) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { id: conversationId } = req.params;

    // Verify user is participant
    const conversationDoc = await db.collection('conversations').doc(conversationId).get();
    if (!conversationDoc.exists) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const conversationData = conversationDoc.data();
    if (!conversationData?.participants?.includes(uid)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Reset unread count for this user
    const unreadCount: Record<string, number> = conversationData.unreadCount || {};
    unreadCount[uid] = 0;

    await db.collection('conversations').doc(conversationId).update({ unreadCount });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error marking all messages as read:', error);
    res.status(500).json({ error: 'Failed to mark all messages as read' });
  }
});

/**
 * DELETE /api/messaging/conversations/:id/messages/:messageId - Delete a message
 */
router.delete('/conversations/:id/messages/:messageId', async (req: Request, res: Response) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { id: conversationId, messageId } = req.params;

    const messageDoc = await db
      .collection(FIRESTORE_PATHS.MESSAGES(conversationId))
      .doc(messageId)
      .get();

    if (!messageDoc.exists) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const messageData = messageDoc.data();

    // Only sender can delete their message
    if (messageData?.senderId !== uid) {
      return res.status(403).json({ error: 'You can only delete your own messages' });
    }

    // Soft delete
    await db
      .collection(FIRESTORE_PATHS.MESSAGES(conversationId))
      .doc(messageId)
      .update({ deletedAt: new Date() });

    logger.info(`[Messaging] Message ${messageId} deleted by user ${uid}`);

    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

/**
 * POST /api/messaging/conversations/:id/archive - Archive a conversation
 */
router.post('/conversations/:id/archive', async (req: Request, res: Response) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { id: conversationId } = req.params;

    const conversationDoc = await db.collection('conversations').doc(conversationId).get();
    if (!conversationDoc.exists) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const conversationData = conversationDoc.data();
    if (!conversationData?.participants?.includes(uid)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const archived = conversationData.archived || [];
    if (!archived.includes(uid)) {
      archived.push(uid);
      await db.collection('conversations').doc(conversationId).update({ archived });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error archiving conversation:', error);
    res.status(500).json({ error: 'Failed to archive conversation' });
  }
});

/**
 * POST /api/messaging/conversations/:id/unarchive - Unarchive a conversation
 */
router.post('/conversations/:id/unarchive', async (req: Request, res: Response) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { id: conversationId } = req.params;

    const conversationDoc = await db.collection('conversations').doc(conversationId).get();
    if (!conversationDoc.exists) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const conversationData = conversationDoc.data();
    if (!conversationData?.participants?.includes(uid)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const archived = (conversationData.archived || []).filter((u: string) => u !== uid);
    await db.collection('conversations').doc(conversationId).update({ archived });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error unarchiving conversation:', error);
    res.status(500).json({ error: 'Failed to unarchive conversation' });
  }
});

/**
 * POST /api/messaging/conversations/:id/pin-message - Pin a message in conversation
 */
router.post('/conversations/:id/pin-message', async (req: Request, res: Response) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { id: conversationId } = req.params;
    
    const validation = z.object({ 
      messageId: z.string().min(1, { message: "Message ID is required" }) 
    }).safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validation.error.errors
      });
    }
    
    const { messageId } = validation.data;

    const conversationDoc = await db.collection('conversations').doc(conversationId).get();
    if (!conversationDoc.exists) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const conversationData = conversationDoc.data();
    if (!conversationData?.participants?.includes(uid)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Verify message exists and belongs to this conversation
    const messageDoc = await db.collection('messages').doc(messageId).get();
    if (!messageDoc.exists) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const messageData = messageDoc.data();
    if (messageData?.conversationId !== conversationId) {
      return res.status(400).json({ error: 'Message does not belong to this conversation' });
    }

    // Pin the message
    await db.collection('conversations').doc(conversationId).update({
      pinnedMessageId: messageId,
      pinnedBy: uid,
      pinnedAt: new Date(),
    });

    // Broadcast update to all participants
    conversationData.participants.forEach((participantUid: string) => {
      notifyConversationUpdate(participantUid, conversationId, {
        type: 'message_pinned',
        messageId,
        pinnedBy: uid,
      });
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error pinning message:', error);
    res.status(500).json({ error: 'Failed to pin message' });
  }
});

/**
 * POST /api/messaging/conversations/:id/unpin-message - Unpin message from conversation
 */
router.post('/conversations/:id/unpin-message', async (req: Request, res: Response) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { id: conversationId } = req.params;

    const conversationDoc = await db.collection('conversations').doc(conversationId).get();
    if (!conversationDoc.exists) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const conversationData = conversationDoc.data();
    if (!conversationData?.participants?.includes(uid)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Unpin the message
    await db.collection('conversations').doc(conversationId).update({
      pinnedMessageId: null,
      pinnedBy: null,
      pinnedAt: null,
    });

    // Broadcast update to all participants
    conversationData.participants.forEach((participantUid: string) => {
      notifyConversationUpdate(participantUid, conversationId, {
        type: 'message_unpinned',
        unpinnedBy: uid,
      });
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error unpinning message:', error);
    res.status(500).json({ error: 'Failed to unpin message' });
  }
});

export default router;

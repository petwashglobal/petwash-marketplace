/**
 * Secure Personal Inbox API
 * 7-Star luxury internal messaging system with document signing and Google Cloud Storage backup
 */

import { Router } from 'express';
import { db } from '../db';
import { 
  userMessages, 
  messageAttachments,
  messageSignatureRequests,
  insertUserMessageSchema,
  insertMessageAttachmentSchema,
  insertMessageSignatureRequestSchema,
  type InsertUserMessage,
  type UserMessage 
} from '../../shared/schema';
import { eq, and, or, desc } from 'drizzle-orm';
import { recordAuditEvent } from '../utils/auditSignature';
import { backupMessage } from '../services/gcsBackupService';
import { logger } from '../lib/logger';
import crypto from 'crypto';

const router = Router();

/**
 * GET /api/messages/lookup-user
 * Lookup user UID by email for recipient resolution
 */
router.get('/lookup-user', async (req, res) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const email = req.query.email as string;
    if (!email) {
      return res.status(400).json({ error: 'Email parameter required' });
    }

    // Use Firebase Admin to lookup user by email
    const { getAuth } = await import('firebase-admin/auth');
    const auth = getAuth();
    
    try {
      const userRecord = await auth.getUserByEmail(email);
      
      return res.json({
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName || null,
      });
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        return res.status(404).json({ error: 'User not found with that email' });
      }
      throw error;
    }

  } catch (error: any) {
    logger.error('[Secure Inbox] User lookup failed', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Helper: Create SHA-256 hash for message content
 */
function createMessageHash(message: Partial<InsertUserMessage>): string {
  const content = JSON.stringify({
    senderId: message.senderId,
    recipientId: message.recipientId,
    subject: message.subject,
    body: message.body,
    timestamp: new Date().toISOString(),
  });
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * GET /api/messages/inbox
 * Get all messages for authenticated user (sent + received)
 */
router.get('/inbox', async (req, res) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get all messages where user is sender or recipient (not permanently deleted)
    const messages = await db
      .select()
      .from(userMessages)
      .where(
        and(
          or(
            eq(userMessages.senderId, userId),
            eq(userMessages.recipientId, userId)
          ),
          eq(userMessages.permanentlyDeleted, false)
        )
      )
      .orderBy(desc(userMessages.createdAt));

    logger.info('[Secure Inbox] Messages retrieved', { 
      userId, 
      count: messages.length 
    });

    return res.json({ messages });

  } catch (error: any) {
    logger.error('[Secure Inbox] Failed to retrieve inbox', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/messages/:messageId
 * Get specific message details with attachments
 */
router.get('/:messageId', async (req, res) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const messageId = parseInt(req.params.messageId);
    
    // Get message
    const [message] = await db
      .select()
      .from(userMessages)
      .where(eq(userMessages.id, messageId));

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Verify user has access to this message
    if (message.senderId !== userId && message.recipientId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get attachments
    const attachments = await db
      .select()
      .from(messageAttachments)
      .where(eq(messageAttachments.messageId, messageId));

    // Mark as read if recipient is viewing
    if (message.recipientId === userId && !message.isRead) {
      await db
        .update(userMessages)
        .set({ 
          isRead: true, 
          readAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(userMessages.id, messageId));
    }

    logger.info('[Secure Inbox] Message viewed', { messageId, userId });

    return res.json({ 
      message: { ...message, isRead: message.recipientId === userId ? true : message.isRead }, 
      attachments 
    });

  } catch (error: any) {
    logger.error('[Secure Inbox] Failed to retrieve message', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/messages/send
 * Send a new secure message
 */
router.post('/send', async (req, res) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validated = insertUserMessageSchema.parse(req.body);

    // Verify sender matches authenticated user
    if (validated.senderId !== userId) {
      return res.status(403).json({ error: 'Sender ID mismatch' });
    }

    // Create message hash for tamper detection
    const messageHash = createMessageHash(validated);

    // Get previous message hash for blockchain-style chaining
    const [previousMessage] = await db
      .select()
      .from(userMessages)
      .where(eq(userMessages.senderId, userId))
      .orderBy(desc(userMessages.createdAt))
      .limit(1);

    // Create cryptographic audit signature
    const auditSignature = await recordAuditEvent({
      eventType: 'send_secure_message',
      customerUid: userId,
      metadata: {
        action: 'send_secure_message',
        resourceType: 'user_message',
        resourceId: 'pending',
        subject: validated.subject,
        messageType: validated.messageType,
        priority: validated.priority,
        recipientId: validated.recipientId,
        recipientEmail: validated.recipientEmail,
        messageHash,
      },
      ipAddress: req.ip || req.headers['x-forwarded-for']?.toString() || null,
      userAgent: req.headers['user-agent'] || null,
    });

    // Insert message
    const [newMessage] = await db
      .insert(userMessages)
      .values({
        ...validated,
        messageHash,
        previousMessageHash: previousMessage?.messageHash || null,
        auditHash: auditSignature.auditHash,
        gcsBackupPath: `messages/${userId}/${Date.now()}.json`,
        backupStatus: 'pending',
      })
      .returning();

    // Trigger Google Cloud Storage backup asynchronously (don't block response)
    backupMessage({
      messageId: newMessage.id,
      userId,
      subject: newMessage.subject,
      body: newMessage.body,
      messageHash: newMessage.messageHash,
      auditHash: newMessage.auditHash,
      createdAt: new Date(newMessage.createdAt),
    })
      .then(async (result) => {
        if (result.success) {
          await db
            .update(userMessages)
            .set({ 
              backupStatus: 'completed',
              gcsBackupPath: result.gcsPath,
              updatedAt: new Date()
            })
            .where(eq(userMessages.id, newMessage.id));
        } else {
          await db
            .update(userMessages)
            .set({ 
              backupStatus: 'failed',
              updatedAt: new Date()
            })
            .where(eq(userMessages.id, newMessage.id));
        }
      })
      .catch((err) => {
        logger.error('[Secure Inbox] Backup promise error', err);
      });

    // TODO: Send email/push notification to recipient

    logger.info('[Secure Inbox] Message sent successfully', { 
      messageId: newMessage.id,
      senderId: userId,
      recipientId: validated.recipientId,
      auditHash: auditSignature.auditHash
    });

    return res.json({ 
      success: true, 
      message: newMessage,
      auditSignature 
    });

  } catch (error: any) {
    logger.error('[Secure Inbox] Failed to send message', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/messages/:messageId/star
 * Toggle star status on a message
 */
router.post('/:messageId/star', async (req, res) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const messageId = parseInt(req.params.messageId);

    // Get message
    const [message] = await db
      .select()
      .from(userMessages)
      .where(eq(userMessages.id, messageId));

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Verify user has access
    if (message.senderId !== userId && message.recipientId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Toggle star
    const [updated] = await db
      .update(userMessages)
      .set({ 
        isStarred: !message.isStarred,
        updatedAt: new Date()
      })
      .where(eq(userMessages.id, messageId))
      .returning();

    return res.json({ success: true, message: updated });

  } catch (error: any) {
    logger.error('[Secure Inbox] Failed to toggle star', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/messages/:messageId
 * Soft delete a message
 */
router.delete('/:messageId', async (req, res) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const messageId = parseInt(req.params.messageId);

    // Get message
    const [message] = await db
      .select()
      .from(userMessages)
      .where(eq(userMessages.id, messageId));

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Determine which delete flag to set
    const updateData: any = { updatedAt: new Date() };
    
    if (message.senderId === userId) {
      updateData.deletedBySender = true;
    } else if (message.recipientId === userId) {
      updateData.deletedByRecipient = true;
    } else {
      return res.status(403).json({ error: 'Access denied' });
    }

    // If both deleted, mark permanently deleted
    if (
      (message.deletedBySender && message.recipientId === userId) ||
      (message.deletedByRecipient && message.senderId === userId)
    ) {
      updateData.permanentlyDeleted = true;
    }

    await db
      .update(userMessages)
      .set(updateData)
      .where(eq(userMessages.id, messageId));

    logger.info('[Secure Inbox] Message deleted', { messageId, userId });

    return res.json({ success: true });

  } catch (error: any) {
    logger.error('[Secure Inbox] Failed to delete message', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/messages/unread/count
 * Get count of unread messages for user
 */
router.get('/unread/count', async (req, res) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const unreadMessages = await db
      .select()
      .from(userMessages)
      .where(
        and(
          eq(userMessages.recipientId, userId),
          eq(userMessages.isRead, false),
          eq(userMessages.deletedByRecipient, false),
          eq(userMessages.permanentlyDeleted, false)
        )
      );

    return res.json({ count: unreadMessages.length });

  } catch (error: any) {
    logger.error('[Secure Inbox] Failed to get unread count', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { 
  insertChatConversationSchema,
  insertChatMessageSchema,
  insertChatAttachmentSchema,
  insertChatAnalyticsSchema,
  type ChatConversation,
  type ChatMessage,
  type ChatAttachment,
} from '@shared/schema-chat';
import { chatConversations, chatMessages, chatAttachments, chatAnalytics } from '@shared/schema-chat';
import { eq, desc, and, gte, lte, like, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';

const router = Router();

// =================== AUTHENTICATION & AUTHORIZATION MIDDLEWARE ===================

interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    role?: string;
    franchiseId?: number;
  };
}

// Authentication middleware - Requires user to be logged in
async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { validateFirebaseToken } = await import('../middleware/firebase-auth');
    await validateFirebaseToken(req, res, next);
  } catch (error) {
    res.status(401).json({ success: false, error: 'Authentication required' });
  }
}

// Admin authorization middleware
function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  
  if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  
  next();
}

// Tenant scoping helper - Ensures user can only access their own data
function canAccessConversation(req: AuthenticatedRequest, conversation: ChatConversation): boolean {
  if (!req.user) return false;
  
  // Admins can access any conversation
  if (req.user.role === 'admin' || req.user.role === 'superadmin') {
    return true;
  }
  
  // Users can access their own conversations
  if (conversation.userId === req.user.uid) {
    return true;
  }
  
  // Franchise managers can access conversations for their franchise
  if (req.user.franchiseId && conversation.franchiseId === req.user.franchiseId) {
    return true;
  }
  
  return false;
}

// Validation schema for conversation updates (whitelist fields)
const updateConversationSchema = z.object({
  status: z.enum(['active', 'archived', 'deleted']).optional(),
  language: z.string().optional(),
  metadata: z.any().optional(),
}).strict(); // Reject unknown fields

// =================== CONVERSATION ROUTES ===================

// GET /api/chat/conversations - List user's conversations with pagination
router.get('/conversations', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.uid; // Force to authenticated user
    const stationId = req.query.stationId as string;
    const status = req.query.status as string || 'active';
    const limit = Math.min(parseInt(req.query.limit as string || '20'), 100); // Cap at 100
    const offset = parseInt(req.query.offset as string || '0');

    const filters = [eq(chatConversations.userId, userId)];
    
    if (stationId) {
      filters.push(eq(chatConversations.stationId, stationId));
    }
    
    if (status) {
      filters.push(eq(chatConversations.status, status));
    }

    const conversations = await db
      .select()
      .from(chatConversations)
      .where(and(...filters))
      .orderBy(desc(chatConversations.lastMessageAt))
      .limit(limit)
      .offset(offset);

    res.json({
      success: true,
      conversations,
      pagination: {
        limit,
        offset,
        hasMore: conversations.length === limit,
      }
    });
  } catch (error: any) {
    console.error('[ChatHistory] Error fetching conversations:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch conversations',
      message: error.message 
    });
  }
});

// GET /api/chat/conversations/franchise/:franchiseId - List franchise conversations (Admin/Franchise Manager only)
router.get('/conversations/franchise/:franchiseId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const franchiseId = parseInt(req.params.franchiseId);
    
    // Authorization check
    if (req.user!.role !== 'admin' && req.user!.role !== 'superadmin') {
      if (req.user!.franchiseId !== franchiseId) {
        return res.status(403).json({ 
          success: false, 
          error: 'Access denied: You can only view conversations for your franchise' 
        });
      }
    }

    const limit = Math.min(parseInt(req.query.limit as string || '20'), 100);
    const offset = parseInt(req.query.offset as string || '0');

    const conversations = await db
      .select()
      .from(chatConversations)
      .where(eq(chatConversations.franchiseId, franchiseId))
      .orderBy(desc(chatConversations.lastMessageAt))
      .limit(limit)
      .offset(offset);

    res.json({
      success: true,
      conversations,
      pagination: {
        limit,
        offset,
        hasMore: conversations.length === limit,
      }
    });
  } catch (error: any) {
    console.error('[ChatHistory] Error fetching franchise conversations:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch conversations',
      message: error.message 
    });
  }
});

// GET /api/chat/conversations/:conversationId - Get single conversation
router.get('/conversations/:conversationId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { conversationId } = req.params;

    const [conversation] = await db
      .select()
      .from(chatConversations)
      .where(eq(chatConversations.conversationId, conversationId))
      .limit(1);

    if (!conversation) {
      return res.status(404).json({ 
        success: false, 
        error: 'Conversation not found' 
      });
    }

    // Authorization check
    if (!canAccessConversation(req, conversation)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied: You do not have permission to view this conversation' 
      });
    }

    res.json({
      success: true,
      conversation,
    });
  } catch (error: any) {
    console.error('[ChatHistory] Error fetching conversation:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch conversation',
      message: error.message 
    });
  }
});

// POST /api/chat/conversations - Create new conversation
router.post('/conversations', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Force userId to authenticated user (server-side source of truth)
    const validatedData = insertChatConversationSchema.parse({
      ...req.body,
      conversationId: req.body.conversationId || nanoid(),
      userId: req.user!.uid, // Server-side override for security
    });

    const [newConversation] = await db
      .insert(chatConversations)
      .values(validatedData)
      .returning();

    res.status(201).json({
      success: true,
      conversation: newConversation,
    });
  } catch (error: any) {
    console.error('[ChatHistory] Error creating conversation:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid conversation data',
        details: error.errors 
      });
    }

    res.status(500).json({ 
      success: false, 
      error: 'Failed to create conversation',
      message: error.message 
    });
  }
});

// PATCH /api/chat/conversations/:conversationId - Update conversation (Validated fields only)
router.patch('/conversations/:conversationId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { conversationId } = req.params;

    // Fetch existing conversation
    const [existing] = await db
      .select()
      .from(chatConversations)
      .where(eq(chatConversations.conversationId, conversationId))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ 
        success: false, 
        error: 'Conversation not found' 
      });
    }

    // Authorization check
    if (!canAccessConversation(req, existing)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied: You do not have permission to update this conversation' 
      });
    }

    // Validate update data (whitelist approach)
    const updateData = updateConversationSchema.parse(req.body);

    const [updated] = await db
      .update(chatConversations)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(chatConversations.conversationId, conversationId))
      .returning();

    res.json({
      success: true,
      conversation: updated,
    });
  } catch (error: any) {
    console.error('[ChatHistory] Error updating conversation:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid update data',
        details: error.errors 
      });
    }

    res.status(500).json({ 
      success: false, 
      error: 'Failed to update conversation',
      message: error.message 
    });
  }
});

// DELETE /api/chat/conversations/:conversationId - Soft delete conversation (Audit logged)
router.delete('/conversations/:conversationId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { conversationId } = req.params;

    // Fetch existing conversation
    const [existing] = await db
      .select()
      .from(chatConversations)
      .where(eq(chatConversations.conversationId, conversationId))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ 
        success: false, 
        error: 'Conversation not found' 
      });
    }

    // Authorization check
    if (!canAccessConversation(req, existing)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied: You do not have permission to delete this conversation' 
      });
    }

    const [deleted] = await db
      .update(chatConversations)
      .set({
        deletedAt: new Date(),
        deletedBy: req.user!.uid, // Server-side source of truth
        status: 'deleted',
        updatedAt: new Date(),
      })
      .where(eq(chatConversations.conversationId, conversationId))
      .returning();

    // Audit log
    console.info('[ChatHistory] [AUDIT] Conversation deleted:', {
      conversationId,
      deletedBy: req.user!.uid,
      deletedAt: new Date(),
    });

    res.json({
      success: true,
      message: 'Conversation deleted successfully',
      conversation: deleted,
    });
  } catch (error: any) {
    console.error('[ChatHistory] Error deleting conversation:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete conversation',
      message: error.message 
    });
  }
});

// =================== MESSAGE ROUTES ===================

// GET /api/chat/conversations/:conversationId/messages - Get messages with pagination
router.get('/conversations/:conversationId/messages', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { conversationId } = req.params;

    // Verify access to conversation
    const [conversation] = await db
      .select()
      .from(chatConversations)
      .where(eq(chatConversations.conversationId, conversationId))
      .limit(1);

    if (!conversation) {
      return res.status(404).json({ 
        success: false, 
        error: 'Conversation not found' 
      });
    }

    if (!canAccessConversation(req, conversation)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied' 
      });
    }

    const limit = Math.min(parseInt(req.query.limit as string || '50'), 100);
    const offset = parseInt(req.query.offset as string || '0');
    const beforeDate = req.query.beforeDate as string;

    const filters = [eq(chatMessages.conversationId, conversationId)];
    
    if (beforeDate) {
      filters.push(lte(chatMessages.createdAt, new Date(beforeDate)));
    }

    const messages = await db
      .select()
      .from(chatMessages)
      .where(and(...filters))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({
      success: true,
      messages: messages.reverse(), // Return chronological order
      pagination: {
        limit,
        offset,
        hasMore: messages.length === limit,
      }
    });
  } catch (error: any) {
    console.error('[ChatHistory] Error fetching messages:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch messages',
      message: error.message 
    });
  }
});

// POST /api/chat/messages - Create new message
router.post('/messages', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Verify access to conversation
    const conversationId = req.body.conversationId;
    
    const [conversation] = await db
      .select()
      .from(chatConversations)
      .where(eq(chatConversations.conversationId, conversationId))
      .limit(1);

    if (!conversation) {
      return res.status(404).json({ 
        success: false, 
        error: 'Conversation not found' 
      });
    }

    if (!canAccessConversation(req, conversation)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied' 
      });
    }

    const validatedData = insertChatMessageSchema.parse({
      ...req.body,
      messageId: req.body.messageId || nanoid(),
    });

    const [newMessage] = await db
      .insert(chatMessages)
      .values(validatedData)
      .returning();

    // Update conversation's lastMessageAt
    await db
      .update(chatConversations)
      .set({ 
        lastMessageAt: newMessage.createdAt,
        updatedAt: new Date(),
      })
      .where(eq(chatConversations.conversationId, validatedData.conversationId));

    res.status(201).json({
      success: true,
      message: newMessage,
    });
  } catch (error: any) {
    console.error('[ChatHistory] Error creating message:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid message data',
        details: error.errors 
      });
    }

    res.status(500).json({ 
      success: false, 
      error: 'Failed to create message',
      message: error.message 
    });
  }
});

// PATCH /api/chat/messages/:messageId/read - Mark message as read
router.patch('/messages/:messageId/read', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { messageId } = req.params;

    // Fetch message and verify access
    const [message] = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.messageId, messageId))
      .limit(1);

    if (!message) {
      return res.status(404).json({ 
        success: false, 
        error: 'Message not found' 
      });
    }

    // Verify access to conversation
    const [conversation] = await db
      .select()
      .from(chatConversations)
      .where(eq(chatConversations.conversationId, message.conversationId))
      .limit(1);

    if (!conversation || !canAccessConversation(req, conversation)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied' 
      });
    }

    const [updated] = await db
      .update(chatMessages)
      .set({
        readAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(chatMessages.messageId, messageId))
      .returning();

    res.json({
      success: true,
      message: updated,
    });
  } catch (error: any) {
    console.error('[ChatHistory] Error marking message as read:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update message',
      message: error.message 
    });
  }
});

// =================== SEARCH ROUTES ===================

// GET /api/chat/search - Search across user's conversations and messages
router.get('/search', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const query = req.query.q as string;
    const limit = Math.min(parseInt(req.query.limit as string || '20'), 100);

    if (!query) {
      return res.status(400).json({ 
        success: false, 
        error: 'Search query is required' 
      });
    }

    const searchPattern = `%${query}%`;
    const userId = req.user!.uid; // Scope to authenticated user

    // Search only within user's conversations
    const messages = await db
      .select({
        message: chatMessages,
        conversation: chatConversations,
      })
      .from(chatMessages)
      .innerJoin(
        chatConversations,
        eq(chatMessages.conversationId, chatConversations.conversationId)
      )
      .where(
        and(
          like(chatMessages.content, searchPattern),
          eq(chatConversations.userId, userId)
        )
      )
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);

    res.json({
      success: true,
      results: messages,
    });
  } catch (error: any) {
    console.error('[ChatHistory] Error searching messages:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to search messages',
      message: error.message 
    });
  }
});

// =================== ANALYTICS ROUTES ===================

// POST /api/chat/analytics - Track analytics event
router.post('/analytics', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Verify user owns the conversation
    const conversationId = req.body.conversationId;
    
    const [conversation] = await db
      .select()
      .from(chatConversations)
      .where(eq(chatConversations.conversationId, conversationId))
      .limit(1);

    if (!conversation || !canAccessConversation(req, conversation)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied' 
      });
    }

    const validatedData = insertChatAnalyticsSchema.parse({
      ...req.body,
      userId: req.user!.uid, // Server-side override
    });

    const [event] = await db
      .insert(chatAnalytics)
      .values(validatedData)
      .returning();

    res.status(201).json({
      success: true,
      event,
    });
  } catch (error: any) {
    console.error('[ChatHistory] Error tracking analytics:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid analytics data',
        details: error.errors 
      });
    }

    res.status(500).json({ 
      success: false, 
      error: 'Failed to track analytics event',
      message: error.message 
    });
  }
});

// GET /api/chat/analytics/:conversationId - Get conversation analytics
router.get('/analytics/:conversationId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { conversationId } = req.params;

    // Verify access to conversation
    const [conversation] = await db
      .select()
      .from(chatConversations)
      .where(eq(chatConversations.conversationId, conversationId))
      .limit(1);

    if (!conversation || !canAccessConversation(req, conversation)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied' 
      });
    }

    const eventType = req.query.eventType as string;
    const filters = [eq(chatAnalytics.conversationId, conversationId)];
    
    if (eventType) {
      filters.push(eq(chatAnalytics.eventType, eventType));
    }

    const events = await db
      .select()
      .from(chatAnalytics)
      .where(and(...filters))
      .orderBy(desc(chatAnalytics.timestamp));

    res.json({
      success: true,
      events,
    });
  } catch (error: any) {
    console.error('[ChatHistory] Error fetching analytics:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch analytics',
      message: error.message 
    });
  }
});

// =================== ATTACHMENT ROUTES ===================

// POST /api/chat/attachments - Create attachment
router.post('/attachments', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Verify access to conversation
    const conversationId = req.body.conversationId;
    
    const [conversation] = await db
      .select()
      .from(chatConversations)
      .where(eq(chatConversations.conversationId, conversationId))
      .limit(1);

    if (!conversation || !canAccessConversation(req, conversation)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied' 
      });
    }

    const validatedData = insertChatAttachmentSchema.parse({
      ...req.body,
      uploadedBy: req.user!.uid, // Server-side override
    });

    const [attachment] = await db
      .insert(chatAttachments)
      .values(validatedData)
      .returning();

    res.status(201).json({
      success: true,
      attachment,
    });
  } catch (error: any) {
    console.error('[ChatHistory] Error creating attachment:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid attachment data',
        details: error.errors 
      });
    }

    res.status(500).json({ 
      success: false, 
      error: 'Failed to create attachment',
      message: error.message 
    });
  }
});

// GET /api/chat/messages/:messageId/attachments - Get message attachments
router.get('/messages/:messageId/attachments', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { messageId } = req.params;

    // Verify access through message -> conversation chain
    const [message] = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.messageId, messageId))
      .limit(1);

    if (!message) {
      return res.status(404).json({ 
        success: false, 
        error: 'Message not found' 
      });
    }

    const [conversation] = await db
      .select()
      .from(chatConversations)
      .where(eq(chatConversations.conversationId, message.conversationId))
      .limit(1);

    if (!conversation || !canAccessConversation(req, conversation)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied' 
      });
    }

    const attachments = await db
      .select()
      .from(chatAttachments)
      .where(eq(chatAttachments.messageId, messageId))
      .orderBy(chatAttachments.createdAt);

    res.json({
      success: true,
      attachments,
    });
  } catch (error: any) {
    console.error('[ChatHistory] Error fetching attachments:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch attachments',
      message: error.message 
    });
  }
});

export default router;

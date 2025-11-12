/**
 * The PetWash Circle - Social Platform API
 * Instagram-style social network with 7-star luxury design
 * 
 * Features:
 * - Feed with high-res media posts
 * - Comments and likes
 * - Friend requests and connections
 * - Direct messaging (DMs)
 * - AI Content Moderation (24/7 Gemini-powered)
 */

import { Router } from 'express';
import { db } from '../db';
import {
  socialPosts,
  socialComments,
  socialLikes,
  socialFriendships,
  socialDirectMessages,
  insertSocialPostSchema,
  insertSocialCommentSchema,
  insertSocialDirectMessageSchema,
  insertSocialFriendshipSchema,
} from '../../shared/schema';
import { eq, and, or, desc, sql, inArray } from 'drizzle-orm';
import { contentModerationService } from '../services/ContentModerationService';
import { recordAuditEvent } from '../utils/auditSignature';
import { logger } from '../lib/logger';
import crypto from 'crypto';

const router = Router();

// =================== POSTS API ===================

/**
 * GET /api/social/feed
 * Get personalized feed (friends' posts + own posts)
 */
router.get('/feed', async (req, res) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    // Get user's friends
    const friendships = await db
      .select()
      .from(socialFriendships)
      .where(
        and(
          or(
            eq(socialFriendships.requesterId, userId),
            eq(socialFriendships.addresseeId, userId)
          ),
          eq(socialFriendships.status, 'accepted')
        )
      );

    const friendIds = friendships.map(f =>
      f.requesterId === userId ? f.addresseeId : f.requesterId
    );
    friendIds.push(userId); // Include own posts

    // Get feed posts
    const posts = await db
      .select()
      .from(socialPosts)
      .where(
        and(
          inArray(socialPosts.userId, friendIds),
          eq(socialPosts.isDeleted, false),
          eq(socialPosts.moderationStatus, 'approved')
        )
      )
      .orderBy(desc(socialPosts.createdAt))
      .limit(limit)
      .offset(offset);

    logger.info('[Social Feed] Retrieved posts', {
      userId,
      page,
      postsCount: posts.length,
    });

    return res.json({ posts, page, hasMore: posts.length === limit });
  } catch (error: any) {
    logger.error('[Social Feed] Failed to get feed', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/social/posts
 * Create new post with AI moderation
 */
router.post('/posts', async (req, res) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validated = insertSocialPostSchema.parse(req.body);

    // CRITICAL: AI MODERATION - Stage 1 & 2
    if (validated.caption) {
      const moderation = await contentModerationService.moderateContent(
        validated.caption,
        'post',
        userId,
        0
      );

      if (!moderation.isApproved) {
        logger.warn('[Social Post] Rejected by moderation', {
          userId,
          flags: moderation.flags,
        });

        return res.status(400).json({
          error: 'Content violates community guidelines',
          flags: moderation.flags,
          safetyScore: moderation.safetyScore,
        });
      }
    }

    // Create content hash
    const contentHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({
        userId,
        caption: validated.caption,
        mediaUrls: validated.mediaUrls,
        timestamp: new Date().toISOString(),
      }))
      .digest('hex');

    // Create audit signature
    const auditSignature = await recordAuditEvent({
      eventType: 'create_social_post',
      customerUid: userId,
      metadata: {
        caption: validated.caption?.substring(0, 100),
        mediaCount: validated.mediaUrls?.length || 0,
        location: validated.location,
      },
      ipAddress: req.ip || null,
      userAgent: req.headers['user-agent'] || null,
    });

    // Insert post
    const [newPost] = await db
      .insert(socialPosts)
      .values({
        ...validated,
        contentHash,
        auditHash: auditSignature.auditHash,
        moderationStatus: 'approved',
      })
      .returning();

    logger.info('[Social Post] Created successfully', {
      postId: newPost.id,
      userId,
    });

    return res.json({ success: true, post: newPost });
  } catch (error: any) {
    logger.error('[Social Post] Failed to create', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/social/posts/:postId/like
 * Toggle like on a post
 */
router.post('/posts/:postId/like', async (req, res) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const postId = parseInt(req.params.postId);

    // Check if already liked
    const existingLike = await db
      .select()
      .from(socialLikes)
      .where(
        and(
          eq(socialLikes.userId, userId),
          eq(socialLikes.targetType, 'post'),
          eq(socialLikes.targetId, postId)
        )
      );

    if (existingLike.length > 0) {
      // Unlike
      await db
        .delete(socialLikes)
        .where(eq(socialLikes.id, existingLike[0].id));

      await db
        .update(socialPosts)
        .set({ likesCount: sql`${socialPosts.likesCount} - 1` })
        .where(eq(socialPosts.id, postId));

      return res.json({ success: true, liked: false });
    } else {
      // Like
      await db.insert(socialLikes).values({
        userId,
        targetType: 'post',
        targetId: postId,
      });

      await db
        .update(socialPosts)
        .set({ likesCount: sql`${socialPosts.likesCount} + 1` })
        .where(eq(socialPosts.id, postId));

      return res.json({ success: true, liked: true });
    }
  } catch (error: any) {
    logger.error('[Social Like] Failed to toggle like', error);
    return res.status(500).json({ error: error.message });
  }
});

// =================== COMMENTS API ===================

/**
 * GET /api/social/posts/:postId/comments
 * Get comments for a post
 */
router.get('/posts/:postId/comments', async (req, res) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const postId = parseInt(req.params.postId);

    const comments = await db
      .select()
      .from(socialComments)
      .where(
        and(
          eq(socialComments.postId, postId),
          eq(socialComments.isDeleted, false),
          eq(socialComments.moderationStatus, 'approved')
        )
      )
      .orderBy(desc(socialComments.createdAt));

    return res.json({ comments });
  } catch (error: any) {
    logger.error('[Social Comments] Failed to get comments', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/social/posts/:postId/comments
 * Add comment with AI moderation
 */
router.post('/posts/:postId/comments', async (req, res) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const postId = parseInt(req.params.postId);
    const validated = insertSocialCommentSchema.parse({
      ...req.body,
      postId,
    });

    // CRITICAL: AI MODERATION - Stage 1 & 2
    const moderation = await contentModerationService.moderateContent(
      validated.text,
      'comment',
      userId,
      0
    );

    if (!moderation.isApproved) {
      logger.warn('[Social Comment] Rejected by moderation', {
        userId,
        postId,
        flags: moderation.flags,
      });

      return res.status(400).json({
        error: 'Comment violates community guidelines',
        flags: moderation.flags,
        safetyScore: moderation.safetyScore,
      });
    }

    // Insert comment
    const [newComment] = await db
      .insert(socialComments)
      .values({
        ...validated,
        moderationStatus: 'approved',
      })
      .returning();

    // Increment comments count
    await db
      .update(socialPosts)
      .set({ commentsCount: sql`${socialPosts.commentsCount} + 1` })
      .where(eq(socialPosts.id, postId));

    logger.info('[Social Comment] Created successfully', {
      commentId: newComment.id,
      postId,
      userId,
    });

    return res.json({ success: true, comment: newComment });
  } catch (error: any) {
    logger.error('[Social Comment] Failed to create', error);
    return res.status(500).json({ error: error.message });
  }
});

// =================== FRIENDS API ===================

/**
 * GET /api/social/friends
 * Get user's friends list
 */
router.get('/friends', async (req, res) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const friendships = await db
      .select()
      .from(socialFriendships)
      .where(
        and(
          or(
            eq(socialFriendships.requesterId, userId),
            eq(socialFriendships.addresseeId, userId)
          ),
          eq(socialFriendships.status, 'accepted')
        )
      );

    const friends = friendships.map(f => ({
      userId: f.requesterId === userId ? f.addresseeId : f.requesterId,
      name: f.requesterId === userId ? f.addresseeName : f.requesterName,
      avatar: f.requesterId === userId ? f.addresseeAvatar : f.requesterAvatar,
      since: f.acceptedAt,
    }));

    return res.json({ friends });
  } catch (error: any) {
    logger.error('[Social Friends] Failed to get friends', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/social/friend-requests
 * Get pending friend requests
 */
router.get('/friend-requests', async (req, res) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const requests = await db
      .select()
      .from(socialFriendships)
      .where(
        and(
          eq(socialFriendships.addresseeId, userId),
          eq(socialFriendships.status, 'pending')
        )
      );

    return res.json({ requests });
  } catch (error: any) {
    logger.error('[Social Friends] Failed to get requests', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/social/friend-requests
 * Send friend request
 */
router.post('/friend-requests', async (req, res) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validated = insertSocialFriendshipSchema.parse({
      ...req.body,
      requesterId: userId,
    });

    // Check if already friends or request exists
    const existing = await db
      .select()
      .from(socialFriendships)
      .where(
        or(
          and(
            eq(socialFriendships.requesterId, userId),
            eq(socialFriendships.addresseeId, validated.addresseeId)
          ),
          and(
            eq(socialFriendships.requesterId, validated.addresseeId),
            eq(socialFriendships.addresseeId, userId)
          )
        )
      );

    if (existing.length > 0) {
      return res.status(400).json({
        error: 'Friend request already exists or users are already friends',
      });
    }

    const [request] = await db
      .insert(socialFriendships)
      .values(validated)
      .returning();

    logger.info('[Social Friends] Request sent', {
      requestId: request.id,
      from: userId,
      to: validated.addresseeId,
    });

    return res.json({ success: true, request });
  } catch (error: any) {
    logger.error('[Social Friends] Failed to send request', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/social/friend-requests/:requestId/accept
 * Accept friend request
 */
router.post('/friend-requests/:requestId/accept', async (req, res) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const requestId = parseInt(req.params.requestId);

    const [updated] = await db
      .update(socialFriendships)
      .set({
        status: 'accepted',
        acceptedAt: new Date(),
      })
      .where(
        and(
          eq(socialFriendships.id, requestId),
          eq(socialFriendships.addresseeId, userId),
          eq(socialFriendships.status, 'pending')
        )
      )
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Request not found or already processed' });
    }

    logger.info('[Social Friends] Request accepted', {
      requestId,
      userId,
    });

    return res.json({ success: true, friendship: updated });
  } catch (error: any) {
    logger.error('[Social Friends] Failed to accept request', error);
    return res.status(500).json({ error: error.message });
  }
});

// =================== DIRECT MESSAGES API ===================

/**
 * GET /api/social/conversations
 * Get user's DM conversations
 */
router.get('/conversations', async (req, res) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get all conversations
    const messages = await db
      .select()
      .from(socialDirectMessages)
      .where(
        and(
          or(
            eq(socialDirectMessages.senderId, userId),
            eq(socialDirectMessages.recipientId, userId)
          ),
          eq(socialDirectMessages.isDeleted, false)
        )
      )
      .orderBy(desc(socialDirectMessages.createdAt));

    // Group by conversation
    const conversationsMap = new Map();
    
    messages.forEach(msg => {
      const convId = msg.conversationId;
      if (!conversationsMap.has(convId)) {
        conversationsMap.set(convId, {
          conversationId: convId,
          partnerId: msg.senderId === userId ? msg.recipientId : msg.senderId,
          partnerName: msg.senderId === userId ? msg.recipientName : msg.senderName,
          partnerAvatar: msg.senderId === userId ? null : msg.senderAvatar,
          lastMessage: msg,
          unreadCount: 0,
        });
      }
      
      // Count unread messages
      if (msg.recipientId === userId && !msg.isRead) {
        conversationsMap.get(convId).unreadCount++;
      }
    });

    const conversations = Array.from(conversationsMap.values());

    return res.json({ conversations });
  } catch (error: any) {
    logger.error('[Social DM] Failed to get conversations', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/social/conversations/:conversationId/messages
 * Get messages in a conversation
 */
router.get('/conversations/:conversationId/messages', async (req, res) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const conversationId = req.params.conversationId;

    const messages = await db
      .select()
      .from(socialDirectMessages)
      .where(
        and(
          eq(socialDirectMessages.conversationId, conversationId),
          eq(socialDirectMessages.isDeleted, false),
          eq(socialDirectMessages.moderationStatus, 'approved')
        )
      )
      .orderBy(socialDirectMessages.createdAt);

    // Mark as read
    await db
      .update(socialDirectMessages)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(socialDirectMessages.conversationId, conversationId),
          eq(socialDirectMessages.recipientId, userId),
          eq(socialDirectMessages.isRead, false)
        )
      );

    return res.json({ messages });
  } catch (error: any) {
    logger.error('[Social DM] Failed to get messages', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/social/messages
 * Send DM with AI moderation
 */
router.post('/messages', async (req, res) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validated = insertSocialDirectMessageSchema.parse(req.body);

    // CRITICAL: AI MODERATION - Stage 1 & 2 (REAL-TIME DM)
    if (validated.text) {
      const moderation = await contentModerationService.moderateContent(
        validated.text,
        'message',
        userId,
        0
      );

      if (!moderation.isApproved) {
        logger.warn('[Social DM] Rejected by moderation', {
          userId,
          flags: moderation.flags,
        });

        return res.status(400).json({
          error: 'Message violates community guidelines',
          flags: moderation.flags,
          safetyScore: moderation.safetyScore,
        });
      }
    }

    const [newMessage] = await db
      .insert(socialDirectMessages)
      .values({
        ...validated,
        moderationStatus: 'approved',
      })
      .returning();

    logger.info('[Social DM] Sent successfully', {
      messageId: newMessage.id,
      from: userId,
      to: validated.recipientId,
    });

    // TODO: WebSocket broadcast to recipient

    return res.json({ success: true, message: newMessage });
  } catch (error: any) {
    logger.error('[Social DM] Failed to send', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;

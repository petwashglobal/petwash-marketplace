/**
 * The PetWash Circle - Social Network Routes
 * Instagram-style social platform with AI content moderation
 */

import { Router, type Request, Response } from "express";
import { db } from "../db";
import { socialPosts, socialComments, socialLikes, socialFollows } from "../../shared/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { contentModerationService } from "../services/ContentModerationService";
import { logger } from "../lib/logger";

const router = Router();

// ============ POSTS ============

// Get feed (all approved posts)
router.get("/social/feed", async (req: Request, res: Response) => {
  try {
    const posts = await db
      .select()
      .from(socialPosts)
      .where(eq(socialPosts.moderationStatus, 'approved'))
      .orderBy(desc(socialPosts.createdAt))
      .limit(50);

    res.json({ success: true, data: posts });
  } catch (error: any) {
    logger.error('[SocialCircle] Failed to fetch feed', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new post (with AI moderation)
router.post("/social/posts", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const { content, imageUrls } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ success: false, error: "Content is required" });
    }

    // Insert post with pending moderation
    const [newPost] = await db.insert(socialPosts).values({
      userId: user.id,
      userName: user.displayName || user.email?.split('@')[0] || 'Anonymous',
      userAvatar: user.profileImageUrl || null,
      content: content.trim(),
      imageUrls: imageUrls || [],
      moderationStatus: 'pending',
    } as any).returning();

    // AI moderation (async - don't block response)
    contentModerationService.moderateContent(content, 'post', user.id, newPost.id)
      .then(async (result) => {
        // Update post with moderation result
        await db.update(socialPosts)
          .set({
            moderationStatus: result.isApproved ? 'approved' : 'rejected',
            moderationFlags: result.flags,
            moderationScore: result.safetyScore,
            moderatedAt: new Date(),
            moderatedBy: 'AI',
          })
          .where(eq(socialPosts.id, newPost.id));

        logger.info('[SocialCircle] Post moderated', { 
          postId: newPost.id, 
          approved: result.isApproved,
          score: result.safetyScore
        });
      })
      .catch(err => {
        logger.error('[SocialCircle] Moderation failed', err);
      });

    res.json({
      success: true,
      data: newPost,
      message: '⏳ הפוסט עובר בדיקת אבטחה / Post is being reviewed for safety'
    });
  } catch (error: any) {
    logger.error('[SocialCircle] Failed to create post', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Like/Unlike post
router.post("/social/posts/:id/like", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const postId = parseInt(req.params.id);

    // Check if already liked
    const existing = await db
      .select()
      .from(socialLikes)
      .where(and(
        eq(socialLikes.postId, postId),
        eq(socialLikes.userId, user.id)
      ))
      .limit(1);

    if (existing.length > 0) {
      // Unlike
      await db.delete(socialLikes).where(eq(socialLikes.id, existing[0].id));
      
      // Decrement likes count
      await db.update(socialPosts)
        .set({ likesCount: sql`${socialPosts.likesCount} - 1` })
        .where(eq(socialPosts.id, postId));

      res.json({ success: true, liked: false });
    } else {
      // Like
      await db.insert(socialLikes).values({
        postId,
        userId: user.id,
      } as any);

      // Increment likes count
      await db.update(socialPosts)
        .set({ likesCount: sql`${socialPosts.likesCount} + 1` })
        .where(eq(socialPosts.id, postId));

      res.json({ success: true, liked: true });
    }
  } catch (error: any) {
    logger.error('[SocialCircle] Failed to like post', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ COMMENTS ============

// Get comments for a post
router.get("/social/posts/:id/comments", async (req: Request, res: Response) => {
  try {
    const postId = parseInt(req.params.id);

    const comments = await db
      .select()
      .from(socialComments)
      .where(and(
        eq(socialComments.postId, postId),
        eq(socialComments.moderationStatus, 'approved')
      ))
      .orderBy(desc(socialComments.createdAt));

    res.json({ success: true, data: comments });
  } catch (error: any) {
    logger.error('[SocialCircle] Failed to fetch comments', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add comment (with AI moderation)
router.post("/social/posts/:id/comments", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const postId = parseInt(req.params.id);
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ success: false, error: "Comment is required" });
    }

    // Insert comment with pending moderation
    const [newComment] = await db.insert(socialComments).values({
      postId,
      userId: user.id,
      userName: user.displayName || user.email?.split('@')[0] || 'Anonymous',
      userAvatar: user.profileImageUrl || null,
      content: content.trim(),
      moderationStatus: 'pending',
    } as any).returning();

    // AI moderation (async)
    contentModerationService.moderateContent(content, 'comment', user.id, newComment.id)
      .then(async (result) => {
        await db.update(socialComments)
          .set({
            moderationStatus: result.isApproved ? 'approved' : 'rejected',
            moderationFlags: result.flags,
            moderationScore: result.safetyScore,
            moderatedAt: new Date(),
            moderatedBy: 'AI',
          })
          .where(eq(socialComments.id, newComment.id));

        if (result.isApproved) {
          // Increment comments count
          await db.update(socialPosts)
            .set({ commentsCount: sql`${socialPosts.commentsCount} + 1` })
            .where(eq(socialPosts.id, postId));
        }
      })
      .catch(err => {
        logger.error('[SocialCircle] Comment moderation failed', err);
      });

    res.json({
      success: true,
      data: newComment,
      message: '⏳ התגובה בבדיקה / Comment under review'
    });
  } catch (error: any) {
    logger.error('[SocialCircle] Failed to add comment', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

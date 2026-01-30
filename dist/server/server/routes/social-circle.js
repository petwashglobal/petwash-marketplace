/**
 * The PetWash Circle - Social Network Routes
 * Instagram-style social platform with AI content moderation
 */
import { Router } from "express";
import { db } from "../db";
import { socialPosts, socialComments, socialLikes } from "../../shared/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { contentModerationService } from "../services/ContentModerationService";
import { logger } from "../lib/logger";
const router = Router();
// ============ POSTS ============
// Get feed (all approved posts)
router.get("/feed", async (req, res) => {
    try {
        const posts = await db
            .select()
            .from(socialPosts)
            .where(eq(socialPosts.moderationStatus, 'approved'))
            .orderBy(desc(socialPosts.createdAt))
            .limit(50);
        res.json({ success: true, data: posts });
    }
    catch (error) {
        logger.error('[SocialCircle] Failed to fetch feed', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// Create new post (with SYNCHRONOUS AI moderation - check BEFORE publishing)
router.post("/posts", async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ success: false, error: "Authentication required" });
        }
        const { content, imageUrls } = req.body;
        if (!content || content.trim().length === 0) {
            return res.status(400).json({ success: false, error: "Content is required" });
        }
        // SYNCHRONOUS AI moderation - CHECK BEFORE PUBLISHING
        // This ensures NO inappropriate content ever reaches the database as "approved"
        const moderationResult = await contentModerationService.moderateContent(content.trim(), 'post', user.id, 0 // Temporary ID since post doesn't exist yet
        );
        logger.info('[SocialCircle] Pre-publish moderation complete', {
            userId: user.id,
            approved: moderationResult.isApproved,
            score: moderationResult.safetyScore,
            flags: moderationResult.flags
        });
        // REJECT immediately if content is not approved
        if (!moderationResult.isApproved) {
            return res.status(400).json({
                success: false,
                error: 'התוכן שלך לא עבר את בדיקת הבטיחות / Your content did not pass safety review',
                moderationDetails: {
                    reason: moderationResult.explanation,
                    flags: moderationResult.flags,
                    safetyScore: moderationResult.safetyScore
                }
            });
        }
        // Only insert APPROVED posts into the database
        const [newPost] = await db.insert(socialPosts).values({
            userId: user.id,
            userName: user.displayName || user.email?.split('@')[0] || 'Anonymous',
            userAvatar: user.profileImageUrl || null,
            content: content.trim(),
            imageUrls: imageUrls || [],
            moderationStatus: 'approved', // Already verified by AI
            moderationScore: moderationResult.safetyScore,
            moderationFlags: moderationResult.flags,
            moderatedAt: new Date(),
            moderatedBy: 'Gemini-AI',
        }).returning();
        logger.info('[SocialCircle] Post approved and published', {
            postId: newPost.id,
            userId: user.id,
            score: moderationResult.safetyScore
        });
        res.json({
            success: true,
            data: newPost,
            message: '✅ הפוסט שלך פורסם בהצלחה! / Your post has been published!'
        });
    }
    catch (error) {
        logger.error('[SocialCircle] Failed to create post', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// Like/Unlike post
router.post("/posts/:id/like", async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ success: false, error: "Authentication required" });
        }
        const postId = parseInt(req.params.id);
        // Check if already liked
        const existing = await db
            .select()
            .from(socialLikes)
            .where(and(eq(socialLikes.postId, postId), eq(socialLikes.userId, user.id)))
            .limit(1);
        if (existing.length > 0) {
            // Unlike
            await db.delete(socialLikes).where(eq(socialLikes.id, existing[0].id));
            // Decrement likes count
            await db.update(socialPosts)
                .set({ likesCount: sql `${socialPosts.likesCount} - 1` })
                .where(eq(socialPosts.id, postId));
            res.json({ success: true, liked: false });
        }
        else {
            // Like
            await db.insert(socialLikes).values({
                postId,
                userId: user.id,
            });
            // Increment likes count
            await db.update(socialPosts)
                .set({ likesCount: sql `${socialPosts.likesCount} + 1` })
                .where(eq(socialPosts.id, postId));
            res.json({ success: true, liked: true });
        }
    }
    catch (error) {
        logger.error('[SocialCircle] Failed to like post', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// ============ COMMENTS ============
// Get comments for a post
router.get("/posts/:id/comments", async (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        const comments = await db
            .select()
            .from(socialComments)
            .where(and(eq(socialComments.postId, postId), eq(socialComments.moderationStatus, 'approved')))
            .orderBy(desc(socialComments.createdAt));
        res.json({ success: true, data: comments });
    }
    catch (error) {
        logger.error('[SocialCircle] Failed to fetch comments', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// Add comment (with SYNCHRONOUS AI moderation - check BEFORE publishing)
router.post("/posts/:id/comments", async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ success: false, error: "Authentication required" });
        }
        const postId = parseInt(req.params.id);
        const { content } = req.body;
        if (!content || content.trim().length === 0) {
            return res.status(400).json({ success: false, error: "Comment is required" });
        }
        // SYNCHRONOUS AI moderation - CHECK BEFORE PUBLISHING
        const moderationResult = await contentModerationService.moderateContent(content.trim(), 'comment', user.id, 0 // Temporary ID
        );
        logger.info('[SocialCircle] Comment pre-publish moderation', {
            postId,
            userId: user.id,
            approved: moderationResult.isApproved,
            score: moderationResult.safetyScore
        });
        // REJECT immediately if content is not approved
        if (!moderationResult.isApproved) {
            return res.status(400).json({
                success: false,
                error: 'התגובה שלך לא עברה בדיקת בטיחות / Your comment did not pass safety review',
                moderationDetails: {
                    reason: moderationResult.explanation,
                    flags: moderationResult.flags
                }
            });
        }
        // Only insert APPROVED comments
        const [newComment] = await db.insert(socialComments).values({
            postId,
            userId: user.id,
            userName: user.displayName || user.email?.split('@')[0] || 'Anonymous',
            userAvatar: user.profileImageUrl || null,
            content: content.trim(),
            moderationStatus: 'approved',
            moderationScore: moderationResult.safetyScore,
            moderationFlags: moderationResult.flags,
            moderatedAt: new Date(),
            moderatedBy: 'Gemini-AI',
        }).returning();
        // Increment comments count for approved comments
        await db.update(socialPosts)
            .set({ commentsCount: sql `${socialPosts.commentsCount} + 1` })
            .where(eq(socialPosts.id, postId));
        res.json({
            success: true,
            data: newComment,
            message: '✅ התגובה פורסמה! / Comment published!'
        });
    }
    catch (error) {
        logger.error('[SocialCircle] Failed to add comment', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
export default router;

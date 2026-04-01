/**
 * Paw Finder™ Routes — PostgreSQL + Gemini Moderation + Haversine Matching
 * Public browsing | Active-member posting | Safe contact flow
 */

import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { requireAuth } from '../customAuth';
import { requireLoyaltyMember } from '../middleware/loyalty';
import {
  createAndPublishPost,
  resolvePost,
  createContactRequest,
} from '../services/PawFinderService';
import { logger } from '../lib/logger';

const router = Router();

/* -----------------------------------------------------------------------
   INPUT SCHEMAS
----------------------------------------------------------------------- */

const createPostSchema = z.object({
  postType: z.enum(['lost', 'found']),
  petType: z.enum(['dog', 'cat', 'bird', 'other']),
  petName: z.string().max(100).optional(),
  breed: z.string().max(100).optional(),
  colorPrimary: z.string().max(60).optional(),
  colorSecondary: z.string().max(60).optional(),
  sizeCategory: z.enum(['tiny', 'small', 'medium', 'large', 'giant', 'unknown']).default('unknown'),
  sex: z.enum(['male', 'female', 'unknown']).default('unknown'),
  description: z.string().min(10).max(2000),
  rewardAmount: z.number().min(0).max(10000).optional(),
  contactPreference: z.enum(['inbox_first', 'reveal_phone_after_accept']).default('inbox_first'),
  contactPhone: z.string().max(32).optional(),
  city: z.string().min(1).max(100),
  area: z.string().max(100).optional(),
  addressText: z.string().max(255).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mediaFiles: z.array(z.object({
    filePath: z.string().min(1),
    mimeType: z.string().optional(),
    mediaRole: z.enum(['primary', 'extra']).default('primary'),
  })).min(1).max(8),
});

const contactSchema = z.object({
  messageText: z.string().min(5).max(1000),
});

/* -----------------------------------------------------------------------
   HELPERS
----------------------------------------------------------------------- */

function uid(req: any): string {
  return req.user?.uid || req.firebaseUser?.uid || '';
}

/* -----------------------------------------------------------------------
   PUBLIC ROUTES — no auth required
----------------------------------------------------------------------- */

/** GET /api/paw-finder/posts — browse published posts */
router.get('/posts', async (req, res) => {
  try {
    const postType = req.query.postType as string | undefined;
    const city     = req.query.city     as string | undefined;
    const pet      = req.query.petType  as string | undefined;
    const limit    = Math.min(Number(req.query.limit || 60), 100);

    const { rows } = await pool.query(
      `SELECT
         p.id, p.post_key, p.post_type, p.pet_type, p.pet_name,
         p.breed, p.color_primary, p.size_category, p.sex,
         p.city, p.area, p.description, p.reward_amount,
         p.event_date, p.status, p.matched_post_count,
         p.latitude, p.longitude, p.published_at,
         (SELECT m.file_path
          FROM paw_finder_media m
          WHERE m.post_id = p.id
          ORDER BY CASE WHEN m.media_role = 'primary' THEN 0 ELSE 1 END, m.id
          LIMIT 1) AS primary_media
       FROM paw_finder_posts p
       WHERE p.status IN ('published','matched')
         AND ($1::text IS NULL OR p.post_type = $1)
         AND ($2::text IS NULL OR LOWER(p.city) = LOWER($2))
         AND ($3::text IS NULL OR p.pet_type = $3)
       ORDER BY p.published_at DESC NULLS LAST, p.created_at DESC
       LIMIT $4`,
      [postType || null, city || null, pet || null, limit],
    );

    res.json({ rows });
  } catch (err: any) {
    logger.error('[PawFinder] GET /posts failed', { error: err.message });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** GET /api/paw-finder/posts/:id — single post with media + matches */
router.get('/posts/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid_id' });

    const postRes = await pool.query(
      `SELECT p.* FROM paw_finder_posts p
       WHERE p.id = $1 AND p.status NOT IN ('rejected','archived')
       LIMIT 1`,
      [id],
    );
    const post = postRes.rows[0];
    if (!post) return res.status(404).json({ error: 'not_found' });

    const [mediaRes, matchRes] = await Promise.all([
      pool.query(
        `SELECT id, media_role, file_path, mime_type FROM paw_finder_media WHERE post_id = $1 ORDER BY id ASC`,
        [id],
      ),
      pool.query(
        `SELECT m.*, lp.pet_name AS lost_pet_name, lp.city AS lost_city, lp.event_date AS lost_date,
                fp.pet_name AS found_pet_name, fp.city AS found_city, fp.event_date AS found_date
         FROM paw_finder_matches m
         JOIN paw_finder_posts lp ON lp.id = m.lost_post_id
         JOIN paw_finder_posts fp ON fp.id = m.found_post_id
         WHERE (m.lost_post_id = $1 OR m.found_post_id = $1) AND m.status = 'suggested'
         ORDER BY m.similarity_score DESC LIMIT 20`,
        [id],
      ),
    ]);

    const safePost = { ...post };
    delete safePost.contact_phone;

    res.json({ post: safePost, media: mediaRes.rows, matches: matchRes.rows });
  } catch (err: any) {
    logger.error('[PawFinder] GET /posts/:id failed', { error: err.message });
    res.status(500).json({ error: 'internal_error' });
  }
});

/* -----------------------------------------------------------------------
   MEMBER ROUTES — requireAuth + requireLoyaltyMember for posting
----------------------------------------------------------------------- */

/** POST /api/paw-finder/posts — create + auto-publish (loyalty members only) */
router.post('/posts', requireAuth, requireLoyaltyMember, async (req, res) => {
  try {
    const userId = uid(req);
    if (!userId) return res.status(401).json({ error: 'not_authenticated' });

    const parsed = createPostSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'validation_error', details: parsed.error.flatten() });
    }

    const result = await createAndPublishPost(userId, parsed.data);

    const statusCode =
      result.status === 'published'      ? 201 :
      result.status === 'pending_review' ? 202 : 422;

    res.status(statusCode).json(result);
  } catch (err: any) {
    logger.error('[PawFinder] POST /posts failed', { error: err.message });
    const code =
      ['DESCRIPTION_REQUIRED','CITY_REQUIRED','EVENT_DATE_REQUIRED','PRIMARY_MEDIA_REQUIRED'].includes(err.message)
        ? 400 : 500;
    res.status(code).json({ error: err.message || 'create_failed' });
  }
});

/** POST /api/paw-finder/posts/:id/contact — safe contact (any logged-in user) */
router.post('/posts/:id/contact', requireAuth, async (req, res) => {
  try {
    const userId = uid(req);
    if (!userId) return res.status(401).json({ error: 'not_authenticated' });

    const postId = Number(req.params.id);
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'validation_error', details: parsed.error.flatten() });
    }

    const result = await createContactRequest(postId, userId, parsed.data.messageText);
    res.json(result);
  } catch (err: any) {
    const status =
      err.message === 'POST_NOT_FOUND'         ? 404 :
      err.message === 'POST_NOT_CONTACTABLE'   ? 409 :
      err.message === 'CANNOT_CONTACT_OWN_POST'? 400 :
      err.message === 'MESSAGE_REQUIRED'        ? 400 : 500;
    res.status(status).json({ error: err.message || 'contact_failed' });
  }
});

/** GET /api/paw-finder/my/posts — user's own posts (all statuses) */
router.get('/my/posts', requireAuth, async (req, res) => {
  try {
    const userId = uid(req);
    if (!userId) return res.status(401).json({ error: 'not_authenticated' });

    const { rows } = await pool.query(
      `SELECT p.*,
              (SELECT m.file_path FROM paw_finder_media m WHERE m.post_id = p.id ORDER BY id LIMIT 1) AS primary_media,
              COALESCE((SELECT COUNT(*)::int FROM paw_finder_contact_requests cr
                        WHERE cr.post_id = p.id AND cr.status = 'pending'), 0) AS pending_contacts
       FROM paw_finder_posts p
       WHERE p.user_id = $1 AND p.status <> 'archived'
       ORDER BY p.created_at DESC`,
      [userId],
    );

    res.json({ rows });
  } catch (err: any) {
    logger.error('[PawFinder] GET /my/posts failed', { error: err.message });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** POST /api/paw-finder/my/posts/:id/resolve — mark as resolved */
router.post('/my/posts/:id/resolve', requireAuth, async (req, res) => {
  try {
    const userId = uid(req);
    if (!userId) return res.status(401).json({ error: 'not_authenticated' });

    const result = await resolvePost(userId, Number(req.params.id));
    res.json(result);
  } catch (err: any) {
    const status =
      err.message === 'POST_NOT_FOUND'  ? 404 :
      err.message === 'NOT_POST_OWNER'  ? 403 :
      err.message === 'ALREADY_RESOLVED'? 409 : 500;
    res.status(status).json({ error: err.message || 'resolve_failed' });
  }
});

/** GET /api/paw-finder/my/contacts — incoming contact requests on my posts */
router.get('/my/contacts', requireAuth, async (req, res) => {
  try {
    const userId = uid(req);
    if (!userId) return res.status(401).json({ error: 'not_authenticated' });

    const { rows } = await pool.query(
      `SELECT cr.*, p.pet_name, p.pet_type, p.post_type, p.city
       FROM paw_finder_contact_requests cr
       JOIN paw_finder_posts p ON p.id = cr.post_id
       WHERE cr.owner_user_id = $1
       ORDER BY cr.created_at DESC LIMIT 100`,
      [userId],
    );
    res.json({ rows });
  } catch (err: any) {
    logger.error('[PawFinder] GET /my/contacts failed', { error: err.message });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** POST /api/paw-finder/my/contacts/:id/accept */
router.post('/my/contacts/:id/accept', requireAuth, async (req, res) => {
  try {
    const userId = uid(req);
    const crId = Number(req.params.id);

    const { rows } = await pool.query(
      `UPDATE paw_finder_contact_requests
       SET status = 'accepted', reveal_phone = TRUE, updated_at = NOW()
       WHERE id = $1 AND owner_user_id = $2 AND status = 'pending'
       RETURNING id`,
      [crId, userId],
    );
    if (!rows.length) return res.status(404).json({ error: 'not_found_or_already_handled' });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;

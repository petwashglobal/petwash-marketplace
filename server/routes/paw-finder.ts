/**
 * Paw Finder™ Routes — PostgreSQL + Gemini Moderation + Haversine Matching
 * v2 — Privacy-safe | Rate-limited | Real upload | Full lifecycle | Abuse-resistant
 */

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { z } from 'zod';
import { pool } from '../db';
import { requireAuth } from '../customAuth';
import { requireVerifiedClubMember } from '../middleware/loyalty';
import {
  createAndPublishPost,
  resolvePost,
  createContactRequest,
} from '../services/PawFinderService';
import { logger } from '../lib/logger';

const router = Router();

/* -----------------------------------------------------------------------
   IMAGE UPLOAD — multer → disk → sha256 hash → sharp compress
----------------------------------------------------------------------- */

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'paw-finder');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function assertSafeUploadPath(filePath: string): void {
  const resolved = path.resolve(filePath);
  const prefix = UPLOAD_DIR + path.sep;
  if (resolved !== UPLOAD_DIR && !resolved.startsWith(prefix)) {
    throw new Error('Invalid file path: outside upload directory');
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `pf-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB raw; sharp will compress
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    cb(null, allowed.includes(file.mimetype));
  },
});

function sha256File(filePath: string): string {
  try {
    assertSafeUploadPath(filePath);
    const buf = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buf).digest('hex');
  } catch {
    return '';
  }
}

async function compressIfNeeded(filePath: string): Promise<void> {
  try {
    assertSafeUploadPath(filePath);
    const sharp = (await import('sharp')).default;
    const info = await sharp(filePath).metadata();
    const width = info.width ?? 0;
    const size  = fs.statSync(filePath).size;
    if (width > 1600 || size > 800_000) {
      const tmp = filePath + '.tmp.jpg';
      await sharp(filePath)
        .resize({ width: 1600, withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toFile(tmp);
      fs.renameSync(tmp, filePath);
    }
  } catch (err: any) {
    logger.warn('[PawFinder] compress failed (non-blocking)', { error: err.message });
  }
}

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

async function pushNotification(
  userId: string,
  postId: number | null,
  eventType: string,
  title: string,
  body: string,
  payload: Record<string, any> = {},
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO paw_finder_notifications (user_id, post_id, event_type, title, body, payload)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [userId, postId, eventType, title, body, JSON.stringify(payload)],
    );
  } catch (err: any) {
    logger.warn('[PawFinder] pushNotification failed', { error: err.message });
  }
}

/* -----------------------------------------------------------------------
   UPLOAD — POST /api/paw-finder/upload
   Accepts: multipart field "photo"
   Returns: { filePath, hash, duplicate }
   Auth: any authenticated user
----------------------------------------------------------------------- */

router.post('/upload', requireAuth, upload.single('photo'), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'NO_FILE', message: 'Upload a photo (JPEG/PNG/WebP/HEIC max 15MB)' });
    }

    await compressIfNeeded(req.file.path);

    const hash     = sha256File(req.file.path);
    const filePath = `/uploads/paw-finder/${req.file.filename}`;
    assertSafeUploadPath(req.file.path);
    const fileSize = fs.statSync(req.file.path).size;

    // Duplicate image detection across all posts
    const dupCheck = await pool.query(
      `SELECT id, post_key, status FROM paw_finder_posts WHERE image_hash = $1 LIMIT 1`,
      [hash],
    );
    const duplicate = dupCheck.rows[0] || null;

    res.json({ filePath, hash, duplicate, fileSize });
  } catch (err: any) {
    logger.error('[PawFinder] upload failed', { error: err.message });
    res.status(500).json({ error: 'upload_failed' });
  }
});

/* -----------------------------------------------------------------------
   PUBLIC ROUTES — no auth required
----------------------------------------------------------------------- */

/**
 * GET /api/paw-finder/posts
 * Filters: postType, city, petType, breed, dateFrom, dateTo, hasReward, matchedOnly, offset, limit
 * Privacy: lat/lng rounded to ~1.1km precision; contact_phone never returned
 */
router.get('/posts', async (req, res) => {
  try {
    const postType    = req.query.postType    as string | undefined;
    const city        = req.query.city        as string | undefined;
    const pet         = req.query.petType     as string | undefined;
    const breed       = req.query.breed       as string | undefined;
    const dateFrom    = req.query.dateFrom    as string | undefined;
    const dateTo      = req.query.dateTo      as string | undefined;
    const hasReward   = req.query.hasReward   === 'true';
    const matchedOnly = req.query.matchedOnly === 'true';
    const limit       = Math.min(Number(req.query.limit  || 60), 100);
    const offset      = Math.max(Number(req.query.offset || 0), 0);

    const { rows } = await pool.query(
      `SELECT
         p.id, p.post_key, p.post_type, p.pet_type, p.pet_name,
         p.breed, p.color_primary, p.size_category, p.sex,
         p.city, p.area, p.description, p.reward_amount,
         p.event_date, p.status, p.matched_post_count,
         ROUND(p.latitude::numeric,  2) AS latitude,
         ROUND(p.longitude::numeric, 2) AS longitude,
         p.published_at,
         (SELECT m.file_path
          FROM paw_finder_media m
          WHERE m.post_id = p.id
          ORDER BY CASE WHEN m.media_role = 'primary' THEN 0 ELSE 1 END, m.id
          LIMIT 1) AS primary_media
       FROM paw_finder_posts p
       WHERE p.status IN ('published','matched')
         AND ($1::text IS NULL OR p.post_type    = $1)
         AND ($2::text IS NULL OR LOWER(p.city)  = LOWER($2))
         AND ($3::text IS NULL OR p.pet_type     = $3)
         AND ($4::text IS NULL OR LOWER(COALESCE(p.breed,'')) ILIKE '%' || LOWER($4) || '%')
         AND ($5::date IS NULL OR p.event_date  >= $5::date)
         AND ($6::date IS NULL OR p.event_date  <= $6::date)
         AND (NOT $7::bool OR p.reward_amount IS NOT NULL AND p.reward_amount > 0)
         AND (NOT $8::bool OR p.status = 'matched')
       ORDER BY p.published_at DESC NULLS LAST, p.created_at DESC
       LIMIT $9 OFFSET $10`,
      [
        postType || null, city || null, pet || null, breed || null,
        dateFrom || null, dateTo || null,
        hasReward, matchedOnly,
        limit, offset,
      ],
    );

    res.json({ rows, count: rows.length, offset, limit });
  } catch (err: any) {
    logger.error('[PawFinder] GET /posts failed', { error: err.message });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** GET /api/paw-finder/posts/:id — single post detail with media + matches */
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
        `SELECT m.id, m.similarity_score, m.similarity_reasons, m.distance_km, m.date_gap_days, m.status,
                lp.id AS lost_id, lp.pet_name AS lost_pet_name, lp.city AS lost_city, lp.event_date AS lost_date, lp.pet_type AS lost_pet_type,
                fp.id AS found_id, fp.pet_name AS found_pet_name, fp.city AS found_city, fp.event_date AS found_date, fp.pet_type AS found_pet_type
         FROM paw_finder_matches m
         JOIN paw_finder_posts lp ON lp.id = m.lost_post_id
         JOIN paw_finder_posts fp ON fp.id = m.found_post_id
         WHERE (m.lost_post_id = $1 OR m.found_post_id = $1) AND m.status = 'suggested'
         ORDER BY m.similarity_score DESC LIMIT 20`,
        [id],
      ),
    ]);

    // Privacy: never expose contact_phone; coarse GPS (±1.1km)
    const safePost = { ...post };
    delete safePost.contact_phone;
    if (safePost.latitude  != null) safePost.latitude  = Math.round(Number(safePost.latitude)  * 100) / 100;
    if (safePost.longitude != null) safePost.longitude = Math.round(Number(safePost.longitude) * 100) / 100;

    res.json({ post: safePost, media: mediaRes.rows, matches: matchRes.rows });
  } catch (err: any) {
    logger.error('[PawFinder] GET /posts/:id failed', { error: err.message });
    res.status(500).json({ error: 'internal_error' });
  }
});

/* -----------------------------------------------------------------------
   MEMBER ROUTES — requireAuth + requireVerifiedClubMember for posting
----------------------------------------------------------------------- */

/**
 * POST /api/paw-finder/posts — create + auto-publish (loyalty members only)
 * Abuse guards:
 *   - Max 5 posts per user per UTC day
 *   - Image hash duplicate detection (same image + same user = blocked)
 */
router.post('/posts', requireAuth, requireVerifiedClubMember, async (req, res) => {
  try {
    const userId = uid(req);
    if (!userId) return res.status(401).json({ error: 'not_authenticated' });

    // Daily post limit
    const { rows: todayCnt } = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM paw_finder_posts
       WHERE user_id = $1 AND created_at >= CURRENT_DATE`,
      [userId],
    );
    if ((todayCnt[0]?.cnt ?? 0) >= 5) {
      return res.status(429).json({
        error: 'DAILY_LIMIT_REACHED',
        message: 'You can post up to 5 reports per day. Please try again tomorrow.',
      });
    }

    const parsed = createPostSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'validation_error', details: parsed.error.flatten() });
    }

    // Image hash duplicate check
    let imageHash: string | null = null;
    const primaryMedia = parsed.data.mediaFiles.find(m => m.mediaRole === 'primary');
    if (primaryMedia) {
      const diskPath = path.join(process.cwd(), primaryMedia.filePath);
      if (fs.existsSync(diskPath)) {
        imageHash = sha256File(diskPath);
        if (imageHash) {
          const { rows: dupRows } = await pool.query(
            `SELECT id, post_key FROM paw_finder_posts WHERE image_hash = $1 AND user_id = $2 LIMIT 1`,
            [imageHash, userId],
          );
          if (dupRows.length) {
            return res.status(409).json({
              error: 'DUPLICATE_IMAGE',
              message: 'This image was already used in one of your posts.',
              existingPostKey: dupRows[0].post_key,
            });
          }
        }
      }
    }

    const result = await createAndPublishPost(userId, parsed.data);

    // Store image_hash on the post
    if (imageHash && (result as any).postId) {
      await pool.query(
        `UPDATE paw_finder_posts SET image_hash = $1 WHERE id = $2`,
        [imageHash, (result as any).postId],
      ).catch(() => {});
    }

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

/**
 * POST /api/paw-finder/posts/:id/contact
 * Rate limits:
 *   - Same requester + same post: max 1 pending request at a time
 *   - Same requester: max 10 requests across all posts in 24h
 */
router.post('/posts/:id/contact', requireAuth, async (req, res) => {
  try {
    const userId = uid(req);
    if (!userId) return res.status(401).json({ error: 'not_authenticated' });

    const postId = Number(req.params.id);
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'validation_error', details: parsed.error.flatten() });
    }

    // Block duplicate pending request for same post
    const { rows: existingRows } = await pool.query(
      `SELECT id FROM paw_finder_contact_requests
       WHERE post_id = $1 AND requester_user_id = $2 AND status = 'pending' LIMIT 1`,
      [postId, userId],
    );
    if (existingRows.length) {
      return res.status(409).json({
        error: 'DUPLICATE_CONTACT_REQUEST',
        message: 'You already have a pending request for this post.',
      });
    }

    // Daily rate limit (10/24h across all posts)
    const { rows: dailyRows } = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM paw_finder_contact_requests
       WHERE requester_user_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
      [userId],
    );
    if ((dailyRows[0]?.cnt ?? 0) >= 10) {
      return res.status(429).json({
        error: 'CONTACT_RATE_LIMIT',
        message: 'You have sent too many contact requests today. Try again tomorrow.',
      });
    }

    const result = await createContactRequest(postId, userId, parsed.data.messageText);

    // In-app notification to post owner
    const { rows: postRows } = await pool.query(
      `SELECT user_id, pet_name, post_type FROM paw_finder_posts WHERE id = $1`,
      [postId],
    );
    if (postRows[0]) {
      const p = postRows[0];
      await pushNotification(
        p.user_id, postId,
        'contact_request',
        p.post_type === 'lost' ? '🐾 מישהו ראה את החיה שלך!' : '🐾 מישהו מעוניין בפוסט שלך',
        `קיבלת בקשת יצירת קשר בנוגע ל-${p.pet_name || 'החיה'}`,
        { contactRequestId: result.contactRequestId },
      );
    }

    res.json(result);
  } catch (err: any) {
    const status =
      err.message === 'POST_NOT_FOUND'          ? 404 :
      err.message === 'POST_NOT_CONTACTABLE'    ? 409 :
      err.message === 'CANNOT_CONTACT_OWN_POST' ? 400 :
      err.message === 'MESSAGE_REQUIRED'         ? 400 : 500;
    res.status(status).json({ error: err.message || 'contact_failed' });
  }
});

/** GET /api/paw-finder/my/posts */
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

    const safe = rows.map(r => { const s = { ...r }; delete s.contact_phone; return s; });
    res.json({ rows: safe });
  } catch (err: any) {
    logger.error('[PawFinder] GET /my/posts failed', { error: err.message });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** POST /api/paw-finder/my/posts/:id/resolve */
router.post('/my/posts/:id/resolve', requireAuth, async (req, res) => {
  try {
    const userId = uid(req);
    if (!userId) return res.status(401).json({ error: 'not_authenticated' });
    const result = await resolvePost(userId, Number(req.params.id));
    res.json(result);
  } catch (err: any) {
    const status =
      err.message === 'POST_NOT_FOUND'      ? 404 :
      err.message === 'NOT_POST_OWNER'      ? 403 :
      err.message === 'ALREADY_RESOLVED'    ? 409 :
      err.message === 'POST_NOT_RESOLVABLE' ? 422 : 500;
    res.status(status).json({ error: err.message || 'resolve_failed' });
  }
});

/** GET /api/paw-finder/my/contacts — incoming contact requests */
router.get('/my/contacts', requireAuth, async (req, res) => {
  try {
    const userId = uid(req);
    if (!userId) return res.status(401).json({ error: 'not_authenticated' });

    const { rows } = await pool.query(
      `SELECT cr.id, cr.post_id, cr.requester_user_id, cr.status,
              cr.reveal_phone, cr.message_text, cr.created_at, cr.updated_at,
              p.pet_name, p.pet_type, p.post_type, p.city,
              CASE WHEN cr.reveal_phone AND p.contact_preference = 'reveal_phone_after_accept'
                   THEN p.contact_phone ELSE NULL END AS contact_phone
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
       RETURNING id, requester_user_id, post_id`,
      [crId, userId],
    );
    if (!rows.length) return res.status(404).json({ error: 'not_found_or_already_handled' });

    const cr = rows[0];
    const { rows: postRows } = await pool.query(
      `SELECT pet_name, post_type FROM paw_finder_posts WHERE id = $1`,
      [cr.post_id],
    );
    if (postRows[0]) {
      await pushNotification(
        cr.requester_user_id, cr.post_id,
        'contact_accepted',
        '✅ בקשת הקשר שלך התקבלה!',
        `בעל/ת ${postRows[0].pet_name || 'החיה'} קיבל/ה את הבקשה שלך`,
        { contactRequestId: crId },
      );
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: 'internal_error' });
  }
});

/** POST /api/paw-finder/my/contacts/:id/decline */
router.post('/my/contacts/:id/decline', requireAuth, async (req, res) => {
  try {
    const userId = uid(req);
    const crId = Number(req.params.id);

    const { rows } = await pool.query(
      `UPDATE paw_finder_contact_requests
       SET status = 'declined', updated_at = NOW()
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

/* -----------------------------------------------------------------------
   NOTIFICATIONS
----------------------------------------------------------------------- */

/** GET /api/paw-finder/my/notifications */
router.get('/my/notifications', requireAuth, async (req, res) => {
  try {
    const userId = uid(req);
    if (!userId) return res.status(401).json({ error: 'not_authenticated' });

    const { rows } = await pool.query(
      `SELECT id, post_id, event_type, title, body, read, payload, created_at
       FROM paw_finder_notifications
       WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 50`,
      [userId],
    );

    const unreadCount = rows.filter(r => !r.read).length;
    res.json({ rows, unreadCount });
  } catch (err: any) {
    res.status(500).json({ error: 'internal_error' });
  }
});

/** POST /api/paw-finder/my/notifications/read-all */
router.post('/my/notifications/read-all', requireAuth, async (req, res) => {
  try {
    const userId = uid(req);
    await pool.query(
      `UPDATE paw_finder_notifications SET read = true WHERE user_id = $1 AND read = false`,
      [userId],
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;

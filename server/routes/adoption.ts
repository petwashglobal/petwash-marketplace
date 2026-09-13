/**
 * Adopt a Pet routes — /api/adoption
 *
 * "This pet needs a new permanent family." Its own listings, statuses
 * (available / pending / adopted), enquiries and member dashboard.
 * NOT PawFinder™‎ (lost ↔ found): no post_type, no matching, no reward.
 *
 * Public:  GET /listings, GET /listings/:id, GET /photo/:name
 * Members: POST /upload, POST /listings, POST /listings/:id/enquiries,
 *          GET /my/listings, POST /my/listings/:id/status,
 *          GET /my/enquiries, GET /my/enquiries/sent,
 *          POST /my/enquiries/:id/accept | /decline,
 *          GET /my/notifications, POST /my/notifications/read-all
 */
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { pool } from '../db';
import { requireAuth } from '../customAuth';
import { logger } from '../lib/logger';
import { requireValidFileContentDisk } from '../lib/fileMagicValidation';
import {
  adoptionPhotoPublicPath,
  isValidAdoptionPhotoName,
  readAdoptionPhoto,
  uploadAdoptionPhoto,
} from '../lib/adoptionPhotoStore';
import {
  adoptionEnquirySchema,
  createAdoptionListingSchema,
  ownerStatusSchema,
  PUBLIC_ADOPTION_STATUSES,
} from '../lib/adoptionRules';
import {
  AdoptionError,
  createAdoptionEnquiry,
  createAdoptionListing,
  respondToAdoptionEnquiry,
  setOwnListingStatus,
} from '../services/AdoptionService';

const router = Router();

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'adoption');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/** Strictly inside UPLOAD_DIR (CodeQL path-injection dialect, see paw-finder.ts). */
function isSafeUploadPath(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  return resolved.startsWith(UPLOAD_DIR + path.sep);
}

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/png': '.png',
  'image/webp': '.webp', 'image/heic': '.heic', 'image/heif': '.heic',
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    // Random name + allowlisted extension; the caller's filename is never read.
    filename: (_req, file, cb) => {
      const ext = EXT_BY_MIME[(file.mimetype || '').toLowerCase()] ?? '.jpg';
      cb(null, `ad-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, Object.prototype.hasOwnProperty.call(EXT_BY_MIME, file.mimetype)),
});

function uid(req: any): string {
  return req.user?.uid || req.firebaseUser?.uid || '';
}

function sendError(res: any, err: any, where: string) {
  if (err instanceof AdoptionError) return res.status(err.httpStatus).json({ error: err.code });
  logger.error(`[Adoption] ${where} failed`, { error: err?.message });
  return res.status(500).json({ error: 'internal_error' });
}

/* ── Photos ─────────────────────────────────────────────────────────────── */

router.get('/photo/:name', async (req, res) => {
  const name = String(req.params.name || '');
  if (!isValidAdoptionPhotoName(name)) return res.status(404).end();
  const photo = await readAdoptionPhoto(name);
  if (!photo) return res.status(404).end();
  res.setHeader('Content-Type', photo.contentType);
  res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.send(photo.buf);
});

router.post(
  '/upload',
  requireAuth,
  upload.single('photo'),
  requireValidFileContentDisk(['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  async (req: any, res) => {
    const uploadedPath: string = req.file?.path || '';
    try {
      if (!req.file) return res.status(400).json({ error: 'NO_FILE' });
      if (!isSafeUploadPath(uploadedPath)) return res.status(400).json({ error: 'INVALID_UPLOAD_PATH' });

      try {
        const sharp = (await import('sharp')).default;
        const meta = await sharp(uploadedPath).metadata();
        if ((meta.width ?? 0) > 1600 || fs.statSync(uploadedPath).size > 800_000) {
          const tmp = uploadedPath + '.tmp.jpg';
          await sharp(uploadedPath).resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(tmp);
          fs.renameSync(tmp, uploadedPath);
        }
      } catch (err: any) {
        logger.warn('[Adoption] compress failed (non-blocking)', { error: err?.message });
      }

      const buf = fs.readFileSync(uploadedPath);
      const hash = crypto.createHash('sha256').update(buf).digest('hex');

      // A listing photo that exists on one container only would vanish on the
      // next deploy. Refuse instead of publishing a broken card.
      if (!(await uploadAdoptionPhoto(uploadedPath, req.file.filename))) {
        return res.status(503).json({ error: 'PHOTO_STORAGE_UNAVAILABLE' });
      }

      let identification: unknown;
      try {
        const { petIdentificationService } = await import('../services/PetIdentificationService');
        identification = await petIdentificationService.identifyFromBuffer(buf, req.file.mimetype || 'image/jpeg');
      } catch {
        identification = { ok: true, degraded: true, errorCode: 'gemini_error' };
      }

      return res.json({ filePath: adoptionPhotoPublicPath(req.file.filename), hash, identification });
    } catch (err: any) {
      return sendError(res, err, 'upload');
    } finally {
      if (uploadedPath && isSafeUploadPath(uploadedPath)) fs.rm(uploadedPath, { force: true }, () => {});
    }
  },
);

/* ── Public board ───────────────────────────────────────────────────────── */

const PUBLIC_LISTING_COLUMNS = `
  l.id, l.listing_key, l.lister_type, l.pet_type, l.pet_name, l.breed, l.sex, l.age_group,
  l.size_category, l.color, l.description, l.temperament, l.health_notes, l.special_needs,
  l.vaccinated, l.neutered, l.microchipped, l.good_with_children, l.good_with_dogs, l.good_with_cats,
  l.city, l.area, l.status, l.published_at, l.adopted_at`;

/** GET /api/adoption/listings — available + pending by default; contact phone never returned. */
router.get('/listings', async (req, res) => {
  try {
    const wanted = String(req.query.status || '');
    const statuses = (PUBLIC_ADOPTION_STATUSES as readonly string[]).includes(wanted) ? [wanted] : ['available', 'pending'];
    const petType = req.query.petType ? String(req.query.petType) : null;
    const city = req.query.city ? String(req.query.city) : null;
    const limit = Math.min(Math.max(Number(req.query.limit) || 60, 1), 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const { rows } = await pool.query(
      `SELECT ${PUBLIC_LISTING_COLUMNS},
              (SELECT m.file_path FROM adoption_listing_media m WHERE m.listing_id = l.id
                ORDER BY CASE WHEN m.media_role = 'primary' THEN 0 ELSE 1 END, m.id LIMIT 1) AS primary_media
         FROM adoption_listings l
        WHERE l.status = ANY($1::text[])
          AND ($2::text IS NULL OR l.pet_type = $2)
          AND ($3::text IS NULL OR LOWER(l.city) = LOWER($3))
        ORDER BY CASE WHEN l.status = 'available' THEN 0 ELSE 1 END, l.published_at DESC NULLS LAST, l.id DESC
        LIMIT $4 OFFSET $5`,
      [statuses, petType, city, limit, offset],
    );
    return res.json({ rows, count: rows.length, offset, limit });
  } catch (err: any) {
    if (err?.code === '42P01') return res.json({ rows: [], count: 0, offset: 0, limit: 0 });
    return sendError(res, err, 'GET /listings');
  }
});

/** GET /api/adoption/listings/:id — the pet's own page. */
router.get('/listings/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'invalid_id' });
    const { rows } = await pool.query(
      `SELECT ${PUBLIC_LISTING_COLUMNS} FROM adoption_listings l WHERE l.id = $1 AND l.status = ANY($2::text[]) LIMIT 1`,
      [id, PUBLIC_ADOPTION_STATUSES],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    const { rows: media } = await pool.query(
      `SELECT id, media_role, file_path, mime_type FROM adoption_listing_media WHERE listing_id = $1
        ORDER BY CASE WHEN media_role = 'primary' THEN 0 ELSE 1 END, id`,
      [id],
    );
    return res.json({ listing: rows[0], media });
  } catch (err: any) {
    return sendError(res, err, 'GET /listings/:id');
  }
});

/* ── Members ────────────────────────────────────────────────────────────── */

router.post('/listings', requireAuth, async (req, res) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ error: 'not_authenticated' });
  const parsed = createAdoptionListingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'validation_error', details: parsed.error.flatten() });
  try {
    const { pawFinderModeration } = await import('../services/PawFinderModerationService');
    const result = await createAdoptionListing(pool as any, userId, parsed.data, {
      moderate: (input) => pawFinderModeration.moderateFinal({ ...input, rewardAmount: null }, {
        readPhotoBytes: (filePath) => readAdoptionPhoto(path.basename(filePath)),
      }),
    });
    return res.status(result.status === 'rejected' ? 422 : 202).json(result);
  } catch (err: any) {
    return sendError(res, err, 'POST /listings');
  }
});

router.post('/listings/:id/enquiries', requireAuth, async (req, res) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ error: 'not_authenticated' });
  const parsed = adoptionEnquirySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'validation_error', details: parsed.error.flatten() });
  try {
    return res.status(201).json(await createAdoptionEnquiry(pool, userId, Number(req.params.id), parsed.data));
  } catch (err: any) {
    return sendError(res, err, 'POST /listings/:id/enquiries');
  }
});

router.get('/my/listings', requireAuth, async (req, res) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ error: 'not_authenticated' });
  try {
    const { rows } = await pool.query(
      `SELECT ${PUBLIC_LISTING_COLUMNS}, l.moderation_reason, l.created_at,
              (SELECT m.file_path FROM adoption_listing_media m WHERE m.listing_id = l.id ORDER BY m.id LIMIT 1) AS primary_media,
              (SELECT COUNT(*)::int FROM adoption_enquiries e WHERE e.listing_id = l.id AND e.status = 'pending') AS pending_enquiries
         FROM adoption_listings l
        WHERE l.user_id = $1 AND l.status <> 'archived'
        ORDER BY l.created_at DESC`,
      [userId],
    );
    return res.json({ rows });
  } catch (err: any) {
    return sendError(res, err, 'GET /my/listings');
  }
});

router.post('/my/listings/:id/status', requireAuth, async (req, res) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ error: 'not_authenticated' });
  const parsed = ownerStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'validation_error' });
  try {
    return res.json(await setOwnListingStatus(pool, userId, Number(req.params.id), parsed.data.status));
  } catch (err: any) {
    return sendError(res, err, 'POST /my/listings/:id/status');
  }
});

/** Incoming enquiries on my listings. The applicant chose to share their phone. */
router.get('/my/enquiries', requireAuth, async (req, res) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ error: 'not_authenticated' });
  try {
    const { rows } = await pool.query(
      `SELECT e.id, e.listing_id, e.message_text, e.applicant_phone, e.home_type, e.has_children,
              e.has_other_pets, e.status, e.created_at, l.pet_name, l.pet_type
         FROM adoption_enquiries e JOIN adoption_listings l ON l.id = e.listing_id
        WHERE e.owner_user_id = $1
        ORDER BY e.created_at DESC LIMIT 100`,
      [userId],
    );
    return res.json({ rows });
  } catch (err: any) {
    return sendError(res, err, 'GET /my/enquiries');
  }
});

/** Enquiries I sent. The lister's phone appears only once they accepted. */
router.get('/my/enquiries/sent', requireAuth, async (req, res) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ error: 'not_authenticated' });
  try {
    const { rows } = await pool.query(
      `SELECT e.id, e.listing_id, e.status, e.created_at, l.pet_name, l.pet_type, l.city,
              CASE WHEN e.status = 'accepted' THEN l.contact_phone ELSE NULL END AS owner_phone
         FROM adoption_enquiries e JOIN adoption_listings l ON l.id = e.listing_id
        WHERE e.applicant_user_id = $1
        ORDER BY e.created_at DESC LIMIT 100`,
      [userId],
    );
    return res.json({ rows });
  } catch (err: any) {
    return sendError(res, err, 'GET /my/enquiries/sent');
  }
});

for (const [action, decision] of [['accept', 'accepted'], ['decline', 'declined']] as const) {
  router.post(`/my/enquiries/:id/${action}`, requireAuth, async (req, res) => {
    const userId = uid(req);
    if (!userId) return res.status(401).json({ error: 'not_authenticated' });
    try {
      return res.json(await respondToAdoptionEnquiry(pool, userId, Number(req.params.id), decision));
    } catch (err: any) {
      return sendError(res, err, `POST /my/enquiries/:id/${action}`);
    }
  });
}

router.get('/my/notifications', requireAuth, async (req, res) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ error: 'not_authenticated' });
  try {
    const { rows } = await pool.query(
      `SELECT id, listing_id, event_type, title, body, read, payload, created_at
         FROM adoption_notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [userId],
    );
    return res.json({ rows, unreadCount: rows.filter((r: any) => !r.read).length });
  } catch (err: any) {
    return sendError(res, err, 'GET /my/notifications');
  }
});

router.post('/my/notifications/read-all', requireAuth, async (req, res) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ error: 'not_authenticated' });
  try {
    await pool.query(`UPDATE adoption_notifications SET read = TRUE WHERE user_id = $1 AND read = FALSE`, [userId]);
    return res.json({ ok: true });
  } catch (err: any) {
    return sendError(res, err, 'POST /my/notifications/read-all');
  }
});

export default router;

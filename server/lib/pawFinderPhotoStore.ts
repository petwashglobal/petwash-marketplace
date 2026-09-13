/**
 * pawFinderPhotoStore — durable storage for lost-pet photos.
 *
 * WHY (platforms audit 2026-09-12): PawFinder photos were written by multer to
 * the container's own disk (`uploads/paw-finder/`) and served by express.static.
 * On Cloud Run that disk is per-instance and per-revision: a photo uploaded to
 * instance A 404'd from instance B, and every deploy wiped every lost-dog photo.
 * A lost-pet board whose photos vanish is not a lost-pet board.
 *
 * Now: after compression the file is copied to Google Cloud Storage (the same
 * bucket + ADC the careers / KYC uploads already use) and served through
 * GET /api/paw-finder/photo/:name, which streams from GCS and falls back to
 * the local file for posts created before this change. The bucket stays
 * private; the URL stays stable across revisions.
 */
import fs from 'fs';
import path from 'path';
import { Storage } from '@google-cloud/storage';
import { logger } from './logger';

export const PAW_FINDER_OBJECT_PREFIX = 'paw-finder/';
/** pf-<ms>-<12 hex>.<ext> — exactly what multer names an upload; nothing else is a valid object name. */
export const PAW_FINDER_OBJECT_NAME_RE = /^pf-\d{10,16}-[a-f0-9]{12}\.(jpg|jpeg|png|webp|heic)$/;

/**
 * The two photo addresses /upload can return — and nothing else. A post's
 * mediaFiles[].filePath must match.
 *
 * P0 (2026-09-13): #2428 made /upload return `/api/paw-finder/photo/<name>`
 * when the GCS copy succeeds, but the post schema still only accepted
 * `/uploads/paw-finder/…`. Every post whose photo reached GCS got a 400, and a
 * photo is required — so nobody could publish a lost, found or adoption post.
 */
export const PAW_FINDER_MEDIA_PATH_RE =
  /^\/(?:uploads\/paw-finder|api\/paw-finder\/photo)\/pf-\d{10,16}-[a-f0-9]{12}\.(?:jpg|jpeg|png|webp|heic)$/;

export function bucketName(env: NodeJS.ProcessEnv = process.env): string {
  return env.PAW_FINDER_BUCKET_NAME || env.BIOMETRIC_BUCKET_NAME || 'signinpetwash.firebasestorage.app';
}

export function isValidPhotoName(name: string): boolean {
  return PAW_FINDER_OBJECT_NAME_RE.test(name);
}

export function contentTypeFor(name: string): string {
  const ext = path.extname(name).toLowerCase();
  return ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.heic' ? 'image/heic' : 'image/jpeg';
}

/** The public path a post carries in paw_finder_media.file_path. */
export function photoPublicPath(name: string): string {
  return `/api/paw-finder/photo/${name}`;
}

let storage: Storage | null = null;
function gcs(): Storage {
  if (!storage) storage = new Storage();
  return storage;
}

/** Copy a compressed local upload to GCS. Returns false (and logs) on failure — the caller keeps the local path. */
export async function uploadPhotoToGcs(localPath: string, name: string): Promise<boolean> {
  if (!isValidPhotoName(name)) return false;
  try {
    const buf = fs.readFileSync(localPath);
    const file = gcs().bucket(bucketName()).file(PAW_FINDER_OBJECT_PREFIX + name);
    await file.save(buf, {
      contentType: contentTypeFor(name),
      resumable: false,
      metadata: { cacheControl: 'public, max-age=604800, immutable' },
    });
    return true;
  } catch (err: any) {
    logger.error('[PawFinder] GCS upload failed — photo will only exist on this instance', { name, error: err?.message });
    return false;
  }
}

/** Read the photo bytes: GCS first, then the legacy local directory. Null when neither has it. */
export async function readPhoto(name: string, localDir: string): Promise<{ buf: Buffer; contentType: string; source: 'gcs' | 'local' } | null> {
  if (!isValidPhotoName(name)) return null;
  try {
    const file = gcs().bucket(bucketName()).file(PAW_FINDER_OBJECT_PREFIX + name);
    const [exists] = await file.exists();
    if (exists) {
      const [buf] = await file.download();
      return { buf, contentType: contentTypeFor(name), source: 'gcs' };
    }
  } catch (err: any) {
    logger.warn('[PawFinder] GCS read failed — trying local', { name, error: err?.message });
  }
  const local = path.resolve(localDir, name);
  if (local.startsWith(path.resolve(localDir) + path.sep) && fs.existsSync(local)) {
    return { buf: fs.readFileSync(local), contentType: contentTypeFor(name), source: 'local' };
  }
  return null;
}

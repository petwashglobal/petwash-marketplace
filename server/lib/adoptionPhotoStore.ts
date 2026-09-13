/**
 * adoptionPhotoStore — durable storage for Adopt a Pet listing photos.
 *
 * Same bucket and credentials as the PawFinder photo store (shared plumbing),
 * but its own object prefix, its own file names and its own public route
 * (`/api/adoption/photo/:name`) — an adoption photo never carries a PawFinder
 * address. The container disk is per-instance and wiped on deploy, so a photo
 * that fails to reach GCS is refused rather than published half-broken.
 */
import fs from 'fs';
import { Storage } from '@google-cloud/storage';
import { logger } from './logger';
import { bucketName, contentTypeFor } from './pawFinderPhotoStore';

export const ADOPTION_OBJECT_PREFIX = 'adoption/';
/** ad-<ms>-<12 hex>.<ext> — exactly what the adoption upload names a file. */
export const ADOPTION_OBJECT_NAME_RE = /^ad-\d{10,16}-[a-f0-9]{12}\.(jpg|jpeg|png|webp|heic)$/;

export function isValidAdoptionPhotoName(name: string): boolean {
  return ADOPTION_OBJECT_NAME_RE.test(name);
}

export function adoptionPhotoPublicPath(name: string): string {
  return `/api/adoption/photo/${name}`;
}

let storage: Storage | null = null;
function gcs(): Storage {
  if (!storage) storage = new Storage();
  return storage;
}

export async function uploadAdoptionPhoto(localPath: string, name: string): Promise<boolean> {
  if (!isValidAdoptionPhotoName(name)) return false;
  try {
    const buf = fs.readFileSync(localPath);
    await gcs().bucket(bucketName()).file(ADOPTION_OBJECT_PREFIX + name).save(buf, {
      contentType: contentTypeFor(name),
      resumable: false,
      metadata: { cacheControl: 'public, max-age=604800, immutable' },
    });
    return true;
  } catch (err: any) {
    logger.error('[Adoption] GCS upload failed', { name, error: err?.message });
    return false;
  }
}

export async function readAdoptionPhoto(name: string): Promise<{ buf: Buffer; contentType: string } | null> {
  if (!isValidAdoptionPhotoName(name)) return null;
  try {
    const file = gcs().bucket(bucketName()).file(ADOPTION_OBJECT_PREFIX + name);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [buf] = await file.download();
    return { buf, contentType: contentTypeFor(name) };
  } catch (err: any) {
    logger.warn('[Adoption] GCS read failed', { name, error: err?.message });
    return null;
  }
}

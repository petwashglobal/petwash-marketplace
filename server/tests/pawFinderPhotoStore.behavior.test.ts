import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { isValidPhotoName, contentTypeFor, photoPublicPath, bucketName, PAW_FINDER_OBJECT_PREFIX } from '../lib/pawFinderPhotoStore';

/**
 * Platforms audit 2026-09-12 — PawFinder:
 *  - photos lived on the container disk (per instance, wiped per deploy) → GCS + stable route
 *  - the page promised "SMS-verified members only" while the gate is signed-in members (CEO 2026-08-24)
 *  - every post waits for a human and nothing told support → review-queue SLA alert
 */
const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('photo store helpers', () => {
  it('accepts only multer-shaped names — never a path, never a foreign extension', () => {
    expect(isValidPhotoName('pf-1789197617123-0a1b2c3d4e5f.jpg')).toBe(true);
    expect(isValidPhotoName('pf-1789197617123-0a1b2c3d4e5f.webp')).toBe(true);
    expect(isValidPhotoName('../etc/passwd')).toBe(false);
    expect(isValidPhotoName('pf-1789197617123-0a1b2c3d4e5f.svg')).toBe(false);
    expect(isValidPhotoName('pf-x-0a1b2c3d4e5f.jpg')).toBe(false);
    expect(isValidPhotoName('')).toBe(false);
  });
  it('content type + public path + bucket resolution', () => {
    expect(contentTypeFor('a.png')).toBe('image/png');
    expect(contentTypeFor('a.jpg')).toBe('image/jpeg');
    expect(photoPublicPath('pf-1-abcdefabcdef.jpg')).toBe('/api/paw-finder/photo/pf-1-abcdefabcdef.jpg');
    expect(bucketName({ PAW_FINDER_BUCKET_NAME: 'x' } as any)).toBe('x');
    expect(bucketName({ BIOMETRIC_BUCKET_NAME: 'y' } as any)).toBe('y');
    expect(bucketName({} as any)).toBe('signinpetwash.firebasestorage.app');
    expect(PAW_FINDER_OBJECT_PREFIX).toBe('paw-finder/');
  });
});

describe('wiring pins', () => {
  it('upload copies to GCS and the post carries the served path; the serve route validates the name', () => {
    const r = R('server/routes/paw-finder.ts');
    expect(r).toContain('const inGcs = await uploadPhotoToGcs(uploadedPath, req.file.filename);');
    expect(r).toContain('const filePath = inGcs ? photoPublicPath(req.file.filename) : `/uploads/paw-finder/${req.file.filename}`;');
    expect(r).toContain("router.get('/photo/:name', async (req, res) => {");
    expect(r).toContain('if (!isValidPhotoName(name)) return res.status(404).end();');
    expect(r).not.toContain("import { requireVerifiedClubMember } from '../middleware/loyalty';");
  });
  it('the page says what the gate is: signed-in members, human approval', () => {
    const c = R('client/src/pages/PawFinder.tsx');
    expect(c).not.toContain('Verified PetWash members only.');
    expect(c).not.toContain('(incl. SMS)');
    expect(c).not.toContain('מאומתי SMS');
    expect(c).toContain('For signed-in PetWash members.');
    expect(c).toContain('Safe & approved');
  });
  it('the review-queue SLA alert is scheduled and throttled', () => {
    const b = R('server/backgroundJobs.ts');
    expect(b).toContain("this.acquireLock('pawFinderReviewSla')");
    expect(b).toContain("WHERE status = 'pending_review' AND created_at < NOW() - INTERVAL '30 minutes'");
    expect(b).toContain('private pawFinderSlaLastAlertAt = 0;');
    expect(b).toContain("PawFinder: ${n} post(s) waiting for approval > 30 min");
  });
});

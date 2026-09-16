/**
 * BOOT LANDMINE: routes/adoption imported a name its module did not export.
 *
 * 2026-09-16 — the production deploy gate ("routes.ts module-load smoke test")
 * stopped every merge to main with:
 *
 *   ./routes/adoption
 *     ↳ The requested module '../lib/adoptionPhotoStore' does not provide an
 *       export named 'contentTypeFor'
 *
 * adoption.ts imports contentTypeFor from adoptionPhotoStore, which imported it
 * from pawFinderPhotoStore for its own use but never re-exported it. An ESM
 * import of a missing name throws at route registration — the container would
 * have crashed on boot, so the gate was right to hold the deploy.
 *
 * These assertions are on the real modules, not the text: a future refactor
 * that drops the re-export fails here instead of in the deploy queue.
 */
import { describe, expect, it } from 'vitest';

describe('adoption photo store exports everything routes/adoption imports', () => {
  it('contentTypeFor is importable from adoptionPhotoStore', async () => {
    const mod = await import('../lib/adoptionPhotoStore');
    expect(typeof mod.contentTypeFor).toBe('function');
    expect(mod.contentTypeFor('ad-1789197617123-0a1b2c3d4e5f.jpg')).toBe('image/jpeg');
    expect(mod.contentTypeFor('ad-1789197617123-0a1b2c3d4e5f.png')).toBe('image/png');
  });

  it('it is the SAME table PawFinder uses — one extension map, one answer', async () => {
    const adoption = await import('../lib/adoptionPhotoStore');
    const pawFinder = await import('../lib/pawFinderPhotoStore');
    expect(adoption.contentTypeFor).toBe(pawFinder.contentTypeFor);
  });

  it('every other name adoption.ts imports from the store exists too', async () => {
    const mod: Record<string, unknown> = await import('../lib/adoptionPhotoStore');
    for (const name of [
      'ADOPTION_OBJECT_PREFIX', 'ADOPTION_OBJECT_NAME_RE', 'isValidAdoptionPhotoName',
      'adoptionPhotoPublicPath', 'uploadAdoptionPhoto', 'readAdoptionPhoto', 'contentTypeFor',
    ]) {
      expect(mod[name], `adoptionPhotoStore must export ${name}`).toBeDefined();
    }
  });
});

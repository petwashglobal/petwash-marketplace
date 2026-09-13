import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * PawFinder / Adoption audit 2026-09-13.
 *  1. P0: /upload returned `/api/paw-finder/photo/<name>` (GCS, #2428) but the
 *     post schema only accepted `/uploads/paw-finder/…` → every post 400'd.
 *  2. Support approve / reject and a new lost↔found match never told the owner.
 *  3. Adoption listings were matched against lost pets.
 *  4. The AI photo scan resolved a URL path from the filesystem root → no photo
 *     was ever scanned.
 *  5. Adoption "Meet" opened the whole board, not the pet.
 */

const push = vi.fn(async () => 1);
vi.mock('../lib/fcm-push', () => ({ sendPushToUser: push }));

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

type Q = { sql: string; params: unknown[] };
function fakePool(handler: (sql: string, params: unknown[]) => any) {
  const calls: Q[] = [];
  return {
    calls,
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      return handler(sql, params) ?? { rows: [] };
    }),
  };
}

beforeEach(() => push.mockClear());

describe('1. the post schema accepts exactly what /upload returns', async () => {
  const { PAW_FINDER_MEDIA_PATH_RE, photoPublicPath } = await import('../lib/pawFinderPhotoStore');
  const name = 'pf-1789197617123-0a1b2c3d4e5f.jpg';

  it('accepts the GCS address and the legacy address', () => {
    expect(PAW_FINDER_MEDIA_PATH_RE.test(photoPublicPath(name))).toBe(true);
    expect(PAW_FINDER_MEDIA_PATH_RE.test(`/uploads/paw-finder/${name}`)).toBe(true);
  });

  it('rejects anything else', () => {
    for (const bad of [
      `/uploads/paw-finder/../../etc/passwd`,
      `/uploads/paw-finder/${name}/../x.html`,
      `/api/paw-finder/photo/pf-1-abc.svg`,
      `https://evil.example/${name}`,
      `/uploads/other/${name}`,
      `/api/paw-finder/photo/${name}?x=1`,
    ]) expect(PAW_FINDER_MEDIA_PATH_RE.test(bad), bad).toBe(false);
  });

  it('every path /upload can return passes the schema (both branches)', () => {
    const r = R('server/routes/paw-finder.ts');
    expect(r).toContain('const filePath = inGcs ? photoPublicPath(req.file.filename) : `/uploads/paw-finder/${req.file.filename}`;');
    expect(r).toContain('filePath: z.string().min(1).regex(PAW_FINDER_MEDIA_PATH_RE, {');
    expect(r).not.toContain('regex(/^\\/uploads\\/paw-finder\\//');
  });
});

describe('2. the owner is told', async () => {
  const { notifyPawFinderOwner, pawFinderOwnerMessage } = await import('../lib/pawFinderNotify');

  it('writes the in-app row AND pushes, deep-linked to the post', async () => {
    const pool = fakePool(() => undefined);
    await notifyPawFinderOwner(pool, { userId: 'u1', postId: 42, event: 'post_approved', post: { post_type: 'lost', pet_name: 'Kenzo' } });
    expect(pool.calls).toHaveLength(1);
    expect(pool.calls[0].sql).toContain('INSERT INTO paw_finder_notifications');
    expect(pool.calls[0].params.slice(0, 3)).toEqual(['u1', 42, 'post_approved']);
    expect(JSON.parse(String(pool.calls[0].params[5]))).toEqual({ link: '/paw-finder/42' });
    expect(push).toHaveBeenCalledWith('u1', expect.objectContaining({
      data: { deepLink: '/paw-finder/42', type: 'paw_finder_post_approved', postId: '42' },
    }));
  });

  it('never throws when the DB or push fails, and does nothing without an owner', async () => {
    push.mockRejectedValueOnce(new Error('fcm down'));
    const pool = fakePool(() => { throw new Error('db down'); });
    await expect(notifyPawFinderOwner(pool, { userId: 'u1', postId: 1, event: 'match_found', post: {} })).resolves.toBeUndefined();
    const empty = fakePool(() => undefined);
    await notifyPawFinderOwner(empty, { userId: null, postId: 1, event: 'match_found', post: {} });
    expect(empty.calls).toHaveLength(0);
  });

  it('copy names the pet and never leaks the internal reject reason', () => {
    expect(pawFinderOwnerMessage('post_approved', { post_type: 'adoption', pet_name: 'Harley' }).body).toContain('Harley');
    expect(pawFinderOwnerMessage('match_found', { post_type: 'lost', pet_name: 'Kenzo' }).title).toContain('מצאנו');
    const rej = pawFinderOwnerMessage('post_rejected', { pet_name: 'X' });
    expect(`${rej.title} ${rej.body}`).not.toMatch(/reason|spam|blocked/i);
  });

  it('admin approve / reject notify once (not on a repeat click) and 404 an unknown post', () => {
    const a = R('server/routes/admin-paw-finder.ts');
    expect(a).toContain("RETURNING p.user_id, p.post_type, p.pet_name, prev.prev_status IN ('published','matched') AS was_published");
    expect(a).toContain("if (!approved[0].was_published) {");
    expect(a).toContain("event: 'post_approved'");
    expect(a).toContain("RETURNING p.user_id, p.post_type, p.pet_name, prev.prev_status = 'rejected' AS was_rejected");
    expect(a).toContain("event: 'post_rejected'");
    expect(a.match(/return res\.status\(404\)\.json\(\{ error: 'not_found' \}\);/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

describe('2+3. matching', async () => {
  const { refreshMatchesForPost } = await import('../services/PawFinderMatchService');
  const lost = { id: 1, user_id: 'owner', post_type: 'lost', status: 'published', city: 'Kfar Saba', pet_type: 'dog', color_primary: 'black', breed: 'Poodle', size_category: 'medium', event_date: '2026-09-12', pet_name: 'Kenzo' };
  const found = { id: 2, user_id: 'finder', post_type: 'found', status: 'published', city: 'Kfar Saba', pet_type: 'dog', color_primary: 'black', breed: 'poodle', size_category: 'medium', event_date: '2026-09-12', pet_name: null };

  function matchPool(post: any, others: any[], inserted: boolean) {
    return fakePool((sql) => {
      if (sql.includes('SELECT * FROM paw_finder_posts WHERE id = $1')) return { rows: [post] };
      if (sql.includes('SELECT * FROM paw_finder_posts')) return { rows: others };
      if (sql.includes('INSERT INTO paw_finder_matches')) return { rows: [{ inserted }] };
      return { rows: [] };
    });
  }

  it('a NEW match notifies both owners, each on their own post', async () => {
    const pool = matchPool(found, [lost], true);
    await refreshMatchesForPost(pool, 2);
    const notes = pool.calls.filter(c => c.sql.includes('INSERT INTO paw_finder_notifications'));
    expect(notes.map(n => [n.params[0], n.params[1], n.params[2]])).toEqual([
      ['owner', 1, 'match_found'],
      ['finder', 2, 'match_found'],
    ]);
    expect(push).toHaveBeenCalledTimes(2);
  });

  it('a re-scored existing match does not re-notify', async () => {
    const pool = matchPool(found, [lost], false);
    await refreshMatchesForPost(pool, 2);
    expect(pool.calls.some(c => c.sql.includes('paw_finder_notifications'))).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });

  it('an adoption listing is never matched against lost pets', async () => {
    const pool = matchPool({ ...found, post_type: 'adoption' }, [lost], true);
    await refreshMatchesForPost(pool, 2);
    expect(pool.calls.some(c => c.sql.includes('paw_finder_matches'))).toBe(false);
  });
});

describe('4. the AI photo scan reads the real photo', () => {
  it('reads through the photo store by validated name, not path.resolve on a URL path', () => {
    const m = R('server/services/PawFinderModerationService.ts');
    expect(m).toContain('const name = path.basename(String(filePath || \'\'));');
    expect(m).toContain('if (!isValidPhotoName(name)) {');
    expect(m).toContain('const photo = await readPhoto(name, PAW_FINDER_UPLOAD_DIR);');
    expect(m).not.toContain('const resolved = path.resolve(filePath);');
  });
});

describe('5. adoption "Meet" opens the pet', () => {
  it('links to /paw-finder/:id, and that route exists', () => {
    expect(R('client/src/pages/AdoptionMaison.tsx')).toContain('<Link href={`/paw-finder/${p.id}`}>');
    expect(R('client/src/App.tsx')).toContain('<Route path="/paw-finder/:id">');
  });
});

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * CEO 2026-09-17: "cannot edit or add details".
 *
 * Verified true: Adopt a Pet allowed only a status change, PawFinder only
 * "resolved". A wrong street or phone forced delete-and-repost, losing the
 * notice's age, its matches and every share.
 *
 * The rule these pins protect: free text and photos go BACK THROUGH REVIEW;
 * structured answers and contact details apply AT ONCE; every change is logged;
 * nobody edits an item that is not theirs.
 */
const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

type Call = { sql: string; params: unknown[] };
function fakePool(handler: (sql: string, params: unknown[]) => any) {
  const calls: Call[] = [];
  return {
    calls,
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      return handler(sql, params) ?? { rows: [] };
    }),
  };
}

describe('what an edit costs', async () => {
  const { classifyEdit, canEdit, statusAfterEdit } = await import('../lib/communityEdits');

  it('a phone fix is instant; new words are not', () => {
    expect(classifyEdit('adoption', { contactPhone: '050-1234567' })).toMatchObject({ needsReview: false, instant: ['contactPhone'] });
    expect(classifyEdit('adoption', { description: 'new text' })).toMatchObject({ needsReview: true, review: ['description'] });
    expect(classifyEdit('paw_finder', { rewardAmount: 500 })).toMatchObject({ needsReview: false });
    expect(classifyEdit('paw_finder', { area: 'somewhere else' })).toMatchObject({ needsReview: true });
  });

  it('a field nobody may edit is refused, never silently dropped', () => {
    const r = classifyEdit('paw_finder', { status: 'published', user_id: 'someone-else', postType: 'found' });
    expect(r.rejected.sort()).toEqual(['postType', 'status', 'user_id']);
    expect(r.instant).toEqual([]);
    expect(r.review).toEqual([]);
  });

  it('only a live item is editable', () => {
    expect(canEdit('adoption', 'available')).toBe(true);
    expect(canEdit('adoption', 'pending_review')).toBe(true);
    expect(canEdit('adoption', 'adopted')).toBe(false);
    expect(canEdit('adoption', 'archived')).toBe(false);
    expect(canEdit('paw_finder', 'published')).toBe(true);
    expect(canEdit('paw_finder', 'resolved')).toBe(false);
  });

  it('review sends it back to the queue; an instant edit leaves status alone', () => {
    expect(statusAfterEdit('paw_finder', 'published', true)).toBe('pending_review');
    expect(statusAfterEdit('paw_finder', 'published', false)).toBe('published');
    expect(statusAfterEdit('adoption', 'available', false)).toBe('available');
  });
});

describe('applying an edit', async () => {
  const { applyCommunityEdit } = await import('../services/CommunityEditService');
  const listing = (over: Record<string, unknown> = {}) => ({
    id: 7, user_id: 'owner', status: 'available', contact_phone: '050-0000000',
    description: 'the original words', city: 'כפר סבא', area: null, ...over,
  });
  const pool = (row: any) => fakePool((sql) => {
    if (sql.startsWith('SELECT * FROM')) return { rows: [row] };
    if (sql.includes('UPDATE')) return { rows: [{ status: sql.includes("status = $2") || true ? 'x' : 'x' }] };
    return { rows: [] };
  });

  it('a phone-only edit keeps the listing public', async () => {
    const p = fakePool((sql) => {
      if (sql.startsWith('SELECT * FROM')) return { rows: [listing()] };
      if (sql.includes('UPDATE')) return { rows: [{ status: 'available' }] };
    });
    const r = await applyCommunityEdit(p, { surface: 'adoption', itemId: 7, userId: 'owner', changes: { contactPhone: '050-1234567' } });
    expect(r).toMatchObject({ applied: ['contactPhone'], needsReview: false, status: 'available' });
    const update = p.calls.find((c) => c.sql.includes('UPDATE'))!;
    expect(update.sql).toContain('contact_phone = $1');
    expect(update.sql).not.toContain("moderation_status = 'pending'");
  });

  it('changing the words sends it back to review and clears the old approval', async () => {
    const p = fakePool((sql) => {
      if (sql.startsWith('SELECT * FROM')) return { rows: [listing()] };
      if (sql.includes('UPDATE')) return { rows: [{ status: 'pending_review' }] };
    });
    const r = await applyCommunityEdit(p, { surface: 'adoption', itemId: 7, userId: 'owner', changes: { description: 'a completely new description here' } });
    expect(r).toMatchObject({ needsReview: true, status: 'pending_review' });
    expect(p.calls.find((c) => c.sql.includes('UPDATE'))!.sql).toContain("moderation_status = 'pending'");
  });

  it('an edit that changes nothing does NOT push a live notice into the queue', async () => {
    const p = fakePool((sql) => (sql.startsWith('SELECT * FROM') ? { rows: [listing()] } : { rows: [] }));
    const r = await applyCommunityEdit(p, { surface: 'adoption', itemId: 7, userId: 'owner', changes: { description: 'the original words' } });
    expect(r).toEqual({ applied: [], needsReview: false, status: 'available' });
    expect(p.calls.some((c) => c.sql.includes('UPDATE'))).toBe(false);
  });

  it('someone else cannot edit your notice, and a resolved one is closed', async () => {
    await expect(applyCommunityEdit(pool(listing()), { surface: 'adoption', itemId: 7, userId: 'stranger', changes: { contactPhone: '050-1234567' } }))
      .rejects.toMatchObject({ code: 'NOT_OWNER', httpStatus: 403 });
    await expect(applyCommunityEdit(pool(listing({ status: 'adopted' })), { surface: 'adoption', itemId: 7, userId: 'owner', changes: { contactPhone: '050-1234567' } }))
      .rejects.toMatchObject({ httpStatus: 409 });
  });

  it('every change is written to the trail, before → after', async () => {
    const p = fakePool((sql) => {
      if (sql.startsWith('SELECT * FROM')) return { rows: [listing()] };
      if (sql.includes('UPDATE')) return { rows: [{ status: 'available' }] };
    });
    await applyCommunityEdit(p, { surface: 'adoption', itemId: 7, userId: 'owner', changes: { contactPhone: '050-1234567' } });
    const trail = p.calls.find((c) => c.sql.includes('community_edit_events'))!;
    expect(trail.params.slice(0, 6)).toEqual(['adoption', 7, 'owner', 'contactPhone', '050-0000000', '050-1234567']);
  });
});

describe('sightings', () => {
  const route = R('server/routes/paw-finder.ts');

  it('a sighting can only be added to a live lost/found notice, and alerts the owner', () => {
    expect(route).toContain("router.post('/posts/:id/sightings', requireAuth");
    expect(route).toContain("AND post_type IN ('lost','found') LIMIT 1");
    expect(route).toContain("if (!['published', 'matched'].includes(post.status)) return res.status(409).json({ error: 'POST_NOT_OPEN' });");
    expect(route).toContain("'sighting_reported'");
    expect(route).toContain("type: 'paw_finder_sighting'");
  });

  it('the public trail hides dismissed reports and never leaks the reporter', () => {
    const q = route.slice(route.indexOf("router.get('/posts/:id/sightings'"), route.indexOf("router.post('/posts/:id/sightings'"));
    expect(q).toContain("s.status <> 'dismissed'");
    expect(q).not.toContain('reporter_user_id');
    expect(q).toContain('ROUND(s.latitude::numeric, 2)');
  });

  it('spamming the trail is capped', () => {
    expect(route).toContain("SIGHTING_RATE_LIMIT");
  });
});

describe('edit + add wiring', () => {
  it('both products expose edit, history and add-photo for the owner only', () => {
    const a = R('server/routes/adoption.ts'), p = R('server/routes/paw-finder.ts');
    expect(a).toContain("router.patch('/my/listings/:id', requireAuth");
    expect(a).toContain("router.get('/my/listings/:id/history', requireAuth");
    expect(a).toContain("router.post('/my/listings/:id/photos', requireAuth");
    expect(p).toContain("router.patch('/my/posts/:id', requireAuth");
    expect(p).toContain("router.get('/my/posts/:id/history', requireAuth");
    expect(p).toContain("router.post('/my/posts/:id/photos', requireAuth");
    for (const src of [a, p]) expect(src).toContain("return res.status(403).json({ error: 'not_owner' });");
  });

  it('a new photo is treated like new public content', () => {
    for (const src of [R('server/routes/adoption.ts'), R('server/routes/paw-finder.ts')]) {
      expect(src).toContain("SET status = 'pending_review', moderation_status = 'pending',");
      expect(src).toContain('PHOTO_LIMIT_REACHED');
    }
  });

  it('the migration adds the trail, the sightings and the edit counters', () => {
    const sql = R('migrations/0160_community_edits_and_sightings.sql');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS community_edit_events');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS paw_finder_sightings');
    expect(sql).toContain('ALTER TABLE adoption_listings ADD COLUMN IF NOT EXISTS last_edited_at');
    expect(sql).toContain('ALTER TABLE paw_finder_posts ADD COLUMN IF NOT EXISTS edit_count');
    expect(sql).not.toContain('$$');
  });
});

describe('the Hebrew booking confirmation subject', () => {
  it('says "אישור הזמנה", not the word ניר', () => {
    const t = R('server/email/templates/booking-confirmation-2026.ts');
    expect(t).toContain('`אישור הזמנה ⁦PetWash™⁩ — ${p.bookingRef}`');
    expect(t).not.toContain('ניר הזמנה');
  });
});

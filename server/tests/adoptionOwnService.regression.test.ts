import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

/**
 * ADOPT A PET IS NOT PAWFINDER (CEO, 2026-09-13).
 *
 *   PawFinder™‎  = "Where is my pet?" / "I found someone's pet."  LOST ↔ FOUND.
 *   Adopt a Pet = "This pet needs a new permanent family."
 *
 * PR #920 stored adoption listings as paw_finder_posts rows (post_type
 * 'adoption'): /adoption fetched /api/paw-finder/posts?postType=adoption, "List a
 * pet for adoption" opened /paw-finder, "Meet" opened /paw-finder/:id, and the
 * PawFinder board (filter "all") showed adoption listings next to lost dogs.
 *
 * These pins keep the products apart: separate data, API, routes, statuses and
 * contact flow. Low-level plumbing (login, photo bucket, safety scan, push) may
 * be shared; product identity may not.
 */

const push = vi.fn(async () => 1);
vi.mock('../lib/fcm-push', () => ({ sendPushToUser: push }));

const ROOT = resolve(__dirname, '..', '..');
const R = (p: string) => readFileSync(join(ROOT, p), 'utf8');

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

beforeEach(() => push.mockClear());

describe('PawFinder is lost ↔ found only', () => {
  const route = R('server/routes/paw-finder.ts');

  it('the post schema accepts exactly lost | found', () => {
    expect(route).toContain("export const PAW_FINDER_POST_TYPES = ['lost', 'found'] as const;");
    expect(route).toContain('postType: z.enum(PAW_FINDER_POST_TYPES),');
    expect(route).not.toMatch(/z\.enum\(\[[^\]]*'adoption'/);
  });

  it('every PawFinder read excludes legacy adoption rows', () => {
    expect(route).toContain("AND p.post_type IN ('lost','found')\n         AND ($1::text IS NULL OR p.post_type    = $1)");
    expect(route).toContain("WHERE p.id = $1 AND p.status NOT IN ('rejected','archived') AND p.post_type IN ('lost','found')");
    expect(route).toContain("WHERE p.user_id = $1 AND p.status <> 'archived' AND p.post_type IN ('lost','found')");
    expect(R('server/services/PawFinderService.ts')).toContain("WHERE id = $1 AND post_type IN ('lost','found') LIMIT 1");
    const admin = R('server/routes/admin-paw-finder.ts');
    expect(admin.match(/post_type IN \('lost','found'\)/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it('the PawFinder form cannot create an adoption notice', () => {
    const page = R('client/src/pages/PawFinder.tsx');
    expect(page).toContain("postType: 'lost' as 'lost' | 'found',");
    expect(page).not.toContain('<option value="adoption">');
    expect(R('server/lib/pawFinderNotify.ts')).not.toContain("'adoption'");
  });

  it('the database refuses a new adoption row in paw_finder_posts, and legacy rows are moved, not deleted', () => {
    const sql = R('migrations/0155_adoption_own_service.sql');
    expect(sql).toContain("CHECK (post_type IN ('lost', 'found')) NOT VALID;");
    expect(sql).toContain('legacy_paw_finder_post_id');
    expect(sql).not.toMatch(/DELETE\s+FROM\s+paw_finder/i);
    expect(sql).not.toContain('$$'); // the migration runner splits on ';'
  });
});

describe('Adopt a Pet has its own product surface', () => {
  it('the board reads its own API and links only to adoption routes', () => {
    const maison = R('client/src/pages/AdoptionMaison.tsx');
    expect(maison).toContain("fetch('/api/adoption/listings'");
    expect(maison).toContain('<Link href="/adoption/new">');
    expect(maison).toContain('<Link href={`/adoption/${l.id}`}>');
    expect(maison).not.toContain('/paw-finder');
    expect(maison).not.toContain('reward');
  });

  it('keeps the approved #920 concept copy', () => {
    const maison = R('client/src/pages/AdoptionMaison.tsx');
    expect(maison).toContain("'Every soul deserves a home.'");
    // Superseded by the CEO's canonical Adopt a Pet mockup (2026-09-13).
    expect(maison).toContain('A free members-only adoption platform.');
    expect(maison).toContain("'List a pet for adoption ←'");
  });

  it('routes exist, specific before :id', () => {
    const app = R('client/src/App.tsx');
    const at = (p: string) => app.indexOf(`<Route path="${p}">`);
    for (const p of ['/adoption/new', '/adoption/my', '/adoption/:id', '/adoption', '/admin/adoption']) expect(at(p), p).toBeGreaterThan(-1);
    expect(at('/adoption/new')).toBeLessThan(at('/adoption/:id'));
    expect(at('/adoption/my')).toBeLessThan(at('/adoption/:id'));
  });

  it('the API is mounted on its own prefix', () => {
    const routes = R('server/routes.ts');
    expect(routes).toContain("app.use('/api/adoption', apiLimiter, requireConsentIfEnabled('terms', 'privacy'), adoptionRoutes.default);");
    expect(routes).toContain("app.use('/api/admin/adoption', validateFirebaseToken, adminLimiter,");
  });

  it('no client code asks PawFinder for adoption data', () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const full = join(dir, f);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.tsx?$/.test(f) && /postType=adoption|\/api\/paw-finder[^'"`\s]*adoption/.test(readFileSync(full, 'utf8'))) hits.push(full);
      }
    };
    walk(join(ROOT, 'client', 'src', 'pages'));
    expect(hits).toEqual([]);
  });

  it('adoption photos never carry a PawFinder address', async () => {
    const { ADOPTION_MEDIA_PATH_RE } = await import('../lib/adoptionRules');
    // Source pin, not an import: the store pulls in @google-cloud/storage (slow under the full suite).
    expect(R('server/lib/adoptionPhotoStore.ts')).toContain('return `/api/adoption/photo/${name}`;');
    expect(ADOPTION_MEDIA_PATH_RE.test('/api/adoption/photo/ad-1789197617123-0a1b2c3d4e5f.jpg')).toBe(true);
    for (const bad of [
      '/api/paw-finder/photo/pf-1789197617123-0a1b2c3d4e5f.jpg',
      '/uploads/paw-finder/pf-1789197617123-0a1b2c3d4e5f.jpg',
      '/api/adoption/photo/ad-1-abc.svg',
      '/api/adoption/photo/../x.jpg',
    ]) expect(ADOPTION_MEDIA_PATH_RE.test(bad), bad).toBe(false);
  });
});

describe('adoption rules', async () => {
  const { canOwnerMoveListing, createAdoptionListingSchema } = await import('../lib/adoptionRules');

  const valid = {
    petType: 'dog', petName: 'Harley', description: 'Gentle, house-trained, loves long walks.',
    city: 'Kfar Saba', contactPhone: '050-1234567',
    mediaFiles: [{ filePath: '/api/adoption/photo/ad-1789197617123-0a1b2c3d4e5f.jpg' }],
  };

  it('available → pending → adopted; support alone publishes', () => {
    expect(canOwnerMoveListing('available', 'pending')).toBe(true);
    expect(canOwnerMoveListing('pending', 'adopted')).toBe(true);
    expect(canOwnerMoveListing('pending', 'available')).toBe(true);
    expect(canOwnerMoveListing('pending_review', 'available')).toBe(false);
    expect(canOwnerMoveListing('rejected', 'available')).toBe(false);
    expect(canOwnerMoveListing('adopted', 'available')).toBe(false);
    expect(canOwnerMoveListing('archived', 'available')).toBe(false);
  });

  it('a listing is a home-seeking profile, not a lost/found notice', () => {
    expect(createAdoptionListingSchema.safeParse(valid).success).toBe(true);
    for (const lostFoundField of [{ postType: 'lost' }, { rewardAmount: 500 }, { eventDate: '2026-09-13' }, { latitude: 32.1 }]) {
      expect(createAdoptionListingSchema.safeParse({ ...valid, ...lostFoundField }).success, JSON.stringify(lostFoundField)).toBe(false);
    }
    expect(createAdoptionListingSchema.safeParse({ ...valid, contactPhone: undefined }).success).toBe(false);
    expect(createAdoptionListingSchema.safeParse({ ...valid, mediaFiles: [] }).success).toBe(false);
  });
});

describe('adoption service', async () => {
  const svc = await import('../services/AdoptionService');

  const listingRow = (over: Record<string, unknown> = {}) => ({ id: 7, user_id: 'lister', status: 'available', pet_name: 'Harley', ...over });

  it('never touches PawFinder tables', async () => {
    const pool = fakePool((sql) => {
      if (sql.includes('COUNT(*)')) return { rows: [{ cnt: 0 }] };
      if (sql.includes('SELECT id, user_id, status, pet_name')) return { rows: [listingRow()] };
      if (sql.includes('INSERT INTO adoption_enquiries')) return { rows: [{ id: 3 }] };
      if (sql.includes('INSERT INTO adoption_listings')) return { rows: [{ id: 9 }] };
    });
    await svc.createAdoptionEnquiry(pool, 'applicant', 7, { messageText: 'x'.repeat(30), homeType: 'house', hasChildren: 'no', hasOtherPets: 'no' });
    await svc.createAdoptionListing(pool as any, 'lister', {
      listerType: 'private', petType: 'dog', petName: 'Harley', sex: 'unknown', ageGroup: 'adult', sizeCategory: 'large',
      description: 'Gentle, house-trained, loves long walks.', vaccinated: 'yes', neutered: 'yes', microchipped: 'yes',
      goodWithChildren: 'yes', goodWithDogs: 'unknown', goodWithCats: 'no', city: 'Kfar Saba', contactPhone: '0501234567',
      mediaFiles: [{ filePath: '/api/adoption/photo/ad-1789197617123-0a1b2c3d4e5f.jpg', mediaRole: 'primary' }],
    }, { moderate: async () => ({ verdict: 'approved', moderationReason: 'ok', confidence: 90, flags: [] }) });
    expect(pool.calls.filter((c) => /paw_finder/.test(c.sql))).toEqual([]);
  });

  it('a clean listing waits for support; a blocked one is refused', async () => {
    const mk = () => fakePool((sql) => {
      if (sql.includes('COUNT(*)')) return { rows: [{ cnt: 0 }] };
      if (sql.includes('INSERT INTO adoption_listings')) return { rows: [{ id: 9 }] };
    });
    const input: any = { listerType: 'private', petType: 'cat', petName: 'Mishi', sex: 'female', ageGroup: 'young', sizeCategory: 'small',
      description: 'Calm indoor cat looking for a quiet home.', vaccinated: 'yes', neutered: 'yes', microchipped: 'no',
      goodWithChildren: 'yes', goodWithDogs: 'no', goodWithCats: 'yes', city: 'Ramat Gan', contactPhone: '0501234567',
      mediaFiles: [{ filePath: '/api/adoption/photo/ad-1789197617123-0a1b2c3d4e5f.jpg', mediaRole: 'primary' }] };
    const ok = await svc.createAdoptionListing(mk() as any, 'u', input, { moderate: async () => ({ verdict: 'approved', moderationReason: '', confidence: 90, flags: [] }) });
    expect(ok.status).toBe('pending_review');
    const flagged = await svc.createAdoptionListing(mk() as any, 'u', input, { moderate: async () => ({ verdict: 'flagged', moderationReason: '', confidence: 70, flags: ['illegal_sale'] }) });
    expect(flagged.status).toBe('pending_review');
    const blocked = await svc.createAdoptionListing(mk() as any, 'u', input, { moderate: async () => ({ verdict: 'blocked', moderationReason: '', confidence: 96, flags: ['abuse_content'] }) });
    expect(blocked.status).toBe('rejected');
  });

  it('an enquiry needs an open listing that is not your own, and alerts the lister', async () => {
    const pool = (listing: any) => fakePool((sql) => {
      if (sql.includes('SELECT id, user_id, status, pet_name')) return { rows: [listing] };
      if (sql.includes('COUNT(*)')) return { rows: [{ cnt: 0 }] };
      if (sql.includes('INSERT INTO adoption_enquiries')) return { rows: [{ id: 3 }] };
    });
    const body = { messageText: 'We have a garden and work from home.', homeType: 'house_with_yard', hasChildren: 'yes', hasOtherPets: 'no' };
    await expect(svc.createAdoptionEnquiry(pool(listingRow({ status: 'adopted' })), 'a', 7, body)).rejects.toMatchObject({ code: 'LISTING_NOT_OPEN' });
    await expect(svc.createAdoptionEnquiry(pool(listingRow({ status: 'pending_review' })), 'a', 7, body)).rejects.toMatchObject({ code: 'LISTING_NOT_OPEN' });
    await expect(svc.createAdoptionEnquiry(pool(listingRow()), 'lister', 7, body)).rejects.toMatchObject({ code: 'CANNOT_ENQUIRE_OWN_LISTING' });

    const p = pool(listingRow());
    await svc.createAdoptionEnquiry(p, 'applicant', 7, body);
    const note = p.calls.find((c) => c.sql.includes('INSERT INTO adoption_notifications'))!;
    expect(note.params.slice(0, 3)).toEqual(['lister', 7, 'enquiry_received']);
    expect(push).toHaveBeenCalledWith('lister', expect.objectContaining({ data: expect.objectContaining({ deepLink: '/adoption/my' }) }));
  });

  it('accepting shares the lister phone with that applicant only; declining does not', async () => {
    const pool = () => fakePool((sql) => {
      if (sql.includes('UPDATE adoption_enquiries')) return { rows: [{ id: 3, listing_id: 7, applicant_user_id: 'applicant' }] };
      if (sql.includes('SELECT id, pet_name, contact_phone')) return { rows: [{ id: 7, pet_name: 'Harley', contact_phone: '050-1234567' }] };
    });
    await svc.respondToAdoptionEnquiry(pool(), 'lister', 3, 'accepted');
    expect(push).toHaveBeenLastCalledWith('applicant', expect.objectContaining({ body: expect.stringContaining('050-1234567') }));
    await svc.respondToAdoptionEnquiry(pool(), 'lister', 3, 'declined');
    expect(push).toHaveBeenLastCalledWith('applicant', expect.objectContaining({ body: expect.not.stringContaining('050') }));
  });

  it('only the lister moves a listing, and only along the allowed path', async () => {
    const pool = (row: any, updated = true) => fakePool((sql) => {
      if (sql.startsWith('SELECT id, user_id, status FROM adoption_listings')) return { rows: [row] };
      if (sql.includes('UPDATE adoption_listings')) return { rows: updated ? [{ id: 7 }] : [] };
    });
    await expect(svc.setOwnListingStatus(pool(listingRow()), 'someone-else', 7, 'adopted')).rejects.toMatchObject({ code: 'NOT_LISTING_OWNER' });
    await expect(svc.setOwnListingStatus(pool(listingRow({ status: 'pending_review' })), 'lister', 7, 'available')).rejects.toMatchObject({ code: 'STATUS_CHANGE_NOT_ALLOWED' });
    await expect(svc.setOwnListingStatus(pool(listingRow(), false), 'lister', 7, 'adopted')).rejects.toMatchObject({ code: 'STATUS_CHANGE_NOT_ALLOWED' });

    const p = pool(listingRow());
    await svc.setOwnListingStatus(p, 'lister', 7, 'adopted');
    expect(p.calls.some((c) => c.sql.includes("SET status = 'declined'"))).toBe(true);
  });
});

describe('public listing API never exposes the lister phone', () => {
  it('contact_phone is absent from the public projection and only in accepted sent-enquiries', () => {
    const r = R('server/routes/adoption.ts');
    const projection = r.slice(r.indexOf('const PUBLIC_LISTING_COLUMNS'), r.indexOf('l.published_at, l.adopted_at`;'));
    expect(projection).not.toContain('contact_phone');
    expect(r).toContain("CASE WHEN e.status = 'accepted' THEN l.contact_phone ELSE NULL END AS owner_phone");
  });
});

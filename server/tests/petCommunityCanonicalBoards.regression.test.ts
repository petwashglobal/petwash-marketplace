import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * CEO canonical mockups (2026-09-13): Adopt a Pet and PawFinder™ boards.
 * Implement exactly, wired to real data — and keep the two products apart.
 */
const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('Adopt a Pet board = the mockup, wired', () => {
  const s = R('client/src/pages/AdoptionMaison.tsx');
  it('header, side nav, filters, sort and pillars from the mockup', () => {
    for (const t of ['Adopt a Pet', 'A free members-only adoption platform.', 'Find Their Next Chapter', 'Browse Pets', 'My Matches', 'Saved', 'My Profile',
      'Apartment Friendly', 'Good with Kids', 'Dog Friendly', 'Cat Friendly', 'Low Shedding', 'Special Needs', 'Newest First',
      'Verified Listings', 'Smart Matching', 'Secure Enquiries', 'Meet & Adopt', 'Pending Meet', "I'm Interested", 'View Profile']) {
      expect(s, t).toContain(t);
    }
  });
  it('saved pets and matches come from the server, not local fakes', () => {
    expect(s).toContain("'/api/adoption/my/favorites'");
    expect(s).toContain("'/api/adoption/my/matches'");
    expect(s).toContain('/favorite`');
    expect(s).not.toContain('/api/paw-finder');
  });
  it('the server backs every filter the board offers', () => {
    const r = R('server/routes/adoption.ts');
    expect(r).toContain('l.apartment_friendly, l.low_shedding, l.age_months,');
    expect(r).toContain("router.get('/my/matches', requireAuth,");
    expect(R('migrations/0158_adoption_matching_and_saved.sql')).toContain('CREATE TABLE IF NOT EXISTS adoption_favorites');
  });
});

describe('PawFinder board = the mockup, wired', () => {
  const s = R('client/src/pages/PawFinder.tsx');
  it('header, side nav, chips, map, alert cards and pillars from the mockup', () => {
    for (const t of ['A free members service for lost & found pets.', 'Find faster. Reunite sooner.', 'Live Map', 'Lost Pets', 'Found Pets',
      'Possible Matches', 'My Alerts', 'Find Lost Pets Near You', 'Last 24 Hours', 'Recent Alerts', 'Share Alert', 'Report a Pet',
      'Instant Alerts', 'Direct Contact', 'A faster path home.', 'Reunite']) {
      expect(s, t).toContain(t);
    }
  });
  it('"Call Now" only dials a phone the owner chose to publish', () => {
    expect(s).toContain('const primary = post.public_phone ? (');
    expect(s).toContain('href={`tel:${post.public_phone}`}');
  });
  it('never shows adoption listings', () => {
    expect(s).not.toContain('/api/adoption');
    expect(s).not.toContain("'adoption'");
  });
});

describe('adoption fit is honest', async () => {
  const { adoptionFit } = await import('../lib/adoptionRules');
  const pet = { pet_type: 'dog', good_with_children: 'yes', good_with_cats: 'no', apartment_friendly: 'unknown', low_shedding: 'unknown' };
  it('no profile → no fit claim', () => {
    expect(adoptionFit(pet, null).greatFit).toBe(false);
  });
  it('confirmed need + no conflict → great fit', () => {
    expect(adoptionFit(pet, { hasChildren: 'yes', preferredSpecies: 'dog' }).greatFit).toBe(true);
  });
  it('a stated conflict always wins', () => {
    expect(adoptionFit(pet, { hasChildren: 'yes', hasCats: 'yes' }).greatFit).toBe(false);
  });
  it('unknown is neither a match nor a conflict', () => {
    const f = adoptionFit(pet, { homeType: 'apartment' });
    expect(f).toEqual({ greatFit: false, conflicts: [], confirmed: [] });
  });
});

describe('live-test findings 2026-09-16', () => {
  it('a photo records what it is — mime_type was NULL on every live post', () => {
    expect(R('server/routes/adoption.ts')).toContain('mimeType: contentTypeFor(req.file.filename)');
    expect(R('server/routes/paw-finder.ts')).toContain('mimeType: contentTypeFor(req.file.filename)');
    expect(R('client/src/pages/adoption/AdoptionCreate.tsx')).toContain('...(p.mimeType ? { mimeType: p.mimeType } : {})');
    expect(R('client/src/pages/PawFinder.tsx')).toContain('...(uploadedMime ? { mimeType: uploadedMime } : {})');
  });

  it('a pet page never prints an answer the lister never gave', () => {
    const s = R('client/src/pages/adoption/AdoptionListingPage.tsx');
    expect(s).toContain("if (!value || answer === 'unknown' || answer === null) return null;");
    expect(s).not.toMatch(/<Fact label=\{[^}]+\} value=\{yesNoLabel\(isHe, [^)]+\)\} \/>/);
  });
});

describe('placeLine', async () => {
  const { placeLine } = await import('@shared/lib/placeLine');
  it('never repeats the city inside the area', () => {
    expect(placeLine('כפר סבא', 'פארק כפר סבא')).toBe('פארק כפר סבא');
    expect(placeLine('Kfar Saba', 'Kfar Saba')).toBe('Kfar Saba');
  });
  it('keeps a real area', () => {
    expect(placeLine('כפר סבא', 'רחוב ויצמן')).toBe('רחוב ויצמן, כפר סבא');
  });
  it('survives a missing half', () => {
    expect(placeLine('כפר סבא', null)).toBe('כפר סבא');
    expect(placeLine(null, 'רחוב ויצמן')).toBe('רחוב ויצמן');
    expect(placeLine(null, null)).toBe('');
  });
});

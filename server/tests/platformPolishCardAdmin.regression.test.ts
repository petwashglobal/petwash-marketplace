/**
 * Platform polish + card admin (2026-09-12).
 *  - ONE tier ladder (shared/lib/tierLabels.ts) behind memberTier.tierLabel and the pass page.
 *  - PawFinder: dead DEMO_PETS gone; /paw-finder/:id deep link; share links point at it.
 *  - Academy tile no longer advertises "courses" (no such entity — it is trainer booking).
 *  - Membership cards: admin lookup endpoint + a screen for freeze / unfreeze / regenerate / print,
 *    linked from the HQ portal.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { canonicalTierId, tierDisplayName, tierPassLabel, tierDisplay } from '../../shared/lib/tierLabels';

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('one tier ladder', () => {
  it('resolves legacy ids and returns the CEO-locked names', () => {
    expect(canonicalTierId('new')).toBe('bronze');
    expect(canonicalTierId('VIP')).toBe('royal');
    expect(canonicalTierId('black')).toBe('royal');
    expect(canonicalTierId('garbage')).toBe('bronze');
    expect(tierDisplayName('new')).toBe('Member');
    expect(tierDisplayName('diamond')).toBe('Diamond');
    expect(tierDisplayName('emerald')).toBe('Emerald');
    expect(tierDisplayName('black')).toBe('Black Reserve');
    expect(tierDisplayName('black', 'he')).toBe('Black Reserve'); // product name stays English
    expect(tierDisplayName('gold', 'he')).toBe('זהב');
    expect(tierPassLabel('black')).toBe('BLACK RESERVE');
    expect(tierDisplay('platinum')).toEqual({ en: 'Platinum', he: 'פלטינום' });
  });
  it('memberTier.tierLabel and the pass page derive from it (no private ladders left)', () => {
    const mt = R('server/lib/memberTier.ts');
    expect(mt).toContain("import { tierPassLabel } from '@shared/lib/tierLabels'");
    expect(mt).not.toContain("black: 'BLACK RESERVE'");
    const pp = R('server/routes/prestige-pass.ts');
    expect(pp).toContain("import { tierDisplay as tierDisplayFor } from '@shared/lib/tierLabels'");
    expect(pp).not.toContain("'Prestige Pearl'");
    expect(pp).not.toContain("'Prestige Black'");
  });
});

describe('PawFinder', () => {
  const src = R('client/src/pages/PawFinder.tsx');
  it('dead DEMO_PETS constant is gone', () => {
    expect(src).not.toContain('const DEMO_PETS');
    expect(src).not.toContain("primary_media: '/paw-finder/demo-dog.jpg'");
  });
  it('/paw-finder/:id deep link opens the post and share links point at it', () => {
    expect(src).toContain('initialPostId?: number;');
    expect(src).toContain("if (initialPostId && Number.isFinite(initialPostId)) setSelectedId(initialPostId);");
    expect(src).toContain("apiRequest(`/api/paw-finder/posts/${selectedId}`)");
    expect(src).toContain("/paw-finder/${post.id}`}");
    const app = R('client/src/App.tsx');
    expect(app).toContain('<Route path="/paw-finder/:id">');
    expect(app).toContain('initialPostId={Number(params.id)}');
    // 2026-09-13: this used to assert the route was PRESENT in the
    // unreachable-route baseline — it pinned the bookkeeping, not the
    // behaviour, so it passed for exactly as long as the route stayed broken.
    // The route is reachable now (the guard reported it healed), so the entry
    // is gone and the correct assertion is its absence.
    expect(R('scripts/guards/unreachable_routes_baseline.txt')).not.toContain('/paw-finder/:id');
  });
});

describe('Academy tile', () => {
  it('does not advertise courses (no courses entity exists — the Academy books trainers)', () => {
    const src = R('client/src/pages/PrestigeHome.tsx');
    expect(src).not.toContain("'Academy Courses'");
    expect(src).toContain("'Academy — Training'");
  });
});

describe('membership card admin', () => {
  it('lookup endpoint resolves e-mail / member id / uid and never issues a card', () => {
    const src = R('server/routes/membership-cards.ts');
    expect(src).toContain('membershipAdminRouter.get("/lookup", requireAdmin,');
    expect(src).toContain('error: "MEMBER_NOT_FOUND"');
    expect(src).toContain('error: "CARD_NOT_ISSUED"');
    const lookup = src.slice(src.indexOf('membershipAdminRouter.get("/lookup"'), src.indexOf('/** Print file for ONE member'));
    expect(lookup).not.toContain('getOrCreateCard');
    // /lookup is registered BEFORE /:userId/print.pdf so it is not captured as a userId
    expect(src.indexOf('membershipAdminRouter.get("/lookup"')).toBeLessThan(src.indexOf('membershipAdminRouter.get("/:userId/print.pdf"'));
  });
  it('the admin screen exists, is routed behind AdminRouteGuard, and has a door in the HQ portal', () => {
    const page = R('client/src/pages/AdminMembershipCards.tsx');
    for (const a of ['freeze', 'unfreeze', 'regenerate-qr', 'regenerate-barcode']) expect(page).toContain(`'${a}'`);
    expect(page).toContain('/print.pdf');
    expect(page).toContain("'/api/admin/membership/lookup'");
    const app = R('client/src/App.tsx');
    expect(app).toContain('<Route path="/admin/membership-cards">');
    expect(app).toMatch(/<Route path="\/admin\/membership-cards">\s*\{\(\) => \(\s*<AdminRouteGuard>\s*<AdminMembershipCards \/>/);
    expect(R('client/src/pages/HQManagementPortal.tsx')).toContain('href: "/admin/membership-cards"');
  });
});

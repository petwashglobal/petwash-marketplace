import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve, join } from 'path';

/**
 * PET PASSPORT IS REACHABLE (2026-09-10)
 *
 * PetPassportHome.tsx is the CEO's canonical multi-pet passport screen —
 * green marble (#063B22 / #D6B56D / #FAFAF7), RTL, 8 species, its own bottom
 * nav. It was ROUTED at /pet-passport in App.tsx and completely UNREACHABLE:
 * a grep of the entire client for "/pet-passport" returned exactly two hits
 * outside the passport's own files, and NEITHER was a link —
 *
 *   client/src/lib/immersive-routes.ts   a nav-SUPPRESSION list
 *   client/src/lib/workspaceFromPath.ts  a path→workspace classifier
 *
 * 330 lines of finished, spec-compliant, still-actively-maintained design that
 * a member could only reach by typing the URL. That is the failure mode this
 * pin exists to prevent: not "the screen broke", but "the screen quietly
 * stopped being linked and nobody noticed for months".
 *
 * A route existing is NOT reachability. The assertion is that some surface a
 * member actually sees navigates there.
 */
const CLIENT = resolve(__dirname, '../../client/src');

const read = (p: string) => readFileSync(resolve(CLIENT, p), 'utf8');

/** Files that mention the path WITHOUT linking to it — classifiers, not doors. */
const NOT_A_LINK = ['lib/immersive-routes.ts', 'lib/workspaceFromPath.ts'];

describe('the Pet Passport screen is reachable by a real member', () => {
  it('the member home has a tile that navigates to /pet-passport', () => {
    const home = read('pages/PrestigeHome.tsx');
    expect(
      /to:\s*'\/pet-passport'/.test(home),
      'PrestigeHome must link to /pet-passport — without it the passport is ' +
        'reachable only by typing the URL, which is how it went dark before.',
    ).toBe(true);
  });

  // 2026-09-18 (CEO: "why not in my dashboard or profile?"): the tile is
  // labelled by its product name, and the profile's quick actions carry a
  // door too — the per-pet link inside the "pets" tab was one tap deep and
  // pointed at the per-pet detail, never the passport home.
  it('the member home tile is called "Pet Passport", not "My Pets"', () => {
    const home = read('pages/PrestigeHome.tsx');
    expect(home).toMatch(/label:\s*'Pet Passport',\s*labelHe:\s*'Pet Passport',[^\n]*to:\s*'\/pet-passport'/);
  });

  it('the profile (MyAccount) quick actions link to /pet-passport', () => {
    const account = read('pages/MyAccount.tsx');
    expect(account).toMatch(/label:\s*'Pet Passport',\s*href:\s*'\/pet-passport'/);
  });

  it('the route still exists and renders PetPassportHome', () => {
    const app = read('App.tsx');
    expect(app).toMatch(/path="\/pet-passport"/);
    expect(app).toMatch(/PetPassportHome/);
  });

  it('at least one real link exists outside the passport family and the classifiers', () => {
    // Walk the client for "/pet-passport" and discount (a) the passport's own
    // files, (b) App.tsx's route table, (c) the two known non-link mentions.
    // Whatever remains is a genuine entry point.
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.tsx?$/.test(entry.name)) continue;
        const rel = full.slice(CLIENT.length + 1).split('\\').join('/');
        if (/PetPassport/i.test(rel) || rel === 'App.tsx') continue;
        if (NOT_A_LINK.includes(rel)) continue;
        // Match a NAVIGATION SHAPE, never the bare string. The bare string
        // appears in prose too — including in the comment on PrestigeHome
        // that explains this very fix, which made an earlier version of this
        // test pass on its own documentation. Comments do not route users.
        const src = readFileSync(full, 'utf8');
        const LINK = /(?:to:\s*|navigate\(\s*|href=|setLocation\(\s*|push\(\s*)['"`]\/pet-passport/;
        if (LINK.test(src)) hits.push(rel);
      }
    };
    walk(CLIENT);
    expect(
      hits.length,
      'No file outside the passport family links to /pet-passport. The screen ' +
        'is orphaned again.',
    ).toBeGreaterThan(0);
  });

  // 2026-09-19 (CEO: "passport pet where is it?"). The 2026-09-18 round gave
  // the Pet Parent home and the profile a door, but the DEFAULT dashboard —
  // App.tsx renders <Dashboard /> unless VITE_DASHBOARD_V2_ENABLED is set, so
  // it is the screen most members actually land on — still sent its "My Pets"
  // tile to /pets, the plain management list. Two doors out of three is how
  // the screen went dark the first time.
  it('the default dashboard\'s My Pets tile opens the passport, not the list', () => {
    const dashboard = read('pages/Dashboard.tsx');
    expect(dashboard).toMatch(/key: 'myPets',[^\n]*href: '\/pet-passport'/);
  });

  it('its "Add" card opens the add flow it promises', () => {
    // It was labelled Add / הוסף and opened /pets, a list with an Add button
    // somewhere on it.
    const dashboard = read('pages/Dashboard.tsx');
    expect(dashboard).toMatch(/href="\/pet-passport\/add"/);
  });

  it('tapping ONE pet opens that pet\'s passport card', () => {
    // The thumbnails all pointed at the generic list, so tapping a specific
    // pet lost which pet you tapped. /pets/:petId/passport is the detail card
    // both PetPassportHome and /pets already link to.
    const dashboard = read('pages/Dashboard.tsx');
    expect(dashboard).toMatch(/href=\{`\/pets\/\$\{pet\.id\}\/passport`\}/);
  });

  it('/pets is NOT orphaned by the change — the passport still links back to it', () => {
    // The per-pet PetHealthPanel that owns vaccine / deworming / vet-visit
    // events lives on /pets, so the passport's Vaccines, Reminders, Vet, More
    // and Health targets are deliberate. Repointing the home tile must not
    // strand that screen.
    const passport = read('pages/PetPassportHome.tsx');
    expect(passport).toMatch(/navigate\('\/pets'\)/);
  });
});

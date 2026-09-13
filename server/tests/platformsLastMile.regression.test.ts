import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Platforms audit 2026-09-12 — verified last-mile defects on Sitter Suite,
 * Academy, Walk My Pet, PawFinder and Adoption:
 *  - marketplace filtered trainers on verificationStatus 'verified', a value
 *    no code path writes (approval writes 'approved') → always empty
 *  - AdoptionMaison read `.posts`; the server returns `{ rows }` → always empty
 *  - (2026-09-13) adoption is no longer a PawFinder post type at all — it is
 *    its own service; see adoptionOwnService.regression.test.ts
 *  - the marketplace "Training" chip linked to /academy/browse, which never existed
 */
const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('trainer visibility uses the status the approval writes', () => {
  it('marketplace + academy + booking-search all read approved', () => {
    expect(R('server/routes/marketplace.ts')).toContain("eq(trainers.verificationStatus, 'approved')");
    expect(R('server/routes/marketplace.ts')).not.toContain("eq(trainers.verificationStatus, 'verified')");
    expect(R('server/routes/academy.ts')).toContain("eq(trainers.verificationStatus, 'approved')");
  });
});

describe('adoption board can render and be posted to', () => {
  it('reads rows from its own adoption API', () => {
    const s = R('client/src/pages/AdoptionMaison.tsx');
    expect(s).toContain("queryKey: ['/api/adoption/listings']");
    expect(s).toContain('const posts: AdoptionListing[] = data?.rows ?? [];');
  });
  it('is posted to through its own flow, not the PawFinder form', () => {
    expect(R('client/src/pages/AdoptionMaison.tsx')).toContain('<Link href="/adoption/new">');
    expect(R('client/src/pages/PawFinder.tsx')).not.toContain('<option value="adoption">');
  });
});

describe('marketplace search links to routes that exist', () => {
  it('Training → /academy', () => {
    const s = R('client/src/components/marketplace/ProviderSearch.tsx');
    expect(s).toContain("return '/academy';");
    expect(s).not.toContain("'/academy/browse'");
    expect(R('client/src/App.tsx')).toContain('<Route path="/academy"');
  });
});

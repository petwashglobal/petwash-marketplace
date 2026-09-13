import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

/**
 * 2026-09-13 — "there are no sitters" was sometimes a lie.
 *
 * Both provider-browse screens wrapped their search in
 *   try { return await fetchProviderBrowseResults(...) }
 *   catch { return { providers: [], pagination: { total: 0 } } }
 * so a 500, an expired session or a dropped connection produced the same empty
 * grid and the same "Search by location and dates" subtitle as a genuine
 * no-matches result. There was no error state, no retry and no toast. The
 * person searching concludes the marketplace is empty and leaves — which is
 * indistinguishable, from the outside, from the marketplace actually being
 * empty. That is the most expensive possible failure mode for a two-sided
 * marketplace, and it is invisible in the logs.
 */
describe('a failed provider search says it failed', () => {
  const SCREENS: Array<[label: string, file: string]> = [
    ['Browse Walkers', 'client/src/pages/walk-my-pet/BrowseWalkers.tsx'],
    ['Browse Sitters', 'client/src/pages/sitter-suite/BrowseSitters.tsx'],
  ];

  for (const [label, file] of SCREENS) {
    describe(label, () => {
      const src = read(file);

      it('does not swallow the search failure into an empty provider list', () => {
        // Any catch that manufactures a providers array is the bug returning.
        const swallow = /catch\s*(\([^)]*\))?\s*\{[^}]*providers:\s*\[\]/s;
        expect(swallow.test(src), `${file} still catches the search error into an empty list`).toBe(false);
      });

      it('reads isError from the search query', () => {
        expect(src).toMatch(/const\s*\{[^}]*\bisError\b[^}]*\}\s*=\s*useQuery/);
      });

      it('renders a distinct, retryable error state', () => {
        expect(src, 'no error branch on the results area').toContain('data-testid="browse-search-error"');
        expect(src, 'no retry control').toContain('data-testid="browse-search-retry"');
        expect(src, 'retry does not refetch').toMatch(/onClick=\{\(\)\s*=>\s*refetch\(\)\}/);
      });

      it('says it failed in both languages', () => {
        expect(src).toContain('The search failed');
        expect(src).toContain('החיפוש נכשל');
      });

      it('puts the error branch before the empty/results branch', () => {
        const errAt = src.indexOf('data-testid="browse-search-error"');
        const loadAt = src.indexOf('{isLoading ? (');
        expect(errAt).toBeGreaterThan(loadAt);
        // and it must be reached from the same ternary chain as isLoading
        expect(src.slice(loadAt, errAt)).toContain(') : isError ? (');
      });
    });
  }
});

describe('inbox mutations report their own failures', () => {
  const src = read('client/src/pages/PersonalInbox.tsx');

  for (const name of ['toggleStarMutation', 'markReadMutation', 'sendMessageMutation', 'deleteMessageMutation']) {
    it(`${name} has an onError`, () => {
      const at = src.indexOf(`const ${name} = useMutation({`);
      expect(at, `${name} not found`).toBeGreaterThan(-1);
      const end = src.indexOf('\n  });', at);
      expect(src.slice(at, end), `${name} fails silently`).toContain('onError');
    });
  }
});

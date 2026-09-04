/**
 * NextBestActionCard mount surfaces — regression pin
 * (Journey Brain Phase 5 · post-release 2026-09-04).
 *
 * The card MUST be mounted on BOTH the Pet-Parent (Prestige) home
 * and the Provider home, positioned ABOVE the AttentionList so the
 * "Your next step" surface is the loudest tap on home.
 *
 * A refactor that removes either mount silently loses the whole
 * point of Phase 5. The pin guards:
 *
 *   1. The <NextBestActionCard /> element exists in both files.
 *   2. It's mounted with the RIGHT actor (pet_parent on the customer
 *      home, provider on the provider home).
 *   3. The card sits ABOVE the AttentionList in the JSX order — the
 *      server picks the loudest primary; a re-order would silently
 *      demote it below routine attention items.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..');

interface Mount {
  label: string;
  file: string;
  actor: 'pet_parent' | 'provider';
}

const MOUNTS: readonly Mount[] = [
  {
    label: 'Pet-Parent (Prestige) home',
    file: 'client/src/pages/PrestigeHome.tsx',
    actor: 'pet_parent',
  },
  {
    label: 'Provider home',
    file: 'client/src/pages/ProviderHome.tsx',
    actor: 'provider',
  },
];

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), 'utf8');
}

describe('NextBestActionCard · mount pins', () => {
  for (const mount of MOUNTS) {
    describe(mount.label, () => {
      const src = read(mount.file);

      it('imports NextBestActionCard from the components folder', () => {
        expect(src).toMatch(
          /import\s*\{\s*NextBestActionCard\s*\}\s*from\s*['"]@\/components\/NextBestActionCard['"]/,
        );
      });

      it(`renders <NextBestActionCard actor="${mount.actor}" />`, () => {
        const rx = new RegExp(
          `<NextBestActionCard\\s+actor=["']${mount.actor}["']\\s*/>`,
        );
        expect(src).toMatch(rx);
      });

      it('renders the card ABOVE the AttentionList (loudest surface first)', () => {
        const cardIdx = src.indexOf('<NextBestActionCard');
        const attentionIdx = src.indexOf(`<AttentionList actor="${mount.actor}"`);
        expect(cardIdx, 'NextBestActionCard mount not found').toBeGreaterThan(-1);
        expect(attentionIdx, 'AttentionList mount not found').toBeGreaterThan(-1);
        expect(
          cardIdx,
          'NextBestActionCard must render ABOVE AttentionList in the JSX order',
        ).toBeLessThan(attentionIdx);
      });
    });
  }
});

/**
 * PR-SEARCH-FILTER-B.
 *
 * Active customer-facing provider browse pages should use the canonical
 * `/api/providers/search` adapter. `marketplace-bookings` remains for checkout,
 * rate cards, and legacy mapped surfaces only; it should not own public
 * provider search for these active pages.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');

describe('active provider search pages use canonical provider search', () => {
  const activeSearchFiles = [
    'ProviderListings.tsx',
    'walk-my-pet/BrowseWalkers.tsx',
    'sitter-suite/BrowseSitters.tsx',
    'Groomers.tsx',
  ];

  it('does not call marketplace-bookings provider search from active browse pages', () => {
    for (const file of activeSearchFiles) {
      expect(read(file)).not.toContain('/api/marketplace-bookings/search/providers');
    }
  });

  it('does not call legacy marketplace search from active browse pages', () => {
    for (const file of activeSearchFiles) {
      expect(read(file)).not.toContain('/api/marketplace/search');
    }
  });

  it('uses the canonical provider search adapter', () => {
    for (const file of activeSearchFiles) {
      expect(read(file)).toMatch(/fetchProviderBrowseResults|\/api\/providers\/search/);
    }
  });
});

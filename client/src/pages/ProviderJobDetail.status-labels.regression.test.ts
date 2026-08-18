/**
 * PR-PROVIDER-JOB-DETAIL-STATUS-LABELS — regression pin for the STATUS_LABEL
 * map coverage on ProviderJobDetail.tsx.
 *
 * Before: 7 statuses that the server actively emits were missing from the
 * label map — the raw enum literal was rendered as the pill text. Same shape
 * fix as PR-CUSTOMER-BOOKINGS-STATUS-LABEL for the customer side.
 *
 * Missing statuses added:
 *   accepted, pending_provider, meet_greet_requested, meet_greet_scheduled,
 *   meet_greet_completed, payment_pending, reviewed.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, 'ProviderJobDetail.tsx'),
  'utf8',
);

const REQUIRED = [
  'pending',
  'pending_provider',
  'quote_sent',
  'accepted',
  'meet_greet_requested',
  'meet_greet_scheduled',
  'meet_greet_completed',
  'payment_pending',
  'confirmed',
  'in_progress',
  'provider_marked_complete',
  'completed',
  'reviewed',
  'declined',
  'cancelled',
  'disputed',
];

describe('ProviderJobDetail — STATUS_LABEL coverage pin', () => {
  for (const key of REQUIRED) {
    it(`STATUS_LABEL has a bilingual entry for ${key}`, () => {
      // Match `key: { en: '...', he: '...', tone: '...' }` in either order.
      const re = new RegExp(`\\b${key}:\\s*\\{[^}]*en:\\s*['"]`);
      expect(SRC).toMatch(re);
      const reHe = new RegExp(`\\b${key}:\\s*\\{[^}]*he:\\s*['"]`);
      expect(SRC).toMatch(reHe);
    });
  }

  it('reviewed is treated as green (post-completion positive)', () => {
    expect(SRC).toMatch(/reviewed:\s*\{[^}]*tone:\s*GREEN/);
  });

  it('does not regress any pre-existing label', () => {
    // Every REQUIRED status should show up at least once in the map region.
    // Ensures a later refactor doesn't accidentally drop an entry.
    for (const key of REQUIRED) {
      expect(SRC.match(new RegExp(`\\b${key}:\\s*\\{`, 'g'))?.length ?? 0).toBeGreaterThanOrEqual(1);
    }
  });
});

/**
 * PR-POSJOBS-STATUS-STYLES — regression pin for STATUS_STYLES map coverage.
 *
 * Before: pending_provider (legacy) and meet_greet_requested were missing —
 * the pill fell back to raw enum text. Same shape as PR #1919 (customer),
 * PR #1926 (ProviderJobDetail).
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, 'POSJobs.tsx'),
  'utf8',
);

const REQUIRED = [
  'pending', 'pending_provider', 'accepted',
  'meet_greet_requested', 'meet_greet_scheduled', 'meet_greet_completed',
  'payment_pending', 'confirmed', 'in_progress', 'provider_marked_complete',
  'completed', 'reviewed', 'cancelled', 'declined', 'disputed',
  'new_request', 'dispute', 'provider_confirmed',
];

describe('POSJobs — STATUS_STYLES coverage pin', () => {
  for (const key of REQUIRED) {
    it(`STATUS_STYLES has a full entry for ${key}`, () => {
      const re = new RegExp(`\\b${key}:\\s*\\{[^}]*label:\\s*['"]`);
      expect(SRC).toMatch(re);
    });
  }

  it('meet_greet_requested is present (was missing before)', () => {
    expect(SRC).toMatch(/meet_greet_requested:\s*\{[^}]*label:\s*['"]M&G Requested['"]/);
  });

  it('pending_provider (legacy) matches primary Pending visual', () => {
    expect(SRC).toMatch(/pending_provider:\s*\{[^}]*label:\s*['"]Pending['"]/);
    expect(SRC).toMatch(/pending_provider:[\s\S]{0,180}bg:\s*['"]#dbeafe['"]/);
  });
});

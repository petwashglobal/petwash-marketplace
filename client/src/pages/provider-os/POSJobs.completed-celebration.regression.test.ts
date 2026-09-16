/**
 * PR-POSJOBS-COMPLETED-CELEBRATION — regression pin for the payout-released
 * subline on the /provider-os/jobs list.
 *
 * Before: completed / reviewed jobs migrated into the "Done" tab silently.
 * The card showed the same layout as an in-progress job — no visual signal
 * that the money had actually released. Mirrors the ProviderJobDetail panel
 * shipped by PR-PROVIDER-CONFIRMED-BADGE so BOTH surfaces celebrate the
 * payout.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, 'POSJobs.tsx'),
  'utf8',
);

describe('POSJobs — completed/reviewed payout celebration', () => {
  it('renders a payout-released subline for completed/reviewed jobs with a positive payout', () => {
    expect(SRC).toMatch(
      /\['completed',\s*'reviewed'\]\.includes\(booking\.status\)\s*&&\s*payout\s*>\s*0/,
    );
  });

  it('subline exposes a stable data-testid per booking id', () => {
    expect(SRC).toMatch(/data-testid=\{`payout-released-\$\{booking\.id\}`\}/);
  });

  // 2026-09-16: the original pin demanded "released · arriving in 72h". Since
  // the CEO rule of 2026-09-13 no payout releases itself — an admin approves
  // each one after reviewing the job evidence — so that sentence promised the
  // provider money that had not moved. The subline stays; the promise goes.
  it('states the money is held pending a Pet Wash review, and promises no ETA', () => {
    expect(SRC).toMatch(/held for you · Pet Wash approves it after review/);
    expect(SRC).not.toMatch(/arriving in 72h/);
  });

  it('shows a star-review badge when status === reviewed and a rating is present', () => {
    expect(SRC).toMatch(
      /booking\.status\s*===\s*['"]reviewed['"]\s*&&\s*\(booking\.ownerRating\s*\|\|\s*booking\.rating\)/,
    );
    expect(SRC).toMatch(/data-testid=\{`review-badge-\$\{booking\.id\}`\}/);
  });

  it('uses CheckCircle2 + Star already imported (no new lucide import needed)', () => {
    expect(SRC).toMatch(/import\s*\{[\s\S]*?\bCheckCircle2\b[\s\S]*?\bStar\b[\s\S]*?\}\s*from\s*['"]lucide-react['"]/);
  });
});

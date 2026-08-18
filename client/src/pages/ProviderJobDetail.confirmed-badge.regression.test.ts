/**
 * PR-PROVIDER-CONFIRMED-BADGE — regression pin for the "customer confirmed /
 * auto-approved" celebration panel on ProviderJobDetail.tsx.
 *
 * Before: when the customer confirmed (or the 24h cron auto-approved), the
 * provider saw only a silent label flip from "Awaiting confirmation" to
 * "Completed" on next refetch. No visible payout summary, no review, no
 * celebration. Not Rover/MadPaws parity.
 *
 * This pin locks the panel in place.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, 'ProviderJobDetail.tsx'),
  'utf8',
);

describe('ProviderJobDetail — customer-confirmed / auto-approved payout panel', () => {
  it('mounts a payout-released panel with a stable testid', () => {
    expect(SRC).toContain('data-testid="provider-payout-released"');
  });

  it('renders only for completed / reviewed statuses that carry a customer approval timestamp', () => {
    // Panel gate must include BOTH terminal statuses AND require an approval
    // timestamp (either customerApprovedAt from manual /confirm, or
    // ownerConfirmedAt written by the same handler and the auto-approve cron).
    expect(SRC).toMatch(/status\s*===\s*['"]completed['"]\s*\|\|\s*status\s*===\s*['"]reviewed['"]/);
    expect(SRC).toMatch(/b\.customerApprovedAt\s*\|\|\s*b\.ownerConfirmedAt/);
  });

  it('differentiates manual customer approval from auto-approval in the copy', () => {
    // Manual path uses HE "הלקוח אישר" / EN "Customer confirmed"
    expect(SRC).toMatch(/הלקוח אישר את השירות/);
    expect(SRC).toMatch(/Customer confirmed the service/);
    // Auto path uses HE "אושר אוטומטית" / EN "Auto-approved"
    expect(SRC).toMatch(/אושר אוטומטית לאחר 24 שעות/);
    expect(SRC).toMatch(/Auto-approved after 24 hours/);
  });

  it('renders the payout amount + 72h ETA', () => {
    expect(SRC).toMatch(/ils\(b\.providerPayoutCents\)/);
    expect(SRC).toMatch(/72 שעות|72 hours/);
  });

  it('shows a star-rating badge when the customer left a rating (status === reviewed)', () => {
    // The rating chip is gated on status==='reviewed' AND b.ownerRating.
    expect(SRC).toMatch(/status\s*===\s*['"]reviewed['"]\s*&&\s*b\.ownerRating/);
    expect(SRC).toMatch(/הלקוח נתן|Customer left/);
  });

  it('renders the customer review text in an italic block-quote when present', () => {
    expect(SRC).toMatch(/b\.ownerReview/);
  });

  it('Star icon is imported from lucide-react', () => {
    expect(SRC).toMatch(/import\s*\{[^}]*\bStar\b[^}]*\}\s*from\s*['"]lucide-react['"]/);
  });
});

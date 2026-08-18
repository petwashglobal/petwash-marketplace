/**
 * PR-DISPUTE-PROVIDER-OFFAPP-NOTIFY — regression pin for the added off-app
 * notification block on POST /:requestId/dispute.
 *
 * Before: provider only got an in-app superAppNotifications row. Dispute
 * FREEZES ESCROW — a provider who's not looking at the app has no idea
 * their money is on hold. Now they get push + email + inbox.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '../routes/booking-requests.ts'),
  'utf8',
);

function disputeBlock(): string {
  const start = SRC.indexOf("router.post('/:requestId/dispute'");
  expect(start).toBeGreaterThan(-1);
  const end = SRC.indexOf("router.post('/:requestId/provider-emergency-cancel'", start);
  return SRC.slice(start, end > start ? end : start + 5000);
}

describe('POST /:requestId/dispute — provider off-app notification', () => {
  const b = disputeBlock();

  it('still writes the in-app superAppNotifications row (kept)', () => {
    expect(b).toMatch(/superAppNotifications\)?\.values\(\{[\s\S]*?type:\s*['"]booking_disputed['"]/);
    expect(b).toMatch(/channels:\s*\[\s*['"]in_app['"]\s*\]/);
  });

  it('additionally fires dispatchNotification with inbox+email+push', () => {
    expect(b).toMatch(/dispatchNotification\(\{[\s\S]*?uid:\s*booking\.providerId/);
    expect(b).toMatch(/channels:\s*\[\s*['"]inbox['"]\s*,\s*['"]email['"]\s*,\s*['"]push['"]\s*\]/);
  });

  it('carries a booking-scoped CTA to the provider job page', () => {
    expect(b).toMatch(/ctaUrl:\s*`https:\/\/petwash\.co\.il\/provider\/jobs\/\$\{requestId\}`/);
  });

  it('bilingual title (HE + EN) so push preview is legible', () => {
    expect(b).toMatch(/Customer opened a dispute/);
    expect(b).toContain('לקוח פתח מחלוקת');
  });

  it('is fire-and-forget (setImmediate + try/catch)', () => {
    expect(b).toMatch(/setImmediate\(async/);
    expect(b).toMatch(/Dispute off-app notification failed/);
  });

  it('priority is 9 (dispute is highest-urgency provider notification)', () => {
    expect(b).toMatch(/priority:\s*9/);
  });
});

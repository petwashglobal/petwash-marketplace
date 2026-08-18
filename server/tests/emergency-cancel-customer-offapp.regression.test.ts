/**
 * PR-EMERGENCY-CANCEL-CUSTOMER-OFFAPP — regression pin for the added off-app
 * notification block on POST /:requestId/provider-emergency-cancel.
 *
 * Before: customer only got an in-app superAppNotifications row. This is an
 * EMERGENCY — the pet may have had care lined up for TODAY. Customer needs
 * push + SMS + email immediately so they can arrange alternatives.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '../routes/booking-requests.ts'),
  'utf8',
);

function block(): string {
  const start = SRC.indexOf("router.post('/:requestId/provider-emergency-cancel'");
  expect(start).toBeGreaterThan(-1);
  const end = SRC.indexOf("router.post('/:requestId/cancel'", start);
  return SRC.slice(start, end > start ? end : start + 6000);
}

describe('POST /:requestId/provider-emergency-cancel — customer off-app notification', () => {
  const b = block();

  it('still writes the in-app superAppNotifications row (kept)', () => {
    expect(b).toMatch(/superAppNotifications\)?\.values\(\{[\s\S]*?type:\s*['"]booking_cancelled['"]/);
    expect(b).toMatch(/channels:\s*\[\s*['"]in_app['"]\s*\]/);
  });

  it('additionally fires dispatchNotification with inbox+email+sms+push', () => {
    expect(b).toMatch(/dispatchNotification\(\{[\s\S]*?uid:\s*booking\.ownerId/);
    expect(b).toMatch(/channels:\s*\[\s*['"]inbox['"]\s*,\s*['"]email['"]\s*,\s*['"]sms['"]\s*,\s*['"]push['"]\s*\]/);
  });

  it('CTA directs customer to the marketplace for a replacement', () => {
    expect(b).toMatch(/ctaUrl:\s*`https:\/\/petwash\.co\.il\/marketplace`/);
  });

  it('body includes the refund amount', () => {
    expect(b).toMatch(/refundIls/);
    expect(b).toMatch(/refundAmount:\s*parseFloat\(refundIls\)/);
  });

  it('priority is 10 (emergency = highest urgency)', () => {
    expect(b).toMatch(/priority:\s*10/);
  });

  it('bilingual title (HE + EN)', () => {
    expect(b).toMatch(/Provider emergency cancel/);
    expect(b).toContain('הספק ביטל בחירום');
  });

  it('is fire-and-forget (setImmediate + try/catch)', () => {
    expect(b).toMatch(/setImmediate\(async/);
    expect(b).toMatch(/Emergency cancel off-app dispatch failed/);
  });
});

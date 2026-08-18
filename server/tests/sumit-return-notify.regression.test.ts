/**
 * PR-SUMIT-RETURN-NOTIFY — regression pin for the payment-confirmed
 * notification block on GET /:requestId/sumit-return.
 *
 * Before: the SUMIT rail flipped booking → 'confirmed' after a real,
 * server-re-verified payment WITHOUT sending any notification to the
 * customer or the provider. If BOOKING_CARD_RAIL=sumit was in prod,
 * the customer paid and got zero confirmation; the provider had no
 * idea their booking just cleared payment. The Nayax rail already
 * does this via its webhook — SUMIT was the outlier.
 *
 * These pins lock the additive notification block in place.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '../routes/booking-requests.ts'),
  'utf8',
);

// Slice from the sumit-return handler start to the /start handler start —
// keeps assertions bounded to the SUMIT block.
function sumitBlock(): string {
  const start = SRC.indexOf("router.get('/:requestId/sumit-return'");
  const end = SRC.indexOf("router.post('/:requestId/start'", start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return SRC.slice(start, end);
}

describe('sumit-return — dual-party payment-confirmed notification', () => {
  it('notifies the CUSTOMER after the status flip to confirmed', () => {
    const b = sumitBlock();
    expect(b).toMatch(/dispatchNotification\(\{[\s\S]*?uid:\s*booking\.ownerId[\s\S]*?type:\s*['"]receipt['"]/);
    expect(b).toMatch(/Payment received — booking confirmed/);
  });

  it('notifies the PROVIDER after the status flip to confirmed', () => {
    const b = sumitBlock();
    expect(b).toMatch(/dispatchNotification\(\{[\s\S]*?uid:\s*booking\.providerId/);
    expect(b).toMatch(/Customer paid — booking confirmed/);
  });

  it('both notifications use inbox + email + push (no SMS on payment success)', () => {
    const b = sumitBlock();
    const channelHits = b.match(/channels:\s*\[\s*['"]inbox['"]\s*,\s*['"]email['"]\s*,\s*['"]push['"]\s*\]/g) || [];
    expect(channelHits.length).toBeGreaterThanOrEqual(2);
  });

  it('is fire-and-forget (setImmediate + try/catch — never blocks the redirect)', () => {
    const b = sumitBlock();
    expect(b).toMatch(/setImmediate\(async\s*\(\)\s*=>\s*\{/);
    expect(b).toMatch(/SUMIT confirm notifications failed/);
  });

  it('runs AFTER the atomic UPDATE (order matters — never notify unless confirmed)', () => {
    const b = sumitBlock();
    const updateIdx = b.search(/db\.update\(bookingRequests\)/);
    const notifyIdx = b.search(/setImmediate\(async\s*\(\)\s*=>\s*\{/);
    expect(updateIdx).toBeGreaterThan(-1);
    expect(notifyIdx).toBeGreaterThan(updateIdx);
  });

  it('parity: both notifications carry a booking-scoped deep-link CTA', () => {
    const b = sumitBlock();
    expect(b).toMatch(/ctaUrl:\s*`https:\/\/petwash\.co\.il\/booking\/confirmation\/\$\{requestId\}`/);
    expect(b).toMatch(/ctaUrl:\s*`https:\/\/petwash\.co\.il\/provider\/jobs\/\$\{requestId\}`/);
  });
});

/**
 * PR-V2-START-CANCEL-NOTIFY-PARITY — regression pin ensuring the V2
 * dashboard `/bookings/:id/{start,cancel}` actions notify the customer.
 *
 * Before: V2 was silent on both. V1 /:requestId/start (PR #1922) and
 * /:requestId/cancel already notify — so V2, which is what
 * ProviderJobDetail actually calls, was the parity gap.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '../routes/provider-dashboard-v2.ts'),
  'utf8',
);

function startBlock(): string {
  const idx = SRC.indexOf('service_started notify failed');
  expect(idx).toBeGreaterThan(-1);
  return SRC.slice(Math.max(0, idx - 2000), idx + 500);
}
function cancelBlock(): string {
  const idx = SRC.indexOf('provider_cancelled notify failed');
  expect(idx).toBeGreaterThan(-1);
  return SRC.slice(Math.max(0, idx - 2000), idx + 500);
}

describe('V2 dashboard /start — customer notified', () => {
  const b = startBlock();
  it('dispatchNotification fires to booking.owner_id', () => {
    expect(b).toMatch(/dispatchNotification\(\{\s*uid:\s*ownerId/);
  });
  it('title carries "Service started" (bilingual)', () => {
    expect(b).toMatch(/Service started/);
    expect(b).toContain('השירות התחיל');
  });
  it('channels are inbox + email + push', () => {
    expect(b).toMatch(/channels:\s*\[\s*['"]inbox['"]\s*,\s*['"]email['"]\s*,\s*['"]push['"]\s*\]/);
  });
  it('runs from setImmediate (fire-and-forget)', () => {
    expect(b).toMatch(/setImmediate\(async/);
  });
  it('gated on action === start', () => {
    expect(SRC).toMatch(/if\s*\(action\s*===\s*['"]start['"]\)\s*\{\s*const\s+ownerId/);
  });
});

describe('V2 dashboard /cancel — customer notified', () => {
  const b = cancelBlock();
  it('dispatchNotification fires to booking.owner_id', () => {
    expect(b).toMatch(/dispatchNotification\(\{\s*uid:\s*ownerId/);
  });
  it('title carries "Provider cancelled" (bilingual)', () => {
    expect(b).toMatch(/Provider cancelled/);
    expect(b).toContain('הספק ביטל');
  });
  it('CTA directs the customer back to the marketplace', () => {
    expect(b).toMatch(/ctaUrl:\s*`https:\/\/petwash\.co\.il\/marketplace`/);
  });
  it('channels are inbox + push (no email — usually followed by immediate rebook)', () => {
    expect(b).toMatch(/channels:\s*\[\s*['"]inbox['"]\s*,\s*['"]push['"]\s*\]/);
  });
  it('gated on action === cancel', () => {
    expect(SRC).toMatch(/if\s*\(action\s*===\s*['"]cancel['"]\)\s*\{\s*const\s+ownerId/);
  });
});

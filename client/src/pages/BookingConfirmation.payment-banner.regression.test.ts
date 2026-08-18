/**
 * PR-BOOKING-CONFIRM-PAYMENT-BANNER — regression pin for the
 * ?payment=success|failed banner on BookingConfirmation.tsx.
 *
 * Before: SUMIT redirects the customer back with ?payment=success or
 * ?payment=failed after a hosted-page payment attempt. The client
 * silently ignored the param — no green success confirmation, no red
 * failure explanation, customer was left to infer from the status pill.
 *
 * After: two dismissible banners at the top of the page, HE + EN, with
 * stable data-testids.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, 'BookingConfirmation.tsx'),
  'utf8',
);

describe('BookingConfirmation — payment-return banner pin', () => {
  it('reads ?payment= from window.location.search on mount', () => {
    expect(SRC).toMatch(/new URLSearchParams\(\s*window\.location\.search\s*\)\.get\(\s*['"]payment['"]\s*\)/);
    expect(SRC).toMatch(/p\s*===\s*['"]success['"]\s*\|\|\s*p\s*===\s*['"]failed['"]/);
  });

  it('renders a success banner with a stable data-testid', () => {
    expect(SRC).toContain('data-testid="payment-banner-success"');
  });

  it('renders a failed banner with a stable data-testid', () => {
    expect(SRC).toContain('data-testid="payment-banner-failed"');
  });

  it('banners are dismissible (setPaymentBanner(null) on X click)', () => {
    // Two X buttons — one per banner
    const hits = SRC.match(/onClick=\{\(\)\s*=>\s*setPaymentBanner\(null\)\}/g) || [];
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });

  it('SSR-safe (typeof window guard on the initializer)', () => {
    expect(SRC).toMatch(/typeof\s+window\s*===\s*['"]undefined['"]/);
  });

  it('HE + EN labels present for both success and failed', () => {
    expect(SRC).toContain('התשלום התקבל');
    expect(SRC).toContain('Payment received');
    expect(SRC).toContain('התשלום לא עבר');
    expect(SRC).toContain('Payment could not be processed');
  });
});

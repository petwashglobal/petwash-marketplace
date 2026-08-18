/**
 * PR-CUSTOMER-BOOKINGS-REVIEW-CTA — regression pin for the "Leave a review /
 * Confirm & rate" CTA on the customer's My Bookings list.
 *
 * Before: the CTA was gated on status === 'completed' ONLY, and its onClick
 * navigated to /booking/confirmation/:requestId (no ?review=1). Since PR
 * #1902 the star-rating form on that page is gated on
 * status === 'provider_marked_complete', so the CTA opened a dead page.
 *
 * After:
 *  1. Gate extended to include 'provider_marked_complete' (the actionable
 *     window) AND 'completed && !ownerRating' (cron-auto-approved fallback).
 *  2. Never renders once the customer has already rated (ownerRating set).
 *  3. onClick appends ?review=1 so PR-1906's scrollIntoView fires.
 *  4. Label is context-aware ("Confirm & rate" vs "Leave a review").
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, 'CustomerBookings.tsx'),
  'utf8',
);

describe('CustomerBookings — Review/Confirm-and-rate CTA pin', () => {
  it('canReview includes provider_marked_complete AND completed-without-rating', () => {
    expect(SRC).toMatch(
      /canReview\s*=\s*[\s\S]*?booking\.status\s*===\s*['"]provider_marked_complete['"]/,
    );
    expect(SRC).toMatch(
      /booking\.status\s*===\s*['"]completed['"]\s*&&\s*!booking\.ownerRating/,
    );
  });

  it('never re-introduces the dead status === "completed"-only gate', () => {
    expect(SRC).not.toMatch(/const\s+canReview\s*=\s*booking\.status\s*===\s*['"]completed['"]\s*;/);
  });

  it('handleReview appends ?review=1 to the deep-link', () => {
    expect(SRC).toMatch(
      /navigate\(\s*`\/booking\/confirmation\/\$\{booking\.requestId\}\?review=1`/,
    );
  });

  it('CTA has a stable data-testid per booking id', () => {
    expect(SRC).toMatch(/data-testid=\{`booking-review-cta-\$\{booking\.requestId\}`\}/);
  });

  it('label is context-aware — Confirm & rate for provider_marked_complete', () => {
    expect(SRC).toMatch(
      /booking\.status\s*===\s*['"]provider_marked_complete['"][\s\S]{0,180}Confirm & rate/,
    );
    // HE version present too
    expect(SRC).toContain('אשר/י ודרג/י');
  });

  it('post-confirmation fallback keeps the original Leave-a-review copy', () => {
    expect(SRC).toContain('Leave a review');
    expect(SRC).toContain('כתוב ביקורת');
  });
});

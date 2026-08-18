/**
 * PR-CLIENT-RATING-CLAMP — regression pin for the client-side rating
 * normalization in the confirm mutation on BookingConfirmation.tsx.
 *
 * Server-side (PR-1904 zod boundary) requires rating ∈ [1..5] integer or
 * absent. This client-side clamp keeps the mutation forward-compatible if
 * a future UX change (e.g. "start unrated at 0") is applied — otherwise
 * the customer would 400 on submit.
 *
 * Also clamps review text to the same 2000-char cap the server zod uses.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, 'BookingConfirmation.tsx'),
  'utf8',
);

describe('BookingConfirmation — client-side rating/review clamp', () => {
  it('rating is clamped to number 1..5 or normalized to undefined', () => {
    expect(SRC).toMatch(/typeof\s+rating\s*===\s*['"]number['"]/);
    expect(SRC).toMatch(/rating\s*>=\s*1\s*&&\s*rating\s*<=\s*5/);
    // Must use safeRating in the request body, not raw rating
    expect(SRC).toMatch(/rating:\s*safeRating/);
  });

  it('rating is floored to an integer (avoids sending 4.5 or 3.7)', () => {
    expect(SRC).toMatch(/Math\.floor\(rating\)/);
  });

  it('review text is trimmed + capped at 2000 chars (matches server zod)', () => {
    expect(SRC).toMatch(/reviewText\s*\|\|\s*['"]{2}\)\s*\.trim\(\)\s*\.slice\(0,\s*2000\)/);
  });

  it('empty review normalizes to undefined so server does not persist an empty string', () => {
    expect(SRC).toMatch(/trimmedReview\s*\|\|\s*undefined/);
  });

  it('mutation still POSTs to /api/booking-requests/:requestId/confirm', () => {
    expect(SRC).toMatch(
      /apiRequest\(\s*['"]POST['"]\s*,\s*`\/api\/booking-requests\/\$\{requestId\}\/confirm`/,
    );
  });
});

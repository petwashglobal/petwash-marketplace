/**
 * PR-COMPLETION-INBOX-REVIEW-DEEPLINK — regression pin for the ?review=1 param
 * appended to every server-emitted completion notification deep-link.
 *
 * Before: three completion-related notifications (inbox, SMS-email, cron)
 * navigated to /booking/confirmation/:requestId with NO ?review=1. The client's
 * end-of-stay banner + rating-form auto-scroll (PR #1906) is triggered
 * exclusively by ?review=1, so the customer landed at the top of the page and
 * had to scroll past hero + financial + escrow panels to find the star row.
 *
 * These pins lock the deep-link contract in place.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const BR = fs.readFileSync(
  path.resolve(__dirname, '../routes/booking-requests.ts'),
  'utf8',
);
const CRON = fs.readFileSync(
  path.resolve(__dirname, '../cron/auto-approve-completions.ts'),
  'utf8',
);

describe('completion notifications — ?review=1 deep-link contract', () => {
  it('booking_completion_approval inbox row deep-links with ?review=1', () => {
    const idx = BR.indexOf("type: 'booking_completion_approval'");
    expect(idx).toBeGreaterThan(-1);
    // Look within the next ~500 chars for the actionUrl.
    const window = BR.slice(idx, idx + 1200);
    expect(window).toMatch(
      /actionUrl:\s*`\/booking\/confirmation\/\$\{requestId\}\?review=1`/,
    );
  });

  it('provider_marked_complete SMS dispatchNotification ctaUrl deep-links with ?review=1', () => {
    const idx = BR.indexOf("ctaText: 'אשרו / Confirm'");
    expect(idx).toBeGreaterThan(-1);
    const window = BR.slice(idx, idx + 400);
    expect(window).toMatch(
      /ctaUrl:\s*`https:\/\/petwash\.co\.il\/booking\/confirmation\/\$\{requestId\}\?review=1`/,
    );
  });

  it('auto-approve cron customer notification deep-links with ?review=1', () => {
    const idx = CRON.indexOf("type: 'booking_auto_completed'");
    expect(idx).toBeGreaterThan(-1);
    const window = CRON.slice(idx, idx + 2400);
    expect(window).toMatch(
      /actionUrl:\s*`\/booking\/confirmation\/\$\{booking\.requestId\}\?review=1`/,
    );
  });
});

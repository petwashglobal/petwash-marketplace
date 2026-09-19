import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * PR-FAKE (2026-06-13) stripped invented trust stats — "10,000+ Bookings",
 * "1 in 5 Accepted", "Trained & Certified" — out of TrustBar.tsx because no
 * such data existed pre-launch.
 *
 * 2026-09-19: the same claims were still live on two other public pages.
 * Sitter Suite browse showed "4.9 Average Rating", "10K+ Bookings Completed"
 * and "24/7 Support Available"; PetTrek showed "4.9★" and "50k+". Production
 * at that moment had ZERO providers and ZERO completed bookings.
 *
 * Rule: a public marketing surface may not hard-code a rating, a booking
 * count or a user count. If we ever have real numbers they come from real
 * data, not from a string literal.
 */
const ROOT = path.resolve(__dirname, '..', '..', '..');

const PUBLIC_PAGES = [
  'client/src/pages/sitter-suite/BrowseSitters.tsx',
  'client/src/pages/sitter-suite/Overview.tsx',
  'client/src/pages/walk-my-pet/BrowseWalkers.tsx',
  'client/src/pages/walk-my-pet/Overview.tsx',
  'client/src/pages/pettrek/Overview.tsx',
  'client/src/components/TrustBar.tsx',
];

/** a hard-coded social-proof number rendered to a visitor */
const INVENTED = [
  /"\d+(\.\d+)?★"/,                       // "4.9★"
  /"\d+[kK]\+"/,                           // "50k+"
  /">\s*\d+[kK]\+\s*</,                    // >10K+<
  /">\s*\d{1,3},\d{3}\+?\s*</,             // >10,000+<
  /'(Average Rating|Bookings Completed)'/, // the labels themselves
];

describe('no invented marketplace statistics on public pages', () => {
  it.each(PUBLIC_PAGES)('%s states no made-up rating or volume', (rel) => {
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) return; // page renamed — nothing to police
    const src = fs.readFileSync(file, 'utf8');
    const hits = INVENTED.filter((re) => re.test(src)).map(String);
    expect(hits, `${rel} still renders an invented statistic`).toEqual([]);
  });
});

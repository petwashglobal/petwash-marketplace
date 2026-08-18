import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const STRIP_SRC = readFileSync(
  join(__dirname, 'LandingLiveBayStrip.tsx'),
  'utf8',
);
const LANDING_SRC = readFileSync(
  join(__dirname, '..', 'pages', 'Landing.tsx'),
  'utf8',
);

// Regression pin for COMPETITIVE 2026-08-18: WhatIDog copied our K9000 concept
// but has no live hardware to show. We prove real-station status on Landing.

describe('LandingLiveBayStrip — live K9000 bay status under Landing hero', () => {
  it('polls /api/k9000/stations/:id/bay-status on a 15s interval', () => {
    expect(STRIP_SRC).toMatch(/\/api\/k9000\/stations['"]?,\s*stationId/);
    expect(STRIP_SRC).toMatch(/refetchInterval:\s*15000/);
  });

  it('has a stable testid at the strip AND per-bay chip level', () => {
    expect(STRIP_SRC).toMatch(/data-testid=['"]landing-live-bay-strip['"]/);
    expect(STRIP_SRC).toMatch(/data-testid=\{`bay-chip-\$\{label\.replace.+`\}/);
  });

  it('is mounted directly under the Landing hero image', () => {
    expect(LANDING_SRC).toMatch(/import\s+\{\s*LandingLiveBayStrip\s*\}\s+from\s+['"]@\/components\/LandingLiveBayStrip['"]/);
    expect(LANDING_SRC).toMatch(/<LandingLiveBayStrip\s+language=\{language\}\s*\/>/);
  });

  it('surfaces a fail-quiet WifiOff state when the API is unreachable', () => {
    expect(STRIP_SRC).toMatch(/isError\s*\|\|\s*!data\?\.station_online/);
    expect(STRIP_SRC).toMatch(/<WifiOff/);
  });

  it('is bilingual (HE + EN) — no raw language leak', () => {
    expect(STRIP_SRC).toMatch(/isHe\s*\?\s*['"]עמדת כפר סבא/);
    expect(STRIP_SRC).toMatch(/isHe\s*\?\s*['"]עמדה 1['"]\s*:\s*['"]Bay 1['"]/);
    expect(STRIP_SRC).toMatch(/isHe\s*\?\s*['"]עמדה 2['"]\s*:\s*['"]Bay 2['"]/);
  });
});

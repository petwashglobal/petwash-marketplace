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

// 2026-08-22 CEO directive: the live K9000 bay-status strip is
// operational / back-office data. It MUST NOT ship on the public
// Landing hero — per-station, per-bay hardware telemetry (empty
// vs busy) is a competitive-intelligence gift and reveals when a
// station is idle. Component + its polling logic are preserved for
// the back-office bay-status view at /k9000/bay-status; the
// regression pin below inverts to enforce non-inclusion on public.

describe('LandingLiveBayStrip — component still exists for back-office use', () => {
  it('polls /api/k9000/stations/:id/bay-status on a 15s interval', () => {
    expect(STRIP_SRC).toMatch(/\/api\/k9000\/stations['"]?,\s*stationId/);
    expect(STRIP_SRC).toMatch(/refetchInterval:\s*15000/);
  });

  it('has a stable testid at the strip AND per-bay chip level', () => {
    expect(STRIP_SRC).toMatch(/data-testid=['"]landing-live-bay-strip['"]/);
    expect(STRIP_SRC).toMatch(/data-testid=\{`bay-chip-\$\{label\.replace.+`\}/);
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

describe('LandingLiveBayStrip — NOT mounted on the public Landing page', () => {
  it('is not imported by Landing.tsx (public surface stays clean)', () => {
    expect(LANDING_SRC).not.toMatch(
      /^\s*import\s+\{\s*LandingLiveBayStrip\s*\}\s+from\s+['"]@\/components\/LandingLiveBayStrip['"]/m,
    );
  });
  it('is not rendered by Landing.tsx', () => {
    expect(LANDING_SRC).not.toMatch(/<LandingLiveBayStrip\b/);
  });
});

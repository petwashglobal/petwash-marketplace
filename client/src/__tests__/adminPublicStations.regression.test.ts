/**
 * The admin screen that opens a new city (2026-09-18).
 *
 * /admin/stations writes Firestore (operations). The station a CUSTOMER sees
 * comes from station_registry, which had no screen at all — it was a code
 * array. /admin/public-stations is that screen, and it must talk to the
 * registry endpoints, say plainly which list it is, and keep the two apart.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = resolve(__dirname, '..');
const page = readFileSync(resolve(SRC, 'pages', 'AdminPublicStations.tsx'), 'utf8');
const app = readFileSync(resolve(SRC, 'App.tsx'), 'utf8');

describe('/admin/public-stations', () => {
  it('is registered behind the admin guard', () => {
    expect(app).toMatch(/<Route path="\/admin\/public-stations">/);
    const block = app.slice(app.indexOf('<Route path="/admin/public-stations">'), app.indexOf('<Route path="/admin/public-stations">') + 400);
    expect(block).toMatch(/<AdminRouteGuard>/);
    expect(block).toMatch(/<AdminPublicStations \/>/);
  });

  it('reads and writes the registry endpoints (not the Firestore ops API)', () => {
    expect(page).toMatch(/apiRequest\('GET', '\/api\/admin\/bookkeeping\/stations'\)/);
    expect(page).toMatch(/apiRequest\('POST', '\/api\/admin\/bookkeeping\/stations', s\)/);
    expect(page).not.toMatch(/'\/api\/admin\/stations'/);
  });

  it('tells the admin which list this is, and links to the other one', () => {
    expect(page).toMatch(/what customers see/i);
    expect(page).toMatch(/עמדות באתר/);
    expect(page).toMatch(/href="\/admin\/stations"/);
  });

  it('collects what a station needs, including bay machine ids', () => {
    for (const k of ['code', 'nameHe', 'nameEn', 'address', 'city', 'lat', 'lng', 'hoursHe', 'bays']) {
      expect(page, k).toMatch(new RegExp(`draft\\.${k}\\b`));
    }
    expect(page).toMatch(/machineId/);
  });

  it('drops empty bay rows before saving (a bay with no machine id is not a bay)', () => {
    expect(page).toMatch(/bays: draft\.bays\.filter\(\(b\) => b\.machineId\.trim\(\)\)/);
  });

  it('shows the server error instead of swallowing it', () => {
    expect(page).toMatch(/data-testid="text-station-error"/);
    expect(page).toMatch(/setError\(body\?\.error/);
  });
});

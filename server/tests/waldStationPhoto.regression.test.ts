/**
 * Wald Kfar Saba station photo (CEO-provided, 2026-07-23) — wired on the
 * Locations page. Green Kfar Saba deliberately has NO photo until its real
 * one arrives next week — never reuse another station's photo.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const page = readFileSync(resolve(ROOT, 'client/src/pages/Locations.tsx'), 'utf8');
const asset = resolve(ROOT, 'attached_assets/wald_kfarsaba_station.jpg');

describe('Wald station photo', () => {
  it('asset exists and is web-sized (not the raw upload)', () => {
    expect(existsSync(asset)).toBe(true);
    expect(statSync(asset).size).toBeLessThan(600_000);
  });

  it('is wired to the Wald entry ONLY, with bilingual alt text', () => {
    const wald = page.slice(page.indexOf("code: 'PWS-IL-KFS-001'"), page.indexOf("code: 'PWS-IL-KFS-002'"));
    const green = page.slice(page.indexOf("code: 'PWS-IL-KFS-002'"), page.indexOf('export default function Locations'));
    expect(wald).toContain('photo: waldStationPhoto');
    expect(wald).toMatch(/photoAltHe/);
    expect(green).not.toContain('photo:');
  });

  it('renders lazily and feeds the LocalBusiness JSON-LD image', () => {
    expect(page).toMatch(/loading="lazy"/);
    expect(page).toMatch(/s\.photo \? new URL\(s\.photo, 'https:\/\/petwash\.co\.il'\)\.href/);
  });
});

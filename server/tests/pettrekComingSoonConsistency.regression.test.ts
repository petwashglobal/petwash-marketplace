/**
 * PR-PETTREK-COMING-SOON-CONSISTENCY — fire-order item 31.
 *
 * PetTrek is coming-soon per the homepage and gated in the /egift
 * picker (PR-EGIFT-COMING-SOON-SERVICES, #1766). Three other public
 * surfaces still labelled it as live:
 *   client/src/pages/SystemStatus.tsx    "operational"
 *   client/src/pages/PrivilegeSignup.tsx unqualified in the platform
 *                                        eligibility chip row
 *   client/src/pages/PlatformShowcase.tsx described as an active service
 *
 * Aligned each to the honest coming-soon labelling used elsewhere.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
function read(rel: string): string { return readFileSync(resolve(ROOT, rel), 'utf8'); }

describe('PR-PETTREK-COMING-SOON-CONSISTENCY', () => {
  // A1–A3 superseded 2026-09-13 (menu dead-end audit): /status no longer
  // hard-codes ANY per-service status — it shows only what GET /api/health
  // measures and labels everything else "not monitored here". The intent of
  // the original pins (PetTrek must never be shown as live) is kept below.
  it('A1. SystemStatus never labels PetTrek (or any service) as hard-coded "operational"', () => {
    const src = read('client/src/pages/SystemStatus.tsx');
    expect(src.includes('PetTrek')).toBe(false);
    expect(/status:\s*["']operational["']/.test(src)).toBe(false);
  });

  it('A2. SystemStatus labels unmeasured services as not monitored', () => {
    const src = read('client/src/pages/SystemStatus.tsx');
    expect(src.includes("'not_monitored'")).toBe(true);
    expect(src.includes('Not monitored here')).toBe(true);
  });

  it('A3. SystemStatus summary is computed from measured checks, never a static "All Systems Operational"', () => {
    const src = read('client/src/pages/SystemStatus.tsx');
    expect(src.includes('All Systems Operational')).toBe(false);
    expect(/const\s+allOk\s*=\s*measured\.every\(/.test(src)).toBe(true);
  });

  it('B1. PrivilegeSignup marks PetTrek with comingSoon flag', () => {
    const src = read('client/src/pages/PrivilegeSignup.tsx');
    // The row for PetTrek in the PLATFORMS array must carry comingSoon:true.
    // Find the line and pin the flag.
    const line = src.split(/\r?\n/).find(l => l.includes('PetTrek') && l.includes('icon:')) || '';
    expect(line.length).toBeGreaterThan(0);
    expect(line.includes('comingSoon: true')).toBe(true);
  });

  it('B2. PrivilegeSignup render loop shows "Coming Soon" tag for flagged platforms', () => {
    const src = read('client/src/pages/PrivilegeSignup.tsx');
    expect(src.includes('platform.comingSoon')).toBe(true);
    expect(src.includes('Coming Soon')).toBe(true);
    expect(src.includes('בקרוב')).toBe(true);
  });

  it('C1. PlatformShowcase PetTrek line explicitly labels coming soon', () => {
    const src = read('client/src/pages/PlatformShowcase.tsx');
    // The specific line for PetTrek must now include the "(coming soon)"
    // qualifier so the marketing bullet is honest.
    const line = src.split(/\r?\n/).find(l => l.includes('PetTrek') && l.includes('transport')) || '';
    expect(line.length).toBeGreaterThan(0);
    expect(line.toLowerCase().includes('coming soon')).toBe(true);
  });
});

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
  it('A1. SystemStatus lists PetTrek as coming_soon (not "operational")', () => {
    const src = read('client/src/pages/SystemStatus.tsx');
    // The one line where PetTrek Transport appears must NOT still say
    // operational; the new status literal is coming_soon.
    const line = src.split(/\r?\n/).find(l => l.includes('PetTrek Transport')) || '';
    expect(line.length).toBeGreaterThan(0);
    expect(line.includes('status: "coming_soon"')).toBe(true);
    expect(line.includes('status: "operational"')).toBe(false);
  });

  it('A2. SystemStatus render loop honors coming_soon (renders "Coming Soon" badge, not just green "Operational")', () => {
    const src = read('client/src/pages/SystemStatus.tsx');
    expect(/system\.status\s*===\s*['"]coming_soon['"]/.test(src)).toBe(true);
    expect(src.includes('Coming Soon')).toBe(true);
  });

  it('A3. SystemStatus summary line no longer claims "All Systems Operational" statically — computed from data', () => {
    const src = read('client/src/pages/SystemStatus.tsx');
    // The summary must gate on `allLive` so it becomes honest as soon
    // as any service is coming_soon.
    expect(/const\s+allLive\s*=\s*systems\.every\(/.test(src)).toBe(true);
    expect(src.includes("{allLive ? 'All Systems Operational'")).toBe(true);
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

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import {
  backgroundCheckPassed,
  backgroundCheckClearsBooking,
} from '../../shared/backgroundCheck';

/**
 * 2026-09-17: every approval path writes background_check_status = 'passed',
 * but the booking accept gates (booking-requests, provider-dashboard-v2), the
 * payment deal gate, the trust badges and the "background checked" filter all
 * compared against 'approved' — a value nothing writes. No approved provider
 * could accept a booking; no provider ever got the badge.
 */
const ROOT = resolve(__dirname, '..', '..');

describe('one reading of the background-check status', () => {
  it('a passed check clears booking and earns the badge (legacy "approved" too)', () => {
    for (const s of ['passed', 'approved', 'PASSED', ' passed ']) {
      expect(backgroundCheckPassed(s)).toBe(true);
      expect(backgroundCheckClearsBooking(s)).toBe(true);
    }
  });
  it('an admin waiver lets the provider take work but never shows a "checked" badge', () => {
    expect(backgroundCheckClearsBooking('waived')).toBe(true);
    expect(backgroundCheckPassed('waived')).toBe(false);
  });
  it('pending / failed / missing clear nothing', () => {
    for (const s of ['pending', 'failed', '', null, undefined, 'rejected', 'in_review']) {
      expect(backgroundCheckPassed(s)).toBe(false);
      expect(backgroundCheckClearsBooking(s)).toBe(false);
    }
  });
  it('the booking gate matches what admin approval itself requires', () => {
    const onboarding = readFileSync(join(ROOT, 'server/routes/provider-onboarding.ts'), 'utf8');
    expect(onboarding).toContain("const backgroundOk = ['passed', 'waived'].includes(");
    expect(onboarding).toContain("background_check_status = 'passed',");
  });
});

describe('no server reader compares the status to a bare literal', () => {
  function walk(dir: string, out: string[] = []): string[] {
    for (const n of readdirSync(dir)) {
      if (n === 'node_modules' || n === 'tests' || n === '__tests__') continue;
      const p = join(dir, n);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.ts$/.test(n)) out.push(p);
    }
    return out;
  }
  it('every comparison goes through shared/backgroundCheck', () => {
    const bad: string[] = [];
    const re = /(backgroundCheckStatus|background_check_status)\s*(===|!==|==|!=)\s*['"]\w+['"]|background_check_status\s*=\s*'approved'/;
    for (const f of walk(join(ROOT, 'server'))) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (re.test(line) && !/^\s*(\/\/|\*)/.test(line)) bad.push(`${f.slice(ROOT.length + 1)}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(bad).toEqual([]);
  });
  it('the two accept gates and the deal gate use backgroundCheckClearsBooking', () => {
    for (const f of ['server/routes/booking-requests.ts', 'server/routes/provider-dashboard-v2.ts', 'server/services/DealGateService.ts']) {
      expect(readFileSync(join(ROOT, f), 'utf8')).toMatch(/backgroundCheckClearsBooking\(/);
    }
  });
});

/**
 * PR-1 — Effective-dated VAT schedule resolver.
 *
 * Adds the historical/effective-dated dimension on top of the canonical
 * ISRAEL_VAT_RATE single source (PR-W13). This test pins:
 *   1. The CURRENT schedule entry equals ISRAEL_VAT_RATE (single-source invariant).
 *   2. resolveVatRateForDate() returns the correct rate per date band.
 *   3. The DB seed migration (0034) mirrors the schedule rates.
 *
 * No behaviour change to existing payment math — this only adds a resolver new
 * code can call. If a future PR changes the current rate, BOTH ISRAEL_VAT_RATE
 * and this schedule's latest entry move together (deliberate signal).
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  ISRAEL_VAT_RATE,
  VAT_RATE_SCHEDULE,
  resolveVatRateForDate,
} from '@shared/israel-compliance-config';

const REPO = path.resolve(__dirname, '..', '..');

describe('PR-1 — VAT rate schedule resolver', () => {
  it('current schedule entry rate equals the canonical ISRAEL_VAT_RATE', () => {
    const current = resolveVatRateForDate(new Date('2026-06-02T00:00:00Z'));
    expect(current.rate).toBe(ISRAEL_VAT_RATE);
    expect(current.rate).toBe(0.18);
  });

  it('resolves 17% for a pre-2025 transaction date', () => {
    expect(resolveVatRateForDate(new Date('2024-07-01T00:00:00Z')).rate).toBe(0.17);
  });

  it('resolves 18% on and after 2025-01-01', () => {
    expect(resolveVatRateForDate(new Date('2025-01-01T00:00:00Z')).rate).toBe(0.18);
    expect(resolveVatRateForDate(new Date('2025-12-31T23:59:59Z')).rate).toBe(0.18);
  });

  it('returns a safe floor (first entry) for dates before the schedule starts', () => {
    const entry = resolveVatRateForDate(new Date('2020-01-01T00:00:00Z'));
    expect(entry).toBe(VAT_RATE_SCHEDULE[0]);
    expect(entry.rate).toBe(0.17);
  });

  it('schedule is in ascending effective_from order', () => {
    for (let i = 1; i < VAT_RATE_SCHEDULE.length; i++) {
      expect(VAT_RATE_SCHEDULE[i].effectiveFrom > VAT_RATE_SCHEDULE[i - 1].effectiveFrom).toBe(true);
    }
  });

  it('migration 0034 seeds the same rates as the schedule', () => {
    const sql = fs.readFileSync(
      path.join(REPO, 'migrations', '0034_vat_rate_configs.sql'),
      'utf8',
    );
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS vat_rate_configs');
    // Both schedule rates appear in the seed (0.1700 and 0.1800).
    expect(sql).toContain('0.1700');
    expect(sql).toContain('0.1800');
  });
});

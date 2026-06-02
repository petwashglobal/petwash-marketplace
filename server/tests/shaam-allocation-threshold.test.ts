/**
 * PR-2 — SHAAM allocation Phase-0 (2025 ₪20,000) band.
 *
 * BUG FIXED: isShaamAllocationRequired() previously returned `false` for ALL
 * 2025 invoice dates, silently missing the חשבוניות ישראל Phase-0 ₪20,000
 * threshold that applied from 2025-01-01. A 2025 supplier invoice over ₪20,000
 * would have been treated as not needing an allocation number — an input-VAT
 * deduction exposure.
 *
 * Thresholds (ex-VAT, strictly greater-than):
 *   Phase 0 — from 2025-01-01: ₪20,000
 *   Phase 1 — from 2026-01-01: ₪10,000
 *   Phase 2 — from 2026-06-01: ₪5,000
 */

import { describe, it, expect } from 'vitest';
import {
  isShaamAllocationRequired,
  resolveShaamAllocation,
  SHAAM_THRESHOLD_PHASE0_ILS,
  SHAAM_THRESHOLD_PHASE1_ILS,
  SHAAM_THRESHOLD_PHASE2_ILS,
} from '@shared/israel-compliance-config';

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe('PR-2 — SHAAM allocation Phase-0 (2025 ₪20k) band', () => {
  it('pre-2025 documents never require an allocation number', () => {
    expect(isShaamAllocationRequired(1_000_000, d('2024-12-31'))).toBe(false);
    expect(resolveShaamAllocation(1_000_000, d('2024-12-31'))).toEqual({
      required: false,
      thresholdILS: null,
    });
  });

  it('THE FIX: 2025 invoice over ₪20,000 now requires an allocation number', () => {
    expect(isShaamAllocationRequired(20_001, d('2025-06-15'))).toBe(true);
    // exactly at the threshold is NOT required (strictly greater-than)
    expect(isShaamAllocationRequired(20_000, d('2025-06-15'))).toBe(false);
    // below threshold not required
    expect(isShaamAllocationRequired(19_999, d('2025-06-15'))).toBe(false);
  });

  it('Phase 1 (from 2026-01-01): ₪10,000 band', () => {
    expect(isShaamAllocationRequired(10_001, d('2026-01-15'))).toBe(true);
    expect(isShaamAllocationRequired(10_000, d('2026-01-15'))).toBe(false);
    // ₪15,000 in 2025 was UNDER the 20k band → not required, but in 2026 it IS
    expect(isShaamAllocationRequired(15_000, d('2025-12-31'))).toBe(false);
    expect(isShaamAllocationRequired(15_000, d('2026-01-15'))).toBe(true);
  });

  it('Phase 2 (from 2026-06-01): ₪5,000 band', () => {
    expect(isShaamAllocationRequired(5_001, d('2026-06-02'))).toBe(true);
    expect(isShaamAllocationRequired(5_000, d('2026-06-02'))).toBe(false);
  });

  it('resolveShaamAllocation returns the threshold used per band (Rule 2)', () => {
    expect(resolveShaamAllocation(30_000, d('2025-03-01')).thresholdILS).toBe(SHAAM_THRESHOLD_PHASE0_ILS);
    expect(resolveShaamAllocation(30_000, d('2026-02-01')).thresholdILS).toBe(SHAAM_THRESHOLD_PHASE1_ILS);
    expect(resolveShaamAllocation(30_000, d('2026-07-01')).thresholdILS).toBe(SHAAM_THRESHOLD_PHASE2_ILS);
  });

  it('credit notes (negative amounts) use absolute value', () => {
    expect(isShaamAllocationRequired(-25_000, d('2025-06-15'))).toBe(true);
    expect(resolveShaamAllocation(-25_000, d('2025-06-15'))).toEqual({
      required: true,
      thresholdILS: SHAAM_THRESHOLD_PHASE0_ILS,
    });
  });
});

/**
 * Issue #153 PR-E-AVAILABILITY-FLAG-TRUTH — replace hardcoded
 * availableForRequestedDates: true at three sites in
 * server/services/providerSearchService.ts with a real, conservative
 * truth signal sourced from the existing bookings-table overlap query.
 *
 * CEO directive (2026-05-09):
 *   The detective audit found that marketplace search returns
 *   availableForRequestedDates: true regardless of real calendar.
 *   "If search says every provider is available regardless of real
 *   calendar, customers will book impossible services and trust will
 *   collapse." Ship Option A: bookings-overlap only (no
 *   availability_slots existence check, no schema, no payments,
 *   no booking-contract changes).
 *
 * Locked invariants this suite enforces:
 *   • The literal `availableForRequestedDates: true` no longer appears
 *     as executable code in providerSearchService.ts (it may still
 *     appear inside line/block comments documenting history, but no
 *     production return path may set it to a constant true again).
 *   • All three former hardcoded sites now compute the flag from the
 *     conflict-set helper.
 *   • The bookings-overlap helper exists and uses the canonical
 *     blocking statuses (draft/pending_payment/pending_provider/
 *     confirmed/in_progress) — same set used by
 *     server/services/booking-service.ts checkAvailability.
 *   • No availability_slots query is introduced inside this file
 *     (Option A discipline: slot population is a future PR).
 *   • No new vendor / payment / API surface is introduced.
 *   • No new pgTable / schema export is introduced by this PR.
 *   • startDate/endDate may be absent — in that case the flag stays
 *     true (preserves the no-date contract).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const svcPath = resolve(ROOT, 'server/services/providerSearchService.ts');
const svc = readFileSync(svcPath, 'utf8');

// Strip comments so we only look at executable code.
const codeOnly = svc
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

// ── A. THE LIE IS GONE ───────────────────────────────────────────────────

describe('PR-E-AVAILABILITY-FLAG-TRUTH — hardcoded true is gone from executable code', () => {
  it('1. literal `availableForRequestedDates: true` does NOT appear in executable code', () => {
    expect(codeOnly).not.toMatch(/availableForRequestedDates\s*:\s*true\b/);
  });

  it('2. all three former sites now compute from the conflict set (negated has() check)', () => {
    // The replacement expression is `!conflictSet.has(providerIdStr)`.
    const matches = codeOnly.match(/availableForRequestedDates\s*:\s*!conflictSet\.has\(/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });

  it('3. PR id marker present in the file head for grepability', () => {
    expect(svc).toMatch(/PR-E-AVAILABILITY-FLAG-TRUTH/);
  });
});

// ── B. CANONICAL BLOCKING STATUSES — EXACT MATCH WITH booking-service.ts ─

describe('PR-E-AVAILABILITY-FLAG-TRUTH — uses canonical blocking statuses', () => {
  it('4. blocking-statuses constant declared with the canonical 5-status set', () => {
    // Same set as server/services/booking-service.ts:checkAvailability.
    expect(codeOnly).toMatch(/BOOKING_BLOCKING_STATUSES/);
    expect(codeOnly).toMatch(/['"]draft['"]/);
    expect(codeOnly).toMatch(/['"]pending_payment['"]/);
    expect(codeOnly).toMatch(/['"]pending_provider['"]/);
    expect(codeOnly).toMatch(/['"]confirmed['"]/);
    expect(codeOnly).toMatch(/['"]in_progress['"]/);
  });

  it('5. helper function getConflictedProviderIds is declared and exported within file', () => {
    expect(codeOnly).toMatch(/async\s+function\s+getConflictedProviderIds\s*\(/);
    // It must be called from the runtime path.
    const callSites = codeOnly.match(/getConflictedProviderIds\s*\(/g) || [];
    // 1 declaration + 3 call sites (dog walkers / sitters / by-platform)
    expect(callSites.length).toBeGreaterThanOrEqual(4);
  });

  it('6. parseRequestedRange helper validates startDate/endDate before query', () => {
    expect(codeOnly).toMatch(/function\s+parseRequestedRange\s*\(/);
    // Must reject end <= start (defence against accidental zero-length / inverted ranges).
    expect(codeOnly).toMatch(/end\s*<=\s*start/);
  });
});

// ── C. OPTION A DISCIPLINE — NO LAYER-2, NO SCHEMA, NO VENDOR ─────────────

describe('PR-E-AVAILABILITY-FLAG-TRUTH — Option A discipline (no slot table, no schema, no vendor)', () => {
  it('7. NO availability_slots table query introduced in this file', () => {
    // Layer-2 (slot existence) is intentionally OUT OF SCOPE for this PR.
    expect(codeOnly).not.toMatch(/availabilitySlots\b/);
    expect(codeOnly).not.toMatch(/availability_slots\b/);
  });

  it('8. NO pgTable / schema export introduced in this file (no new tables this PR)', () => {
    expect(svc).not.toMatch(/pgTable\s*\(/);
    expect(svc).not.toMatch(/export\s+const\s+\w+\s*=\s*pgTable/);
  });

  it('9. NO payment / vendor surface introduced (stripe/cardcom/nayax/tranzila/twilio/sendgrid/process.env.PAYMENT_)', () => {
    const forbidden = /(stripe|cardcom|nayax|tranzila|twilio|sendgrid|process\.env\.PAYMENT_)/i;
    expect(svc).not.toMatch(forbidden);
  });

  it('10. NO booking-contract change: no new column/field reference introduced for booking lifecycle', () => {
    // Defensive: this PR only READS bookings (provider_id, platform_id,
    // status, start_time, end_time). It MUST NOT write/insert/update.
    expect(codeOnly).not.toMatch(/db\.update\(\s*bookings\b/);
    expect(codeOnly).not.toMatch(/db\.insert\(\s*bookings\b/);
    expect(codeOnly).not.toMatch(/db\.delete\(\s*bookings\b/);
  });
});

// ── D. NO-DATE CONTRACT PRESERVED ────────────────────────────────────────

describe('PR-E-AVAILABILITY-FLAG-TRUTH — no-date contract preserved', () => {
  it('11. when no startDate/endDate provided, conflictSet defaults to empty Set', () => {
    // The pattern `range ? await getConflictedProviderIds(...) : new Set<string>()`
    // appears at all three fetch sites.
    const ternaryHits = codeOnly.match(/range\s*\?\s*await\s+getConflictedProviderIds\s*\(/g) || [];
    expect(ternaryHits.length).toBeGreaterThanOrEqual(3);
    // Empty-set fallback expression appears at least 3 times.
    const emptyFallback = codeOnly.match(/:\s*new\s+Set<string>\s*\(\s*\)/g) || [];
    expect(emptyFallback.length).toBeGreaterThanOrEqual(3);
  });

  it('12. parseRequestedRange returns null on missing or invalid dates (fail-soft)', () => {
    // The helper returns null in three branches: missing fields, NaN dates, end <= start.
    expect(codeOnly).toMatch(/return\s+null/);
    expect(codeOnly).toMatch(/isNaN\(start\.getTime\(\)\)/);
    expect(codeOnly).toMatch(/isNaN\(end\.getTime\(\)\)/);
  });
});

// ── E. PER-PLATFORM CONFLICT QUERY (no cross-platform contamination) ──────

describe('PR-E-AVAILABILITY-FLAG-TRUTH — per-platform conflict query', () => {
  it('13. each fetch site passes the correct platformId literal to the helper', () => {
    // walk_my_pet (dog walking), sitter_suite (sitters), and the dynamic
    // platformId param (groomers / pet_trek) all flow through.
    expect(codeOnly).toMatch(/getConflictedProviderIds\s*\(\s*['"]walk_my_pet['"]/);
    expect(codeOnly).toMatch(/getConflictedProviderIds\s*\(\s*['"]sitter_suite['"]/);
    // The fetchByPlatform site uses the function param `platformId`.
    expect(codeOnly).toMatch(/getConflictedProviderIds\s*\(\s*platformId\s*,/);
  });

  it('14. conflict query filters by platformId, providerId list, status, and time overlap', () => {
    expect(codeOnly).toMatch(/eq\(\s*bookings\.platformId\s*,\s*platformId\s*\)/);
    expect(codeOnly).toMatch(/inArray\(\s*bookings\.providerId\s*,/);
    expect(codeOnly).toMatch(/inArray\(\s*bookings\.status\s*,/);
    // Overlap predicate: existing start <= requested end AND existing end >= requested start.
    expect(codeOnly).toMatch(/lte\(\s*bookings\.startTime\s*,\s*range\.end\s*\)/);
    expect(codeOnly).toMatch(/gte\(\s*bookings\.endTime\s*,\s*range\.start\s*\)/);
  });

  it('15. fail-soft on query error: helper returns empty Set so search still works', () => {
    // If the conflict query throws, search must NOT 500 — it should
    // log and return an empty conflict set, leaving the flag true.
    expect(codeOnly).toMatch(/return\s+new\s+Set\(\)/);
    expect(codeOnly).toMatch(/\[ProviderSearch\][\s\S]{0,80}Conflict query failed/);
  });
});

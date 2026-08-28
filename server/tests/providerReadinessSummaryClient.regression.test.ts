/**
 * CEO §23 (2026-08-28) — applicant-facing eligibility summary.
 *
 * ProviderApplicationStatus reads the `readiness` DTO from /my/status
 * and renders TWO applicant-facing rows: "Appears in customer search"
 * (searchEligible) and "Bookable by customers" (bookingEligible). Both
 * badges come straight off the server field — no client-side derivation
 * that could disagree with the gate.
 *
 * A refactor that started deriving searchEligible from the sectionStatus
 * checklist client-side would silently drift: the source-of-truth is
 * the server. Pin the direct readiness read + the two testids so the
 * regression trips CI.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'ProviderApplicationStatus.tsx'),
  'utf8',
);

describe('ProviderApplicationStatus — readiness summary (CEO §23)', () => {
  it('declares the readiness field on the /my/status query type', () => {
    // The client's TS type on the query result MUST include readiness
    // so a rename on the server surfaces as a compile error instead of
    // undefined at runtime.
    expect(SRC).toMatch(/readiness\?: \{/);
    for (const flag of [
      'identityReady',
      'insuranceReady',
      'backgroundReady',
      'payoutReady',
      'agreementsReady',
      'profileReady',
      'serviceApproved',
      'pricingReady',
      'availabilityReady',
      'searchEligible',
      'bookingEligible',
    ]) {
      expect(SRC).toContain(`${flag}: boolean`);
    }
  });

  it('renders the summary card only when the server returned a readiness DTO', () => {
    // Guard on data?.readiness — a stale client hitting an older
    // server that doesn't emit the field must not crash.
    expect(SRC).toMatch(/\{data\?\.readiness && \(/);
    expect(SRC).toMatch(/data-testid="readiness-summary"/);
  });

  it('badge state comes DIRECTLY from data.readiness[key], not from sectionStatus', () => {
    // Regression guard: if the badge ever derived from
    // sectionStatus.sections it would drift from the gate.
    expect(SRC).toMatch(/const on = data\.readiness!\[key\];/);
  });

  it('shows the two applicant-facing rows keyed on searchEligible + bookingEligible', () => {
    // The row list MUST enumerate these two keys — no substitution, no
    // synonyms, no derived flag.
    expect(SRC).toMatch(/'searchEligible',[\s\S]*?'bookingEligible',/);
    expect(SRC).toMatch(/data-testid=\{`readiness-row-\$\{key\}`\}/);
  });

  it('shows a helpful "not yet — do X" hint UNDER a false badge', () => {
    // A red X-only badge is bad UX. Confirm the negative hint copy is
    // gated by !on so it only appears when the flag is off.
    expect(SRC).toMatch(/\{!on && \(/);
    expect(SRC).toContain('complete every section above');
    expect(SRC).toContain('add services, pricing and availability');
  });

  it('carries HE + EN copy on both rows', () => {
    // Israeli product — both languages required.
    expect(SRC).toContain('הופעה בחיפוש הלקוחות');
    expect(SRC).toContain('Appears in customer search');
    expect(SRC).toContain('ניתן להזמין ממני');
    expect(SRC).toContain('Bookable by customers');
  });
});

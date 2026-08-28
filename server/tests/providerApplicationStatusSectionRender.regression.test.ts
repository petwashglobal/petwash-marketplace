/**
 * CEO §46 (2026-08-28) — client renders the per-section state list.
 *
 * Server-side sectionStatus DTO landed in 4922e9305 on /my/status.
 * This test pins the CLIENT render: ProviderApplicationStatus.tsx
 * consumes the DTO and renders a section list with per-row testid
 * anchors + a badge that reflects complete / checking / action_required.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'ProviderApplicationStatus.tsx'),
  'utf8',
);

describe('ProviderApplicationStatus renders per-section state (CEO §46 client half)', () => {
  it('extends the useQuery type with a sectionStatus shape', () => {
    expect(SRC).toMatch(/sectionStatus\?:\s*\{/);
    expect(SRC).toMatch(/sections:\s*Record</);
    expect(SRC).toMatch(/'complete' \| 'checking' \| 'action_required'/);
  });

  it('renders the section-status card only when the server returned the DTO', () => {
    // A prior release of the server may omit sectionStatus; the client
    // must not crash — guard on `data?.sectionStatus`.
    expect(SRC).toMatch(/\{data\?\.sectionStatus && \(/);
    expect(SRC).toMatch(/data-testid="section-status-list"/);
  });

  it('emits a per-section row testid keyed on the section name', () => {
    // The row testid is `section-status-row-${key}` — a template
    // literal. Pin the template + the section-key list so a rename or
    // a dropped section is caught.
    expect(SRC).toMatch(/data-testid=\{`section-status-row-\$\{key\}`\}/);
    for (const key of ['profile', 'identity', 'insurance', 'background', 'bank', 'declarations']) {
      // Each canonical key must appear in the enumerated section
      // list (part of the JSX map source).
      expect(SRC).toMatch(new RegExp(`\\['${key}',`));
    }
  });

  it('badge classes reflect the three states (emerald / amber / red)', () => {
    expect(SRC).toMatch(/state === 'complete'.*bg-emerald-100/);
    expect(SRC).toMatch(/state === 'checking'.*bg-amber-100/);
    // The default fallback (action_required) uses red.
    expect(SRC).toMatch(/bg-red-100/);
  });

  it('badge labels are HE + EN and match the three states', () => {
    for (const label of ['Complete', 'Checking', 'Action required']) {
      expect(SRC).toContain(label);
    }
    for (const heLabel of ['הושלם', 'בבדיקה', 'נדרש טיפול']) {
      expect(SRC).toContain(heLabel);
    }
  });

  it('section labels use HE + EN in the correct language according to isRtl', () => {
    for (const key of ['Profile', 'Identity & Documents', 'Insurance', 'Background & Consents', 'Bank / Payout', 'Onboarding Declarations']) {
      expect(SRC).toContain(key);
    }
    for (const heLabel of ['פרופיל', 'זהות ומסמכים', 'ביטוח', 'רקע ואישורים', 'חשבון בנק / תשלום', 'הצהרות אונבורדינג']) {
      expect(SRC).toContain(heLabel);
    }
  });
});

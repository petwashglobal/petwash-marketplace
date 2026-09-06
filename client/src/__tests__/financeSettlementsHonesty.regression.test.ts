/**
 * Finance & Settlements tab — no invented money figures.
 *
 * Extracted 2026-09-06 from #2240 (stale, superseded in part by #2247) and
 * re-landed on current main, because this specific fix was NOT carried over
 * and the defect is a finance-honesty one.
 *
 * The tab was built on endpoints that do not exist:
 *   GET /api/finance/settlements            → no handler
 *   GET /api/finance/settlements/:id/export  → no handler
 *   GET /api/finance/commissions             → no handler
 * (verified against server/routes/finance.ts, which exposes only
 *  /profitability/stations, /profitability/network, /capital-signals,
 *  /ownership-comparison, /friction-analytics and /summary — and /summary
 *  returns a different shape than the view read.)
 *
 * The consequence was worse than an empty screen: the four headline cards
 * rendered "₪0.00" revenue / commissions / VAT and "0" pending settlements.
 * An operator reading that would conclude the network earned nothing, when
 * in fact nothing was ever fetched. A finance surface must never show a
 * number it did not read from a ledger.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'components', 'control-panel', 'FinanceSettlementsView.tsx'),
  'utf8',
);

/** Source with block comments stripped — the prose documents the OLD behaviour. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '');

describe('FinanceSettlementsView renders no money it did not fetch', () => {
  it('names the missing endpoints as documentation for the operator', () => {
    // The paths DO appear in the rendered output on purpose — the screen tells
    // the operator exactly which handlers are absent. What must never come back
    // is USING them, and that is fully covered by the "fetches nothing" case
    // below: if no fetch/apiRequest/useQuery call exists anywhere in the
    // component, no string in it can be a request target.
    //
    // (An earlier draft built a RegExp from the endpoint string to assert
    // "not adjacent to a call". CodeQL flagged it — js/incomplete-sanitization,
    // the escape handled `/` but not `\` — and it was right: hand-escaping a
    // string into a pattern is fragile even in a test. The assertion was also
    // redundant, so it is gone rather than patched.)
    for (const ep of ['/api/finance/settlements', '/api/finance/commissions']) {
      expect(SRC, `${ep} should be shown to the operator`).toContain(ep);
    }
  });

  it('formats no currency values at all', () => {
    // No toFixed / toLocaleString / Intl.NumberFormat left in executable code:
    // every one of those existed only to render a fabricated total.
    expect(CODE).not.toMatch(/toFixed\(/);
    expect(CODE).not.toMatch(/toLocaleString\(/);
    expect(CODE).not.toMatch(/Intl\.NumberFormat/);
  });

  it('fetches nothing — no query hook remains', () => {
    expect(CODE).not.toMatch(/useQuery\(/);
    expect(CODE).not.toMatch(/apiRequest\(/);
    expect(CODE).not.toMatch(/fetch\(/);
  });

  it('states plainly that the tab has no backing API', () => {
    expect(SRC).toMatch(/no backing API/i);
    expect(SRC).toMatch(/Missing endpoints/i);
  });

  it('points the operator at the finance surfaces that ARE wired', () => {
    expect(SRC).toMatch(/WIRED_ALTERNATIVES/);
    // Must reference real routes from server/routes/finance.ts, not invented ones.
    expect(SRC).toMatch(/profitability|capital-signals|ownership-comparison/);
  });
});

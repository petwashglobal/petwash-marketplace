/**
 * MyTransactions — §8 per-instrument refund-copy source-pin.
 *
 * The CEO §8 example ("Refund ₪40 = eGift ₪10 restored + Card ₪30
 * returned" — never "Refund successful.") lands in
 * client/src/pages/MyTransactions.tsx via a switch on `r.instrument`.
 * Each of the six canonical instruments has its own copy. A refactor
 * that drops a case silently degrades that instrument to the generic
 * fallback ("Refund"), and the customer never sees where their money
 * went.
 *
 * The `default:` branch is also mandatory — it catches the 'unknown'
 * sentinel that lineage.ts coerces off-list DB values into (see
 * refundInstrumentTaxonomyCrossFile.regression.test.ts). Without it,
 * an unknown value crashes the render or falls through with no copy.
 *
 * Pins the switch itself:
 *   1. All six instrument cases present.
 *   2. Default fallback present with neutral copy — NEVER the word
 *      "successful" (§8 explicitly banned that phrasing).
 *   3. Hebrew parity — every branch has a Hebrew string too.
 *   4. RefundLineageEntry.instrument type union carries the six values
 *      + 'unknown' sentinel — the client DTO the switch runs on.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, 'MyTransactions.tsx'),
  'utf8',
);

// Extract the switch block on r.instrument so downstream assertions
// operate on the exact code the customer sees.
const SWITCH_BLOCK = (() => {
  const start = SRC.indexOf('switch (r.instrument)');
  const braceStart = SRC.indexOf('{', start);
  // walk to matching brace
  let depth = 0;
  let i = braceStart;
  while (i < SRC.length) {
    if (SRC[i] === '{') depth++;
    else if (SRC[i] === '}') {
      depth--;
      if (depth === 0) return SRC.slice(braceStart, i + 1);
    }
    i++;
  }
  return '';
})();

describe('MyTransactions §8 per-instrument refund copy', () => {
  it('the switch on r.instrument exists and is complete', () => {
    expect(SWITCH_BLOCK.length).toBeGreaterThan(0);
    // Every canonical instrument gets its own case — a drop silently
    // demotes that instrument to the generic default copy.
    for (const c of ['egift', 'wallet', 'loyalty', 'promo', 'wash_pack', 'card']) {
      expect(SWITCH_BLOCK).toMatch(new RegExp(`case '${c}':`));
    }
  });

  it("carries a default: branch that catches the 'unknown' sentinel", () => {
    // lineage.ts coerces off-list DB values to 'unknown'. The default
    // branch is what renders it — without one, the switch falls
    // through and the row shows nothing.
    expect(SWITCH_BLOCK).toMatch(/default:\s*return\s+tr\(/);
  });

  it("NEVER uses the CEO-banned wording 'Refund successful'", () => {
    // §8: CEO explicitly forbade "Refund successful." in favour of the
    // per-leg breakdown. A refactor that softens the copy to a
    // universal success string is a regression.
    expect(SRC).not.toMatch(/Refund successful/);
  });

  it('every case has Hebrew parity — no monolingual copy escapes', () => {
    // Extract all tr(en, he) calls inside the switch — each must have
    // a non-empty Hebrew second arg. A drop of the Hebrew half silently
    // renders empty text on he-IL.
    const trCalls = [...SWITCH_BLOCK.matchAll(/tr\(\s*'([^']+)'\s*,\s*'([^']+)'/g)];
    expect(trCalls.length).toBeGreaterThanOrEqual(7); // 6 cases + 1 default
    for (const m of trCalls) {
      expect(m[1].trim().length).toBeGreaterThan(0);
      expect(m[2].trim().length).toBeGreaterThan(0);
    }
  });

  it('DTO union carries the six canonical values plus the unknown sentinel', () => {
    // The union the switch runs on. Ordering doesn't matter; the SET
    // does. Sort both sides so the comparison is order-independent.
    const m = SRC.match(/instrument\?:\s*([^;]+);/);
    expect(m).not.toBeNull();
    const values = [...(m![1].matchAll(/['"]([a-z_]+)['"]/g))].map((r) => r[1]).sort();
    expect(values).toEqual(
      ['card', 'egift', 'loyalty', 'promo', 'unknown', 'wallet', 'wash_pack'],
    );
  });
});

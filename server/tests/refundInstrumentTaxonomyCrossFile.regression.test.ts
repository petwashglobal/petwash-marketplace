/**
 * Cross-file source-pin regression: the RefundInstrument enum in
 * RefundService.ts MUST equal the `knownInstruments` allow-list in
 * fiscalPassport/lineage.ts and the RefundLineageEntry.instrument
 * union in shared/lib/fiscalPassport/FiscalTransactionPassport.ts.
 *
 * Why this exists: composeRefundLineage projects refund_transactions
 * rows into the passport's REFUND lineage. Each row carries an
 * `instrument` column (RefundService writes it). lineage.ts uses a
 * literal allow-list to reject free-text and coerce unknowns to the
 * 'unknown' sentinel so an admin free-text field can't leak through.
 * The DTO union defines what the client is willing to render.
 *
 * If any ONE of those three lists drifts, refunds silently render as
 * "unknown" on the customer's transaction history — the §8 CEO example
 * ("eGift ₪10 restored + Card ₪30 returned") stops working invisibly.
 * This test pins the three lists to the same six-value taxonomy so a
 * drift trips CI, not a customer.
 *
 * The 'unknown' sentinel on the DTO is INTENTIONAL — it's the fallback
 * for a row whose instrument column carries a legacy/free-text value.
 * It must NOT appear in the RefundInstrument enum (which is the write-
 * time contract) or in the lineage.ts allow-list (which is the read-
 * time canonicalisation).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const REFUND_SERVICE_SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'RefundService.ts'),
  'utf8',
);
const LINEAGE_SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'fiscalPassport', 'lineage.ts'),
  'utf8',
);
const DTO_SRC = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'shared', 'lib', 'fiscalPassport', 'FiscalTransactionPassport.ts'),
  'utf8',
);

/** The single source-of-truth taxonomy — the six instrument types the
 *  refund rail is authorised to settle across. */
const CANONICAL_INSTRUMENTS = ['wallet', 'egift', 'loyalty', 'promo', 'wash_pack', 'card'] as const;

function extractQuoted(text: string, pattern: RegExp): string[] {
  const m = text.match(pattern);
  if (!m) return [];
  return [...m[1].matchAll(/["']([a-z_]+)["']/g)].map((r) => r[1]);
}

describe('refund instrument taxonomy — the three lists must agree', () => {
  it('RefundService.ts declares exactly the canonical six values', () => {
    const values = extractQuoted(
      REFUND_SERVICE_SRC,
      /export type RefundInstrument\s*=\s*([^;]+);/,
    );
    expect(values.sort()).toEqual([...CANONICAL_INSTRUMENTS].sort());
  });

  it('lineage.ts knownInstruments allow-list carries the same six values', () => {
    // Pin the literal array so a drift trips this test rather than the
    // customer seeing "unknown" on every refund with the drifted value.
    const values = extractQuoted(
      LINEAGE_SRC,
      /const knownInstruments\s*=\s*\[([\s\S]*?)\]/,
    );
    expect(values.sort()).toEqual([...CANONICAL_INSTRUMENTS].sort());
  });

  it("FiscalTransactionPassport.ts DTO union is the six values plus 'unknown' sentinel", () => {
    // The client-side render union — same six values, plus 'unknown'
    // as the intentional fallback for legacy/free-text rows. Drift
    // between the DTO and the read-time coercion in lineage.ts would
    // let a coerced value fail the client's exhaustive-switch renderer.
    const values = extractQuoted(
      DTO_SRC,
      /instrument\?:\s*(['"a-z_|\s]+);/,
    );
    expect(values.sort()).toEqual(
      [...CANONICAL_INSTRUMENTS, 'unknown'].sort(),
    );
  });

  it("'unknown' is NEVER a write-time value — only a read-time sentinel", () => {
    // A refund is written with an authoritative instrument. A row that
    // ever landed with instrument='unknown' would represent a broken
    // caller. The enum on RefundService must never accept it.
    expect(REFUND_SERVICE_SRC).not.toMatch(/RefundInstrument\s*=[^;]*['"]unknown['"]/);
    // Same discipline on the lineage allow-list: 'unknown' is what the
    // mapper COERCES to when the DB value is off-list, not something
    // the allow-list itself contains.
    expect(LINEAGE_SRC).not.toMatch(/knownInstruments\s*=\s*\[[^\]]*['"]unknown['"]/);
  });

  it('lineage.ts uses `.includes(rawInstrument)` — never a bare string equality chain', () => {
    // A refactor that swapped .includes() for a hand-rolled switch would
    // silently break the six-way symmetry (someone forgets a case).
    // Pin the array-membership check so extension stays adding-a-string
    // in one place.
    expect(LINEAGE_SRC).toMatch(/knownInstruments\.includes\(rawInstrument\)/);
  });
});

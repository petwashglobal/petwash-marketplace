/**
 * CEO §8 per-leg refund lineage — 'Refund ₪40 = eGift ₪10 restored +
 * Card ₪30 returned' must never collapse into a single lump-sum.
 *
 * Structural pins on server/services/fiscalPassport/lineage.ts and the
 * shared DTO so:
 *   • composeRefundLineage READS the instrument column (never invents
 *     one, never hard-codes 'card').
 *   • The instrument value is validated against the RefundService
 *     writer taxonomy — free-text admin fields cannot leak into the
 *     customer surface.
 *   • The shared DTO exposes instrument to the client so the customer
 *     tile can render the honest per-leg copy.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const LINEAGE_SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'fiscalPassport', 'lineage.ts'),
  'utf8',
);
const DTO_SRC = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'shared', 'lib', 'fiscalPassport', 'FiscalTransactionPassport.ts'),
  'utf8',
);

describe('composeRefundLineage reads instrument + reason', () => {
  it('SELECT clause includes instrument, reason, status', () => {
    expect(LINEAGE_SRC).toMatch(/instrument,\s*reason,\s*status,\s*created_at/);
  });

  it('every returned refund entry carries instrument (never undefined-if-missing)', () => {
    // The mapper must always emit an instrument field — 'unknown' when
    // the writer didn't record one, so the client never renders an
    // empty <span/>.
    expect(LINEAGE_SRC).toMatch(/instrument:\s*\([\s\S]*?knownInstruments\.includes\(rawInstrument\)/);
    expect(LINEAGE_SRC).toMatch(/'unknown'/);
  });

  it('instrument enum matches the RefundService writer taxonomy (line 32)', () => {
    // Any drift here silently reclassifies a customer's refund. Ban that.
    expect(LINEAGE_SRC).toMatch(/knownInstruments\s*=\s*\[['"]wallet['"],\s*['"]egift['"],\s*['"]loyalty['"],\s*['"]promo['"],\s*['"]wash_pack['"],\s*['"]card['"]\]/);
  });

  it('lowercases the raw instrument so admin CASE / MiXeD strings still match', () => {
    expect(LINEAGE_SRC).toMatch(/String\(r\.instrument\s*\?\?\s*['"]{2}\)\.toLowerCase\(\)/);
  });
});

describe('shared DTO — client can render per-leg copy', () => {
  it('RefundLineageEntry exports instrument as the same 7-value union', () => {
    expect(DTO_SRC).toMatch(
      /instrument\?:\s*'wallet'\s*\|\s*'egift'\s*\|\s*'loyalty'\s*\|\s*'promo'\s*\|\s*'wash_pack'\s*\|\s*'card'\s*\|\s*'unknown'/,
    );
  });

  it('status + reason fields ride through from the writer', () => {
    expect(DTO_SRC).toMatch(/status\?:\s*string/);
    expect(DTO_SRC).toMatch(/reason\?:\s*string/);
  });
});

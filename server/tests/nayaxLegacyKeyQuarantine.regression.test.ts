/**
 * The v1 issuance-identity builder is QUARANTINED — regression pin (2026-09-08).
 *
 * `legacyIdempotencyKeyForV1()` produces the pre-composite reference
 * `nayax-bay:<txId>`, the form carried by the 481 documents already in SUMIT
 * (#10002–#10482). It is retained ONLY so that identity stays expressible for
 * verification.
 *
 * No production path may call it, and the reason is specific rather than
 * stylistic. migration 0148 declares `external_reference` NOT NULL, so every
 * claim already carries its own historical identity and recovery uses exactly
 * that persisted value. Regenerating a v1 reference is therefore never the
 * right answer: were a claim's reference ever missing, silently rebuilding a
 * guess would be WORSE than failing — the guess could resolve to a different
 * document than the one that claim actually produced, and the recovery path
 * would then settle a claim against the wrong tax document.
 *
 * This pin exists because the risk is invisible: calling it compiles, returns
 * a plausible string, and would only be discovered by an auditor.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRV = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(SRV, p), 'utf8');

/** Every file that participates in issuing or recovering a fiscal document. */
const PRODUCTION_ISSUANCE_PATHS = [
  'services/nayaxSaleIssuance.ts',
  'services/nayaxSumitBridge.ts',
  'services/SumitClient.ts',
];

describe('legacy v1 identity builder is quarantined', () => {
  it('is not CALLED anywhere in a production issuance or recovery path', () => {
    for (const f of PRODUCTION_ISSUANCE_PATHS) {
      const src = read(f);
      // A call is `legacyIdempotencyKeyForV1(` — the declaration in
      // nayaxSumitBridge.ts is `export function legacyIdempotencyKeyForV1(`,
      // so strip declarations before looking for invocations.
      const withoutDecl = src.replace(/export\s+function\s+legacyIdempotencyKeyForV1\s*\(/g, 'DECLARATION(');
      expect(withoutDecl, `${f} must not call the legacy v1 key builder`)
        .not.toMatch(/legacyIdempotencyKeyForV1\s*\(/);
    }
  });

  it('recovery uses the PERSISTED external reference, not a regenerated one', () => {
    const src = read('services/nayaxSaleIssuance.ts');
    // The persisted value must come first in the expression — `existing.
    // externalReference || …` — so a claim that has one always uses it.
    expect(src).toMatch(/externalReference:\s*existing\.externalReference\s*\|\|/);
  });

  it('is marked @deprecated so callers are warned at the editor', () => {
    // Structural, not a proximity guess: take the JSDoc block immediately
    // preceding the declaration and assert @deprecated is inside IT. A window
    // regex would break the moment the comment grew, which is exactly the kind
    // of brittle pin that gets deleted instead of fixed.
    const src = read('services/nayaxSumitBridge.ts');
    const decl = src.indexOf('export function legacyIdempotencyKeyForV1');
    expect(decl).toBeGreaterThan(-1);
    const before = src.slice(0, decl);
    const jsdocStart = before.lastIndexOf('/**');
    expect(jsdocStart).toBeGreaterThan(-1);
    const jsdoc = before.slice(jsdocStart);
    expect(jsdoc).toMatch(/@deprecated/);
    expect(jsdoc).toMatch(/QUARANTINED/);
  });

  it('validates its input — a legacy identity may not contain "undefined" either', () => {
    const src = read('services/nayaxSumitBridge.ts');
    const fn = src.match(/export function legacyIdempotencyKeyForV1[\s\S]*?\n}/)?.[0] ?? '';
    expect(fn).not.toBe('');
    expect(fn).toMatch(/refusing to build a v1 identity without a transaction id/);
  });

  it('the composite builder is the one production uses', () => {
    const bridge = read('services/nayaxSumitBridge.ts');
    expect(bridge).toMatch(/idempotencyKey:\s*idempotencyKeyFor\(sale\.machineId,\s*sale\.transactionId\)/);
  });
});

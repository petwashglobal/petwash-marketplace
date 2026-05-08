/**
 * Issue #153 PR-KYC-LABEL-TRUTH — truthful KYC v2 storage label.
 *
 * CEO directive (Track-A foundation: Pillar E step 1):
 *   "Truth-only fix. Remove misleading '[Firebase Storage]' label if
 *    kyc2026 is memory-only. No behavior change."
 *
 * The Lane B-C audit confirmed kyc2026.ts processes images in memory
 * and zeroes the buffers immediately (lines 135-137). The orchestrator
 * hook at line 161 was passing `selfieUrl: '[Firebase Storage]'` and
 * `idDocUrl: '[Firebase Storage]'` — pure placeholder strings that never
 * referenced an actual URL. That created a compliance / legal /
 * audit-trail misleading: a reviewer reading the orchestrator email,
 * the audit-event metadata, or the GDPR docContent line would have
 * concluded documents were persisted in Firebase Storage. They were not.
 *
 * The fix replaces the placeholder with a truthful marker
 * `[kyc-v2-memory-only]` that:
 *   • preserves the orchestrator's truthy-sentinel behaviour
 *     (`opts.selfieUrl ? '✅' : '❌'` still resolves to ✅ when the
 *     user submitted a selfie)
 *   • removes the audit-misleading "Firebase Storage" reference
 *   • clearly marks v2 as the zero-storage pipeline
 *
 * Out of scope (separate, gated CEO/CPA work — Pillar E step 2/3):
 *   - The orchestrator's GDPR docContent prose
 *     (`Documents stored in Firebase Storage with 90-day retention`)
 *     is still in PetWashOperationsOrchestrator.ts. It applies to BOTH
 *     v1 and v2 submissions and changing it requires the unified-KYC
 *     spec decision the CEO is sequencing for later.
 *   - The legacy v1 pipeline (server/routes/kyc.ts) DOES write to
 *     Firebase Storage with 24h quarantine. That label is correct for
 *     v1; this PR doesn't touch v1.
 *
 * Pure source-pin tests. No DB, no orchestrator boot, no FS writes.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const kyc2026 = readFileSync(resolve(ROOT, 'server/routes/kyc2026.ts'), 'utf8');

describe('PR-KYC-LABEL-TRUTH — kyc2026.ts label fix', () => {
  it('1. Misleading "[Firebase Storage]" placeholder no longer appears in any active call site', () => {
    // The PR-KYC-LABEL-TRUTH retirement comment may mention the legacy
    // label by name (and that's fine — documentation). The thing we
    // care about is that NO actual call argument or assignment uses
    // the placeholder. Anchor on the bare quoted string outside a
    // comment by stripping line-leading comment markers first.
    const noComments = kyc2026
      .replace(/\/\*[\s\S]*?\*\//g, '')         // /* ... */ blocks
      .replace(/^\s*\/\/.*$/gm, '')             // // line comments
      .replace(/^\s*\*.*$/gm, '');              // multi-line comment continuations
    expect(noComments).not.toMatch(/['"`]\[Firebase Storage\]['"`]/);
  });

  it('2. selfieUrl/idDocUrl now use the canonical KYC_V2_MEMORY_ONLY_MARKER', () => {
    // The marker is declared as a const so a future reader sees one
    // place to change it (and tests pin the literal value too).
    expect(kyc2026).toMatch(/const\s+KYC_V2_MEMORY_ONLY_MARKER\s*=\s*['"`]\[kyc-v2-memory-only\]['"`]/);
    // Both fields must use the marker — not a hardcoded duplicate.
    expect(kyc2026).toMatch(/selfieUrl:\s*KYC_V2_MEMORY_ONLY_MARKER/);
    expect(kyc2026).toMatch(/idDocUrl:\s*KYC_V2_MEMORY_ONLY_MARKER/);
  });

  it('3. Marker is truthy so the orchestrator\'s "✅ vs ❌" sentinel behaviour is preserved', () => {
    // Behaviour-only check: the orchestrator's truthy check
    // `opts.selfieUrl ? '✅' : '❌'` must still resolve to ✅. Empty
    // string would have changed behaviour — a non-empty marker keeps it.
    const marker = '[kyc-v2-memory-only]';
    expect(marker.length).toBeGreaterThan(0);
    expect(Boolean(marker)).toBe(true);
  });

  it('4. Marker shape is clearly NOT a URL (no scheme, no http/https, no domain)', () => {
    const marker = '[kyc-v2-memory-only]';
    expect(marker).not.toMatch(/^https?:\/\//);
    expect(marker).not.toMatch(/\./); // no domain
    expect(marker).not.toMatch(/^\//); // no path
    // Bracket-wrapped sentinel — clearly metadata, not a URL.
    expect(marker.startsWith('[')).toBe(true);
    expect(marker.endsWith(']')).toBe(true);
  });

  it('5. The retirement comment documents WHY the placeholder was misleading', () => {
    // Future readers must be able to find "PR-KYC-LABEL-TRUTH" and the
    // explanation so they don't reintroduce the placeholder.
    expect(kyc2026).toMatch(/PR-KYC-LABEL-TRUTH/);
    expect(kyc2026).toMatch(/zero-storage/);
    expect(kyc2026).toMatch(/memory/);
  });

  it('6. Buffer-zeroing behaviour at lines 135-137 is preserved (regression guard)', () => {
    // The audit confirmed buffers are zeroed immediately after
    // processSubmission. Removing OR moving that code would change
    // the meaning of the marker — this PR must not touch it.
    expect(kyc2026).toMatch(/selfieFile\.buffer\s*=\s*Buffer\.alloc\(\s*0\s*\)/);
    expect(kyc2026).toMatch(/idFrontFile\.buffer\s*=\s*Buffer\.alloc\(\s*0\s*\)/);
    expect(kyc2026).toMatch(/idBackFile\?\.buffer\s*=\s*Buffer\.alloc\(\s*0\s*\)|if\s*\(\s*idBackFile\s*\)\s*idBackFile\.buffer\s*=\s*Buffer\.alloc\(\s*0\s*\)/);
  });

  it('7. The orchestrator hook still fires (no behaviour change to the audit pipeline)', () => {
    expect(kyc2026).toMatch(/petWashOrchestrator\.handleKYCSubmission/);
    expect(kyc2026).toMatch(/source:\s*['"]kyc_v2_2026['"]/);
  });

  it('8. Out-of-scope guard: the legacy v1 pipeline at server/routes/kyc.ts is NOT modified', () => {
    // PR-KYC-LABEL-TRUTH must not touch v1. v1 uses real Firebase
    // Storage and that label IS correct there. We confirm v1 file
    // still exists and still references Firebase Storage (real use).
    const v1 = readFileSync(resolve(ROOT, 'server/routes/kyc.ts'), 'utf8');
    expect(v1.length).toBeGreaterThan(0);
    // v1 has real bucket.upload / file.save calls — out of scope here.
    expect(v1).toMatch(/(getStorage|bucket\(|\.save\(|file\.save|fileUpload\.save)/);
  });
});

/**
 * M-D regression — DOCUMENT_ENCRYPTION_KEY must be checked at server boot
 * in production, and a missing/short value must be recorded as a startup
 * security violation so /health/strict returns 503 and CI smoke blocks
 * deploy promotion.
 *
 * BEFORE this fix:
 *   server/lib/env-validation.ts:225 defined a hard-stop for this same
 *   secret, but the env-validation module is never imported anywhere in
 *   the server tree — `validateEnv()` never ran, so production could boot
 *   without the key. The gap surfaced only when the first provider KYC
 *   upload threw at runtime (document-security-2025.ts:419 etc).
 *
 * AFTER this fix:
 *   A dedicated IIFE in server/index.ts (assertDocumentEncryptionKeyInProd)
 *   pushes to `_startupSecurityViolations` when NODE_ENV=production and
 *   the key is absent OR shorter than 32 chars. /health/strict surfaces
 *   the violation as HTTP 503, blocking deploy promotion.
 *
 * This source-pin test guarantees the IIFE shape cannot be removed or
 * weakened (e.g. switched to _startupConfigErrors which does not 503).
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'index.ts'),
  'utf8',
);

describe('M-D — DOCUMENT_ENCRYPTION_KEY startup check', () => {
  it('declares a dedicated IIFE that runs at module load', () => {
    expect(SRC).toMatch(/\(function assertDocumentEncryptionKeyInProd\(\)/);
    // Must be invoked immediately, not just declared.
    expect(SRC).toMatch(/\}\)\(\);\s*\n\s*\/\/\s*──\s*Tranzila webhook bypass guard/);
  });

  it('is gated on NODE_ENV === production so dev/test still boots without the key', () => {
    const block = SRC.match(
      /\(function assertDocumentEncryptionKeyInProd[\s\S]*?\}\)\(\);/,
    )?.[0] ?? '';
    expect(block).toMatch(/NODE_ENV === 'production'/);
    expect(block).toMatch(/if \(!isProd\) return;/);
  });

  it('records to _startupSecurityViolations (not _startupConfigErrors) so /health/strict 503s', () => {
    const block = SRC.match(
      /\(function assertDocumentEncryptionKeyInProd[\s\S]*?\}\)\(\);/,
    )?.[0] ?? '';
    expect(block).toMatch(/_startupSecurityViolations\.push/);
    // Must NOT downgrade to ConfigErrors which only mark /health as degraded.
    expect(block).not.toMatch(/_startupConfigErrors\.push/);
  });

  it('checks both absence (missing) AND short length (< 32 chars)', () => {
    const block = SRC.match(
      /\(function assertDocumentEncryptionKeyInProd[\s\S]*?\}\)\(\);/,
    )?.[0] ?? '';
    expect(block).toMatch(/if \(!val\)/);
    expect(block).toMatch(/val\.length < 32/);
  });

  it('does not throw at boot — Cloud Run startup probe must still bind', () => {
    const block = SRC.match(
      /\(function assertDocumentEncryptionKeyInProd[\s\S]*?\}\)\(\);/,
    )?.[0] ?? '';
    // Per the comment at lines 21-36, throwing before app.listen() prevents
    // Cloud Run from ever seeing a listener on the configured port. Record
    // to the security-violations bucket instead.
    expect(block).not.toMatch(/throw new Error/);
    expect(block).not.toMatch(/process\.exit/);
  });
});

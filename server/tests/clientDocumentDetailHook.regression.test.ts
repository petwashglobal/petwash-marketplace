/**
 * Regression pin — client useDocumentDetail hook.
 *
 * Source-anchored to catch:
 *   • the URL drifting from /api/marketplace/documents/:id,
 *   • the outcome union losing its NOT_FOUND / NOT_A_PARTY / ERROR
 *     branches (client would then render a fake "OK" state on a
 *     missing document — §72 violation).
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const HOOK = fs.readFileSync(
  path.resolve(__dirname, '../../client/src/hooks/useDocumentDetail.ts'),
  'utf8',
);

describe('client useDocumentDetail wire', () => {
  it('hits /api/marketplace/documents/:id with URL-encoded id', () => {
    expect(HOOK).toMatch(/\/api\/marketplace\/documents\/\$\{encodeURIComponent\(id!\)\}/);
  });

  it('maps 404 → not_found and 403 → not_a_party', () => {
    expect(HOOK).toContain("'not_found'");
    expect(HOOK).toContain("'not_a_party'");
    expect(HOOK).toContain("code === 404");
    expect(HOOK).toContain("code === 403");
  });

  it('exposes DocumentDetail with the SUMIT-vs-PW issuer discrimination', () => {
    expect(HOOK).toContain("'ISSUER_SUMIT'");
    expect(HOOK).toContain("'ISSUER_PW'");
  });

  it('the query key is the canonical route (so cache stays coherent with server changes)', () => {
    expect(HOOK).toMatch(/queryKey:\s*\[\s*['"]\/api\/marketplace\/documents['"]\s*,\s*id\s*\]/);
  });
});

/**
 * Regression pin — free in-app declaration acceptance (2026-07-25).
 *
 * The Provider Protection Book declarations are self-attestations that don't need
 * DocuSeal. The /:key/accept endpoint records acceptance directly as a COMPLETED
 * signing_sessions row (the format checkProviderDeclarationsSigned reads), so the
 * declaration/payout gate works with no external dependency — while STILL refusing
 * to bind any declaration still marked draft (reviewedByCounsel === false).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(__dirname, '..', 'routes', 'provider-declarations.ts'), 'utf8');
const gate = readFileSync(join(__dirname, '..', 'services', 'providerDeclarationGate.ts'), 'utf8');

describe('in-app declaration acceptance rail', () => {
  it('exposes POST /:key/accept', () => {
    expect(src).toMatch(/router\.post\(\s*'\/:key\/accept'/);
  });
  it('records a COMPLETED signing_sessions row in the gate-readable documentType format', () => {
    const seg = src.slice(src.indexOf("'/:key/accept'"));
    expect(seg).toMatch(/status:\s*'completed'/);
    expect(seg).toMatch(/documentType:\s*declarationDocType\(doc\.key, doc\.version\)/);
    // gate reads: completed status + provider_declaration:key:version documentType
    expect(gate).toMatch(/DECLARATION_DOC_TYPE_PREFIX/);
  });
  it('refuses to bind a draft declaration (reviewedByCounsel gate preserved)', () => {
    const seg = src.slice(src.indexOf("'/:key/accept'"), src.indexOf("'/:key/accept'") + 900);
    expect(seg).toMatch(/!doc\.reviewedByCounsel/);
    expect(seg).toMatch(/PENDING_COUNSEL/);
  });
  it('requires an active affirmation + typed name', () => {
    const seg = src.slice(src.indexOf("'/:key/accept'"), src.indexOf("'/:key/accept'") + 1400);
    expect(seg).toMatch(/accepted === true/);
    expect(seg).toMatch(/signerName/);
  });
  it('hashes the accepted text for integrity', () => {
    const seg = src.slice(src.indexOf("'/:key/accept'"));
    expect(seg).toMatch(/createHash\('sha256'\)/);
  });
});

/**
 * Regression pins — POST /api/legal/accept version + trust invariants
 * (CEO 2026-08-26 correction pass §1, §5, §11).
 *
 * The endpoint is the canonical evidence writer. Three invariants must
 * survive any refactor:
 *
 *   1. `versionExpected` that does NOT match the registry's
 *      `currentVersion` → 410 GONE with `code: 'VERSION_STALE'` and
 *      both `requested` + `current` in the body so the client can
 *      re-render. Silently accepting a stale version would mint
 *      dishonest evidence.
 *
 *   2. The server RESOLVES docVersion + snapshot from the registry —
 *      the client's `snapshotText` is ignored. A `snapshotText` field
 *      on the request MUST not be read into the writer call.
 *
 *   3. Unknown `documentKey` → 400 with a hint pointing at the
 *      registry (the ONE canonical source). No fallback to "just
 *      accept whatever came in".
 *
 * Structural pin — reads the handler source. A behavioral integration
 * test would exercise the same rules end-to-end but requires the full
 * express + firebase mount; this pin catches the diff regressions.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'legal-acceptances.ts'),
  'utf8',
);

describe('/api/legal/accept — version + trust invariants', () => {
  it('rejects stale versionExpected with 410 GONE + VERSION_STALE code', () => {
    // The comparison must be strict `!==` (a permissive `!=` could let
    // number/string coercion slip a mismatched version through).
    expect(SRC).toMatch(/versionExpected\s*&&\s*versionExpected\s*!==\s*doc\.currentVersion/);
    // The rejection status must be 410 (client should re-render, not
    // retry the same payload) and the code must be 'VERSION_STALE'
    // (clients pin on the machine-readable code, not the message).
    expect(SRC).toMatch(/return\s+res\.status\(410\)\.json\(\{[\s\S]*code:\s*['"]VERSION_STALE['"]/);
    // Both `requested` and `current` must be returned so the client
    // can render a diff-aware "the doc changed" prompt.
    expect(SRC).toMatch(/requested:\s*versionExpected/);
    expect(SRC).toMatch(/current:\s*doc\.currentVersion/);
  });

  it('the stale-check runs BEFORE the writer call — 410 must never mint a row', () => {
    // Ordering pin: the 410 branch MUST appear before recordLegalAcceptance.
    // A refactor that hoists the writer above the guard would double-write
    // when the client is on a stale doc.
    const staleIdx = SRC.indexOf('VERSION_STALE');
    const writerIdx = SRC.indexOf('recordLegalAcceptance({');
    expect(staleIdx).toBeGreaterThan(-1);
    expect(writerIdx).toBeGreaterThan(-1);
    expect(staleIdx).toBeLessThan(writerIdx);
  });

  it('server resolves docVersion from the registry — never from the client payload', () => {
    // The writer call uses doc.currentVersion, not versionExpected. A
    // regex that would match a client-derived version is banned.
    expect(SRC).toMatch(/docVersion:\s*doc\.currentVersion/);
    // The schema does not accept a snapshotText field — the client is
    // not trusted to author evidence.
    const schemaBlock = SRC.slice(SRC.indexOf('acceptSchema'), SRC.indexOf('router.post'));
    expect(schemaBlock).not.toMatch(/snapshotText\s*:/);
    // And the writer call passes snapshotText: undefined explicitly.
    expect(SRC).toMatch(/snapshotText:\s*undefined/);
  });

  it('unknown documentKey → 400 with a hint pointing at the registry', () => {
    // Whitelist is derived from the registry (LEGAL_DOCUMENT_KEYS) — no
    // hand-maintained list. A refactor that hard-codes a list breaks
    // this pin.
    expect(SRC).toMatch(/KNOWN_DOCUMENT_KEYS\s*=\s*LEGAL_DOCUMENT_KEYS/);
    // Unknown key → 400 with a hint at the registry.
    expect(SRC).toMatch(/!doc\s*\|\|\s*!KNOWN_DOCUMENT_KEYS\.has\(documentKey\)/);
    expect(SRC).toMatch(/hint:\s*['"]Add the key to shared\/lib\/legalDocumentRegistry\.ts\.['"]/);
  });

  it('language mismatch (not supported by doc) → 400 with supportedLanguages', () => {
    // A dishonest language is dishonest evidence (§3). The handler
    // must return the supported list so the client re-renders in one
    // of the doc's languages.
    expect(SRC).toMatch(/!doc\.languages\.includes\(language\)/);
    expect(SRC).toMatch(/supportedLanguages:\s*doc\.languages/);
  });

  it('writer failure surfaces 500 — never silently mints "you accepted"', () => {
    // AUTHORITATIVE endpoint (§1): a writer failure must NOT fall through
    // to a 200. The handler branches on writeResult.ok and returns 500.
    expect(SRC).toMatch(/if\s*\(!writeResult\.ok\)\s*\{[\s\S]*?res\.status\(500\)/);
    // The 500 response carries the structured errorCode so ops can
    // pair it with LEGAL_ACCEPTANCE_SHADOW_MISSING.
    expect(SRC).toMatch(/errorCode:\s*writeResult\.errorCode/);
  });

  it('trusts req.ip only — never raw X-Forwarded-For', () => {
    // Same rule as PR #2158 for signed provider IPs. A refactor that
    // reads req.headers['x-forwarded-for'] would forge evidence. The
    // comment explaining the rule is allowed; a code lookup is not.
    const writerBlock = SRC.slice(SRC.indexOf('recordLegalAcceptance({'), SRC.indexOf('if (!writeResult'));
    expect(writerBlock).toMatch(/ipAddress:\s*req\.ip/);
    // Ban a header lookup for x-forwarded-for by CODE (not comment).
    expect(writerBlock).not.toMatch(/req\.headers\s*\[\s*['"]x-forwarded-for['"]/i);
    expect(writerBlock).not.toMatch(/req\.get\(\s*['"]x-forwarded-for['"]/i);
  });
});

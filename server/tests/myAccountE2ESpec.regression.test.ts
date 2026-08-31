/**
 * Regression pin — my-account-real-user.e2e.spec.ts must exist and
 * must cover the CEO P0-MY-ACCOUNT #164 discipline: multi-role
 * identity preservation + failure paths (§72 partial-rollback, §12
 * honest surface, 501 server-not-ready).
 *
 * The Playwright runner isn't invoked here; this pin asserts the
 * spec file's SHAPE so the E2E specs never silently disappear.
 * A follow-up commit that deletes the multi-role or 409 test case
 * trips CI.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SPEC_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  'tests',
  'e2e',
  'my-account-real-user.e2e.spec.ts',
);

describe('my-account real-user E2E — spec presence + coverage pin (task #164)', () => {
  it('spec file exists at the canonical path', () => {
    expect(fs.existsSync(SPEC_PATH)).toBe(true);
  });

  it('spec covers the CEO doctrine test names', () => {
    const src = fs.readFileSync(SPEC_PATH, 'utf8');
    // Golden path
    expect(src).toMatch(/opens \/my-account\/canonical and renders every section/);
    expect(src).toMatch(/edit PERSONAL/);
    expect(src).toMatch(/cancel restores the pre-edit value/);
    // Multi-role identity preservation (one human = one profile)
    expect(src).toMatch(/multi-role user.*same UID.*SAME canonical profile/);
    // Failure paths
    expect(src).toMatch(/UPDATE_PARTIAL_ROLLBACK_REQUIRED/);
    expect(src).toMatch(/FIELD_NOT_WRITABLE/);
    expect(src).toMatch(/SERVER_NOT_READY/);
  });

  it('spec asserts against real client testids (matches MyAccountCanonical.tsx source of truth)', () => {
    const src = fs.readFileSync(SPEC_PATH, 'utf8');
    for (const testid of [
      'my-account-canonical-page',
      'section-PERSONAL',
      'section-CONTACT',
      'section-ADDRESS',
      'section-PREFERENCES',
      'edit-PERSONAL',
      'save-PERSONAL',
      'cancel-PERSONAL',
      'input-firstName',
      'value-firstName',
      'saved-pill',
      'partial-pill',
      'rejected-pill',
      'server-not-ready-pill',
    ]) {
      expect(src, `spec missing testid reference: ${testid}`).toContain(testid);
    }
  });

  it('spec asserts the server-persisted snapshot wins over client draft on 409 (§72 anti-drift)', () => {
    const src = fs.readFileSync(SPEC_PATH, 'utf8');
    // The critical anti-pattern the CEO warned against: on a partial
    // rollback the client MUST NOT keep the dirty draft. The spec's
    // failure-path test literally checks the rehydrated snapshot.
    expect(src).toMatch(/client-draft-that-should-not-win/);
    expect(src).toMatch(/Sarah-serverPersisted/);
  });
});

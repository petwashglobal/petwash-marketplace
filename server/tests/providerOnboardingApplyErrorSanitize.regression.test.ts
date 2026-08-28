/**
 * CEO §60 (2026-08-28) — /apply must never ship raw error strings.
 *
 * Prior state: the outer catch for POST /apply used
 *   error.message || 'Failed to submit application'
 * so a Postgres constraint message, a Firebase internal, a Zod issue
 * summary, or a bare Node error like ETIMEDOUT could reach the toast on
 * the applicant's screen. The client's FRIENDLY errorCode map (CEO §60)
 * renders human copy for the five stable codes, but only if the server
 * stops leaking the raw message.
 *
 * Fix: three fixed branches — 23505 → APPLICATION_EXISTS, 23503 →
 * INVALID_REFERENCE, everything else → APPLICATION_FAILED with the
 * neutral "Failed to submit application" copy. `error.message` never
 * appears in a res.json body.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'provider-onboarding.ts'),
  'utf8',
);

describe('POST /apply outer catch — error sanitization (CEO §60)', () => {
  it('the /apply catch NEVER falls back to `error.message` on the response body', () => {
    // Locate the Application submission catch block by its logger line
    // and confirm the sanitizer no longer uses error.message as a
    // fallback. The block ends at the next `router.` declaration.
    const start = SRC.indexOf("logger.error('[Provider Onboarding] Application submission error'");
    expect(start).toBeGreaterThan(0);
    const end = SRC.indexOf('router.', start);
    const block = SRC.slice(start, end);
    // The previous pattern `: error.message || 'Failed to submit...` is
    // banned. A refactor that re-introduces it trips this test.
    expect(block).not.toMatch(/:\s*error\.message\s*\|\|\s*'Failed to submit application'/);
  });

  it('the catch renders exactly three static messages (23505 / 23503 / everything else)', () => {
    const start = SRC.indexOf("logger.error('[Provider Onboarding] Application submission error'");
    const end = SRC.indexOf('router.', start);
    const block = SRC.slice(start, end);
    expect(block).toContain("'An application with these details already exists'");
    expect(block).toContain("'Invalid reference - please check your invite code'");
    // Neutral fallback (matches the FRIENDLY[unknown] copy on the client).
    expect(block).toContain("'Failed to submit application'");
  });

  it('errorCode still maps to APPLICATION_EXISTS / INVALID_REFERENCE / APPLICATION_FAILED', () => {
    // The client's FRIENDLY map reads these codes verbatim — the server
    // MUST NOT rename them silently.
    const start = SRC.indexOf("logger.error('[Provider Onboarding] Application submission error'");
    const end = SRC.indexOf('router.', start);
    const block = SRC.slice(start, end);
    expect(block).toContain("'APPLICATION_EXISTS'");
    expect(block).toContain("'INVALID_REFERENCE'");
    expect(block).toContain("'APPLICATION_FAILED'");
  });

  it('response body carries { error, errorCode } — no `detail` / `constraint` leaked to the client', () => {
    // The full pg detail/constraint go into the SERVER log (already
    // approved) but must never end up on the res.json body — they can
    // reveal schema internals to an attacker.
    const start = SRC.indexOf("logger.error('[Provider Onboarding] Application submission error'");
    const end = SRC.indexOf('router.', start);
    const block = SRC.slice(start, end);
    // The res.json literal must be exactly { error: ..., errorCode }.
    expect(block).toMatch(/res\.status\([^)]+\)\.json\(\{ error: clientMessage, errorCode \}\);/);
    // Ban `.json({ ... detail: ...` / `constraint: ...` inside the block.
    expect(block).not.toMatch(/\.json\(\{[^}]*detail:/);
    expect(block).not.toMatch(/\.json\(\{[^}]*constraint:/);
  });
});

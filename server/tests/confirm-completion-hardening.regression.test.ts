/**
 * PR-CONFIRM-HARDEN-1 — source-text regression pins for the two safe
 * hardening fixes applied to handleConfirmCompletion() in
 * server/routes/booking-requests.ts:
 *
 *   1. Explicit 401 auth guard — the router is mounted with
 *      `optionalFirebaseToken`, so a caller with no session used to fall
 *      through to a misleading 403 ("Only owner can confirm") AFTER a
 *      wasted DB fetch. The hardened path returns 401 at the door.
 *
 *   2. Zod validation on the customer-supplied payload — rating must be
 *      1..5 integer or absent (a confirm without a rating is legal);
 *      review capped at 2000 chars. Rating=0 previously stored
 *      ownerRating="0" in the ledger; now normalizes to "no rating".
 *
 * These are source-text pins (not behavioral tests) — they lock the
 * fixes in place so a later refactor cannot silently regress the
 * hardening. Behavioral verification is out of scope for this PR
 * (would need a Postgres fixture); shipping a source-text pin is the
 * same discipline used by v2-complete-and-escrow-gate.test.ts and
 * booking-complete-email-sms.test.ts for the same file.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '../routes/booking-requests.ts'),
  'utf8',
);

describe('handleConfirmCompletion — hardening pins', () => {
  it('has an explicit 401 auth guard before any DB fetch', () => {
    // The guard block must exist as a coherent unit.
    expect(SRC).toMatch(
      /if\s*\(\s*!userId\s*\)\s*\{\s*return\s+res\.status\(401\)\.json\(\{\s*error:\s*['"`]Authentication required['"`]/,
    );
  });

  it('declares a zod schema for the confirm-completion input payload', () => {
    expect(SRC).toMatch(/confirmCompletionInputSchema\s*=\s*z\.object\(/);
  });

  it('rating field is bounded to int 1..5 in the schema', () => {
    expect(SRC).toMatch(
      /rating:\s*z\.number\(\)\.int\(\)\.min\(1\)\.max\(5\)\.optional\(\)/,
    );
  });

  it('review field is bounded to 2000 chars', () => {
    expect(SRC).toMatch(/review:\s*z\.string\(\)\.max\(2000\)\.optional\(\)/);
  });

  it('handler safeParses req.body and returns 400 on invalid payload', () => {
    expect(SRC).toMatch(
      /confirmCompletionInputSchema\.safeParse\(\s*req\.body\s*\|\|\s*\{\}\s*\)/,
    );
    expect(SRC).toMatch(
      /if\s*\(\s*!parsed\.success\s*\)\s*\{\s*return\s+res\.status\(400\)\.json\(\{\s*error:\s*['"`]Invalid confirmation payload['"`]/,
    );
  });

  it('still gates on status === provider_marked_complete (contract unchanged)', () => {
    expect(SRC).toMatch(
      /if\s*\(\s*booking\.status\s*!==\s*['"`]provider_marked_complete['"`]/,
    );
  });

  it('still enforces owner-only ownership', () => {
    expect(SRC).toMatch(
      /if\s*\(\s*booking\.ownerId\s*!==\s*userId\s*\)\s*\{\s*return\s+res\.status\(403\)/,
    );
  });
});

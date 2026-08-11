/**
 * Google/Apple "join as new" dead-ended at Complete-Profile (2026-08-11).
 *
 * `getWhoami` returns requiredFields = ONLY the missing fields. Social (Google/
 * Apple) signups already have a name (from displayName) + auto-stamped terms, so
 * the only missing field is `phone`. CompleteProfile.tsx therefore omits
 * firstName/lastName from the payload. The server's POST /api/auth/complete-profile
 * then hard-rejected the empty name with 400 NAME_REQUIRED — dead-ending every
 * social signup. Fix: fall back to the name already on the user row; reject only
 * when neither the request NOR the DB row has a name.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(__dirname, '..', 'routes', 'post-login.ts'), 'utf8');

describe('completeProfile falls back to the existing name (social signups)', () => {
  it('does NOT hard-reject on a body-only name check', () => {
    expect(src).not.toMatch(/if \(!firstName \|\| !lastName\) \{\s*return res\.status\(400\)\.json\(\{ error: "NAME_REQUIRED" \}\)/);
  });

  it('resolves an effective name from the request OR the existing user row', () => {
    expect(src).toMatch(/effectiveFirstName\s*=[\s\S]*existingUserRow[\s\S]*firstName/);
    expect(src).toMatch(/effectiveLastName\s*=[\s\S]*existingUserRow[\s\S]*lastName/);
  });

  it('only 400s NAME_REQUIRED when neither source has a name, and persists the effective name', () => {
    expect(src).toMatch(/if \(!effectiveFirstName \|\| !effectiveLastName\)/);
    expect(src).toMatch(/firstName:\s*effectiveFirstName/);
    expect(src).toMatch(/lastName:\s*effectiveLastName/);
  });
});

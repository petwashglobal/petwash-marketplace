/**
 * Issue #153 Mission-3 PR-1 — customer profile verification surface pin.
 *
 * BEFORE this fix:
 *   `/api/session/whoami` returned `emailVerified` (from the Firebase token)
 *   but did NOT surface `phoneVerified` or the user's stored `language` from
 *   Postgres. `client/src/pages/Settings.tsx` had no way to render whether
 *   the user's email or phone had actually been verified, and the customer
 *   could not tell when an OTP/email-verification step had silently failed.
 *
 * AFTER this fix:
 *   - `/api/session/whoami` (server/routes.ts) loads the Postgres user and
 *     adds `phoneVerified`, `phone`, `language` to its response. Read-only.
 *     No change to auth, role, MFA, KYC, or session decisions.
 *   - `client/src/auth/useWhoami.ts` exposes the new fields on the typed
 *     response interface.
 *   - `client/src/pages/Settings.tsx` renders ✓ Verified / ✗ Not verified
 *     badges next to the email field, and adds a phone row with the same
 *     badge when a phone is on file.
 *
 * This source-pin test fails if any of the four guarantees regresses:
 *   1. server response keeps the new fields
 *   2. useWhoami types keep the new fields
 *   3. Settings.tsx renders both verified and unverified badges
 *   4. Settings.tsx exposes the four data-testids assistive tech relies on
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const REPO = path.resolve(__dirname, '..', '..', '..');
const ROUTES_SRC = fs.readFileSync(
  path.resolve(REPO, 'server', 'routes.ts'),
  'utf8',
);
const WHOAMI_HOOK_SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'auth', 'useWhoami.ts'),
  'utf8',
);
const SETTINGS_SRC = fs.readFileSync(
  path.resolve(__dirname, 'Settings.tsx'),
  'utf8',
);

describe('Issue #153 Mission-3 PR-1 — server /api/session/whoami', () => {
  it('still loads the Postgres user before responding', () => {
    expect(ROUTES_SRC).toMatch(
      /storage\.getUser\(decoded\.uid\)\.catch\(\(\)\s*=>\s*null\)/,
    );
  });

  it('adds phoneVerified, phone, and language to the response payload', () => {
    expect(ROUTES_SRC).toMatch(/phoneVerified:\s*\(pgUser as any\)\?\.phoneVerified\s*===\s*true/);
    expect(ROUTES_SRC).toMatch(/phone:\s*\(pgUser as any\)\?\.phone\s*\|\|\s*null/);
    expect(ROUTES_SRC).toMatch(/language:\s*\(pgUser as any\)\?\.language\s*\|\|\s*null/);
  });

  it('preserves the original emailVerified flag from the Firebase token', () => {
    expect(ROUTES_SRC).toMatch(/emailVerified:\s*decoded\.email_verified\s*\|\|\s*false/);
  });
});

describe('Issue #153 Mission-3 PR-1 — useWhoami response type', () => {
  it('exposes phoneVerified, phone, and language on WhoamiResponse', () => {
    expect(WHOAMI_HOOK_SRC).toMatch(/phoneVerified:\s*boolean;/);
    expect(WHOAMI_HOOK_SRC).toMatch(/phone:\s*string\s*\|\s*null;/);
    expect(WHOAMI_HOOK_SRC).toMatch(/language:\s*string\s*\|\s*null;/);
  });
});

describe('Issue #153 Mission-3 PR-1 — Settings.tsx verification badges', () => {
  it('reads whoami from useWhoami so badge state is server-sourced', () => {
    expect(SETTINGS_SRC).toMatch(/useWhoami\(\)/);
    expect(SETTINGS_SRC).toMatch(/whoami\?\.emailVerified/);
    expect(SETTINGS_SRC).toMatch(/whoami\?\.phoneVerified/);
  });

  it('renders both verified and unverified email badges', () => {
    expect(SETTINGS_SRC).toMatch(/data-testid="badge-email-verified"/);
    expect(SETTINGS_SRC).toMatch(/data-testid="badge-email-unverified"/);
  });

  it('renders both verified and unverified phone badges', () => {
    expect(SETTINGS_SRC).toMatch(/data-testid="badge-phone-verified"/);
    expect(SETTINGS_SRC).toMatch(/data-testid="badge-phone-unverified"/);
  });

  it('only renders the phone row when a phone number is on file', () => {
    // The phone block must be guarded by `whoami?.phone &&` so users without
    // a phone don't see an empty / misleading row.
    expect(SETTINGS_SRC).toMatch(/\{whoami\?\.phone\s*&&\s*\(/);
  });

  it('badges have aria-labels in both Hebrew and English (assistive-tech parity)', () => {
    expect(SETTINGS_SRC).toMatch(/aria-label=\{language === 'he' \? 'אימייל מאומת' : 'Email verified'\}/);
    expect(SETTINGS_SRC).toMatch(/aria-label=\{language === 'he' \? 'טלפון מאומת' : 'Phone verified'\}/);
  });
});

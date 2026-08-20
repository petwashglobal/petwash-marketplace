import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Regression pin for agent-7 duplicate-hunt finding (2026-08-20):
//
// server/routes/globalForms.ts declared:
//     import { validateFirebaseToken } from '../franchiseAuth';
//     router.get('/admin/sheets-url', validateFirebaseToken, requireAdminRole, ...);
//
// The `franchiseAuth` variant sets `req.firebaseUid` / `req.firebaseEmail`,
// but `requireAdminRole` in server/lib/adminCheck.ts reads
// `req.firebaseUser?.uid`. They never met — the admin route always returned
// 401 "Authentication required" no matter who called it. Silent dead route
// on an admin surface (mounted at /api/global-forms/admin/sheets-url).
//
// The canonical `validateFirebaseToken` in server/middleware/firebase-auth.ts
// populates `req.firebaseUser` with { uid, email, email_verified } — the exact
// shape `requireAdminRole` expects. Keep the import wired to that one.

const GLOBAL_FORMS_SRC = readFileSync(
  join(__dirname, '..', '..', 'server', 'routes', 'globalForms.ts'),
  'utf8',
);

const ADMIN_CHECK_SRC = readFileSync(
  join(__dirname, '..', '..', 'server', 'lib', 'adminCheck.ts'),
  'utf8',
);

const FRANCHISE_AUTH_SRC = readFileSync(
  join(__dirname, '..', '..', 'server', 'franchiseAuth.ts'),
  'utf8',
);

const FIREBASE_AUTH_MIDDLEWARE_SRC = readFileSync(
  join(__dirname, '..', '..', 'server', 'middleware', 'firebase-auth.ts'),
  'utf8',
);

describe('globalForms.ts admin sheets-url — firebase-auth wiring (agent-7 dup-hunt 2026-08-20)', () => {
  it('imports validateFirebaseToken from middleware/firebase-auth (NOT franchiseAuth)', () => {
    // Canonical middleware — sets req.firebaseUser which requireAdminRole reads.
    expect(GLOBAL_FORMS_SRC).toMatch(
      /import\s*\{\s*validateFirebaseToken\s*\}\s*from\s*['"]\.\.\/middleware\/firebase-auth['"]/,
    );
    // Must not regress to the franchiseAuth variant, which populates
    // req.firebaseUid — a shape requireAdminRole does NOT read.
    expect(GLOBAL_FORMS_SRC).not.toMatch(
      /import\s*\{\s*validateFirebaseToken\s*\}\s*from\s*['"]\.\.\/franchiseAuth['"]/,
    );
  });

  it('/admin/sheets-url is guarded by validateFirebaseToken + requireAdminRole', () => {
    expect(GLOBAL_FORMS_SRC).toMatch(
      /router\.get\(\s*['"]\/admin\/sheets-url['"]\s*,\s*validateFirebaseToken\s*,\s*requireAdminRole\s*,/,
    );
  });

  it('requireAdminRole still reads req.firebaseUser?.uid (contract not moved)', () => {
    // If this ever flips to req.firebaseUid the wrong side of the fix would look
    // correct — pin the read shape so a rename gets caught.
    expect(ADMIN_CHECK_SRC).toMatch(/req\.firebaseUser\?\.uid/);
  });

  it('middleware/firebase-auth validateFirebaseToken sets req.firebaseUser', () => {
    expect(FIREBASE_AUTH_MIDDLEWARE_SRC).toMatch(/req\.firebaseUser\s*=\s*user/);
  });

  it('franchiseAuth validateFirebaseToken still populates req.firebaseUid (different contract)', () => {
    // We keep the franchiseAuth variant untouched — franchise routes still need it.
    // This pin documents the shape mismatch so future refactors see the two
    // co-exist by design and stay wired to the right consumer.
    expect(FRANCHISE_AUTH_SRC).toMatch(/req as any\)\.firebaseUid\s*=/);
  });
});

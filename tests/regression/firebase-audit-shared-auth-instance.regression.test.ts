import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Firebase-audit 2026-08-19 SEV-2 #4:
// client/src/lib/firebase.ts:143 calls `initializeAuth(app, { popupRedirectResolver,
// persistence: [indexedDBLocalPersistence, browserLocalPersistence] })` and
// re-exports the initialised Auth as `auth`.
//
// Six pages were calling raw `getAuth()` from 'firebase/auth' instead of
// importing that shared `auth`. If a lazy-loaded chunk containing one of
// those pages runs BEFORE firebase.ts side-effects (route-based code
// splitting makes this real), getAuth() auto-creates a second Auth
// instance with NO persistence and NO popup-redirect resolver, so:
//   1. currentUser is null immediately after a Google/Apple popup returns
//      (the resolver is missing; sign-in state is written to the wrong
//      Auth instance).
//   2. The user appears "signed out" on THAT page only, but a hard reload
//      of another page shows them signed in.
//
// These pins fail if any of the six files re-introduces the raw pattern.

const FILES = [
  'client/src/pages/ProviderApplicationStatus.tsx',
  'client/src/pages/admin/ProviderKycReview.tsx',
  'client/src/pages/admin/ManagementKycDashboard.tsx',
  'client/src/pages/ProviderDeclarations.tsx',
  'client/src/pages/AdminChatRisk.tsx',
  'client/src/pages/CaseQueue.tsx',
] as const;

describe('firebase-audit 2026-08-19 SEV-2 #4 — shared Auth instance in 6 pages', () => {
  for (const rel of FILES) {
    describe(rel, () => {
      const src = readFileSync(join(__dirname, '..', '..', rel), 'utf8');

      it("imports `auth` from '@/lib/firebase'", () => {
        expect(src).toMatch(/import\s*\{\s*(?:[^}]*,\s*)?auth(?:\s*,[^}]*)?\s*\}\s*from\s*['"]@\/lib\/firebase['"]/);
      });

      it("does NOT import raw getAuth from 'firebase/auth'", () => {
        // Strip line comments so a fix-explaining comment mentioning
        // getAuth() by name doesn't false-positive.
        const stripped = src.replace(/\/\/[^\n]*/g, '');
        expect(stripped).not.toMatch(/from\s*['"]firebase\/auth['"][\s\S]*getAuth/);
        expect(stripped).not.toMatch(/\bgetAuth\s*\(\s*\)/);
      });
    });
  }
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Evil-hunt 2026-08-20 pins — three silent-failure classes on the auth surface:
//
// SEV-1 #1 — ensureServerSession swallowed every error and returned void.
//   The caller's .then(() => sessionDone = true) fired unconditionally, so the
//   background retry loop was SKIPPED after any real failure (5xx, CORS,
//   network). Result: user "signed in" with NO server session, every /api/*
//   401'd, guards bounced to /signin. Root cause of the "signed in then
//   kicked out" reports.
//
// SEV-1 #3 — client Firebase silently boots with placeholder credentials when
//   VITE_FIREBASE_* is missing at build time. initializeApp succeeds, page
//   renders, EVERY auth call throws auth/api-key-not-valid — visible only in
//   DevTools. Root cause of "buttons do nothing" in prod after a bad build.
//   Must fail-hard, not fall back to placeholders.
//
// SEV-2 #7 — /api/auth/signout is intentionally CSRF-protected, but the
//   client never sent a token → 403 EBADCSRFTOKEN → catch swallowed → session
//   cookie stuck 14 days → next user on the device inherited the previous
//   session. Fix: attach Bearer idToken (server's Bearer-skip runs before
//   the CSRF gate) so signout succeeds without weakening CSRF.

const root = (rel: string) => readFileSync(join(__dirname, '..', '..', rel), 'utf8');

describe('auth silent-fail evil-hunt pins', () => {
  describe('AuthProvider — ensureServerSession returns boolean, retry loop keys on it', () => {
    const src = root('client/src/auth/AuthProvider.tsx');

    it('ensureServerSession signature is Promise<boolean>, not Promise<void>', () => {
      expect(src).toMatch(/async function ensureServerSession\([^)]*\):\s*Promise<boolean>/);
    });

    it('success path returns true and non-2xx / catch return false', () => {
      const body = src.match(/async function ensureServerSession[\s\S]*?^}/m)?.[0] ?? '';
      expect(body).toMatch(/return true/);
      // At least two `return false` branches (non-ok + catch).
      const falses = body.match(/return false/g) || [];
      expect(falses.length).toBeGreaterThanOrEqual(2);
    });

    it('caller keys the retry loop on the returned boolean, not a fire-then-set', () => {
      // The old pattern was `ensureServerSession(...).then(() => { sessionDone = true; })`.
      // Any surviving `.then(() => { <var> = true` on ensureServerSession is the bug.
      expect(src).not.toMatch(/ensureServerSession\([^)]*\)\.then\(\(\)\s*=>\s*\{[^}]*=\s*true/);
      // New pattern: `.then((ok) => { sessionOk = ok; })` — the boolean flows through.
      expect(src).toMatch(/ensureServerSession\([^)]*\)\.then\(\(ok\)\s*=>\s*\{\s*sessionOk\s*=\s*ok/);
    });
  });

  describe('firebase.ts — no placeholder fallback for missing config', () => {
    const src = root('client/src/lib/firebase.ts');

    it('does not fabricate a placeholder config when VITE_FIREBASE_* is missing', () => {
      // The specific placeholder values that used to be returned MUST NOT appear
      // as values assigned to a config key any more (they were the API key etc.).
      const stripped = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
      expect(stripped).not.toMatch(/apiKey:\s*['"]placeholder-api-key['"]/);
      expect(stripped).not.toMatch(/projectId:\s*['"]placeholder-project['"]/);
    });

    it('throws a hard error naming the missing fields', () => {
      expect(src).toMatch(/if\s*\(\s*missingFields\.length\s*>\s*0\s*\)/);
      expect(src).toMatch(/throw\s+new\s+Error\s*\(\s*msg\s*\)/);
    });
  });

  describe('AuthProvider — signout POST attaches Bearer idToken', () => {
    const src = root('client/src/auth/AuthProvider.tsx');

    it('/api/auth/signout call includes an Authorization: Bearer header', () => {
      // Find the actual fetch call for /api/auth/signout (skip past comments).
      const fetchCall = src.match(/fetch\(getApiUrl\(['"]\/api\/auth\/signout['"]\)[\s\S]*?\}\s*\)/)?.[0] ?? '';
      expect(fetchCall).toMatch(/Authorization:\s*`Bearer\s*\$\{idToken\}`/);
    });
  });
});

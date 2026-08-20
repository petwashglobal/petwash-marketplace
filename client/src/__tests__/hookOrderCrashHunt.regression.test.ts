/**
 * Frontend crash hunt (2026-08-20) — hook-order regression pin.
 *
 * BEFORE this fix:
 *   Four component files had an imperative early return that skipped every
 *   hook declared BELOW the return, so React threw "Rendered fewer hooks
 *   than expected" (or "Rendered more hooks than during the previous
 *   render") on the render where the auth state resolved — a runtime
 *   crash on every visit for the affected user:
 *
 *     client/src/pages/Dashboard.tsx:480
 *       `if (!whoamiLoading && serverRole === 'provider') return null;`
 *       skipped a useMutation + 6 useQuery + 1 useEffect below → any
 *       provider account hitting /dashboard white-screened.
 *
 *     client/src/pages/CustomerManagement.tsx:167-170
 *       `if (!isAdminLoading && !isAdminAuthenticated) { setLocation…;
 *        return null; }` skipped every useQuery / useMutation below →
 *       /admin/customers crashed as soon as an admin session lapsed.
 *
 *     client/src/pages/LeadManagement.tsx:254-257
 *       Same pattern → /crm/leads crashed as soon as an admin session
 *       lapsed.
 *
 *     client/src/pages/CommunicationCenter.tsx:220-223
 *       Worst case — the early return had no loading guard, so hooks
 *       were skipped on FIRST render and then registered on the second.
 *       React throws "Rendered more hooks than during the previous
 *       render". /crm/communications white-screened on every visit.
 *
 * AFTER this fix:
 *   In each file the early return moves BELOW every hook, and the
 *   redirect side-effect moves into a useEffect. React sees a stable
 *   hook count across renders.
 *
 * This test is a source-text pin: it fails the second the anti-pattern
 * comes back. Behavioural render tests would require mocking Firebase +
 * wouter + i18n + tanstack-query per page — the pin catches the exact
 * mistake at zero infra cost.
 *
 * Not touched (out of scope of this hunt):
 *   - SignUpLuxury.tsx TDZ         → PR #1976
 *   - AuthProvider silent failures → PR #1979
 *   - MobileBottomNav / capabilities → PR #1971
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const readPage = (name: string) =>
  fs.readFileSync(path.resolve(__dirname, '..', 'pages', name), 'utf8');

/** Utility: strip block/line comments (preserve offsets) so our regexes
 *  don't accidentally match text inside the human explanations that
 *  describe the OLD pattern. Strings are kept as-is because the source
 *  regexes reference literal URLs and identifiers. */
function stripComments(src: string): string {
  const out: string[] = new Array(src.length);
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') { out[i] = ' '; i++; }
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      while (i < n - 1 && !(src[i] === '*' && src[i + 1] === '/')) {
        out[i] = src[i] === '\n' ? '\n' : ' '; i++;
      }
      if (i < n - 1) { out[i] = ' '; out[i + 1] = ' '; i += 2; }
      continue;
    }
    // Skip past string literals unchanged (preserve their content).
    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      out[i] = q; i++;
      while (i < n && src[i] !== q) {
        if (src[i] === '\\' && i + 1 < n) {
          out[i] = src[i]; out[i + 1] = src[i + 1]; i += 2; continue;
        }
        out[i] = src[i]; i++;
      }
      if (i < n) { out[i] = q; i++; }
      continue;
    }
    out[i] = c; i++;
  }
  return out.join('');
}

interface HookGuarantee {
  file: string;
  page: string;
  /** identifiers whose useState/useMutation/useQuery/useForm/useEffect
   *  declaration MUST appear before any early-return `return null;` that
   *  references the same auth predicate. Empty string sentinel = "at least
   *  one useEffect is registered before the redirect line". */
  redirectPredicate: RegExp;
  hooksBeforeRedirect: RegExp[];
}

const cases: HookGuarantee[] = [
  {
    file: 'Dashboard.tsx',
    page: '/dashboard',
    redirectPredicate: /serverRole\s*===\s*['"]provider['"]/,
    hooksBeforeRedirect: [
      // The useEffect that performs the redirect must be registered
      /useEffect\(\(\)\s*=>\s*\{[\s\S]{0,200}?serverRole\s*===\s*['"]provider['"]/,
      // The useMutation that used to be skipped by the crash
      /const\s+sendWalletEmailMutation\s*=\s*useMutation\(/,
    ],
  },
  {
    file: 'CustomerManagement.tsx',
    page: '/admin/customers',
    redirectPredicate: /!isAdminAuthenticated/,
    hooksBeforeRedirect: [
      /useEffect\(\(\)\s*=>\s*\{[\s\S]{0,200}?!isAdminAuthenticated/,
      /useQuery\(\{[\s\S]{0,600}?\/api\/admin\/customers/,
    ],
  },
  {
    file: 'LeadManagement.tsx',
    page: '/crm/leads',
    redirectPredicate: /!isAdminAuthenticated/,
    hooksBeforeRedirect: [
      /useEffect\(\(\)\s*=>\s*\{[\s\S]{0,200}?!isAdminAuthenticated/,
      /const\s+leadForm\s*=\s*useForm\(/,
    ],
  },
  {
    file: 'CommunicationCenter.tsx',
    page: '/crm/communications',
    redirectPredicate: /!isAuthenticated/,
    hooksBeforeRedirect: [
      /useEffect\(\(\)\s*=>\s*\{[\s\S]{0,200}?!isAuthenticated/,
      /useQuery<CommunicationStats>/,
    ],
  },
];

describe('Frontend crash hunt (2026-08-20) — no hook after auth-early-return', () => {
  for (const c of cases) {
    describe(`${c.file} (${c.page})`, () => {
      const raw = readPage(c.file);
      const src = stripComments(raw);

      it('performs the redirect from a useEffect (no imperative setLocation+return-null in render)', () => {
        // The anti-pattern is the render-time early exit:
        //   if (<predicate>) { setLocation(<path>); return null; }
        // The `return null` right after setLocation is what makes this a
        // hook-order landmine — the same setLocation INSIDE a useEffect
        // (the fix) doesn't match because a useEffect body doesn't end
        // with an early `return null;`.
        const antiPattern = new RegExp(
          String.raw`if\s*\([^)]*` + c.redirectPredicate.source +
          String.raw`[^)]*\)\s*\{\s*setLocation\([^)]*\)\s*;\s*return\s+null\s*;`,
          'm',
        );
        expect(src, `${c.file}: imperative setLocation + return null in render still present`).not.toMatch(antiPattern);
      });

      it('registers the fix hooks BEFORE any `return null` that uses the same predicate', () => {
        // Find first `return null` whose enclosing `if (...)` references
        // the redirect predicate.
        const returnNullRe = new RegExp(
          String.raw`if\s*\([^)]*` + c.redirectPredicate.source +
          String.raw`[^)]*\)\s*return\s+null\s*;`,
          'm',
        );
        const rn = src.match(returnNullRe);
        expect(rn, `${c.file}: expected an auth-gated \`if (...) return null;\` guard`).not.toBeNull();
        const returnNullOffset = src.indexOf(rn![0]);
        for (const hookRe of c.hooksBeforeRedirect) {
          const hookMatch = src.match(hookRe);
          expect(hookMatch, `${c.file}: expected hook matching ${hookRe} to exist`).not.toBeNull();
          const hookOffset = src.indexOf(hookMatch![0]);
          expect(
            hookOffset,
            `${c.file}: hook ${hookRe} at offset ${hookOffset} must appear BEFORE the \`return null\` at offset ${returnNullOffset}`,
          ).toBeLessThan(returnNullOffset);
        }
      });
    });
  }
});

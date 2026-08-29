/**
 * CEO FLY MODE II §7 (2026-08-29) — Phase F2 wire pins.
 *
 * Locks the shape of the SignUpLuxury Google-popup shortcut: DEV
 * guard FIRST, dynamic import (not top-level), strict null check
 * on the adapter, and stage instrumentation. Any refactor that
 * makes production authentication statically depend on the
 * harness breaks these pins BEFORE the postbuild scanner even runs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = path.resolve(__dirname, '..', '..');

const SIGNUP = fs.readFileSync(
  path.resolve(ROOT, 'client', 'src', 'pages', 'SignUpLuxury.tsx'),
  'utf8',
);

describe('CEO FLY MODE II §7 — SignUpLuxury Phase F2 adapter shortcut', () => {
  it('the adapter branch sits under a Vite DEV compile-time guard', () => {
    // `if (import.meta.env.DEV)` is what Vite eliminates in production.
    // Anything else — a runtime env read, a build flag, a
    // `process.env.NODE_ENV` — would ship the branch to prod.
    expect(SIGNUP).toMatch(/if \(import\.meta\.env\.DEV\)/);
  });

  it('the adapter is loaded via DYNAMIC import — never a top-level static import', () => {
    // The static import `import { getFirebaseTestAdapter } from ...`
    // would pin the adapter into the SignUpLuxury chunk regardless of
    // DEV/PROD. Only the dynamic form inside a DEV branch is safe.
    expect(SIGNUP).toMatch(
      /await import\('@\/lib\/firebaseTestAdapterClient'\)/,
    );
    expect(SIGNUP).not.toMatch(
      /^import \{[^\n]*getFirebaseTestAdapter[^\n]*\} from ['"]@\/lib\/firebaseTestAdapterClient['"]/m,
    );
  });

  it('checks `if (adapter)` — a null return from the probe short-circuits', () => {
    expect(SIGNUP).toMatch(/const adapter = getFirebaseTestAdapter\(\);/);
    expect(SIGNUP).toMatch(/if \(adapter\)/);
  });

  it('records the FIREBASE_TEST_ADAPTER_SHORTCUT stage for auth-journey correlation', () => {
    expect(SIGNUP).toMatch(
      /recordAuthJourneyStage\('FIREBASE_TEST_ADAPTER_SHORTCUT'/,
    );
  });

  it('posts the synthetic ID token to /api/auth/session (harness route-intercepts it)', () => {
    expect(SIGNUP).toMatch(
      /JSON\.stringify\(\{ idToken: adapter\.syntheticIdToken \}\)/,
    );
  });

  it('the shortcut sits BEFORE signInWithPopup — never after', () => {
    // Ordering pin: the whole point is to skip signInWithPopup when
    // the harness is present. A refactor that moves the shortcut
    // below the popup call defeats the purpose.
    const shortcutIdx = SIGNUP.indexOf('FIREBASE_TEST_ADAPTER_SHORTCUT');
    const popupIdx = SIGNUP.indexOf(
      "recordAuthJourneyStage('FIREBASE_POPUP_STARTED'",
    );
    expect(shortcutIdx).toBeGreaterThan(0);
    expect(popupIdx).toBeGreaterThan(0);
    expect(shortcutIdx).toBeLessThan(popupIdx);
  });

  it('the shortcut early-returns — must never fall through into signInWithPopup', () => {
    // A missed `return` would run the popup AFTER the shortcut,
    // which either double-authenticates or dead-ends the flow.
    const shortcutIdx = SIGNUP.indexOf('FIREBASE_TEST_ADAPTER_SHORTCUT');
    const nextPopupIdx = SIGNUP.indexOf(
      "recordAuthJourneyStage('FIREBASE_POPUP_STARTED'",
      shortcutIdx,
    );
    const block = SIGNUP.slice(shortcutIdx, nextPopupIdx);
    // Two returns expected inside the block: the fail() branch and the
    // finishAndRoute() branch. Both must be `return;`.
    const returnMatches = block.match(/\breturn;/g) || [];
    expect(returnMatches.length).toBeGreaterThanOrEqual(2);
  });
});

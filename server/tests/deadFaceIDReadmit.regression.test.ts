/**
 * Regression pin — the dead "auto Face ID" flow must stay dead.
 *
 * Auth-rebuild Phase 10 deleted:
 *   - client/src/hooks/useAutoFaceID.ts
 *   - client/src/components/FaceIDLoadingState.tsx
 *   - client/src/auth/passkey.ts::signInWithPasskeyAuto()
 *
 * The old hook read localStorage['lastPasskeyEmail'], a key NO code path
 * ever wrote. So the "auto Face ID on page load" branch could never
 * actually fire — it was cargo-culted UX theatre. The real returning-
 * user door is now client/src/auth/ReturnLogin.tsx, which calls
 * signInWithPasskey() with the `petwash_passkey_email` hint that the
 * live signup/login paths actually populate.
 *
 * If any of the deleted symbols come back, or a source file starts
 * reading/writing the ghost `lastPasskeyEmail` key, this test fails —
 * forcing the re-introducer to either (a) delete it again, or (b)
 * write the missing producer AND update this pin.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');

const DELETED_FILES = [
  'client/src/hooks/useAutoFaceID.ts',
  'client/src/components/FaceIDLoadingState.tsx',
];

const DELETED_SYMBOLS = [
  'signInWithPasskeyAuto',
  'useAutoFaceID',
  'FaceIDLoadingState',
  'shouldSkipAutoFaceID',
  'getConsecutiveFailures',
  'storeLastAuthMethod',
  'getLastAuthMethod',
  'storePasskeyEmail',
  'clearPasskeyEmail',
];

// The ghost localStorage key nobody populated. If it appears again
// in ANY source file (client or server), fail — that's the exact
// bug this phase deleted.
const GHOST_KEY = 'lastPasskeyEmail';

describe('dead FaceID auto-flow readmit pin', () => {
  it('deleted files must NOT come back', () => {
    for (const rel of DELETED_FILES) {
      expect(existsSync(join(ROOT, rel)), `${rel} was deleted in auth-rebuild Phase 10; do NOT re-add`).toBe(
        false,
      );
    }
  });

  it('deleted symbols must not appear in client/src passkey.ts', () => {
    const passkey = readFileSync(join(ROOT, 'client/src/auth/passkey.ts'), 'utf8');
    for (const sym of DELETED_SYMBOLS) {
      // We check word-boundary matches so we don't false-positive on
      // e.g. signInWithPasskey (the LIVE function) vs signInWithPasskeyAuto.
      const re = new RegExp(`\\b${sym}\\b`);
      expect(re.test(passkey), `passkey.ts must not reintroduce ${sym}`).toBe(false);
    }
  });

  it('ghost localStorage key must not appear anywhere in client source', () => {
    // Walk the small handful of files that had it. If it reappears
    // in a new file, the codemod-in-review sweep will catch it via
    // the existing PII/keyname audit; this pin covers the historic
    // hot spots.
    const CANDIDATES = [
      'client/src/auth/passkey.ts',
      'client/src/auth/ReturnLogin.tsx',
    ];
    for (const rel of CANDIDATES) {
      const path = join(ROOT, rel);
      if (!existsSync(path)) continue;
      const src = readFileSync(path, 'utf8');
      expect(src.includes(GHOST_KEY), `${rel} must not reference the ghost key ${GHOST_KEY}`).toBe(
        false,
      );
    }
  });
});

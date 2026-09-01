/**
 * returnTo canonical-key regression pin (Phase 8, CEO D6).
 *
 * PetWash used to have four incompatible deep-link keys —
 * `?from=` `?redirect=` `?returnTo=` `?next=`. The audit found
 * cross-surface deep-links silently dropped because only one surface
 * accepted a given key. CEO D6 pinned the canonical key at `returnTo`.
 *
 * This pin walks the client tree and asserts:
 *   - client/src/auth/returnTo.ts exists and exports the right symbols
 *   - the isSafeReturnTarget guard behaves correctly on the classic
 *     open-redirect vectors
 *   - the legacy keys stay READ-only (`.get('from')` etc are still
 *     allowed inside auth/returnTo.ts for backward compat, but nobody
 *     ELSE should be reading or writing those keys)
 *
 * When you touch deep-link handling, either use readReturnTo /
 * buildReturnToParam / RETURN_TO_KEY from client/src/auth/returnTo.ts,
 * or add your file to KNOWN_LEGACY_READERS with a Phase 8.x plan.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO_ROOT = join(__dirname, '..', '..');
const CLIENT_SRC = join(REPO_ROOT, 'client', 'src');

/**
 * Files that currently still READ a legacy key. Each entry has an
 * intentional reason. New entries are forbidden — the max-size test
 * below decreases as each entry migrates to the canonical helper.
 */
const KNOWN_LEGACY_READERS: ReadonlySet<string> = new Set([
  // The canonical module — it INTENTIONALLY reads legacy keys during
  // the transition window (readReturnTo falls back to from/redirect/next).
  'client/src/auth/returnTo.ts',
  // SignUpLuxury still reads ?from and ?redirect directly. Migration
  // to readReturnTo is a Phase 8.b client-side task.
  'client/src/pages/SignUpLuxury.tsx',
  // ChooseMode reads ?returnTo directly (already canonical name).
  'client/src/pages/ChooseMode.tsx',
  // WalletDownload reads ?returnTo directly (already canonical name).
  'client/src/pages/WalletDownload.tsx',
  // ExecutiveSuiteGuard reads ?redirect directly. Phase 8.b migration.
  'client/src/components/ExecutiveSuiteGuard.tsx',
  // LegalPage reads ?next directly. Phase 8.b migration.
  'client/src/pages/legal/LegalPage.tsx',
  // CompleteProfile reads ?from directly. Phase 8.b migration.
  'client/src/pages/CompleteProfile.tsx',
  // RequireAuth writes ?from — reader lives elsewhere; keeping the pin
  // exemption pending the Phase 8.b migration to buildReturnToParam.
  'client/src/auth/RequireAuth.tsx',
  // workspaceFromPath.ts reads ?redirect — legacy workspace switcher.
  // Phase 8.b migration to readReturnTo.
  'client/src/lib/workspaceFromPath.ts',
  // PrestigeEnroll.tsx reads ?redirect for post-enrollment landing.
  // Phase 8.b migration to readReturnTo.
  'client/src/pages/PrestigeEnroll.tsx',
]);

/** Walk client/src/ collecting .ts and .tsx files. */
function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx)$/.test(entry)) acc.push(full);
  }
  return acc;
}

const CANONICAL_MODULE = join(CLIENT_SRC, 'auth', 'returnTo.ts');

describe('returnTo canonical-key regression pin', () => {
  it('canonical module exists and exports the expected API', () => {
    expect(existsSync(CANONICAL_MODULE)).toBe(true);
    const src = readFileSync(CANONICAL_MODULE, 'utf8');
    expect(src).toMatch(/export\s+const\s+RETURN_TO_KEY\s*=\s*'returnTo'/);
    expect(src).toMatch(/export\s+function\s+readReturnTo/);
    expect(src).toMatch(/export\s+function\s+buildReturnToParam/);
    expect(src).toMatch(/export\s+function\s+isSafeReturnTarget/);
  });

  it('isSafeReturnTarget defends against the classic open-redirect vectors', async () => {
    const mod = await import('../../client/src/auth/returnTo');
    const { isSafeReturnTarget } = mod;
    expect(isSafeReturnTarget('/booking/ABC')).toBe(true);
    expect(isSafeReturnTarget('/pet-parent/home')).toBe(true);
    // Rejects:
    expect(isSafeReturnTarget('//evil.com/oops')).toBe(false); // protocol-relative
    expect(isSafeReturnTarget('https://evil.com')).toBe(false);
    expect(isSafeReturnTarget('http://evil.com')).toBe(false);
    expect(isSafeReturnTarget('javascript:alert(1)')).toBe(false);
    expect(isSafeReturnTarget('/https://evil.com')).toBe(false);
    expect(isSafeReturnTarget('')).toBe(false);
    expect(isSafeReturnTarget('/')).toBe(true); // root is fine
    expect(isSafeReturnTarget('/booking\r\nX-Header: pwn')).toBe(false); // CRLF
  });

  it('no NEW file reads legacy keys without being in KNOWN_LEGACY_READERS', () => {
    // Look for the specific `.get('from')` / `.get('redirect')` /
    // `.get('next')` patterns on URLSearchParams (or router params
    // that look identical). Legitimate reads of the canonical key
    // (`.get('returnTo')`) are always OK.
    const badPatterns = [
      /\.get\(\s*['"]from['"]\s*\)/,
      /\.get\(\s*['"]redirect['"]\s*\)/,
      /\.get\(\s*['"]next['"]\s*\)/,
    ];
    const clientFiles = walk(CLIENT_SRC);
    const violations: string[] = [];
    for (const abs of clientFiles) {
      const rel = relative(REPO_ROOT, abs);
      if (KNOWN_LEGACY_READERS.has(rel)) continue;
      const src = readFileSync(abs, 'utf8');
      for (const pattern of badPatterns) {
        if (pattern.test(src)) {
          violations.push(`${rel} matched ${pattern}`);
        }
      }
    }
    expect(
      violations,
      'New file(s) reading legacy deep-link keys. Use readReturnTo() from ' +
        'client/src/auth/returnTo.ts instead:\n' + violations.map((v) => '  - ' + v).join('\n'),
    ).toEqual([]);
  });

  it('KNOWN_LEGACY_READERS cannot GROW — Phase 8.b shrinks it', () => {
    // Progressive ceiling. When you migrate a KNOWN_LEGACY_READERS entry
    // to the canonical helper, remove it AND lower this cap by one.
    const ALLOWED_MAX = 10;
    expect(
      KNOWN_LEGACY_READERS.size,
      `KNOWN_LEGACY_READERS has ${KNOWN_LEGACY_READERS.size} entries; ` +
        `Phase 8.a pinned it at ${ALLOWED_MAX}. If you migrated a file, ` +
        'remove it from KNOWN_LEGACY_READERS AND lower the cap.',
    ).toBeLessThanOrEqual(ALLOWED_MAX);
  });
});

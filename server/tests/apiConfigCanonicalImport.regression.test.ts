/**
 * Regression pin — canonical `@/lib/apiConfig` import spelling.
 *
 * CI incident (2026-09-01): two new files landed on
 * `returning-user-auth-architecture` importing `@/lib/api-config`
 * (with a hyphen) — the module does not exist under that name. The
 * canonical file is `client/src/lib/apiConfig.ts`. Vite production
 * build broke on PR #2177 because path aliasing does not tolerate
 * a filename-vs-alias mismatch.
 *
 * This pin walks every client TypeScript source file and refuses:
 *   • any import from `@/lib/api-config`
 *   • any import from `@/lib/api_config`
 *   • any import from `@/lib/APIConfig`
 *
 * so a fresh contributor (or a future auto-refactor) cannot invent a
 * second spelling for a module that already has a canonical home.
 *
 * We also assert positively that the canonical file exists — if
 * someone renames it, this pin fires loud instead of the build going
 * mysteriously red.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const CLIENT_SRC = join(ROOT, 'client', 'src');
const CANONICAL_MODULE = join(CLIENT_SRC, 'lib', 'apiConfig.ts');

const BANNED_SPELLINGS = [
  '@/lib/api-config',
  '@/lib/api_config',
  '@/lib/APIConfig',
  '@/lib/apiconfig',
];

function walkClientSources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next' || entry === 'dist') continue;
      walkClientSources(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('client apiConfig import invariant', () => {
  it('canonical module client/src/lib/apiConfig.ts exists', () => {
    expect(existsSync(CANONICAL_MODULE)).toBe(true);
  });

  it('no client source imports from a non-canonical spelling of apiConfig', () => {
    const files = walkClientSources(CLIENT_SRC);
    const offenders: Array<{ file: string; spelling: string }> = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      for (const banned of BANNED_SPELLINGS) {
        if (src.includes(banned)) {
          offenders.push({ file: file.slice(ROOT.length + 1), spelling: banned });
        }
      }
    }
    expect(offenders, `Non-canonical apiConfig imports found:\n${offenders
      .map((o) => `  ${o.file}: ${o.spelling}`)
      .join('\n')}\nUse '@/lib/apiConfig' (camelCase).`).toEqual([]);
  });
});

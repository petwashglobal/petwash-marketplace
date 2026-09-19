import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 2026-09-19: AddToAppleWallet shipped importing '@/hooks/useLanguage', which
 * does not exist — the hook lives at '@/lib/languageStore'. Nothing local
 * caught it:
 *
 *   • esbuild transform passes — it does not resolve modules.
 *   • `tsc --noEmit -p tsconfig.json` passes — client/src is not in that
 *     project, verified by breaking the import on purpose and getting zero
 *     TS2307s.
 *   • source-reading tests pass — the text is right, the path is not.
 *
 * Only the full vite build failed, in CI, after the PR was open. This guard
 * does the same resolution statically, in milliseconds.
 *
 * Same family as the free-identifier route bug: it builds, it type-checks, it
 * passes tests, and it breaks on the real thing.
 */
const ROOT = path.resolve(__dirname, '..', '..', '..');
const SRC = path.join(ROOT, 'client', 'src');
const EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json', '.css', '.svg', '.png'];

function clientFiles(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) clientFiles(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

describe('every @/ import in the client resolves to a real file', () => {
  it('no unresolvable alias imports', () => {
    const bad: string[] = [];
    const files = clientFiles(SRC);
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)[^'"\n]*from\s*['"](@\/[^'"]+)['"]/g)) {
        const spec = m[1];
        const base = path.join(SRC, spec.slice(2));
        const ok =
          EXTS.some((x) => fs.existsSync(base + x)) ||
          fs.existsSync(base) ||
          EXTS.some((x) => fs.existsSync(path.join(base, 'index' + x)));
        if (!ok) bad.push(`${path.relative(ROOT, f)} -> ${spec}`);
      }
    }
    expect(files.length).toBeGreaterThan(500); // the scan itself works
    expect(bad, `these imports point at nothing:\n${bad.join('\n')}`).toEqual([]);
  });
});

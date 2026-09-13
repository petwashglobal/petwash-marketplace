import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve, join } from 'path';

/**
 * EVERY .pkpass MUST BE SERVED `inline`, NEVER `attachment` (2026-09-12)
 *
 * The CEO tapped "הוסף ל-Apple Wallet" and got
 * **"Safari cannot download this file."**
 *
 * Production logs settled it — the server was fine:
 *
 *   08:09:03.025  GET /api/pass/<token>
 *   08:09:03.843  GET /api/pass/apple/<token>    ← redirected, so certs ARE configured
 *   08:09:04.190  [AppleWallet] Generating pkpass {passId: PW-97A5-DEDF, tier: PREMIUM}
 *   (no error, no 500 — normal traffic resumes at 08:09:07)
 *
 * The pass was built and returned correctly. iOS refused it at the
 * Content-Disposition: a .pkpass marked `attachment` is a file DOWNLOAD, and
 * iOS Safari has no flow to install a downloaded pass. `inline` hands it to
 * Wallet.
 *
 * server/routes/wallet.ts had it right in all four of its responses; one route
 * in pass-universal.ts had drifted to `attachment`. This pin covers every
 * server file so the next one cannot drift either.
 */
const SERVER = resolve(__dirname, '..');

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'tests') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.name.endsWith('.ts')) yield full;
  }
}

describe('Apple Wallet passes are handed to Wallet, not downloaded', () => {
  it('no server file serves a .pkpass as an attachment', () => {
    const offenders: string[] = [];
    for (const file of walk(SERVER)) {
      const raw = readFileSync(file, 'utf8');
      // Cheap pre-filter before the comment-stripping regexes: a file that does not
      // contain BOTH words cannot produce an offending line. Running the block-comment
      // regex over every server file (routes.ts alone is ~17k lines) timed this test
      // out under a loaded parallel run. The assertion itself is unchanged.
      if (!/pkpass/i.test(raw) || !/Content-Disposition/i.test(raw)) continue;
      const src = raw
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');   // the comment explaining this mentions both words
      for (const line of src.split('\n')) {
        if (!/Content-Disposition/i.test(line)) continue;
        if (!/pkpass/i.test(line)) continue;
        if (/attachment/i.test(line)) {
          offenders.push(`${file.slice(SERVER.length + 1)}: ${line.trim()}`);
        }
      }
    }
    expect(
      offenders,
      'A .pkpass served as `attachment` makes iOS answer "Safari cannot download this file".',
    ).toEqual([]);
  }, 60_000);

  it('the universal pass route serves inline', () => {
    const src = readFileSync(resolve(SERVER, 'routes/pass-universal.ts'), 'utf8');
    const line = src.split('\n').find((l) => /Content-Disposition/.test(l) && /pkpass/.test(l)) || '';
    expect(line).toMatch(/inline/);
    expect(line).not.toMatch(/attachment/);
  });

  it('it still sends the Apple pkpass content type', () => {
    // `inline` alone is not enough — iOS routes on the MIME type.
    const src = readFileSync(resolve(SERVER, 'routes/pass-universal.ts'), 'utf8');
    expect(src).toMatch(/application\/vnd\.apple\.pkpass/);
  });
});

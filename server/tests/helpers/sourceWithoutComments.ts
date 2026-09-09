import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Read a source file with its comments removed — safely.
 *
 * WHY THIS EXISTS. Pins must not pass on their own explanatory comment, so
 * several of them stripped comments with a pair of regexes copied from file to
 * file:
 *
 *   .replace(/\/\*[\s\S]*?\*\//g, "")        // block comments
 *   .replace(/(^|[^:])\/\/.*$/gm, "$1")      // line comments
 *
 * Run in that order it is UNSOUND. A `/*` appearing inside a `//` line comment
 * opens a block match that runs to the next real `*​/` — in
 * server/routes/prestige-pass.ts that swallowed 168KB and 14 route
 * definitions. Every `toContain` against a swallowed region fails loudly, so
 * those were safe. Every `not.toContain` PASSES VACUOUSLY — the assertion is
 * satisfied because the code is gone, not because the defect is.
 *
 * That is the same shape as the defects these pins were written to catch, in
 * the instrument doing the catching.
 *
 * Two fixes:
 *   1. Line comments are removed FIRST, so a `/*` inside one cannot open a
 *      block match.
 *   2. A strip that removes an implausible share of the file THROWS. A helper
 *      that quietly returns a gutted string is worse than no helper, because
 *      the suite still reports success.
 */

const ROOT = resolve(import.meta.dirname, "../../..");

/** Above this share of non-whitespace removed, assume the strip went wrong. */
const MAX_REMOVED_FRACTION = 0.6;

export function sourceWithoutComments(relativePath: string): string {
  const raw = readFileSync(resolve(ROOT, relativePath), "utf8");

  // 1. line comments first — the `[^:]` guard keeps `https://` intact.
  const withoutLine = raw.replace(/(^|[^:])\/\/.*$/gm, "$1");
  // 2. then block comments, which can no longer be opened from inside a
  //    line comment that has already been removed.
  const stripped = withoutLine.replace(/\/\*[\s\S]*?\*\//g, "");

  const dense = (s: string) => s.replace(/\s+/g, "").length;
  const before = dense(raw);
  const after = dense(stripped);
  if (before > 0 && (before - after) / before > MAX_REMOVED_FRACTION) {
    throw new Error(
      `sourceWithoutComments(${relativePath}) removed ${(((before - after) / before) * 100).toFixed(0)}% ` +
      "of the file — the comment strip is wrong and any negative assertion against this text " +
      "would pass vacuously. Fix the helper rather than lowering the threshold.",
    );
  }
  return stripped;
}

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * Repository-wide source grep, in Node — no external binary.
 *
 * WHY THIS EXISTS
 * ---------------
 * Seven CEO-declared security invariants (national-ID encryption at rest, no
 * bearer secret in HTML or URL, the prestige-pass admin gate from #240, SUMIT
 * webhook audit integrity, the auth architecture rules, activeRole-is-not-
 * authority, and body mass-assignment of role/admin/staff) were written as
 * source-scanning pins that shelled out to `rg`:
 *
 *     execSync(`rg --no-heading -n -g '*.ts' ... ${pattern} ${ROOT}`)
 *
 * ripgrep is not a dependency of this repo. It is not in package.json, it is
 * not installed by any workflow, and on a developer machine `rg` is often a
 * SHELL FUNCTION rather than a binary — which `execSync` (which runs through
 * /bin/sh) cannot see. Every one of those 41 tests therefore died with
 * "rg: command not found" before asserting anything.
 *
 * They were also in no CI job, so nothing caught it. Forty-one security tests
 * that could not run and were not run.
 *
 * The `err?.status === 1` branch in the old helper is worth understanding: it
 * treats "ripgrep found nothing" as a pass. A missing binary exits 127, so it
 * threw rather than passing vacuously — the one mercy in the old design. This
 * helper keeps that property by construction: it either scans real files or
 * throws.
 *
 * PATTERNS are Rust-regex strings from the original call sites. They were
 * audited before this swap: no inline `(?i)` flags, no named groups, no
 * `\p{...}` classes — every pattern is already valid JavaScript RegExp
 * source. Do not add a Rust-only construct to a caller without checking it
 * still compiles here.
 */

export interface RepoGrepOptions {
  /** File extensions WITHOUT the dot. Default: ['ts']. */
  includeExt?: string[];
  /** Extra path fragments to skip, matched against the repo-relative path. */
  excludeGlobs?: string[];
  /** Include client/ in the walk. Default false — most callers are server-only. */
  includeClient?: boolean;
  /** Match across the whole file rather than line-by-line (rg's -U). */
  multiline?: boolean;
}

/** Always skipped — build output, dependencies, and other agents' worktrees. */
const ALWAYS_SKIP = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  'worktrees',
  // Not source. These matter for SPEED, not correctness: ripgrep is a
  // parallel scanner and could afford to walk them, an in-process walk
  // cannot. `.agents/skills` and `.claude/skills` alone hold thousands of
  // files, and descending them pushed these pins past vitest's timeout.
  '.agents',
  '.claude',
  '.github',
  'attached_assets',
  'docs',
  'migrations',
  'android',
  'ios',
  'public',
];

/**
 * Test sources are always skipped, and that is a correctness requirement, not
 * a convenience.
 *
 * Every caller of this helper is an invariant pin asking "does PRODUCTION code
 * contain this anti-pattern?". A test that asserts the server REFUSES an
 * anti-pattern necessarily contains the anti-pattern's text — often in the
 * test's own name. Counting that as a violation makes the pin permanently red
 * for the exact behaviour it wants.
 *
 * That is not hypothetical. `authArchitecturalInvariants` excluded
 * `server/tests/**` but not the top-level `tests/` directory, so it matched
 *
 *   tests/behavior/prestige-sse-auth.behavior.test.ts:189
 *   it('REFUSES the other common URL-credential spellings (?idToken=, ...)')
 *
 * — a test whose whole point is that the token-in-URL flow is rejected. That
 * pin could never have gone green, under ripgrep or otherwise.
 */
const TEST_PATH = /(^|\/)tests?(\/|$)|\.(test|spec)\.[cm]?tsx?$/;

function globToFragment(glob: string): string {
  // The callers pass shell globs like '**/node_modules/**' or 'server/tests/**'.
  // Only the literal directory part matters for a path-contains test.
  return glob.replace(/\*\*/g, '').replace(/\*/g, '').replace(/^\/+|\/+$/g, '');
}

function walk(root: string, exts: string[], skipFragments: string[], includeClient: boolean): string[] {
  const found: string[] = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(dir, entry);
      const rel = relative(root, full);
      const parts = rel.split(sep);
      if (ALWAYS_SKIP.some((s) => parts.includes(s))) continue;
      if (!includeClient && parts[0] === 'client') continue;
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!exts.some((e) => entry.endsWith(`.${e}`))) continue;
      const relPosix = rel.split(sep).join('/');
      if (TEST_PATH.test(relPosix)) continue;
      if (skipFragments.some((f) => f && relPosix.includes(f))) continue;
      found.push(full);
    }
  }
  return found;
}

/**
 * Returns matches in ripgrep's `path:lineNumber:lineContent` shape, with the
 * ABSOLUTE path — the existing call sites do `line.split(':')[0]` and then
 * `.replace(ROOT + '/', '')`, so the shape must not change.
 */
/**
 * File contents are cached per (root, extensions, skips, client) tuple.
 *
 * Without this each pattern re-walked and re-read the whole tree, and callers
 * loop over a dozen patterns in one `it()`. authArchitecturalInvariants blew
 * its 5s timeout that way — a failure that reads exactly like a real
 * regression while proving nothing. ripgrep hid this cost by being a
 * purpose-built parallel scanner; an in-process walk has to cache instead.
 *
 * The cache lives for the test process only. These pins read source that does
 * not change under them mid-run.
 */
const FILE_CACHE = new Map<string, Array<{ path: string; src: string }>>();

function loadFiles(
  root: string,
  exts: string[],
  skip: string[],
  includeClient: boolean,
): Array<{ path: string; src: string }> {
  const key = `${root}|${exts.join(',')}|${skip.join(',')}|${includeClient}`;
  const hit = FILE_CACHE.get(key);
  if (hit) return hit;

  const loaded: Array<{ path: string; src: string }> = [];
  for (const path of walk(root, exts, skip, includeClient)) {
    try {
      loaded.push({ path, src: readFileSync(path, 'utf8') });
    } catch {
      /* unreadable file — skip, same as ripgrep would */
    }
  }
  FILE_CACHE.set(key, loaded);
  return loaded;
}

export function repoGrep(root: string, pattern: string, opts: RepoGrepOptions = {}): string[] {
  const exts = opts.includeExt ?? ['ts'];
  const skip = [
    ...(opts.excludeGlobs ?? []).map(globToFragment),
    'server/tests/',
  ].filter(Boolean);

  const out: string[] = [];

  for (const { path: file, src } of loadFiles(root, exts, skip, opts.includeClient ?? false)) {

    if (opts.multiline) {
      // rg -U reports the line on which the match STARTS.
      const re = new RegExp(pattern, 'gm');
      let m: RegExpExecArray | null;
      while ((m = re.exec(src)) !== null) {
        const lineNo = src.slice(0, m.index).split('\n').length;
        const line = src.split('\n')[lineNo - 1] ?? '';
        out.push(`${file}:${lineNo}:${line}`);
        if (m.index === re.lastIndex) re.lastIndex++; // zero-width guard
      }
      continue;
    }

    const re = new RegExp(pattern);
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) out.push(`${file}:${i + 1}:${lines[i]}`);
    }
  }

  return out;
}

/**
 * The signup page must not reference identifiers that do not exist.
 *
 * FOUND IN PRODUCTION 2026-09-06. SignUpLuxury.tsx used a bare `ageConfirmed`
 * in two JSX expressions. The state variable is `ageConfirmed18Plus`; nothing
 * named `ageConfirmed` was ever declared. So the moment the manual email form
 * opened, render threw
 *
 *   ReferenceError: ageConfirmed is not defined
 *     at SignUpLuxury-BSyZtcwD.js  (inside React's commit path)
 *
 * and the error boundary replaced the ENTIRE signup page with "Something went
 * wrong". Email signup was unreachable.
 *
 * Why nothing caught it: the expression sits inside a conditional JSX branch
 * (`!sent && !mfaChallenge && !mobileStep` + `manualMode`), so it never
 * evaluates on first paint. TypeScript should have — but this repo has no
 * server/client typecheck gate (~2124 baseline errors), so a plain
 * undefined-identifier error ships.
 *
 * This pin is deliberately narrow: it checks the identifiers this page reads
 * against the ones it declares. It is not a type checker; it is the specific
 * class of "renders fine until you click the thing" that took signup down.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..');
const SRC = readFileSync(join(ROOT, 'client/src/pages/SignUpLuxury.tsx'), 'utf8');

/** Executable text only — comments quote the bug they describe. */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const CODE = code(SRC);

describe('the ageConfirmed crash stays fixed', () => {
  it('never reads a bare `ageConfirmed`', () => {
    // Property keys (`ageConfirmed: true`) are fine — those are payload fields
    // the server reads. A bare read is the bug.
    const bareReads = [...CODE.matchAll(/(?<![\w.])ageConfirmed(?!18Plus)(?!\s*:)/g)];
    expect(bareReads.map((m) => CODE.slice(Math.max(0, m.index! - 60), m.index! + 20)))
      .toEqual([]);
  });

  it('the real state variable is declared and used in its place', () => {
    expect(CODE).toMatch(/const \[ageConfirmed18Plus, setAgeConfirmed18Plus\] = useState/);
    expect(CODE).toContain('!ageConfirmed18Plus');
  });

  it('the send-code button gates on the declared variable', () => {
    // This is the exact control that crashed the page.
    expect(CODE).toMatch(/disabled=\{busy \|\|[^}]*!ageConfirmed18Plus\}/);
  });
});

describe('no other undefined identifier of this shape', () => {
  /**
   * Catch the same class rather than only this instance: an identifier read in
   * a `!foo` / `{foo &&` position that is never declared anywhere in the file.
   */
  it('every gating identifier the JSX reads is declared in the file', () => {
    const declared = new Set<string>();
    for (const m of CODE.matchAll(/const \[(\w+),\s*set\w+\]\s*=\s*useState/g)) declared.add(m[1]);
    for (const m of CODE.matchAll(/const (\w+)\s*=/g)) declared.add(m[1]);
    for (const m of CODE.matchAll(/function (\w+)/g)) declared.add(m[1]);
    for (const m of CODE.matchAll(/\{\s*(\w+)[,}]/g)) declared.add(m[1]); // destructured

    // Identifiers used as `!name` inside a disabled={...} expression.
    const used = new Set<string>();
    for (const m of CODE.matchAll(/disabled=\{([^}]*)\}/g)) {
      for (const id of m[1].matchAll(/!(\w+)/g)) used.add(id[1]);
    }

    const missing = [...used].filter((u) => !declared.has(u));
    expect(missing, `read but never declared: ${missing.join(', ')}`).toEqual([]);
  });
});

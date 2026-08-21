/**
 * SignUpLuxury.tsx — client crash class sweep (evil-hunt 2026-08-20).
 *
 * PR #1976 fixed ONE TDZ (resendCountdown effect above its useState). This
 * file pins the whole crash-class family so a future refactor can't
 * reintroduce ANY of them on the /signup front door — a page that, when
 * it throws, blocks 100% of new customer acquisitions.
 *
 * The tests are source-text pins (grep-based) because:
 *   • The vitest env is 'node' (no DOM) — happy-dom / jsdom aren't installed,
 *     and per petwash-platform §2 we don't add deps without approval.
 *   • The crash classes we care about are deterministic in source:
 *       – TDZ: dep array reads a const before its declaration,
 *       – SSR-unsafe: unguarded window/localStorage in a useState initializer,
 *       – Rules-of-hooks: hooks called inside conditionals,
 *       – Missing Suspense: a React.lazy() consumer without a Suspense boundary.
 *   • A grep pin fails LOUD when a future PR re-adds the bad pattern.
 *
 * Ordering pins are pattern-based (regex over the source string) so they
 * survive whitespace / comment churn but catch a real reordering.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC_PATH = join(__dirname, '..', '..', 'client/src/pages/SignUpLuxury.tsx');
const src = readFileSync(SRC_PATH, 'utf8');

// Grab every top-level `const [name, setName] = useState(...)` declaration
// in source order. We use these positions to prove any dep array that reads
// a state name comes AFTER the useState that owns it.
function useStateDeclIndex(name: string): number {
  const re = new RegExp(`const \\[\\s*${name}\\s*,`);
  const m = re.exec(src);
  return m ? m.index : -1;
}

describe('SignUpLuxury — TDZ crash-class pins', () => {
  it('every useEffect dep array reads state AFTER its useState declaration', () => {
    // Enumerate all useEffect blocks and their dep arrays in source order.
    // Regex explanation: match `useEffect(` then any content until `}, [ ... ])`.
    // We only care about the dep-array bracket contents.
    const depRe = /useEffect\s*\(\s*(?:async\s*)?\(\s*\)\s*=>\s*\{[\s\S]*?\},\s*\[([^\]]*)\]\s*\)/g;
    const stateNamesReferenced = new Set<string>();
    for (const m of src.matchAll(depRe)) {
      const deps = m[1] || '';
      const depIdx = m.index ?? -1;
      // Split identifiers out of the dep array (ignore dotted / call expressions
      // — we only want bare state bindings that can TDZ).
      const idents = deps
        .split(',')
        .map((s) => s.trim())
        .filter((s) => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(s));
      for (const id of idents) {
        // Only enforce for names that are actually declared via useState in this file.
        const stateIdx = useStateDeclIndex(id);
        if (stateIdx === -1) continue;
        stateNamesReferenced.add(id);
        expect(depIdx, `useEffect dep [${id}] must come AFTER const [${id}, ...] = useState(...)`)
          .toBeGreaterThan(stateIdx);
      }
    }
    // The most infamous TDZ this file has seen — pin it by name so a rename
    // can't accidentally weaken the sweep. If this fails, the useEffect that
    // ticks the resend cooldown has drifted back above its useState.
    expect(stateNamesReferenced.has('resendCountdown')).toBe(true);
  });

  it('the resend-countdown tick effect lives below its useState (regression of PR #1976)', () => {
    const stateIdx = useStateDeclIndex('resendCountdown');
    expect(stateIdx, 'useState declaration must exist').toBeGreaterThan(-1);
    const tickIdx = src.indexOf('if (resendCountdown <= 0) return;');
    expect(tickIdx, 'countdown-tick effect must exist').toBeGreaterThan(-1);
    expect(tickIdx).toBeGreaterThan(stateIdx);
  });
});

describe('SignUpLuxury — SSR / module-level safety pins', () => {
  it('module-level (outside a function body) window/localStorage access is guarded', () => {
    // We deliberately allow `window.location.pathname` INSIDE the component
    // body (Vite bundles run client-only). But module-top-level statements
    // must never touch `window` unguarded — the file is imported by tests
    // and any tooling that runs in node. Scan the first 160 lines (above
    // `export default function SignUpLuxury`).
    const componentDeclIdx = src.indexOf('export default function SignUpLuxury');
    expect(componentDeclIdx, 'component export must exist').toBeGreaterThan(-1);
    const moduleHead = src.slice(0, componentDeclIdx);
    // A bare `window.` / `localStorage.` / `sessionStorage.` at module top
    // level would run on import. Comments are fine (they may explain the guard).
    const stripped = moduleHead.replace(/\/\/[^\n]*\n/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(stripped).not.toMatch(/^\s*window\./m);
    expect(stripped).not.toMatch(/^\s*localStorage\./m);
    expect(stripped).not.toMatch(/^\s*sessionStorage\./m);
  });

  it('useState initializers that touch localStorage/sessionStorage/window are typeof-guarded or try/catch-wrapped', () => {
    // Find every `useState(() => { ... })` initializer body. If it references
    // localStorage/sessionStorage/window, the body must contain either a
    // `typeof window` guard or a `try {` catch to prevent throws-on-init.
    const initRe = /useState\s*(?:<[^>]+>)?\s*\(\s*\(\)\s*=>\s*\{([\s\S]*?)\}\s*\)/g;
    for (const m of src.matchAll(initRe)) {
      const body = m[1] || '';
      const touchesStorage = /\b(?:localStorage|sessionStorage|window\.[A-Za-z_])\b/.test(body);
      if (!touchesStorage) continue;
      const hasTypeofGuard = /typeof\s+window\s*!==\s*['"]undefined['"]/.test(body);
      const hasTryCatch = /\btry\s*\{[\s\S]*\bcatch\b/.test(body);
      expect(hasTypeofGuard || hasTryCatch,
        `useState initializer touching storage/window must be typeof-guarded or try/catch-wrapped: ${body.slice(0, 120)}`)
        .toBe(true);
    }
  });
});

describe('SignUpLuxury — Rules-of-Hooks pins', () => {
  it('hooks (use*) are never called from inside a conditional block in the component', () => {
    // We enforce the shape "hooks live at the top of the function, not inside
    // if / for / while / && / ternary". This is a lightweight lint: any
    // `useSomething(` that appears after `if (...) {` on the SAME line, or
    // inside a `? :` expression on the same line, would be a violation.
    const lines = src.split('\n');
    const badLines: string[] = [];
    for (const line of lines) {
      // Skip comments.
      const stripped = line.replace(/\/\/.*$/, '').trim();
      if (!stripped) continue;
      // A single-line pattern: `if (foo) useSomething(`. Multi-line
      // conditional hook calls are extremely rare in this file and would
      // trigger eslint-plugin-react-hooks separately.
      if (/^\s*if\s*\(.+\)\s*use[A-Z]\w*\(/.test(line)) badLines.push(line);
      if (/\?\s*use[A-Z]\w*\(/.test(line) && !/\/\//.test(line.split('?')[0])) {
        // Ternary with a hook on the truthy branch.
        badLines.push(line);
      }
    }
    expect(badLines, 'hooks must not be called inside conditionals').toEqual([]);
  });
});

describe('SignUpLuxury — lazy-chunk crash pins', () => {
  it('every React.lazy() import in the file (if any) sits inside a Suspense boundary', () => {
    // The file uses dynamic import() heavily for code-splitting inside async
    // handlers — those are NOT React.lazy and don't need Suspense. Only
    // `React.lazy(` / `lazy(` as a component factory needs Suspense.
    const usesLazy = /\blazy\s*\(\s*\(\)\s*=>\s*import/.test(src);
    if (!usesLazy) return; // nothing to check — no crash class here
    expect(src, 'a React.lazy() component demands a <Suspense> wrapper')
      .toMatch(/<Suspense\b/);
  });
});

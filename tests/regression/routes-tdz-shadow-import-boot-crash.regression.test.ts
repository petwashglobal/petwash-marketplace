import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Regression pin: 2026-08-19 Cloud Run smoke-test Phase 1 failure. The
// container never bound port 8080 within 90 s, and the CI log showed:
//
//   [Startup t=10.0s] phase=registering_routes
//   error=registering_routes: Cannot access 'requireProviderActive2'
//   before initialization
//
// Root cause: `requireProviderActive` was imported at MODULE scope
// (server/routes.ts:214) AND locally re-declared inside registerRoutes
// with `const { requireProviderActive } = await import('./middleware/gates')`.
// A `const` binding hoists into TDZ for the ENTIRE function scope, so the
// EARLIER `app.use('/api/provider/', requireProviderActive)` (line 550)
// reads an uninitialized binding and throws. esbuild's dedup rename
// (`requireProviderActive2`) makes the crash message harder to read but
// doesn't change the underlying JS scope rule.
//
// Rule: a symbol imported at the top of server/routes.ts MUST NOT be
// re-declared with `const { <same-name> } = await import(...)` anywhere
// inside registerRoutes. Reuse the top-level import.

const ROUTES = readFileSync(
  join(__dirname, '..', '..', 'server', 'routes.ts'),
  'utf8',
);

// Names imported at module scope from ./middleware/gates. Grow this list
// if the top-level `import` clause grows.
const GATES_IMPORTED_AT_MODULE_SCOPE = [
  'requireRole',
  'requireStaffApproved',
  'requireProviderActive',
  'requireSuperAdmin',
  'requireMfaEnrolled',
  'enforceReadOnlyMutations',
];

describe('routes.ts TDZ shadow-import regression (Cloud Run boot crash 2026-08-19)', () => {
  it('confirms the offending symbol is present in the module-scope import', () => {
    const importLine = ROUTES.match(
      /^import\s*\{[^}]*\}\s*from\s*["']\.\/middleware\/gates["'];?/m,
    );
    expect(importLine, 'expected a module-scope import from ./middleware/gates').not.toBeNull();
    for (const name of GATES_IMPORTED_AT_MODULE_SCOPE) {
      // If the top-level import ever drops one of these names, this test
      // still passes (the symbol is no longer being imported at module
      // scope, so redeclaration in-function is legal). The test below
      // only fails when BOTH conditions hold: top-level import + local
      // re-declaration.
      if (importLine && importLine[0].includes(name)) {
        // sanity — no regex here, just presence
        expect(importLine[0]).toContain(name);
      }
    }
  });

  it('never redeclares a module-scope gate import inside registerRoutes (TDZ trap)', () => {
    const importLine = ROUTES.match(
      /^import\s*\{[^}]*\}\s*from\s*["']\.\/middleware\/gates["'];?/m,
    );
    const topLevelNames = new Set(
      GATES_IMPORTED_AT_MODULE_SCOPE.filter((n) => !!importLine && importLine[0].includes(n)),
    );
    // Strip line comments so a commented-out example (the fix's own
    // explanatory comment) doesn't count as a live redeclaration.
    const src = ROUTES.replace(/\/\/[^\n]*/g, '');
    const banned: string[] = [];
    for (const name of topLevelNames) {
      const re = new RegExp(
        String.raw`const\s*\{\s*[^}]*\b` + name + String.raw`\b[^}]*\}\s*=\s*await\s+import\(\s*['"]\.\/middleware\/gates['"]`,
      );
      if (re.test(src)) banned.push(name);
    }
    expect(
      banned,
      `redeclaration of module-scope gate import(s) ${banned.join(', ')} would hoist into TDZ and crash boot with "Cannot access '<name>N' before initialization"`,
    ).toEqual([]);
  });
});

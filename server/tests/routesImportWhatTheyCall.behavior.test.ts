/**
 * A route may not CALL a helper it never IMPORTED (2026-09-18).
 *
 * server/routes/walk-my-pet.ts used beginServiceCardPayment,
 * verifyServiceCardPayment, alertPaidButNotFulfilled and paymentLanguageFor —
 * and imported none of them. The file transpiles (esbuild does not resolve
 * free identifiers) and every test in the suite passed, because the only thing
 * that fails is the request itself: POST /walks/:bookingId/pay threw
 * ReferenceError before it could open the hosted page. A walker's accept sent
 * the customer to a payment that could not start, and the walk sat at
 * payment_pending forever.
 *
 * This walks every route file, collects the names it imports and the names it
 * defines itself, and asserts that any helper exported by server/lib is either
 * imported or locally defined before it is called. It is deliberately narrow —
 * server/lib only, call sites only — so it stays fast and has no false alarms
 * from globals or framework names.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const LIB = resolve(ROOT, 'server/lib');
const ROUTES = resolve(ROOT, 'server/routes');

/** Every function/const exported by server/lib/*.ts, mapped to its module. */
function libExports(): Map<string, string> {
  const out = new Map<string, string>();
  for (const f of readdirSync(LIB).filter((n) => n.endsWith('.ts') && !n.endsWith('.test.ts'))) {
    const src = readFileSync(resolve(LIB, f), 'utf8');
    for (const m of src.matchAll(/^export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)) {
      out.set(m[1], f);
    }
    for (const m of src.matchAll(/^export\s+const\s+([A-Za-z_$][\w$]*)\s*[=:]/gm)) {
      out.set(m[1], f);
    }
  }
  return out;
}

/** Comments are not code: a helper named in prose is not a call. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

/** Names a file brings in — static imports, dynamic destructured imports, requires. */
function importedNames(src: string): Set<string> {
  const names = new Set<string>();
  // Named bindings, including the mixed form `import sgMail, { a, b } from …`.
  for (const m of src.matchAll(/import\s+(?:type\s+)?(?:[A-Za-z_$][\w$]*\s*,\s*)?\{([^}]*)\}\s*from/g)) {
    for (const part of m[1].split(',')) {
      const n = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (n) names.add(n);
    }
  }
  for (const m of src.matchAll(/import\s+(?:type\s+)?([A-Za-z_$][\w$]*)\s*(?:,|from)/g)) names.add(m[1]);
  for (const m of src.matchAll(/(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(?:await\s+import|require)/g)) {
    for (const part of m[1].split(',')) {
      const n = part.trim().split(':').pop()?.trim();
      if (n) names.add(n);
    }
  }
  for (const m of src.matchAll(/import\s*\*\s*as\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  return names;
}

/** Names the file declares itself, so a same-named local never looks missing. */
function localNames(src: string): Set<string> {
  const names = new Set<string>();
  for (const m of src.matchAll(/(?:^|\n)\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of src.matchAll(/(?:^|\n)\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*[=:]/g)) names.add(m[1]);
  return names;
}

const EXPORTS = libExports();

describe('every route calls only what it can reach', () => {
  const files = readdirSync(ROUTES).filter((n) => n.endsWith('.ts') && !n.includes('.test.'));

  it('server/lib exports are discoverable (the scan is not silently empty)', () => {
    expect(EXPORTS.size).toBeGreaterThan(50);
    expect(EXPORTS.has('beginServiceCardPayment')).toBe(true);
    expect(EXPORTS.has('paymentLanguageFor')).toBe(true);
  });

  it.each(files)('%s imports every server/lib helper it calls', (file) => {
    const raw = readFileSync(resolve(ROUTES, file), 'utf8');
    const src = stripComments(raw);
    const imported = importedNames(raw);
    const local = localNames(src);
    const missing: string[] = [];

    for (const [name, module] of EXPORTS) {
      if (imported.has(name) || local.has(name)) continue;
      // A call site: the name followed by "(" and not preceded by a dot
      // (so obj.name(...) and 'name' in a string are not counted).
      const called = new RegExp(`(?<![\\w$.'"\`])${name}\\s*\\(`).test(src);
      if (called) missing.push(`${name} (server/lib/${module})`);
    }

    expect(missing, `${file} calls these without importing them: ${missing.join(', ')}`).toEqual([]);
  });
});

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * BUG CLASS (2026-09-19): a router whose handlers read `req.firebaseUser!.uid`
 * while NOTHING ever populates `req.firebaseUser`.
 *
 * `req.firebaseUser` is only ever assigned inside
 * server/middleware/firebase-auth.ts (validateFirebaseToken /
 * optionalFirebaseToken). Neither is applied globally. When a router applies
 * neither at its mount NOR on the route, `req.firebaseUser` is `undefined`,
 * the `!` assertion is erased at build time, and the handler throws
 * TypeError on its first line — answering 500 to EVERY caller, signed in or
 * not. It compiles, it type-checks, and every unit test that stubs the
 * request passes.
 *
 * Found live: /api/devices (all 7 user handlers — the whole Connected Devices
 * screen) and /api/concierge (/request, /alerts, /onboarding) returned 500 in
 * production. The clients were sending a valid Bearer token the server never
 * read.
 */

const ROOT = path.resolve(__dirname, '..', '..');
const routesSrc = fs.readFileSync(path.join(ROOT, 'server', 'routes.ts'), 'utf8');

const GUARDS = /validateFirebaseToken|optionalFirebaseToken|requireAdmin|requireAuth|requireSuperAdmin/;

/** Every `app.use('/api/...', ...)` mount, with the middleware list as written. */
function mounts(): { prefix: string; middleware: string; ident: string }[] {
  const out: { prefix: string; middleware: string; ident: string }[] = [];
  for (const m of routesSrc.matchAll(/app\.use\(\s*['"](\/api\/[^'"]*)['"]\s*,\s*([^)]*)\)/g)) {
    const ident = (m[2].match(/([A-Za-z_$][\w$]*)(?:\.default)?\s*$/) || [])[1] ?? '';
    out.push({ prefix: m[1], middleware: m[2], ident });
  }
  return out;
}

/** router file for an imported identifier, if it is a ./routes/<file> import */
function fileFor(ident: string): string | null {
  const re = new RegExp(`import\\s+(?:\\{[^}]*\\b${ident}\\b[^}]*\\}|${ident})\\s+from\\s+['"]\\./routes/([\\w.-]+)['"]`);
  const m = routesSrc.match(re);
  if (!m) return null;
  const p = path.join(ROOT, 'server', 'routes', `${m[1]}.ts`);
  return fs.existsSync(p) ? p : null;
}

/** handler blocks in a router file, paired with the middleware on their own line */
function handlers(src: string): { line: number; decl: string; head: string; body: string }[] {
  const lines = src.split('\n');
  const starts: number[] = [];
  lines.forEach((l, i) => { if (/^router\.(get|post|put|patch|delete)\(/.test(l)) starts.push(i); });
  return starts.map((i, n) => ({
    line: i + 1,
    decl: lines[i].trim(),
    head: lines.slice(i, i + 4).join('\n'),
    body: lines.slice(i, n + 1 < starts.length ? starts[n + 1] : lines.length).join('\n'),
  }));
}

describe('routers that read req.firebaseUser must actually be given one', () => {
  it('no handler dereferences req.firebaseUser without a token middleware in its path', () => {
    const broken: string[] = [];

    for (const mount of mounts()) {
      if (GUARDS.test(mount.middleware)) continue; // guarded at the mount — fine
      const file = fileFor(mount.ident);
      if (!file) continue;
      const src = fs.readFileSync(file, 'utf8');
      if (/router\.use\([^)]*(?:validateFirebaseToken|optionalFirebaseToken)/.test(src)) continue;

      for (const h of handlers(src)) {
        if (GUARDS.test(h.head)) continue; // guarded on the route itself — fine
        if (/req\.firebaseUser\s*!/.test(h.body)) {
          broken.push(
            `${path.relative(ROOT, file)}:${h.line} — ${h.decl.slice(0, 54)} ` +
            `(mounted at '${mount.prefix}' with no token middleware) ` +
            `reads req.firebaseUser! → TypeError → 500 for every caller`,
          );
        }
      }
    }

    expect(broken, `\n${broken.join('\n')}\n`).toEqual([]);
  });
});

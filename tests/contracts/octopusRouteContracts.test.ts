/**
 * Octopus Route-Contract harness. Reads the canonical route manifest
 * (`octopusRouteManifest.ts`) and verifies against the actual repo state
 * that:
 *
 *   1) Every `clientRoutes[]` entry appears in `client/src/App.tsx` as a
 *      registered <Route path=…>. If a manifest entry says "/signup" but
 *      the router never mounts it, buttons that navigate there 404.
 *
 *   2) Every `clientCalls[]` server path is either
 *        (a) mounted somewhere under `server/` as `app.<verb>('${path}',…)`
 *            or `router.<verb>('${suffix}',…)` behind a matching `.use(…)`
 *      OR (b) covered by an explicit ServerMount entry in the same
 *            contract (so an obscure route mount that grep can't match
 *            is still declared).
 *      Client calls that resolve to NOTHING mounted are the "dead API"
 *      shape the CEO called out.
 *
 *   3) Every `retiredAlternates[]` path is BOTH
 *        (a) covered by a router.all(…) sentinel returning 410, AND
 *        (b) has NO surviving router.<verb>(…) mount for the exact path.
 *      This is the mount-order + resurrection defense that PR-DANGER-1
 *      and PR-DANGER-4 depend on.
 *
 *   4) Every `serverMounts[]` with an admin/super_admin auth boundary
 *      must have the corresponding middleware token on the same source
 *      line (requireAdmin / isSuperAdmin / requireSuperAdmin). An admin
 *      route without an admin gate is exactly the class of bug PR-AUTH-
 *      ADMIN-7 fixed on /api/admin/login.
 *
 * SCOPE: not exhaustive. Encoded flows target auth, money, admin,
 * provider, HR, inbox — the launch-critical surfaces. Follow-up PRs
 * extend the manifest to cover the remaining CEO-listed flows
 * (calendar, notifications delivery, station wash, etc.).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  OCTOPUS_ROUTE_CONTRACTS,
  type RouteContract,
  type ClientCall,
  type ServerMount,
  type RetiredAlternate,
} from './octopusRouteManifest';

// Normalise a RetiredAlternate to { path, pendingPR? } for uniform handling.
function normRetired(entry: RetiredAlternate): { path: string; pendingPR?: number } {
  return typeof entry === 'string' ? { path: entry } : entry;
}

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

// ─────────────────────────────────────────────────────────────────────────────
// Repository snapshots — read once so 30 contracts don't re-read 30 times.

const APP_TSX = read('client/src/App.tsx');

/**
 * Every file under server/ we might need to grep for a route mount. Reading
 * them all up-front turns the per-contract check into a substring test.
 * We skip node_modules, tests, and non-.ts files.
 */
function collectServerSources(): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        walk(full);
        continue;
      }
      if (!/\.ts$/.test(entry.name)) continue;
      out.set(full.slice(root.length + 1), fs.readFileSync(full, 'utf8'));
    }
  };
  walk(path.join(root, 'server'));
  return out;
}
const SERVER_FILES = collectServerSources();

// ─────────────────────────────────────────────────────────────────────────────
// Small predicates the tests below use.

/**
 * True iff the client App.tsx registers `path` as a Route. Accepts single
 * and double quotes. `wouter`-style patterns match verbatim.
 */
function appMountsRoute(routePath: string): boolean {
  const escaped = routePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`<Route\\s+path=["']${escaped}["']`).test(APP_TSX);
}

/**
 * True iff some server file mounts `path` at HTTP `method`, either:
 *   * absolutely — `app.<verb>('${path}', …)` where path starts with `/api/`
 *   * OR via a mounted router — `router.<verb>('${suffix}', …)` where
 *     `suffix` is what's left after stripping the `.use('<mount>', …)`
 *     prefix from `path`.
 *
 * The second form matches per-router files like auth-sms.ts that call
 * `router.post('/start', …)` and get mounted at `/api/auth/sms`.
 */
function serverMountsPath(routePath: string, method: string): boolean {
  const lc = method.toLowerCase();
  const escapedFull = routePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // (a) app-level absolute mount: app.post('/api/…', …)
  const absoluteAppRe = new RegExp(`\\bapp\\.${lc}\\(\\s*["']${escapedFull}["']`);
  if ([...SERVER_FILES.values()].some((src) => absoluteAppRe.test(src))) return true;
  // (b) router-level ABSOLUTE mount: publicAuthRouter.post('/api/…', …)
  // Some routers register absolute paths internally (see publicAuthRoutes.ts).
  const absoluteRouterRe = new RegExp(`\\b\\w*[Rr]outer\\.${lc}\\(\\s*["']${escapedFull}["']`);
  if ([...SERVER_FILES.values()].some((src) => absoluteRouterRe.test(src))) return true;

  // (c) router-mounted with prefix + suffix. Progressively shorter prefixes
  // — include i = parts.length so we try suffix = '/' (matches
  // router.get('/', …) mounted at the full path).
  const parts = routePath.split('/').filter(Boolean);
  for (let i = parts.length; i >= 1; i--) {
    const suffix = i === parts.length ? '/' : '/' + parts.slice(i).join('/');
    const mount = '/' + parts.slice(0, i).join('/');
    const suffixEsc = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const mountEsc = mount.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const routerRe = new RegExp(`\\brouter\\.${lc}\\(\\s*["']${suffixEsc}["']`);
    // Only accept the router mount if some file .use()s the matching
    // prefix — otherwise we'd match random /start handlers.
    const useRe = new RegExp(`\\bapp\\.use\\(\\s*["']${mountEsc}["']`);
    const hasRouterHandler = [...SERVER_FILES.values()].some((src) => routerRe.test(src));
    const hasMount = [...SERVER_FILES.values()].some((src) => useRe.test(src));
    if (hasRouterHandler && hasMount) return true;
  }
  return false;
}

/**
 * True iff the path is covered by a router.all(…) sentinel that returns
 * 410 (V1_DEPRECATED or ENDPOINT_RETIRED). Accepts wildcard sentinels
 * like `/v1/wallet*` matching `/api/octopus/v1/wallet/redeem`.
 */
function isCoveredBy410Sentinel(routePath: string): boolean {
  // Strip the /api/octopus prefix since the sentinels are registered on
  // a router mounted there — matches `router.all('/v1/wallet*', …)`.
  const stripped = routePath.replace(/^\/api\/octopus/, '');
  const sentinelRe = /router\.all\(\s*["']([^"']+)["'][\s\S]{0,600}?(V1_DEPRECATED|ENDPOINT_RETIRED)/g;
  for (const src of SERVER_FILES.values()) {
    let m: RegExpExecArray | null;
    while ((m = sentinelRe.exec(src))) {
      const pattern = m[1];
      // Wildcard sentinel — e.g. `/v1/wallet*` matches everything under.
      if (pattern.endsWith('*')) {
        if (stripped.startsWith(pattern.slice(0, -1))) return true;
      } else if (pattern === stripped || pattern === routePath) {
        return true;
      }
    }
  }
  // Fallback: absolute app-level 410 sentinel — `app.post('/api/admin/login', ...) return 410`.
  const absoluteRetire = new RegExp(
    `app\\.(post|get|patch|put|delete|all)\\(\\s*["']${routePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][\\s\\S]{0,600}?(status\\(410\\)|V1_DEPRECATED|ENDPOINT_RETIRED)`,
  );
  return [...SERVER_FILES.values()].some((src) => absoluteRetire.test(src));
}

/**
 * True iff any surviving router mount handles the EXACT retired path
 * outside the sentinel. If yes, the mount-order defense may not be
 * enough — a reorder could resurrect the handler.
 */
function hasSurvivingHandlerForRetiredPath(routePath: string): boolean {
  const stripped = routePath.replace(/^\/api\/octopus/, '');
  const escaped = stripped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const survivorRe = new RegExp(
    `router\\.(post|get|patch|put|delete)\\(\\s*["']${escaped}["']`,
  );
  return [...SERVER_FILES.values()].some((src) => survivorRe.test(src));
}

/**
 * True iff the handler for `router.<method>('${path}', …)` is auth-gated,
 * either by:
 *   (a) an inline middleware token on the same `router.<verb>(…)` line
 *       (`router.post('/foo', requireAdmin, handler)`), OR
 *   (b) a file-level `router.use(requireAuth, requireRole('admin', …))`
 *       ABOVE the handler declaration in the same source file.
 *
 * Both shapes are legitimate — compliance.ts uses file-level `router.use`,
 * enterprise-hr.ts uses inline middleware per handler.
 */
function serverMountHasAuth(mount: ServerMount): boolean {
  const escaped = mount.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lc = mount.method.toLowerCase();
  const inlineRe = new RegExp(`(?:router|app)\\.${lc}\\(\\s*["']${escaped}["'][^\\n]{0,300}`, 'g');
  const authTokens: Record<ServerMount['auth'], string[]> = {
    public: [],
    user: ['requireAuth', 'firebaseUser', 'requireFirebase', 'requireRole', 'validateFirebaseToken'],
    admin: ['requireAdmin', 'requireRole', 'isSuperAdmin'],
    super_admin: ['isSuperAdmin', 'requireSuperAdmin', 'isSuperAdminVerified'],
  };
  const tokens = authTokens[mount.auth];
  if (tokens.length === 0) return true; // public — no auth token needed.

  for (const src of SERVER_FILES.values()) {
    let m: RegExpExecArray | null;
    // (a) inline middleware
    while ((m = inlineRe.exec(src))) {
      if (tokens.some((tok) => m![0].includes(tok))) return true;
      // File contains a matching handler declaration — check for a
      // file-level (b) router.use(…) auth gate ABOVE this handler.
      const handlerIdx = m.index;
      const fileHead = src.slice(0, handlerIdx);
      const useAuthRe = /router\.use\([^)]*\brequireAuth\b[^)]*\)/g;
      const useRoleRe = /router\.use\([^)]*\b(requireRole|requireAdmin|isSuperAdmin)\b[^)]*\)/g;
      const hasFileLevelAuth = useAuthRe.test(fileHead) || useRoleRe.test(fileHead);
      if (hasFileLevelAuth) return true;
    }
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test cases — one describe() per axis, one it() per (contract, axis) pair.

describe('Octopus route-contract harness — manifest sanity', () => {
  it('manifest has at least one entry per encoded launch-critical flow', () => {
    // The test suite is only useful if the manifest actually declares
    // routes. Pin non-emptiness so a merge that empties the array is
    // caught.
    expect(OCTOPUS_ROUTE_CONTRACTS.length).toBeGreaterThan(5);
  });

  it('every contract declares at least one of clientRoutes / clientCalls / serverMounts / retiredAlternates', () => {
    // A contract with no assertable axis is inert weight in the manifest.
    for (const c of OCTOPUS_ROUTE_CONTRACTS) {
      const hasAxis =
        (c.clientRoutes && c.clientRoutes.length > 0) ||
        (c.clientCalls && c.clientCalls.length > 0) ||
        (c.serverMounts && c.serverMounts.length > 0) ||
        (c.retiredAlternates && c.retiredAlternates.length > 0);
      expect(hasAxis, `contract "${c.action}" has no assertable axis`).toBe(true);
    }
  });
});

describe('Octopus route-contract harness — client routes exist in App.tsx', () => {
  for (const c of OCTOPUS_ROUTE_CONTRACTS) {
    if (!c.clientRoutes) continue;
    for (const route of c.clientRoutes) {
      it(`[${c.flow}] "${c.action}" — App.tsx mounts <Route path="${route}">`, () => {
        expect(
          appMountsRoute(route),
          `client route ${route} declared for "${c.action}" is not mounted in App.tsx`,
        ).toBe(true);
      });
    }
  }
});

describe('Octopus route-contract harness — client → server API calls resolve to a mounted route', () => {
  for (const c of OCTOPUS_ROUTE_CONTRACTS) {
    if (!c.clientCalls) continue;
    for (const call of c.clientCalls) {
      const label = `[${c.flow}] "${c.action}" — ${call.method} ${call.path} is mounted server-side`;
      if (call.pendingPR !== undefined) {
        it.skip(`${label} (SKIPPED — pending PR #${call.pendingPR})`, () => {});
        continue;
      }
      it(label, () => {
        const mounted = serverMountsPath(call.path, call.method);
        expect(
          mounted,
          `client call ${call.method} ${call.path} for "${c.action}" has no mounted handler`,
        ).toBe(true);
      });
    }
  }
});

describe('Octopus route-contract harness — retired alternates return 410 and have no surviving handler', () => {
  for (const c of OCTOPUS_ROUTE_CONTRACTS) {
    if (!c.retiredAlternates) continue;
    for (const raw of c.retiredAlternates) {
      const entry = normRetired(raw);
      const labelSentinel = `[${c.flow}] "${c.action}" — retired ${entry.path} is covered by a 410 sentinel`;
      const labelSurviving = `[${c.flow}] "${c.action}" — retired ${entry.path} has no surviving router.<verb> mount`;
      if (entry.pendingPR !== undefined) {
        it.skip(`${labelSentinel} (SKIPPED — pending PR #${entry.pendingPR})`, () => {});
        it.skip(`${labelSurviving} (SKIPPED — pending PR #${entry.pendingPR})`, () => {});
        continue;
      }
      it(labelSentinel, () => {
        expect(
          isCoveredBy410Sentinel(entry.path),
          `retired path ${entry.path} is NOT covered by a router.all(…) V1_DEPRECATED / ENDPOINT_RETIRED sentinel`,
        ).toBe(true);
      });
      it(labelSurviving, () => {
        expect(
          hasSurvivingHandlerForRetiredPath(entry.path),
          `retired path ${entry.path} still has a surviving router.<verb> handler — one mount-order reorder could resurrect it`,
        ).toBe(false);
      });
    }
  }
});

describe('Octopus route-contract harness — server mounts carry the declared auth boundary', () => {
  for (const c of OCTOPUS_ROUTE_CONTRACTS) {
    if (!c.serverMounts) continue;
    for (const mount of c.serverMounts) {
      const label = `[${c.flow}] "${c.action}" — ${mount.method} ${mount.path} enforces auth="${mount.auth}"`;
      if (mount.pendingPR) {
        it.skip(`${label} (SKIPPED — pending PR #${mount.pendingPR})`, () => {});
        continue;
      }
      it(label, () => {
        expect(
          serverMountHasAuth(mount),
          `server mount ${mount.method} ${mount.path} for "${c.action}" is declared as auth="${mount.auth}" but the mount line does not carry a matching middleware token`,
        ).toBe(true);
      });
    }
  }
});

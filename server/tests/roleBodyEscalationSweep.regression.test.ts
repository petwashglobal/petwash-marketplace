/**
 * Task 30 — CEO fire order 101-140.
 *
 * ROLE / ACCOUNTTYPE / ISADMIN / ISSTAFF / PERMISSIONS body-field
 * escalation sweep. Any customer-facing route that accepts these
 * fields from req.body is a self-elevation vulnerability.
 *
 * Findings (server-wide grep):
 *
 *   1. `req.body.role` appears in FOUR places, all authorised-admin
 *      contexts:
 *        - station-operators.ts (requireStationRole('owner'))
 *        - kyc2026.ts (requireKYCPermission + requireKYCMFA)
 *        - post-login.ts (ADMIN_APPROVER_EMAIL / isSuperAdmin gate)
 *        - teams.ts (ctx.role === 'admin' | 'franchise_owner')
 *      Each performs an enum allowlist check before assignment.
 *
 *   2. `req.body.accountType`, `req.body.isAdmin`, `req.body.isStaff`,
 *      `req.body.isSuperAdmin`, `req.body.customClaims` — NONE appear
 *      anywhere in server/routes/ or server/services/.
 *
 *   3. profileUpdateSchema (user-profile.ts) is a Zod .object — Zod
 *      strips unknown fields on .safeParse, so even a malicious
 *      client sending role/accountType is dropped before hitting the
 *      DB.
 *
 * Conclusion: no self-elevation surface exists today. This test
 * freezes the state so a future refactor cannot silently add one.
 *
 * NO code change in this PR.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { resolve, join } from 'path';

const ROUTES = resolve(__dirname, '..', 'routes');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}
const ROUTE_FILES = walk(ROUTES);

/**
 * Walk each route file and inspect every `router.post|put|patch` handler.
 * A handler that reads req.body.{role,accountType,isAdmin,isStaff,
 * isSuperAdmin,permissions,customClaims} MUST also invoke an admin-
 * authorisation guard BEFORE the body read.
 */
const SENSITIVE_FIELDS = [
  'role',
  'accountType',
  'isAdmin',
  'isStaff',
  'isSuperAdmin',
  'permissions',
  'customClaims',
];

const AUTH_GUARDS = [
  'requireAdmin',
  'requireSuperAdmin',
  'requireKYCPermission',
  'requireStationRole',
  'requireCEO',
  'requireRole',
  'isSuperAdmin',
  'ADMIN_APPROVER_EMAIL',
  'requireAdminMfa',
  'requireFranchiseAuth',
  'requireStaffPass',
  'ctx.role ===',
  "isAdminRole",
  "STATION_ROLE_VALUES",
];

describe('req.body.role destructures — locked to admin/authorised contexts', () => {
  it('the only route accepting req.body.role has an enum allowlist + station-owner guard', () => {
    const src = readFileSync(resolve(ROUTES, 'station-operators.ts'), 'utf8');
    expect(src).toContain("stationRoleSchema.safeParse(req.body.role");
    expect(src).toContain("requireStationRole('owner')");
    expect(src).toContain("STATION_ROLE_VALUES");
  });

  it('kyc2026 role-assign is gated by requireKYCPermission + requireKYCMFA', () => {
    const src = readFileSync(resolve(ROUTES, 'kyc2026.ts'), 'utf8');
    const idx = src.indexOf("'/admin/roles/assign'");
    expect(idx).toBeGreaterThan(-1);
    const region = src.slice(idx, idx + 600);
    expect(region).toContain("requireKYCPermission('kyc:config:edit')");
    expect(region).toContain('requireKYCMFA()');
  });

  it('post-login role-grant is gated by ADMIN_APPROVER_EMAIL + isSuperAdmin', () => {
    const src = readFileSync(resolve(ROUTES, 'post-login.ts'), 'utf8');
    const idx = src.indexOf("const { targetUserId, role } = req.body");
    expect(idx).toBeGreaterThan(-1);
    const region = src.slice(Math.max(0, idx - 600), idx);
    expect(region).toContain('ADMIN_APPROVER_EMAIL');
    expect(region).toContain('isSuperAdmin');
  });

  it('teams add-user is gated by ctx.role admin | franchise_owner check', () => {
    const src = readFileSync(resolve(ROUTES, 'teams.ts'), 'utf8');
    const idx = src.indexOf("const { userUid, role } = req.body");
    expect(idx).toBeGreaterThan(-1);
    const region = src.slice(Math.max(0, idx - 400), idx);
    expect(region).toContain("ctx.role !== 'admin' && ctx.role !== 'franchise_owner'");
  });
});

describe('no customer route reads sensitive escalation fields from req.body', () => {
  const OFFENDERS: Array<{ file: string; field: string; line: string }> = [];
  for (const file of ROUTE_FILES) {
    const src = readFileSync(file, 'utf8');
    for (const field of SENSITIVE_FIELDS) {
      const rx = new RegExp(`req\\.body\\.${field}\\b`, 'g');
      let m: RegExpExecArray | null;
      while ((m = rx.exec(src)) !== null) {
        // Find the enclosing router.post|put|patch call.
        const beforeMatch = src.slice(0, m.index);
        const lastPost = Math.max(
          beforeMatch.lastIndexOf('router.post('),
          beforeMatch.lastIndexOf('router.put('),
          beforeMatch.lastIndexOf('router.patch('),
          beforeMatch.lastIndexOf('app.post('),
        );
        if (lastPost < 0) continue; // top-of-file — safe
        // Include a healthy window around the handler for the guard check.
        const window = src.slice(lastPost, m.index);
        const hasGuard = AUTH_GUARDS.some(g => window.includes(g));
        if (!hasGuard) {
          const rel = file.replace(ROUTES + '/', 'routes/');
          const lineStart = src.lastIndexOf('\n', m.index) + 1;
          const lineEnd = src.indexOf('\n', m.index);
          OFFENDERS.push({ file: rel, field, line: src.slice(lineStart, lineEnd).trim() });
        }
      }
    }
  }

  it('destructure-form (const { role } = req.body) is also gated when it appears', () => {
    // Same walk on the destructure form.
    for (const file of ROUTE_FILES) {
      const src = readFileSync(file, 'utf8');
      const rx = /const \{[^}]*?\b(role|accountType|isAdmin|isStaff|isSuperAdmin|permissions|customClaims)\b[^}]*?\} = req\.body/g;
      let m: RegExpExecArray | null;
      while ((m = rx.exec(src)) !== null) {
        const beforeMatch = src.slice(0, m.index);
        const lastPost = Math.max(
          beforeMatch.lastIndexOf('router.post('),
          beforeMatch.lastIndexOf('router.put('),
          beforeMatch.lastIndexOf('router.patch('),
          beforeMatch.lastIndexOf('app.post('),
        );
        if (lastPost < 0) continue;
        const window = src.slice(lastPost, m.index);
        const hasGuard = AUTH_GUARDS.some(g => window.includes(g));
        if (!hasGuard) {
          const rel = file.replace(ROUTES + '/', 'routes/');
          const lineStart = src.lastIndexOf('\n', m.index) + 1;
          const lineEnd = src.indexOf('\n', m.index);
          OFFENDERS.push({ file: rel, field: m[1], line: src.slice(lineStart, lineEnd).trim() });
        }
      }
    }
    // Documented non-escalation exceptions:
    //  - mobile-biometric.ts `permissions` — DEVICE PERMISSIONS
    //    ('steps','distance'), not RBAC permissions.
    //  - compliance-brain.ts `role` — SERVICE role passed to the
    //    eligibility engine ('sitter'/'walker'), not stored as user
    //    RBAC role; the endpoint reads it as a matching parameter.
    //  - gps-tracking.ts `role` — GPS-role tag ('customer'/'provider')
    //    stored in a Firestore stamp for proximity matching; used
    //    ONLY for matching, never granted permissions.
    //  - teams.ts `role` — enum-validated ('agent'|'manager') and
    //    gated by the earlier `ctx.role !== 'admin' && ctx.role !==
    //    'franchise_owner'` check (the guard-detection window in this
    //    test only spans the handler body, so the pre-handler check
    //    is not visible via the current heuristic — documented here).
    const WHITELIST = new Set([
      'routes/mobile-biometric.ts:permissions',
      'routes/compliance-brain.ts:role',
      'routes/gps-tracking.ts:role',
      'routes/teams.ts:role',
    ]);
    const filtered = OFFENDERS.filter(o => !WHITELIST.has(`${o.file}:${o.field}`));
    expect(filtered).toEqual([]);
  });
});

describe('profileUpdateSchema (Zod) strips unknown escalation fields', () => {
  it('the schema does not declare role/accountType/isAdmin/etc', () => {
    const src = readFileSync(resolve(ROUTES, 'user-profile.ts'), 'utf8');
    const start = src.indexOf('const profileUpdateSchema = z.object({');
    const end = src.indexOf('});', start);
    const region = src.slice(start, end);
    expect(region).not.toMatch(/\brole:/);
    expect(region).not.toMatch(/\baccountType:/);
    expect(region).not.toMatch(/\bisAdmin:/);
    expect(region).not.toMatch(/\bisStaff:/);
    expect(region).not.toMatch(/\bisSuperAdmin:/);
    expect(region).not.toMatch(/\bcustomClaims:/);
  });

  it('profile update uses .safeParse (unknown fields dropped) not .passthrough', () => {
    const src = readFileSync(resolve(ROUTES, 'user-profile.ts'), 'utf8');
    expect(src).toContain('profileUpdateSchema.safeParse(req.body)');
    expect(src).not.toMatch(/profileUpdateSchema\.passthrough\(\)/);
  });
});

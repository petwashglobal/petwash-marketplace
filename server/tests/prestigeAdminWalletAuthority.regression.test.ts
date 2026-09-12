/**
 * The 25 admin wallet handlers were gated on a claim nothing writes (2026-09-13).
 *
 * Every `/admin/wallet/*` handler in server/routes/prestige-pass.ts ran its own
 * second gate:
 *
 *     const adminUser = await firebaseAuth.getUser(uid).catch(() => null);
 *     if (!(adminUser?.customClaims as any)?.admin) return res.status(403)…
 *
 * `grantAdminClaim()` — the ONLY writer of a boolean `admin` custom claim — was
 * deleted on 2026-06-12 as a privilege-escalation surface
 * (server/lib/adminCheck.ts:95). So the claim exists on nobody, and all 25
 * handlers answered 403 to everyone including the verified super admin: hold
 * release, refund, adjust and support release-hold among them. Fail-closed, so
 * never an escalation — but the admin wallet surface was dead in production.
 *
 * The fix is NOT a widening: the router's own `/admin` gate already requires
 * isSuperAdminVerified, so each handler now re-asserts that same authority.
 *
 * (Originally found and written up in PR #2353, which never merged — the
 * census doc is docs/security/admin-wallet-authority-census-2026-09-10.md in
 * that PR. This pin exists so the phantom gate cannot come back.)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');
const SRC = R('server/routes/prestige-pass.ts');

describe('admin wallet authority is the canonical one', () => {
  it('no handler gates on a boolean `admin` custom claim', () => {
    expect(SRC).not.toMatch(/customClaims as any\)\?\.admin/);
    expect(SRC).not.toMatch(/const isAdmin = !!\(adminUser/);
  });

  it('nothing in the repo writes that claim, so any such gate is dead-closed', () => {
    const adminCheck = R('server/lib/adminCheck.ts');
    expect(adminCheck).toContain('grantAdminClaim() was removed');
    expect(adminCheck).not.toMatch(/export async function grantAdminClaim/);
  });

  it('the router-level /admin gate still requires isSuperAdminVerified', () => {
    expect(SRC).toMatch(/router\.use\('\/admin',/);
    expect(SRC).toContain('if (isSuperAdminVerified(req as any)) return next();');
  });

  it('every /admin/wallet value mover re-asserts isSuperAdminVerified', () => {
    const movers = [
      "'/admin/wallet/release'",
      "'/admin/wallet/refund'",
      "'/admin/wallet/adjust'",
    ];
    for (const route of movers) {
      const at = SRC.indexOf(route);
      expect(at, `${route} not found`).toBeGreaterThan(-1);
      const body = SRC.slice(at, at + 1800);
      expect(body, `${route} must re-assert the canonical gate`)
        .toContain('if (!isSuperAdminVerified(req as any)) return res.status(403)');
    }
  });

  it('isSuperAdminVerified comes from the canonical RBAC module', () => {
    expect(SRC).toContain("import { isSuperAdminVerified } from '../middleware/rbac';");
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Multi-role wiring SEV-1 audit (2026-08-20) — regression pins.
 *
 * Every assertion below guards a fix from the seven findings in the
 * "Fix: multi-role contract" PR. The contract is set in stone at:
 *   shared/lib/userCapabilities.ts:4-7 — "ONE user. Additive capabilities.
 *   No mutation of user.role on mode switch."
 *
 * Any refactor that reintroduces a role mutation, unmounts the capability
 * endpoint, or collapses the client to a single-role branch fails PR CI.
 */

const ROOT = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const SERVER_ROUTES        = read('server/routes.ts');
const ME_CAPABILITIES_FILE = read('server/routes/me-capabilities.ts');
const SERVER_AGGREGATOR    = read('server/lib/userCapabilities.ts');
const SHARED_AGGREGATOR    = read('shared/lib/userCapabilities.ts');
const POST_LOGIN           = read('server/routes/post-login.ts');
const MOBILE_BOTTOM_NAV    = read('client/src/components/MobileBottomNav.tsx');
const USE_ACCOUNT_NAV      = read('client/src/hooks/useAccountNavigation.ts');

describe('multi-role wiring SEV-1 fixes (2026-08-20)', () => {
  // #1 — /api/me/capabilities router mounted on server ---------------------
  it('SEV-1 #1 — server/routes.ts imports the me-capabilities router', () => {
    expect(SERVER_ROUTES).toMatch(/from ["']\.\/routes\/me-capabilities["']/);
  });

  it('SEV-1 #1 — server/routes.ts mounts the me-capabilities router on /api/me', () => {
    // The mount line must reference the imported symbol on the /api/me prefix.
    expect(SERVER_ROUTES).toMatch(
      /app\.use\(\s*['"]\/api\/me['"][^)]*meCapabilitiesRoutes\s*\)/,
    );
  });

  // #2 — the route imports a symbol that ACTUALLY exists ------------------
  it('SEV-1 #2 — me-capabilities.ts imports getUserCapabilities', () => {
    expect(ME_CAPABILITIES_FILE).toMatch(
      /import\s*\{\s*getUserCapabilities\s*\}\s*from\s*['"]\.\.\/lib\/userCapabilities['"]/,
    );
  });

  it('SEV-1 #2 — server/lib/userCapabilities.ts exports getUserCapabilities (the symbol the route imports)', () => {
    expect(SERVER_AGGREGATOR).toMatch(
      /export\s+async\s+function\s+getUserCapabilities\s*\(/,
    );
  });

  // #3 — post-login.ts NEVER mutates users.role on provider approval -------
  it('SEV-1 #3 — post-login.ts contains no `updates.role = \'provider\'` write', () => {
    // The offending write was on line 760 of the pre-fix file. Any variation
    // (double quotes, whitespace) counts.
    expect(POST_LOGIN).not.toMatch(/updates\.role\s*=\s*['"]provider['"]/);
  });

  it('SEV-1 #3 — post-login.ts contains no Firebase custom-claim rewrite to role/accountType=provider', () => {
    // Removing the DB mutation but leaving the Firebase claim rewrite would
    // leave the client seeing role='provider' post-approval — the exact
    // downstream symptom the contract forbids.
    expect(POST_LOGIN).not.toMatch(/setCustomUserClaims\([^)]*role:\s*['"]provider['"]/s);
  });

  // #4 — MobileBottomNav reads CAPABILITIES, not just the single role ------
  it('SEV-1 #4 — MobileBottomNav.tsx imports useUserCapabilities', () => {
    expect(MOBILE_BOTTOM_NAV).toMatch(
      /import\s*\{\s*useUserCapabilities\s*\}\s*from\s*['"]@\/hooks\/useUserCapabilities['"]/,
    );
  });

  it('SEV-1 #4 — MobileBottomNav.tsx branches on capability predicates, not `role === \'provider\'`', () => {
    // The old single-role branch was `const isProvider = role === 'provider';`
    // followed by `isProvider ? PROVIDER_NAV : CUSTOMER_NAV`. Fail if that
    // exact xor pattern reappears.
    expect(MOBILE_BOTTOM_NAV).not.toMatch(/const\s+isProvider\s*=\s*role\s*===\s*['"]provider['"]/);
    // Capability + uiMode must both drive the tab selection.
    expect(MOBILE_BOTTOM_NAV).toMatch(/hasProviderCapability\s*\(/);
    expect(MOBILE_BOTTOM_NAV).toMatch(/hasCustomerCapability\s*\(/);
    expect(MOBILE_BOTTOM_NAV).toMatch(/useUiMode\s*\(/);
  });

  // #5 — useAccountNavigation routes via uiMode, not raw role --------------
  it('SEV-1 #5 — useAccountNavigation.ts imports the uiMode reader', () => {
    expect(USE_ACCOUNT_NAV).toMatch(
      /import\s*\{[^}]*\breadUiMode\b[^}]*\}\s*from\s*['"]@\/lib\/uiMode['"]/,
    );
  });

  it('SEV-1 #5 — useAccountNavigation.ts does NOT force `/provider-os` from `role === \'provider\'` alone', () => {
    // The offending line was `if (role === 'provider') return '/provider-os';`
    // inside routeFromRole. Fail if it re-appears anywhere in the file.
    expect(USE_ACCOUNT_NAV).not.toMatch(
      /role\s*===\s*['"]provider['"]\s*\)\s*return\s*['"]\/provider-os['"]/,
    );
  });

  it('SEV-1 #5 — useAccountNavigation.ts routes provider uiMode → /provider-os', () => {
    // The new capability-driven path must send provider uiMode to /provider-os.
    // (Matches the sync + async resolvers we added.)
    expect(USE_ACCOUNT_NAV).toMatch(/readUiMode\(\)\s*===\s*['"]provider['"]\s*\)\s*return\s*['"]\/provider-os['"]/);
  });

  // #6 — whoami emits roles: string[] computed from capabilities -----------
  it('SEV-1 #6 — whoami no longer collapses roles to `[role]`', () => {
    // The pre-fix line was:
    //   const roles: string[] = Array.from(new Set([role].filter(Boolean)));
    // and it was the ONLY assignment to `roles`. Fail if that exact
    // constructor pattern is the only place `roles` is built.
    // We assert (a) the aggregator import is present and (b) roles is
    // built via rolesFromCapabilities somewhere in the whoami handler.
    expect(SERVER_ROUTES).toMatch(
      /import\s*\{\s*getUserCapabilities\s*\}\s*from\s*['"]\.\/lib\/userCapabilities['"]/,
    );
    expect(SERVER_ROUTES).toMatch(
      /import\s*\{\s*rolesFromCapabilities\s*\}\s*from\s*['"]@shared\/lib\/userCapabilities['"]/,
    );
    expect(SERVER_ROUTES).toMatch(/rolesFromCapabilities\s*\(/);
  });

  it('SEV-1 #6 — shared aggregator exports rolesFromCapabilities in the correct fixed order', () => {
    // The customer/loyalty/provider/staff/admin order is a client contract:
    // consumers can slice or filter and rely on it. The single-file source
    // must define the helper and push tokens in that precise order.
    const marker = SHARED_AGGREGATOR.indexOf('export function rolesFromCapabilities');
    expect(marker).toBeGreaterThan(-1);
    const body = SHARED_AGGREGATOR.slice(marker, marker + 800);
    const positions = ['customer', 'loyalty', 'provider', 'staff', 'admin']
      .map((r) => body.indexOf(`'${r}'`));
    // Each token appears (>-1) and each appears AFTER the previous one.
    for (let i = 0; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(-1);
      if (i > 0) expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }
  });

  // #7 — ONE shape file exists; the other imports (or re-exports) it -------
  it('SEV-1 #7 — the shared canonical shape is the nested one (with staff)', () => {
    expect(SHARED_AGGREGATOR).toMatch(/export\s+interface\s+UserCapabilities\s*\{/);
    expect(SHARED_AGGREGATOR).toMatch(/identity:\s*\{/);
    expect(SHARED_AGGREGATOR).toMatch(/prestige:\s*\{/);
    expect(SHARED_AGGREGATOR).toMatch(/provider:\s*\{/);
    expect(SHARED_AGGREGATOR).toMatch(/staff:\s*\{/);
    expect(SHARED_AGGREGATOR).toMatch(/admin:\s*\{/);
  });

  it('SEV-1 #7 — server aggregator no longer declares its OWN flat UserCapabilities shape', () => {
    // The pre-fix file declared:
    //   export interface UserCapabilities {
    //     userId: string;
    //     customer: boolean;
    //     loyalty: boolean;
    //     provider: boolean;
    //     staff: boolean;
    //     admin: boolean;
    //   }
    // That parallel shape is what the drift was — the file must NOT
    // redeclare the type body; it may only re-export the shared one.
    expect(SERVER_AGGREGATOR).not.toMatch(/export\s+interface\s+UserCapabilities\s*\{[^}]*customer:\s*boolean/s);
    // Positive: the file MUST resolve the shape from the shared source.
    expect(SERVER_AGGREGATOR).toMatch(/from\s*['"]@shared\/lib\/userCapabilities['"]/);
  });

  it('SEV-1 #7 — the pre-fix flat `computeCapabilities` symbol is gone', () => {
    // A drift-preventing pin: if a future refactor re-adds a parallel
    // aggregator by that name, this fails.
    expect(SERVER_AGGREGATOR).not.toMatch(/export\s+async\s+function\s+computeCapabilities\s*\(/);
  });

  // The physical file must still exist (we kept & refactored it, we did not
  // create a rival). If someone deletes it without updating the route, the
  // route's import breaks — a symptom worth guarding directly.
  it('sanity — server/lib/userCapabilities.ts still exists and the route file still points at it', () => {
    expect(existsSync(join(ROOT, 'server/lib/userCapabilities.ts'))).toBe(true);
    expect(ME_CAPABILITIES_FILE).toMatch(/from\s*['"]\.\.\/lib\/userCapabilities['"]/);
  });
});

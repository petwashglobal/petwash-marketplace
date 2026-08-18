/**
 * testBypassHeaders — build the `x-test-user-*` header set the server
 * dev-only auth bypass understands.
 *
 * See server/customAuth.ts:170, server/middleware/gates.ts:78, and
 * requireStaffApproved for the reader-side. `TEST_BYPASS_TOKEN` MUST
 * be set in the shell that launches Playwright OR the returned headers
 * are empty (the server treats missing token as absent bypass — no
 * dev-mode-only surface enabled).
 *
 * Usage in a spec:
 *
 *   import { test } from '@playwright/test';
 *   import { headersForPersona } from './testBypassHeaders';
 *
 *   test.use({ extraHTTPHeaders: headersForPersona('customer') });
 *
 *   test('...', async ({ page }) => { ... });
 *
 * For mixed personas inside one file, use `test.describe.serial` and
 * a `test.beforeEach` that swaps `extraHTTPHeaders` per test.
 */

export type TestUserRole =
  | 'customer'
  | 'provider'
  | 'staff'
  | 'management'
  | 'admin'
  | 'super_admin'
  | 'viewer';

export type TestUserStatus =
  | 'active'
  | 'provider_active'
  | 'staff_active'
  | 'pending'
  | 'suspended';

export interface HeadersForPersonaOptions {
  role?: TestUserRole;
  status?: TestUserStatus;
}

/**
 * Returns the header object to pass through Playwright's
 * `extraHTTPHeaders`. Returns an EMPTY object (safe no-op) when
 * TEST_BYPASS_TOKEN is unset — production runs must never grant
 * the bypass.
 */
export function headersForPersona(
  role: TestUserRole,
  status?: TestUserStatus,
): Record<string, string> {
  const token = process.env.TEST_BYPASS_TOKEN;
  if (!token) return {};
  const headers: Record<string, string> = {
    'x-test-user-bypass': token,
    'x-test-user-role': role,
  };
  if (status) headers['x-test-user-status'] = status;
  return headers;
}

/**
 * True when TEST_BYPASS_TOKEN is set and the harness can plausibly
 * exercise gated routes as a specific persona. Specs can use this in
 * `test.skip(!bypassAvailable(), ...)` to skip cleanly on CI without
 * the fixture.
 */
export function bypassAvailable(): boolean {
  return !!process.env.TEST_BYPASS_TOKEN;
}

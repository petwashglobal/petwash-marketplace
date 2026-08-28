/**
 * testBypassHeaders — mirrors tests/e2e/testBypassHeaders.ts. Kept local
 * to this directory so the new shop-checkout specs are self-contained
 * (the parent may move both trees together, or drop this shim when the
 * top-level e2e/ folder is merged into tests/e2e/).
 *
 * See server/customAuth.ts:170 for the reader-side. `TEST_BYPASS_TOKEN`
 * MUST be set in the shell that launches Playwright OR the returned
 * headers are empty (the server treats missing token as absent bypass —
 * production-safe fail-closed default).
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

export function bypassAvailable(): boolean {
  return !!process.env.TEST_BYPASS_TOKEN;
}

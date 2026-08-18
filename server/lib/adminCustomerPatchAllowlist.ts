/**
 * Admin customer PATCH allowlist — the single source of truth for what a
 * general /api/admin/customers/:id PATCH is allowed to change.
 *
 * Extracted from server/routes.ts so it can be behaviorally tested. Every
 * banned field belongs on a dedicated audited endpoint; see the block
 * comment at the PATCH handler for the full classification.
 *
 * PROFILE fields ONLY. Everything else has been deliberately removed —
 * money balances (PR-DANGER-3 initial pass), identity (email/phone —
 * Firebase↔Postgres drift risk), consent (termsAccepted/marketing/
 * reminders — must be a real user event), security/system (isVerified,
 * lastLogin, authProvider, authProviderId — set by the auth/verification
 * services, never by an admin body write), and loyalty binding
 * (loyaltyProgram — needs enrollment ceremony).
 */

export const ADMIN_CUSTOMER_PATCH_ALLOWED_FIELDS = [
  'firstName',
  'lastName',
  'dateOfBirth',
  'country',
  'gender',
  'petType',
  'profilePictureUrl',
] as const;

export type AdminCustomerPatchField = typeof ADMIN_CUSTOMER_PATCH_ALLOWED_FIELDS[number];

const ALLOWED_SET: ReadonlySet<string> = new Set(ADMIN_CUSTOMER_PATCH_ALLOWED_FIELDS);

/**
 * Filter an incoming admin PATCH body down to the fields on the profile
 * allowlist. Unknown keys are silently dropped — the handler's downstream
 * Zod schema validates the surviving keys.
 *
 * Behavioral guarantees pinned by
 * tests/unit/adminCustomerMoneyFieldsSealed.test.ts:
 *   1. A body with only allowed fields is returned unchanged.
 *   2. A body carrying a banned field returns WITHOUT that field.
 *   3. The return is a NEW object — never the input reference — so the
 *      caller cannot re-attach a banned field by holding the argument.
 *   4. null/undefined/non-object inputs return {} (defensive).
 */
export function filterAdminCustomerPatch(
  body: unknown,
): Partial<Record<AdminCustomerPatchField, unknown>> {
  if (!body || typeof body !== 'object') return {};
  const src = body as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(src)) {
    if (ALLOWED_SET.has(key)) {
      out[key] = src[key];
    }
  }
  return out as Partial<Record<AdminCustomerPatchField, unknown>>;
}

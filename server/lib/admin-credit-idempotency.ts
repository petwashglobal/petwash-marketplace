/**
 * admin-credit-idempotency.ts
 *
 * Pure key-derivation helper for the two admin-credit endpoints
 * (`/api/credit-wallet/credits/add` and `/api/credit-wallet/admin/inject`).
 *
 * Mirrors the PR-W4 `/topup` pattern: prefer an explicit
 * `Idempotency-Key` HTTP header; if absent, fall back to a
 * deterministic body fingerprint so an admin double-click on the same
 * dialog still de-dupes against `walletIdempotencyKeys`.
 *
 * The result is always namespaced under `admincred:<route>:` so it
 * cannot collide with idempotency keys from other endpoints sharing
 * the same table.
 *
 * Pure function. No I/O. Safe to test in isolation.
 */

const PREFIX = 'admincred';

export type AdminCreditRoute = 'credits-add' | 'admin-inject';

/**
 * Build the idempotency key for an admin-credit request.
 *
 * @param route             Which admin endpoint this key is for.
 * @param headerKey         Value of the `Idempotency-Key` request header,
 *                          if the caller supplied one. Wins if non-empty.
 * @param bodyFingerprint   Deterministic body summary used as the
 *                          fallback. Caller SHOULD include all fields
 *                          that affect money flow (target user, credit
 *                          type, amount, source/ticket id, etc.).
 *
 * Returns a string ≤128 chars (the column width on
 * `walletIdempotencyKeys.idempotency_key`). Always returns a string
 * — every admin-credit call gets idempotency protection, even when
 * the caller forgot the header.
 */
export function deriveAdminCreditIdempotencyKey(
  route: AdminCreditRoute,
  headerKey: string | null | undefined,
  bodyFingerprint: string,
): string {
  const fromHeader = headerKey ? headerKey.trim() : '';
  const raw = fromHeader || bodyFingerprint || '';
  const fullPrefix = `${PREFIX}:${route}:`;
  const maxRaw = 128 - fullPrefix.length;
  return `${fullPrefix}${raw.slice(0, Math.max(0, maxRaw))}`;
}

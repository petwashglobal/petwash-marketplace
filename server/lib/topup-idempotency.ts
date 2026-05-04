/**
 * PR-W4 — Idempotency-key derivation for the wallet /topup endpoint.
 *
 * Returns the namespaced key (or null) used to insert a row into
 * `walletIdempotencyKeys` when a /topup request is being processed.
 *
 * Order of preference:
 *   1. `nayaxTxId` from the request body — naturally unique per Nayax
 *      transaction; the canonical idempotency identifier.
 *   2. An explicit `Idempotency-Key` request header — used by the rare
 *      super-admin manual-topup path or by partner integrations.
 *   3. null — no key available; the topup proceeds WITHOUT idempotency
 *      protection. Only the super-admin manual path reaches this branch
 *      (and that path is audit-logged separately).
 *
 * The returned key is namespaced under `topup:` so it cannot collide with
 * idempotency keys written by other endpoints sharing the
 * `walletIdempotencyKeys` table.
 *
 * The key is truncated to fit a 128-char column with the prefix.
 *
 * Pure function. No I/O. Safe to test in isolation.
 */
export function deriveTopupIdempotencyKey(
  nayaxTxId: string | undefined,
  headerKey: string | undefined,
): string | null {
  const fromTx = nayaxTxId ? nayaxTxId.trim() : '';
  const fromHeader = headerKey ? headerKey.trim() : '';
  const raw = fromTx || fromHeader;
  if (!raw) return null;
  // Cap the body so the final value (with the "topup:" prefix) fits in a
  // 128-char column. Prefix is 6 chars, so allow 110 of payload.
  return `topup:${raw.slice(0, 110)}`;
}

/**
 * loyalty-redeem-idempotency.ts
 *
 * Pure key-derivation helper for POST /api/loyalty/rewards/redeem (audit R5).
 *
 * A double-submit of the SAME redeem (double-click / client retry) must mint
 * ONE REWARD-* voucher and debit points ONCE. The de-dupe is keyed by a
 * CLIENT-supplied request id that stays stable across the retry — the server
 * cannot tell a retry from a genuine second redeem without it. The key is
 * namespaced to the (user, reward) pair so it can never be replayed against a
 * different member or reward:
 *
 *   loyalty:redeem:{userId}:{rewardId}:{clientReqId}
 *
 * Returns null when the caller supplied no client request id — the route then
 * mints without an idempotency key (legacy behaviour), rather than inventing a
 * server-random key that could never de-dupe a retry anyway.
 *
 * Pure function. No I/O. Safe to test in isolation.
 */

const PREFIX = 'loyalty:redeem';

/** Column width of user_redemptions.idempotency_key. */
export const LOYALTY_REDEEM_KEY_MAXLEN = 191;

/**
 * Build the idempotency key for a reward-redeem request, or null if the caller
 * gave nothing stable to de-dupe on.
 *
 * @param userId       Authenticated member id (never from the client body).
 * @param rewardId     Reward being redeemed.
 * @param clientReqId  Client-stable request id — the `Idempotency-Key` header
 *                     or a body `clientRequestId`/`idempotencyKey`. Trimmed;
 *                     empty / whitespace-only counts as absent.
 */
export function deriveLoyaltyRedeemIdempotencyKey(
  userId: string,
  rewardId: number | string,
  clientReqId: string | null | undefined,
): string | null {
  const req = typeof clientReqId === 'string' ? clientReqId.trim() : '';
  if (!req) return null;
  const full = `${PREFIX}:${userId}:${rewardId}:${req}`;
  return full.slice(0, LOYALTY_REDEEM_KEY_MAXLEN);
}

/**
 * Wallet top-up Nayax verification (PR-J).
 *
 * Background — forensic audit (PR #202) finding F-05:
 *   server/routes/credit-wallet.ts /topup trusts caller-supplied
 *   `nayaxTxId` and `amountCents` with no Nayax-side verification.
 *   A malicious client could credit themselves any amount with any
 *   string. P0-illegal + fraud risk.
 *
 * Resolution — verify the supplied (nayaxTxId, amountCents, userId)
 * tuple against the locally-recorded nayaxTransactions row before
 * the idempotency lock is acquired. The row is the authoritative
 * server-side record of a Nayax authorisation; if it doesn't exist
 * or doesn't match, the top-up is refused.
 *
 * This mirrors the K9000 wash route's verification pattern
 * (server/routes/k9000.ts:188-216) with two additional, stricter
 * checks that the wash route doesn't need:
 *   • amountCents must match the recorded amount
 *   • customerUid must match the requesting user
 *
 * Boundaries:
 *   • Pure read of the nayaxTransactions table. No money mutation,
 *     no vendor SDK, no process.env, no live Nayax API call.
 *   • Live Nayax API cross-verification is a separate concern owned
 *     by Part 7 (Nayax) of the Financial Core Architecture Spec —
 *     out of scope for PR-J.
 *   • Idempotency / replay / uniqueness-constraint enforcement is
 *     unchanged (already wired in PR-W4 via walletIdempotencyKeys).
 *   • Wallet bucket separation (cash vs e-gift) is unchanged —
 *     Part 3 spec territory.
 *
 * Status semantics (per nayaxTransactions.status enum used elsewhere
 * in the codebase):
 *   initiated → authorized → vend_pending → vend_success → settled
 *   |          |
 *   voided    failed
 *
 * For top-up purposes we accept ONLY authorized + settled — these
 * are the states where Nayax has captured / will capture the funds.
 * Any other status (including vend_pending) means the funds aren't
 * confirmed and the wallet must NOT be credited.
 */

import { db } from '../db';
import { nayaxTransactions } from '@shared/schema';
import { eq } from 'drizzle-orm';

export type WalletTopupVerifyReason =
  | 'invalid_input'
  | 'not_found'
  | 'wrong_status'
  | 'wrong_amount'
  | 'wrong_customer';

export interface WalletTopupVerifyInput {
  userId: string;
  nayaxTxId: string;
  claimedAmountCents: number;
}

export type WalletTopupVerifyResult =
  | {
      ok: true;
      /** The verified DB row. Caller may use it for audit fields. */
      txn: typeof nayaxTransactions.$inferSelect;
    }
  | { ok: false; reason: WalletTopupVerifyReason };

const ACCEPTED_STATUSES = new Set(['authorized', 'settled']);

/**
 * Pluggable DB lookup so unit tests can inject a fixture without
 * a live Postgres. Default uses the canonical Drizzle query.
 */
export type NayaxTransactionLookup = (
  nayaxTxId: string,
) => Promise<typeof nayaxTransactions.$inferSelect | undefined>;

const defaultLookup: NayaxTransactionLookup = async (id) => {
  const [row] = await db
    .select()
    .from(nayaxTransactions)
    .where(eq(nayaxTransactions.id, id))
    .limit(1);
  return row;
};

/**
 * Verify a wallet top-up against the locally-recorded Nayax txn.
 * Returns ok:false with a machine-readable reason on any mismatch
 * so the caller can return a stable HTTP response shape.
 */
export async function verifyNayaxTopup(
  input: WalletTopupVerifyInput,
  lookup: NayaxTransactionLookup = defaultLookup,
): Promise<WalletTopupVerifyResult> {
  const { userId, nayaxTxId, claimedAmountCents } = input;

  if (
    typeof userId !== 'string' ||
    userId.length === 0 ||
    typeof nayaxTxId !== 'string' ||
    nayaxTxId.length === 0 ||
    !Number.isInteger(claimedAmountCents) ||
    claimedAmountCents <= 0
  ) {
    return { ok: false, reason: 'invalid_input' };
  }

  const row = await lookup(nayaxTxId);
  if (!row) {
    return { ok: false, reason: 'not_found' };
  }

  if (!ACCEPTED_STATUSES.has(String(row.status ?? ''))) {
    return { ok: false, reason: 'wrong_status' };
  }

  // amount is decimal(10,2) ⇒ "10.50"; convert to cents and compare exactly.
  const recordedCents = Math.round(parseFloat(String(row.amount)) * 100);
  if (!Number.isFinite(recordedCents) || recordedCents !== claimedAmountCents) {
    return { ok: false, reason: 'wrong_amount' };
  }

  if (!row.customerUid || row.customerUid !== userId) {
    return { ok: false, reason: 'wrong_customer' };
  }

  return { ok: true, txn: row };
}

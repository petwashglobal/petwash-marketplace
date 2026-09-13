/**
 * What SUMIT really sends back after a hosted-page payment, and the one rule
 * that makes a verified payment safe to fulfil.
 *
 * PINNED TO SUMIT'S OFFICIAL SCHEMA (2026-09-13, api.sumit.co.il/swagger):
 *   BeginRedirect.RedirectURL — "The following parameters will be added to the
 *   URL: OG-CustomerID, OG-PaymentID, OG-ExternalIdentifier".
 * Every return handler read `req.query.ID`, which SUMIT never sends, so a
 * customer who really paid came back with an empty id and was shown "payment
 * failed". `ID` is still accepted after OG-PaymentID for links already issued.
 *
 * ONE PAYMENT, ONE ORDER. The official Payment object carries NO external
 * identifier (fields: ID, CustomerID, Date, ValidPayment, Status, Amount,
 * PaymentMethod, AuthNumber, …). So `sumitExternalRefMismatch()` can never find
 * a reference to compare and always lets the payment through — the
 * "pay once, replay against another unpaid order" defence was inert. The
 * OG-ExternalIdentifier in the URL is attacker-controlled, so it cannot bind.
 * What does bind: a durable, primary-keyed claim. The first order to fulfil
 * from a SUMIT PaymentID owns it for ever; any other order is refused, on any
 * surface (wallet top-up, guest eGift, booking, save-card). Together with the
 * amount comparison this closes the replay: one real payment can pay for one
 * order of exactly that amount.
 *
 * FAIL CLOSED: if the claim cannot be written (DB down, table missing) the
 * order is NOT fulfilled. The payment is real, so callers log it at error level
 * for reconciliation rather than silently dropping it.
 */
import { sql } from 'drizzle-orm';
import { logger } from './logger';
import { parseSumitPaymentId } from './sumitPaymentId';

export function readSumitPaymentIdFromReturn(query: Record<string, unknown>): string {
  const candidate = query['OG-PaymentID'] ?? query['ID'] ?? query['id'];
  const first = Array.isArray(candidate) ? candidate[0] : candidate;
  const id = parseSumitPaymentId(first);
  return id === null ? '' : String(id);
}

export type SumitPaymentClaim = 'claimed' | 'same_order' | 'other_order' | 'unavailable';

type Executor = { execute: (q: ReturnType<typeof sql>) => Promise<{ rows: unknown[] }> };

export async function claimSumitPayment(
  paymentId: string,
  orderRef: string,
  surface: 'wallet_purchase' | 'egift_guest' | 'booking' | 'save_card',
  database?: Executor,
): Promise<SumitPaymentClaim> {
  const id = parseSumitPaymentId(paymentId);
  if (id === null || !orderRef) return 'unavailable';
  try {
    const exec: Executor = database ?? ((await import('../db')).db as unknown as Executor);
    const inserted = await exec.execute(sql`
      INSERT INTO sumit_payment_claims (payment_id, order_ref, surface)
      VALUES (${id}, ${orderRef}, ${surface})
      ON CONFLICT (payment_id) DO NOTHING
      RETURNING payment_id
    `);
    if (inserted.rows.length > 0) return 'claimed';

    const existing = await exec.execute(sql`
      SELECT order_ref, surface FROM sumit_payment_claims WHERE payment_id = ${id} LIMIT 1
    `);
    const row = existing.rows[0] as { order_ref?: string; surface?: string } | undefined;
    if (!row) return 'unavailable';
    return row.order_ref === orderRef && row.surface === surface ? 'same_order' : 'other_order';
  } catch (err: any) {
    logger.error('[SumitPaymentClaim] claim write failed — FAIL CLOSED, payment needs reconciliation', {
      paymentId: id, orderRef, surface, error: err?.message,
    });
    return 'unavailable';
  }
}

/** Only these two outcomes may fulfil. */
export function claimAllowsFulfil(c: SumitPaymentClaim): boolean {
  return c === 'claimed' || c === 'same_order';
}

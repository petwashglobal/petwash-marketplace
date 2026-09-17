import { sql } from 'drizzle-orm';
import { db } from '../db';

// ──────────────────────────────────────────────────────────────────────────────
// Refund of a wallet-debited booking (2026-09-17) — ONE path for the admin
// refund, the support refund, the approved refund request
// (routes/prestige-pass.ts) and the academy cancel (routes/academy.ts).
//
// Before: each credited the wallet first and then blindly SET
// wallet_refunded_cents from the figure it had read. Two requests on the same
// booking (double-click, two tabs, two approvals) both credited — the admin
// key was Date.now(), the approval key was per approval — and the record kept
// one of them. The support key was the AMOUNT, so a second legitimate partial
// refund of the same size was silently not credited while the record said it
// was. None issued the SUMIT credit document the customer self-serve refund
// issues.
//
// Now: (1) claim the refund on the booking row — compare-and-set on the
// figure read, so only one request per stage can proceed; (2) credit through
// walletService.refundBookingWallet, the same path as the self-serve refund
// (ledger entry, credit document when the booking was receipted, SMS);
// (3) if the credit throws or was already issued under this key, give the
// claim back.
// ──────────────────────────────────────────────────────────────────────────────
export type BookingWalletRefundOutcome =
  | { ok: true; txnId: string; newState: 'refunded' | 'debited'; refundCents: number }
  | { ok: false; code: 'REFUND_CONFLICT' | 'REFUND_ALREADY_ISSUED'; txnId?: string };

export async function refundDebitedBookingToWallet(opts: {
  booking: any;
  sourceTable: 'booking_requests' | 'trainer_bookings';
  refundCents: number;
  keySuffix: string;
  reason: string;
  ip?: string | null;
  metadata: Record<string, unknown>;
}): Promise<BookingWalletRefundOutcome> {
  const { booking, sourceTable, refundCents } = opts;
  const bookingId = String(booking.booking_id);
  const debitedCents = Number(booking.wallet_debited_cents);
  const alreadyRefunded = Number(booking.wallet_refunded_cents ?? 0);
  const newRefunded = alreadyRefunded + refundCents;
  const newState: 'refunded' | 'debited' = newRefunded >= debitedCents ? 'refunded' : 'debited';
  const table = sql.raw(sourceTable === 'booking_requests' ? 'booking_requests' : 'trainer_bookings');
  const idCol = sql.raw(sourceTable === 'booking_requests' ? 'request_id' : 'booking_id');

  const claim: any = await db.execute(sql`
    UPDATE ${table}
    SET finance_state = ${newState},
        wallet_refunded_cents = ${newRefunded},
        updated_at = NOW()
    WHERE ${idCol} = ${bookingId}
      AND finance_state = 'debited'
      AND COALESCE(wallet_refunded_cents, 0) = ${alreadyRefunded}
    RETURNING 1 AS claimed
  `);
  if (((claim?.rows ?? claim ?? []) as any[]).length === 0) {
    return { ok: false, code: 'REFUND_CONFLICT' };
  }

  const giveBack = () => db.execute(sql`
    UPDATE ${table}
    SET finance_state = 'debited',
        wallet_refunded_cents = ${alreadyRefunded},
        updated_at = NOW()
    WHERE ${idCol} = ${bookingId}
      AND COALESCE(wallet_refunded_cents, 0) = ${newRefunded}
  `);

  let result: { txnId: string; idempotent: boolean };
  try {
    const { walletService } = await import('../services/WalletService');
    result = await walletService.refundBookingWallet({
      userId:               booking.user_id,
      amountCents:          refundCents,
      bookingId,
      divisionCode:         booking.division_code ?? 'general',
      reason:               opts.reason,
      ipAddress:            opts.ip ?? null,
      metadata:             opts.metadata,
      idempotencyKeySuffix: opts.keySuffix,
    });
  } catch (err) {
    await giveBack();
    throw err;
  }
  if (result.idempotent) {
    await giveBack();
    return { ok: false, code: 'REFUND_ALREADY_ISSUED', txnId: result.txnId };
  }

  await db.execute(sql`
    UPDATE ${table} SET wallet_refund_key = ${result.txnId} WHERE ${idCol} = ${bookingId}
  `);
  return { ok: true, txnId: result.txnId, newState, refundCents };
}

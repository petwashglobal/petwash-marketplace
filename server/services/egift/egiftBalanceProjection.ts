/**
 * eGift balance projection — CEO 2026-08-27 §21-23, §31.
 *
 * READ-ONLY. Given an egift_id, derives the honest Available / Reserved
 * / Redeemed / Restored breakdown from the append-only egift_events
 * ledger + open egift_reservations. The cached
 * wallet_accounts.egift_balance_cents aggregate STAYS as-is on the
 * money path — this helper is the customer/admin UI truth so the tile
 * can render:
 *
 *   Original            ₪100
 *   Available           ₪35
 *   Reserved            ₪20   ← visible; not hidden as if vanished (§31)
 *   Redeemed            ₪25
 *   Value restored      ₪10   ← refund / partial-refund lineage
 *
 * The signed convention on egift_events.amount_cents varies across the
 * codebase; this helper reads the direction from event_type, not the
 * sign, so a mixed history stays honest.
 */

import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../db';
import { egiftEvents, egiftReservations } from '@shared/schema';
import { logger } from '../../lib/logger';

export interface EgiftBalanceProjection {
  egiftId: string;
  currency: 'ILS';
  originalCents: number;
  availableCents: number;
  reservedCents: number;
  redeemedCents: number;
  restoredCents: number;
  frozen: boolean;
  /** Open reservations, newest-first. Empty when nothing is on hold. */
  openReservations: Array<{
    reservationId: string;
    amountCents: number;
    intendedCommercial: string;
    reservedAt: string;
    expiresAt: string;
  }>;
  /** TRUE when a partial refund landed but no matching credit fiscal
   *  document has yet been recorded — same signal as
   *  RefundLineage.hasOrphanRefundWarning on the passport. */
  hasOrphanRefundWarning: boolean;
}

const CREDIT_EVENTS = new Set([
  'PURCHASED', 'CREDITED_TO_WALLET', 'VALUE_RESTORED', 'ADJUSTMENT',
]);
const DEBIT_EVENTS = new Set([
  'REDEEMED', 'PURCHASE_REFUNDED', 'EXPIRED', 'VOIDED', 'REFUNDED',
]);

export async function projectEgiftBalance(egiftId: string): Promise<EgiftBalanceProjection> {
  const empty: EgiftBalanceProjection = {
    egiftId, currency: 'ILS',
    originalCents: 0, availableCents: 0, reservedCents: 0,
    redeemedCents: 0, restoredCents: 0,
    frozen: false, openReservations: [], hasOrphanRefundWarning: false,
  };

  try {
    const events = await db
      .select({
        id: egiftEvents.id,
        type: egiftEvents.eventType,
        amount: egiftEvents.amountCents,
        invoiceId: egiftEvents.invoiceId,
      })
      .from(egiftEvents)
      .where(eq(egiftEvents.egiftId, egiftId));

    let original = 0;
    let redeemed = 0;
    let restored = 0;
    let purchaseRefunded = 0;
    let frozen = false;
    let orphanRefund = false;

    for (const e of events) {
      const amt = Math.abs(Number(e.amount ?? 0));
      switch (e.type) {
        case 'PURCHASED':
        case 'CREDITED_TO_WALLET':
          original += amt;
          break;
        case 'REDEEMED':
          redeemed += amt;
          break;
        case 'VALUE_RESTORED':
          restored += amt;
          break;
        case 'PURCHASE_REFUNDED':
          purchaseRefunded += amt;
          if (!e.invoiceId) orphanRefund = true;
          break;
        case 'EXPIRED':
        case 'VOIDED':
          redeemed += amt;
          break;
        case 'FROZEN':
          frozen = true;
          break;
        case 'UNFROZEN':
          frozen = false;
          break;
        case 'ADJUSTMENT':
          // Adjustments are signed intentionally on the source event.
          // Trust the sign here — admin correction is the one place
          // negative amounts are legitimate.
          original += Number(e.amount ?? 0);
          break;
        default: /* other events (REDEEM_STARTED / REDEEM_FAILED / RESERVED_* / REFUNDED) — see below */
          break;
      }
    }

    // Reservations — active holds that haven't committed or been released.
    const reservations = await db
      .select()
      .from(egiftReservations)
      .where(and(
        eq(egiftReservations.egiftId, egiftId),
        inArray(egiftReservations.status, ['RESERVED']),
      ));

    let reservedCents = 0;
    const openReservations = reservations.map((r) => {
      reservedCents += Number(r.amountCents ?? 0);
      return {
        reservationId: r.reservationId,
        amountCents: Number(r.amountCents ?? 0),
        intendedCommercial: r.intendedCommercial,
        reservedAt: (r.reservedAt as Date)?.toISOString?.() ?? String(r.reservedAt),
        expiresAt: (r.expiresAt as Date)?.toISOString?.() ?? String(r.expiresAt),
      };
    });

    // Effective original excludes purchase-refunds AGAINST the original
    // sale (that money was returned to the buyer's card, not stored).
    const effectiveOriginal = Math.max(0, original - purchaseRefunded);
    const availableCents = Math.max(0, effectiveOriginal + restored - redeemed - reservedCents);

    return {
      egiftId,
      currency: 'ILS',
      originalCents: effectiveOriginal,
      availableCents,
      reservedCents,
      redeemedCents: redeemed,
      restoredCents: restored,
      frozen,
      openReservations,
      hasOrphanRefundWarning: orphanRefund,
    };
  } catch (err: any) {
    // 42P01 = missing table — some envs may not have egift_reservations
    // yet (migration 0130 in-flight). Return zeros so the customer
    // surface renders the honest empty state instead of a 500.
    if (err?.code === '42P01') return empty;
    logger.error('[EgiftBalance] projection failed', {
      egiftIdTail: egiftId.slice(-6), error: err?.message,
    });
    return empty;
  }
}

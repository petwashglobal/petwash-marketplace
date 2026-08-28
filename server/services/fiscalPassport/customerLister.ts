/**
 * Customer fiscal-transaction lister — CEO 2026-08-27 §94.20, §27.
 *
 * READ-ONLY. Aggregates a single customer's transactions across the
 * seven sources the FiscalPassport composer already understands.
 * NEVER cross-joins customers; every query is uid-scoped. Never
 * mutates. Never invents transactions.
 *
 * §71 security: caller MUST be the same uid as `customerUid` (or a
 * staff member). Route enforces that before calling this lister.
 *
 * §27 shape: returns a slim listing suitable for
 * /account/transactions rendering — date, what, amount, doc type,
 * transactionRef, status. Full detail goes through composeFiscalPassport().
 */

import { eq, desc } from 'drizzle-orm';
import { db, pool } from '../../db';
import {
  sitterBookings,
  walkBookings,
  trainerBookings,
  k9000WashEvents,
  pettrekTrips,
} from '@shared/schema';
import { logger } from '../../lib/logger';
import { generateTransactionRef } from '@shared/lib/fiscalPassport/idNamespace';
import { paymentClassForEvent, type FiscalEventCode } from '@shared/lib/fiscalPassport/eventRegistry';
import { getSumitDocumentMapping } from '../sumitDocumentMapping';

export interface CustomerTransactionRow {
  transactionRef: string;
  correlationId: string;
  /** ISO date the transaction happened (or was created). */
  occurredAt: string;
  platform: 'SHOP' | 'K9000' | 'EGIFT' | 'SITTER_SUITE' | 'WALK_MY_PET' | 'ACADEMY' | 'PETTREK' | 'WALLET';
  /** Public label the customer sees — "Walk My Pet — 60 min" etc. */
  label: string;
  totalCents: number;
  currency: 'ILS';
  /** Aggregated payment state per §50. */
  paymentState: 'PAYMENT_REQUIRED' | 'PAYMENT_PENDING' | 'PAID' | 'REFUNDED' | 'NOT_REQUIRED';
  /** CPA-mapped SUMIT document type. */
  documentType?: 'InvoiceAndReceipt' | 'Receipt' | 'Invoice' | 'CreditInvoice';
  /** Best-effort — the underlying source table so the caller can
   *  compose the full FiscalPassport if the customer taps into it. */
  source:
    | 'shop_orders'
    | 'k9000_wash_events'
    | 'egift_guest_orders_purchase'
    | 'wallet_topup'
    | 'sitter_bookings'
    | 'walk_bookings'
    | 'trainer_bookings'
    | 'pettrek_trips';
  sourceId: string;
}

/**
 * List transactions for one customer, newest-first. Result is bounded
 * to `limit` per source (default 20) — the admin explorer can widen
 * this via a separate call.
 */
export async function listCustomerTransactions(input: {
  customerUid: string;
  /** Optional customer email — used for eGift-guest-order sender match. */
  customerEmail?: string;
  limitPerSource?: number;
}): Promise<CustomerTransactionRow[]> {
  const perSource = Math.min(Math.max(input.limitPerSource ?? 20, 1), 100);
  const rows: CustomerTransactionRow[] = [];

  // ── Shop
  try {
    const { rows: shop } = await pool.query(
      `SELECT id, order_number, status, total_cents, created_at
         FROM shop_orders WHERE user_id = $1
         ORDER BY created_at DESC LIMIT $2`,
      [input.customerUid, perSource],
    );
    for (const r of shop) {
      const paid = ['paid', 'shipped', 'fulfilled', 'completed', 'delivered'].includes(String(r.status ?? ''));
      const refunded = String(r.status ?? '') === 'refunded';
      const event: FiscalEventCode = refunded ? 'SHOP_ORDER_REFUNDED' : 'SHOP_ORDER_PAID';
      rows.push({
        transactionRef: generateTransactionRef({ stableId: `shop:${r.id}`, stableIsoDate: r.created_at ?? null }),
        correlationId: `shop:${r.id}`,
        occurredAt: isoOf(r.created_at),
        platform: 'SHOP',
        label: 'Pet Wash Shop',
        totalCents: Number(r.total_cents ?? 0),
        currency: 'ILS',
        paymentState: paid ? 'PAID' : refunded ? 'REFUNDED' : 'PAYMENT_REQUIRED',
        documentType: paid || refunded ? docTypeFor(event) : undefined,
        source: 'shop_orders',
        sourceId: String(r.id),
      });
    }
  } catch (err) { swallow('shop_orders', err); }

  // ── K9000
  try {
    const events = await db
      .select()
      .from(k9000WashEvents)
      .where(eq(k9000WashEvents.userId, input.customerUid))
      .orderBy(desc(k9000WashEvents.createdAt))
      .limit(perSource);
    for (const e of events) {
      const paid = String(e.status ?? '') === 'completed';
      const isPublicCard = e.transactionSource === 'nayax' || e.redemptionSource === 'nayax';
      const event: FiscalEventCode = isPublicCard ? 'K9000_PUBLIC_CARD_COMPLETED' : 'K9000_WASH_COMPLETED';
      rows.push({
        transactionRef: generateTransactionRef({ stableId: `k9000:${e.id}`, stableIsoDate: e.createdAt?.toISOString() ?? null }),
        correlationId: `k9000:${e.id}`,
        occurredAt: isoOf(e.createdAt),
        platform: 'K9000',
        label: 'Pet Wash K9000 — self-service wash',
        totalCents: Number(e.amountCents ?? 0),
        currency: 'ILS',
        paymentState: paid ? 'PAID' : 'PAYMENT_PENDING',
        documentType: paid ? docTypeFor(event) : undefined,
        source: 'k9000_wash_events',
        sourceId: e.id,
      });
    }
  } catch (err) { swallow('k9000_wash_events', err); }

  // ── eGift guest-order purchase (sender-email match)
  if (input.customerEmail) {
    try {
      const { rows: egift } = await pool.query(
        `SELECT external_id, amount_ils_cents, status, created_at
           FROM egift_guest_orders
          WHERE LOWER(sender_email) = LOWER($1)
          ORDER BY created_at DESC LIMIT $2`,
        [input.customerEmail, perSource],
      );
      for (const g of egift) {
        const paid = String(g.status ?? '') === 'issued';
        const refunded = String(g.status ?? '') === 'refunded';
        const event: FiscalEventCode = refunded ? 'EGIFT_PURCHASE_REFUNDED' : 'EGIFT_PURCHASE_PAID';
        rows.push({
          transactionRef: generateTransactionRef({ stableId: `egift-purchase:${g.external_id}`, stableIsoDate: g.created_at ?? null }),
          correlationId: `egift-purchase:${g.external_id}`,
          occurredAt: isoOf(g.created_at),
          platform: 'EGIFT',
          label: 'PetWash eGift purchase',
          totalCents: Number(g.amount_ils_cents ?? 0),
          currency: 'ILS',
          paymentState: paid ? 'PAID' : refunded ? 'REFUNDED' : 'PAYMENT_REQUIRED',
          documentType: paid || refunded ? docTypeFor(event) : undefined,
          source: 'egift_guest_orders_purchase',
          sourceId: g.external_id,
        });
      }
    } catch (err) { swallow('egift_guest_orders', err); }
  }

  // ── Wallet top-ups (credit_transactions issue rows)
  try {
    const { rows: walletRows } = await pool.query(
      `SELECT t.transaction_id, t.amount_cents, t.source_id, t.created_at
         FROM credit_transactions t
         JOIN wallet_accounts w ON w.wallet_id = t.wallet_id
        WHERE w.user_id = $1 AND t.transaction_type = 'issue'
        ORDER BY t.created_at DESC LIMIT $2`,
      [input.customerUid, perSource],
    );
    for (const w of walletRows) {
      const event: FiscalEventCode = 'WALLET_TOPUP_PAID';
      rows.push({
        transactionRef: generateTransactionRef({ stableId: `wallet-topup:${w.transaction_id}`, stableIsoDate: w.created_at ?? null }),
        correlationId: `wallet-topup:${w.transaction_id}`,
        occurredAt: isoOf(w.created_at),
        platform: 'WALLET',
        label: 'PetWash Wallet top-up',
        totalCents: Number(w.amount_cents ?? 0),
        currency: 'ILS',
        paymentState: 'PAID',
        documentType: docTypeFor(event),
        source: 'wallet_topup',
        sourceId: String(w.transaction_id),
      });
    }
  } catch (err) { swallow('wallet_topup', err); }

  // ── Sitter / Walk / Academy — pull each provider-side fiscal event
  try {
    const sitterRows = await db
      .select({ id: sitterBookings.bookingId, total: sitterBookings.totalChargeCents, status: sitterBookings.paymentStatus, nayax: sitterBookings.nayaxTransactionId, when: sitterBookings.confirmedAt, created: sitterBookings.createdAt })
      .from(sitterBookings)
      .where(eq(sitterBookings.ownerId, input.customerUid))
      .orderBy(desc(sitterBookings.createdAt))
      .limit(perSource);
    for (const s of sitterRows) {
      const paid = String(s.status ?? '') === 'captured' || !!s.nayax;
      const event: FiscalEventCode = 'SITTER_BOOKING_PAID';
      rows.push({
        transactionRef: generateTransactionRef({ stableId: `sitter:${s.id}`, stableIsoDate: (s.when ?? s.created)?.toISOString() ?? null }),
        correlationId: `sitter:${s.id}`,
        occurredAt: isoOf(s.when ?? s.created),
        platform: 'SITTER_SUITE',
        label: 'The Sitter Suite — pet sitting',
        totalCents: Number(s.total ?? 0),
        currency: 'ILS',
        paymentState: paid ? 'PAID' : 'PAYMENT_REQUIRED',
        documentType: paid ? docTypeFor(event) : undefined,
        source: 'sitter_bookings',
        sourceId: s.id,
      });
    }
  } catch (err) { swallow('sitter_bookings', err); }

  try {
    const walkRows = await db
      .select({ id: walkBookings.bookingId, total: walkBookings.totalCost, when: walkBookings.scheduledDate })
      .from(walkBookings)
      .where(eq(walkBookings.ownerId, input.customerUid))
      .orderBy(desc(walkBookings.scheduledDate))
      .limit(perSource);
    for (const w of walkRows) {
      // §24 walk today has no rail — report NOT_REQUIRED honestly.
      rows.push({
        transactionRef: generateTransactionRef({ stableId: `walk:${w.id}`, stableIsoDate: w.when?.toISOString() ?? null }),
        correlationId: `walk:${w.id}`,
        occurredAt: isoOf(w.when),
        platform: 'WALK_MY_PET',
        label: 'Walk My Pet — dog walk',
        totalCents: Math.round(parseFloat(w.total ?? '0') * 100),
        currency: 'ILS',
        paymentState: 'NOT_REQUIRED',
        documentType: undefined,
        source: 'walk_bookings',
        sourceId: w.id,
      });
    }
  } catch (err) { swallow('walk_bookings', err); }

  try {
    const academyRows = await db
      .select({ id: trainerBookings.bookingId, total: trainerBookings.totalAmount, status: trainerBookings.paymentStatus, paid: trainerBookings.paidAt, when: trainerBookings.sessionDate })
      .from(trainerBookings)
      .where(eq(trainerBookings.userId, input.customerUid))
      .orderBy(desc(trainerBookings.sessionDate))
      .limit(perSource);
    for (const a of academyRows) {
      const paid = String(a.status ?? '') === 'completed' || !!a.paid;
      const event: FiscalEventCode = 'ACADEMY_BOOKING_PAID';
      rows.push({
        transactionRef: generateTransactionRef({ stableId: `academy:${a.id}`, stableIsoDate: (a.paid ?? a.when)?.toISOString() ?? null }),
        correlationId: `academy:${a.id}`,
        occurredAt: isoOf(a.paid ?? a.when),
        platform: 'ACADEMY',
        label: 'PetWash Academy — training session',
        totalCents: Math.round(Number(a.total ?? 0) * 100),
        currency: 'ILS',
        paymentState: paid ? 'PAID' : 'PAYMENT_REQUIRED',
        documentType: paid ? docTypeFor(event) : undefined,
        source: 'trainer_bookings',
        sourceId: a.id,
      });
    }
  } catch (err) { swallow('trainer_bookings', err); }

  try {
    // PetTrek trips — the customer sees a transport / sitting / stay trip.
    // paymentStatus is 'pending' | 'paid' | 'refunded' per the schema.
    // finalFare wins over estimatedFare once the trip completes, matching
    // the composer's rule at composer.ts:715.
    const trekRows = await db
      .select({
        id: pettrekTrips.tripId,
        finalFare: pettrekTrips.finalFare,
        estimatedFare: pettrekTrips.estimatedFare,
        paymentStatus: pettrekTrips.paymentStatus,
        serviceType: pettrekTrips.serviceType,
        scheduled: pettrekTrips.scheduledPickupTime,
        actualDropoff: pettrekTrips.actualDropoffTime,
      })
      .from(pettrekTrips)
      .where(eq(pettrekTrips.customerId, input.customerUid))
      .orderBy(desc(pettrekTrips.scheduledPickupTime))
      .limit(perSource);
    for (const t of trekRows) {
      const paidState = String(t.paymentStatus ?? '');
      const paid = paidState === 'paid';
      const refunded = paidState === 'refunded';
      const event: FiscalEventCode = 'PETTREK_BOOKING_PAID';
      const rawTotal = Number(t.finalFare ?? t.estimatedFare ?? 0);
      rows.push({
        transactionRef: generateTransactionRef({
          stableId: `pettrek:${t.id}`,
          stableIsoDate: (t.actualDropoff ?? t.scheduled)?.toISOString() ?? null,
        }),
        correlationId: `pettrek:${t.id}`,
        occurredAt: isoOf(t.actualDropoff ?? t.scheduled),
        platform: 'PETTREK',
        label: `PetTrek — ${String(t.serviceType ?? 'trip')}`,
        totalCents: Math.round(rawTotal * 100),
        currency: 'ILS',
        paymentState: paid ? 'PAID' : refunded ? 'REFUNDED' : 'PAYMENT_REQUIRED',
        documentType: paid || refunded ? docTypeFor(event) : undefined,
        source: 'pettrek_trips',
        sourceId: t.id,
      });
    }
  } catch (err) { swallow('pettrek_trips', err); }

  // Newest-first across the merged set.
  rows.sort((a, b) => (b.occurredAt < a.occurredAt ? -1 : b.occurredAt > a.occurredAt ? 1 : 0));
  return rows;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function isoOf(v: Date | string | null | undefined): string {
  if (!v) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function docTypeFor(event: FiscalEventCode): CustomerTransactionRow['documentType'] {
  const cls = paymentClassForEvent(event);
  const m = getSumitDocumentMapping(cls);
  return m.documentType;
}

function swallow(source: string, err: unknown): void {
  // 42P01 (missing table) is expected in fresh envs — silently skip so
  // the customer sees the other sources' rows instead of a 500.
  const code = (err as any)?.code;
  if (code === '42P01') return;
  logger.error('[FiscalLister] source read failed', { source, error: (err as any)?.message });
}

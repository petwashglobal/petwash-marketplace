/**
 * SUMIT unclaimed-payment watch (2026-09-17).
 *
 * Card payments went live today. Every order fulfils from SUMIT's return
 * redirect and writes one row to sumit_payment_claims. A customer who pays and
 * closes the tab before the redirect leaves real money at SUMIT with no order
 * fulfilled — a booking stuck in payment_pending, a gift card never issued —
 * and nothing noticed.
 *
 * SUMIT's Payment object carries no reference to our order (verified live), so
 * this job does NOT guess and fulfil. It raises one critical admin alert per
 * valid SUMIT payment that no order has claimed, listing the waiting orders of
 * the same amount so a person can match it. The alert resolves itself only
 * when THAT payment is later claimed — never because it aged out of the window.
 */
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { logger } from '../lib/logger';
import { sumitClient } from '../services/SumitClient';

// Payments before this instant are the go-live tests (₪1 rail checks, 2026-09-17).
export const WATCH_FLOOR = new Date('2026-09-17T10:00:00Z');
const WINDOW_MS = 72 * 3600_000;
const KEY = (id: string) => `sumit_unclaimed_payment:${id}:`;

export type UnclaimedPayment = { id: string; customerId: string | null; date: string | null; amountCents: number };

export type Candidate = { kind: 'booking' | 'egift_guest' | 'purchase'; ref: string; amountCents: number; createdAt: string };

/** Pure: which listed payments have no claim. */
export function unclaimedOf(payments: UnclaimedPayment[], claimed: Set<string>, floor = WATCH_FLOOR): UnclaimedPayment[] {
  return payments.filter((p) => {
    if (claimed.has(p.id)) return false;
    const t = p.date ? Date.parse(p.date) : NaN;
    return !Number.isFinite(t) || t >= floor.getTime();
  });
}

/** Pure: the alert text for one unclaimed payment. */
export function describeUnclaimed(p: UnclaimedPayment, candidates: Candidate[]): string {
  const amount = `₪${(p.amountCents / 100).toFixed(2)}`;
  const head = `SUMIT payment ${p.id} · ${amount} · ${p.date ?? 'no date'} · SUMIT customer ${p.customerId ?? '?'} — money received, no order fulfilled.`;
  if (candidates.length === 0) return `${head} No waiting order has this amount — check SUMIT and refund or fulfil by hand.`;
  const list = candidates.slice(0, 5).map((c) => `${c.kind} ${c.ref} (${c.createdAt.slice(0, 16)})`).join('; ');
  return `${head} Waiting orders with the same amount: ${list}. Confirm the customer, then fulfil or refund.`;
}

async function waitingOrders(amountCents: number, around: Date): Promise<Candidate[]> {
  const from = new Date(around.getTime() - 3 * 3600_000);
  const to = new Date(around.getTime() + 15 * 60_000);
  const out: Candidate[] = [];
  const rows = async (q: ReturnType<typeof sql>) => ((await db.execute(q)) as any).rows ?? [];
  try {
    for (const r of await rows(sql`
      SELECT request_id AS ref, total_cents AS cents, updated_at AS at FROM booking_requests
      WHERE status = 'payment_pending' AND total_cents = ${amountCents}
        AND updated_at BETWEEN ${from} AND ${to} LIMIT 5`)) {
      out.push({ kind: 'booking', ref: String(r.ref), amountCents: Number(r.cents), createdAt: new Date(r.at).toISOString() });
    }
  } catch (e: any) { logger.warn('[SumitUnclaimed] booking lookup failed', { error: e?.message }); }
  try {
    for (const r of await rows(sql`
      SELECT external_id AS ref, amount_ils_cents AS cents, created_at AS at FROM egift_guest_orders
      WHERE status = 'pending' AND amount_ils_cents = ${amountCents}
        AND created_at BETWEEN ${from} AND ${to} LIMIT 5`)) {
      out.push({ kind: 'egift_guest', ref: String(r.ref), amountCents: Number(r.cents), createdAt: new Date(r.at).toISOString() });
    }
  } catch (e: any) { logger.warn('[SumitUnclaimed] egift lookup failed', { error: e?.message }); }
  try {
    for (const r of await rows(sql`
      SELECT id AS ref, amount_cents AS cents, created_at AS at FROM purchases
      WHERE status = 'payment_pending' AND amount_cents = ${amountCents}
        AND created_at BETWEEN ${from} AND ${to} LIMIT 5`)) {
      out.push({ kind: 'purchase', ref: String(r.ref), amountCents: Number(r.cents), createdAt: new Date(r.at).toISOString() });
    }
  } catch (e: any) { logger.warn('[SumitUnclaimed] purchase lookup failed', { error: e?.message }); }
  return out;
}

export async function runSumitUnclaimedPaymentWatch(now = new Date()): Promise<{ listed: number; unclaimed: number; resolved: number; ok: boolean }> {
  const from = new Date(Math.max(now.getTime() - WINDOW_MS, WATCH_FLOOR.getTime()));
  const payments: UnclaimedPayment[] = [];
  for (let page = 0, start = 0; page < 20; page++) {
    const r = await sumitClient.listPayments({ from, to: now, startIndex: start, validOnly: true });
    if (!r.ok) {
      logger.warn('[SumitUnclaimed] payments/list failed — skipping this run', { reason: r.reason });
      return { listed: 0, unclaimed: 0, resolved: 0, ok: false };
    }
    payments.push(...r.payments.filter((p) => p.valid));
    if (!r.hasNextPage || r.payments.length === 0) break;
    start += r.payments.length;
  }
  if (payments.length === 0) return { listed: 0, unclaimed: 0, resolved: 0, ok: true };

  const ids = payments.map((p) => p.id);
  const claimedRows: any = await db.execute(sql`
    SELECT payment_id::text AS id FROM sumit_payment_claims
    WHERE payment_id::text IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`);
  const claimed = new Set<string>(((claimedRows?.rows ?? []) as any[]).map((r) => String(r.id)));

  const { createOrUpdateAlert, resolveClearedByPrefix } = await import('../services/AlertEngine');
  let resolved = 0;
  for (const id of claimed) resolved += await resolveClearedByPrefix(KEY(id), []);

  const open = unclaimedOf(payments, claimed);
  for (const p of open) {
    const around = p.date ? new Date(p.date) : now;
    const candidates = await waitingOrders(p.amountCents, around);
    await createOrUpdateAlert({
      dedupeKey: KEY(p.id),
      category: 'payment',
      severity: 'critical',
      title: 'Card payment received — no order fulfilled',
      message: describeUnclaimed(p, candidates),
      linkedEntityType: 'sumit_payment',
      linkedEntityId: p.id,
      source: 'auto_sweep',
      metadata: { amountCents: p.amountCents, sumitCustomerId: p.customerId, candidates },
    });
  }
  if (open.length) logger.error('[SumitUnclaimed] valid SUMIT payments with no order', { count: open.length, ids: open.map((p) => p.id) });
  return { listed: payments.length, unclaimed: open.length, resolved, ok: true };
}

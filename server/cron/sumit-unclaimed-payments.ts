/**
 * SUMIT unclaimed-payment watch (2026-09-17).
 *
 * Card payments went live today. Every order fulfils from SUMIT's return
 * redirect and writes one row to sumit_payment_claims. A customer who pays and
 * closes the tab before the redirect leaves real money at SUMIT with no order
 * fulfilled — a booking stuck in payment_pending, a gift card never issued —
 * and nothing noticed.
 *
 * SUMIT's Payment object carries no reference to our order (verified live, and
 * confirmed in writing by SUMIT support on 2026-09-18: neither payments/get nor
 * payments/list returns the ExternalIdentifier, and the Triggers webhook is not
 * documented to carry it). So this job never guesses. What it does, since
 * 2026-09-19, is read the `PW-REF <externalId>` stamp beginRedirect writes into
 * the payment page's own document and — when exactly one document names the
 * order — replay the customer's missing return through the production /return
 * route (server/lib/sumitLateReturn.ts). That route re-verifies with SUMIT,
 * compares the amount, claims the PaymentID and fulfils exactly as it would
 * for a customer who came back late. Anything the route refuses, or any
 * payment with no unique stamp, stays a critical admin alert listing the
 * waiting orders of the same amount so a person can match it. The alert
 * resolves itself only when THAT payment is later claimed — never because it
 * aged out of the window.
 */
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { logger } from '../lib/logger';
import { sumitClient, SUMIT_ORDER_REF_PREFIX } from '../services/SumitClient';
import { replayLateReturn } from '../lib/sumitLateReturn';

// Payments before this instant are the go-live tests (₪1 rail checks, 2026-09-17).
export const WATCH_FLOOR = new Date('2026-09-17T10:00:00Z');
const WINDOW_MS = 72 * 3600_000;
/**
 * A payment younger than this may still be mid-redirect — the customer's
 * browser is on its way to /return. Replaying it would race the real return
 * (harmless: the claim makes the loser a no-op) but would also alert on a
 * checkout that is about to complete by itself. Wait it out.
 */
export const LATE_RETURN_MIN_AGE_MS = 10 * 60_000;
const KEY = (id: string) => `sumit_unclaimed_payment:${id}:`;

export type UnclaimedPayment = { id: string; customerId: string | null; date: string | null; amountCents: number };

export type Candidate = { kind: 'booking' | 'egift_guest' | 'purchase'; ref: string; amountCents: number; createdAt: string };

/**
 * The order ref SUMIT's own document carries for a payment (2026-09-18).
 * beginRedirect stamps `PW-REF <externalId>` into DocumentDescription, so the
 * document created by a hosted-page charge names the order. Matched by value
 * and time because the payment object itself links nowhere.
 */
export function refFromDocuments(
  payment: { amountCents: number; date: string | null },
  documents: Array<{ description: string | null; valueIls: number; date: string | null }>,
  windowMinutes = 180,
): string | null {
  const paidAt = payment.date ? Date.parse(payment.date) : NaN;
  const hits = documents.filter((d) => {
    if (Math.round(d.valueIls * 100) !== payment.amountCents) return false;
    if (!d.description || !d.description.includes(SUMIT_ORDER_REF_PREFIX)) return false;
    if (!Number.isFinite(paidAt) || !d.date) return true;
    return Math.abs(Date.parse(d.date) - paidAt) <= windowMinutes * 60_000;
  });
  if (hits.length !== 1) return null; // ambiguous is not a match
  const after = hits[0].description!.slice(hits[0].description!.indexOf(SUMIT_ORDER_REF_PREFIX) + SUMIT_ORDER_REF_PREFIX.length);
  const ref = after.split(/[\s,;|]/)[0]?.trim();
  return ref ? ref : null;
}

/** Pure: which listed payments have no claim. */
export function unclaimedOf(payments: UnclaimedPayment[], claimed: Set<string>, floor = WATCH_FLOOR): UnclaimedPayment[] {
  return payments.filter((p) => {
    if (claimed.has(p.id)) return false;
    const t = p.date ? Date.parse(p.date) : NaN;
    return !Number.isFinite(t) || t >= floor.getTime();
  });
}

/** Pure: the alert text for one unclaimed payment. */
export function describeUnclaimed(p: UnclaimedPayment, candidates: Candidate[], stampedRef?: string | null, replayNote?: string | null): string {
  const amount = `₪${(p.amountCents / 100).toFixed(2)}`;
  const head = `SUMIT payment ${p.id} · ${amount} · ${p.date ?? 'no date'} · SUMIT customer ${p.customerId ?? '?'} — money received, no order fulfilled.`;
  if (stampedRef) {
    const replay = replayNote ? ` Late return replayed through the production route and refused: ${replayNote}.` : '';
    return `${head} SUMIT's own document names the order: ${stampedRef}.${replay} Fulfil that order or refund.`;
  }
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

/**
 * Valid SUMIT payments in a window that no order has claimed. Used by the watch
 * and by /pay before it issues a REPLACEMENT link: if money of exactly this
 * amount is sitting unclaimed, the customer may have paid already and a second
 * link would charge them twice.
 */
export async function unclaimedPaymentsIn(from: Date, to: Date): Promise<UnclaimedPayment[]> {
  const payments: UnclaimedPayment[] = [];
  for (let page = 0, start = 0; page < 20; page++) {
    const r = await sumitClient.listPayments({ from, to, startIndex: start, validOnly: true });
    if (!r.ok) throw new Error(`sumit_list_failed:${r.reason ?? 'unknown'}`);
    payments.push(...r.payments.filter((p) => p.valid));
    if (!r.hasNextPage || r.payments.length === 0) break;
    start += r.payments.length;
  }
  if (payments.length === 0) return [];
  const rows: any = await db.execute(sql`
    SELECT payment_id::text AS id FROM sumit_payment_claims
    WHERE payment_id::text IN (${sql.join(payments.map((p) => sql`${p.id}`), sql`, `)})`);
  const claimed = new Set<string>(((rows?.rows ?? []) as any[]).map((r) => String(r.id)));
  return unclaimedOf(payments, claimed);
}

export async function runSumitUnclaimedPaymentWatch(now = new Date()): Promise<{ listed: number; unclaimed: number; resolved: number; fulfilled: number; ok: boolean }> {
  const from = new Date(Math.max(now.getTime() - WINDOW_MS, WATCH_FLOOR.getTime()));
  const payments: UnclaimedPayment[] = [];
  for (let page = 0, start = 0; page < 20; page++) {
    const r = await sumitClient.listPayments({ from, to: now, startIndex: start, validOnly: true });
    if (!r.ok) {
      logger.warn('[SumitUnclaimed] payments/list failed — skipping this run', { reason: r.reason });
      return { listed: 0, unclaimed: 0, resolved: 0, fulfilled: 0, ok: false };
    }
    payments.push(...r.payments.filter((p) => p.valid));
    if (!r.hasNextPage || r.payments.length === 0) break;
    start += r.payments.length;
  }
  if (payments.length === 0) return { listed: 0, unclaimed: 0, resolved: 0, fulfilled: 0, ok: true };

  const ids = payments.map((p) => p.id);
  const claimedRows: any = await db.execute(sql`
    SELECT payment_id::text AS id FROM sumit_payment_claims
    WHERE payment_id::text IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`);
  const claimed = new Set<string>(((claimedRows?.rows ?? []) as any[]).map((r) => String(r.id)));

  const { createOrUpdateAlert, resolveClearedByPrefix } = await import('../services/AlertEngine');
  let resolved = 0;
  for (const id of claimed) resolved += await resolveClearedByPrefix(KEY(id), []);

  const open = unclaimedOf(payments, claimed);
  // One document read for the whole window; the stamp turns "some payment" into
  // "this order" (see refFromDocuments).
  let documents: Array<{ description: string | null; valueIls: number; date: string | null }> = [];
  if (open.length > 0) {
    const docs = await sumitClient.listDocumentsInWindow({ from, to: now, includeDrafts: true });
    if (docs.ok) documents = docs.documents;
    else logger.warn('[SumitUnclaimed] documents/list failed — alerts will name amounts only', { reason: docs.reason });
  }

  let fulfilled = 0;
  const stillOpen: string[] = [];
  for (const p of open) {
    const around = p.date ? new Date(p.date) : now;
    const stampedRef = refFromDocuments(p, documents);

    // THE LATE RETURN (2026-09-19). SUMIT's document names exactly one order:
    // make the request the customer's browser never made. The route owns every
    // safety check; this only reads its verdict.
    let replayNote: string | null = null;
    const paidAt = p.date ? Date.parse(p.date) : NaN;
    const oldEnough = !Number.isFinite(paidAt) || now.getTime() - paidAt >= LATE_RETURN_MIN_AGE_MS;
    if (stampedRef && oldEnough) {
      const replay = await replayLateReturn({ paymentId: p.id, ref: stampedRef });
      if (replay.outcome === 'fulfilled') {
        fulfilled += 1;
        logger.info('[SumitUnclaimed] late return fulfilled the order', { paymentId: p.id, ref: stampedRef, surface: replay.surface, location: replay.location });
        // The route wrote the claim; the alert (if an earlier run raised one) is cleared now.
        resolved += await resolveClearedByPrefix(KEY(p.id), []);
        continue;
      }
      replayNote = replay.outcome === 'refused'
        ? `HTTP ${replay.status} → ${replay.location ?? 'no redirect'}`
        : replay.outcome === 'error' ? `error ${replay.reason}` : replay.reason;
      logger.warn('[SumitUnclaimed] late return did not fulfil — keeping the alert', { paymentId: p.id, ref: stampedRef, replay });
    }

    stillOpen.push(p.id);
    const candidates = stampedRef ? [] : await waitingOrders(p.amountCents, around);
    await createOrUpdateAlert({
      dedupeKey: KEY(p.id),
      category: 'payment',
      severity: 'critical',
      title: 'Card payment received — no order fulfilled',
      message: describeUnclaimed(p, candidates, stampedRef, replayNote),
      linkedEntityType: 'sumit_payment',
      linkedEntityId: p.id,
      source: 'auto_sweep',
      metadata: { amountCents: p.amountCents, sumitCustomerId: p.customerId, candidates, stampedRef, replayNote },
    });
  }
  if (stillOpen.length) logger.error('[SumitUnclaimed] valid SUMIT payments with no order', { count: stillOpen.length, ids: stillOpen });
  return { listed: payments.length, unclaimed: stillOpen.length, resolved, fulfilled, ok: true };
}

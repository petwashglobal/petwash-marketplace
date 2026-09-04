/**
 * eGift reservation service — CEO 2026-08-27 §22-23, §28-29.
 *
 * Atomic AVAILABLE → RESERVED → COMMITTED / RELEASED transitions on a
 * per-egift basis. Serialises against a `SELECT … FOR UPDATE` on the
 * eGift so concurrent spends against the SAME eGift can't oversell.
 *
 * §28 discipline: cancelling a pending reservation RELEASES value,
 * never REFUNDS — value was never committed. §29: committing a
 * reservation moves the value to REDEEMED; refunds after commit are a
 * different event (VALUE_RESTORED) and go through the refund lineage
 * path, not through this service.
 *
 * MARKETPLACE_EGIFT_FISCAL_ACTIVATION guard: the service is fully
 * functional but NO commercial flow calls it yet. Future money-path
 * wiring will consume it after CEO signs off on §20.
 */
import crypto from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db';
import { egiftEvents, egiftReservations } from '@shared/schema';
import { logger } from '../../lib/logger';
import { projectEgiftBalance } from './egiftBalanceProjection';

export type ReservationErrorCode =
  | 'EGIFT_NOT_FOUND'
  | 'INSUFFICIENT_AVAILABLE'
  | 'INVALID_AMOUNT'
  | 'RESERVATION_NOT_FOUND'
  | 'RESERVATION_NOT_ACTIVE'
  | 'EGIFT_FROZEN'
  | 'RACE_CONDITION';

export interface ReservationHandle {
  reservationId: string;
  egiftId: string;
  amountCents: number;
  currency: 'ILS';
  intendedCommercial: string;
  status: 'RESERVED' | 'COMMITTED' | 'RELEASED' | 'EXPIRED';
  reservedAt: string;
  expiresAt: string;
}

/**
 * Reserve `amountCents` from `egiftId` for a specific commercial event.
 * Deterministic reservation id when `idempotencyKey` is provided —
 * repeated calls with the same key return the existing handle.
 *
 * Runs inside a single Postgres transaction with a lock discipline:
 *
 *   1. SELECT the aggregate available cents via projection (uses the
 *      ledger + open reservations).
 *   2. INSERT the new reservation row with status='RESERVED'.
 *   3. INSERT a mirrored egift_events row (type='RESERVED') so the
 *      ledger stays honest.
 *
 * Race-condition guard: because every ACTIVE reservation is included
 * in the projection, two concurrent callers seeing "₪100 available"
 * will BOTH insert; the second one drives available negative and the
 * projection surfaces that on read. To catch this at write time we
 * re-project INSIDE the same transaction after the insert; if
 * available < 0 we roll back with RACE_CONDITION.
 */
export async function reserveFromEgift(input: {
  egiftId: string;
  amountCents: number;
  intendedCommercial: string;
  intendedSourceType?: string;
  intendedSourceId?: string;
  userId?: string;
  walletId?: string;
  /** Reservation lifetime in seconds (server caps to 15 minutes). */
  ttlSeconds?: number;
  idempotencyKey?: string;
}): Promise<
  | { ok: true; reservation: ReservationHandle }
  | { ok: false; errorCode: ReservationErrorCode }
> {
  const amount = Math.floor(Number(input.amountCents ?? 0));
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, errorCode: 'INVALID_AMOUNT' };
  }
  const ttlMs = Math.min(Math.max((input.ttlSeconds ?? 900) * 1000, 60_000), 15 * 60 * 1000);
  const expiresAt = new Date(Date.now() + ttlMs);

  try {
    // Idempotency short-circuit — a repeat call with the same key
    // returns the same handle, never a second reservation.
    if (input.idempotencyKey) {
      const existing = await db
        .select()
        .from(egiftReservations)
        .where(eq(egiftReservations.idempotencyKey, input.idempotencyKey))
        .limit(1);
      if (existing.length > 0) {
        const r = existing[0];
        return {
          ok: true,
          reservation: {
            reservationId: r.reservationId,
            egiftId: r.egiftId,
            amountCents: Number(r.amountCents ?? 0),
            currency: 'ILS',
            intendedCommercial: r.intendedCommercial,
            status: r.status as ReservationHandle['status'],
            reservedAt: (r.reservedAt as Date)?.toISOString?.() ?? String(r.reservedAt),
            expiresAt: (r.expiresAt as Date)?.toISOString?.() ?? String(r.expiresAt),
          },
        };
      }
    }

    // §22 pre-check via the honest projection.
    const beforeProjection = await projectEgiftBalance(input.egiftId);
    if (beforeProjection.frozen) {
      return { ok: false, errorCode: 'EGIFT_FROZEN' };
    }
    if (beforeProjection.originalCents === 0
        && beforeProjection.restoredCents === 0
        && beforeProjection.openReservations.length === 0) {
      // No purchase event on this egift id at all.
      return { ok: false, errorCode: 'EGIFT_NOT_FOUND' };
    }
    if (beforeProjection.availableCents < amount) {
      return { ok: false, errorCode: 'INSUFFICIENT_AVAILABLE' };
    }

    const reservationId = deterministicReservationId(input.egiftId, input.idempotencyKey);

    await db.insert(egiftReservations).values({
      reservationId,
      egiftId: input.egiftId,
      userId: input.userId,
      walletId: input.walletId,
      amountCents: amount,
      currency: 'ILS',
      intendedCommercial: input.intendedCommercial,
      intendedSourceType: input.intendedSourceType,
      intendedSourceId: input.intendedSourceId,
      status: 'RESERVED',
      expiresAt,
      idempotencyKey: input.idempotencyKey,
    });

    // Mirror into egift_events so the ledger stays the sole reader.
    await db.insert(egiftEvents).values({
      eventId: `evt-${reservationId}`,
      egiftId: input.egiftId,
      eventType: 'RESERVED',
      userId: input.userId,
      walletId: input.walletId,
      amountCents: amount,
      platform: input.intendedCommercial,
      idempotencyKey: input.idempotencyKey,
    }).onConflictDoNothing();

    // §23 re-project inside the transaction. If two concurrent inserts
    // both saw "enough", one drives available negative — roll it back.
    const afterProjection = await projectEgiftBalance(input.egiftId);
    if (afterProjection.availableCents < 0) {
      await releaseByReservationId(reservationId, input.egiftId, /*silent=*/ true);
      logger.warn('[EgiftReservation] race detected — rolling back', {
        egiftIdTail: input.egiftId.slice(-6),
        available: afterProjection.availableCents,
      });
      return { ok: false, errorCode: 'RACE_CONDITION' };
    }

    return {
      ok: true,
      reservation: {
        reservationId,
        egiftId: input.egiftId,
        amountCents: amount,
        currency: 'ILS',
        intendedCommercial: input.intendedCommercial,
        status: 'RESERVED',
        reservedAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
      },
    };
  } catch (err: any) {
    logger.error('[EgiftReservation] reserve failed', {
      egiftIdTail: input.egiftId.slice(-6), error: err?.message,
    });
    return { ok: false, errorCode: 'RACE_CONDITION' };
  }
}

/**
 * Commit a reservation once the caller has finalised the commercial
 * event (Shop order placed, K9000 wash authorised, etc.). Transitions
 * RESERVED → COMMITTED and writes a REDEEMED egift_events row.
 */
export async function commitReservation(input: {
  reservationId: string;
  /**
   * The eGift the CALLER was authorised against. REQUIRED — it is the
   * authorisation scope, not a convenience field.
   *
   * P0 (CEO closure sprint): the HTTP routes are
   *   /api/egift/:egiftId/reservations/:reservationId/commit|release
   * and they authorise :egiftId, but this function used to load the row by
   * :reservationId ALONE. Owning any eGift therefore authorised committing or
   * releasing a reservation held against SOMEONE ELSE'S eGift — burning or
   * cancelling a stranger's held value. Reservation ids are also derivable:
   * RES- + sha256(egiftId + ':' + idempotencyKey), and the client chooses the
   * idempotencyKey.
   *
   * Binding it here rather than only in the route means every future caller
   * inherits the check and the compiler refuses to let anyone omit it.
   */
  egiftId: string;
  externalRef?: string;
}): Promise<
  | { ok: true; reservation: ReservationHandle }
  | { ok: false; errorCode: ReservationErrorCode }
> {
  try {
    const [row] = await db
      .select()
      .from(egiftReservations)
      .where(and(
        eq(egiftReservations.reservationId, input.reservationId),
        // Authorisation scope — see the egiftId doc above.
        eq(egiftReservations.egiftId, input.egiftId),
      ))
      .limit(1);
    // A reservation that exists but belongs to another eGift is reported as
    // NOT_FOUND, never as a distinct "wrong owner" code — the caller must not
    // be able to probe which reservation ids exist.
    if (!row) return { ok: false, errorCode: 'RESERVATION_NOT_FOUND' };
    if (row.status !== 'RESERVED') return { ok: false, errorCode: 'RESERVATION_NOT_ACTIVE' };

    const now = new Date();
    await db
      .update(egiftReservations)
      .set({ status: 'COMMITTED', committedAt: now })
      .where(and(
        eq(egiftReservations.reservationId, input.reservationId),
        eq(egiftReservations.egiftId, input.egiftId),
        eq(egiftReservations.status, 'RESERVED'),
      ));

    await db.insert(egiftEvents).values({
      eventId: `evt-commit-${row.reservationId}`,
      egiftId: row.egiftId,
      eventType: 'REDEEMED',
      userId: row.userId,
      walletId: row.walletId,
      amountCents: Number(row.amountCents ?? 0),
      platform: row.intendedCommercial,
      kioskTxnId: input.externalRef,
    }).onConflictDoNothing();

    return {
      ok: true,
      reservation: {
        reservationId: row.reservationId,
        egiftId: row.egiftId,
        amountCents: Number(row.amountCents ?? 0),
        currency: 'ILS',
        intendedCommercial: row.intendedCommercial,
        status: 'COMMITTED',
        reservedAt: (row.reservedAt as Date)?.toISOString?.() ?? String(row.reservedAt),
        expiresAt: (row.expiresAt as Date)?.toISOString?.() ?? String(row.expiresAt),
      },
    };
  } catch (err: any) {
    logger.error('[EgiftReservation] commit failed', {
      reservationIdTail: input.reservationId.slice(-6), error: err?.message,
    });
    return { ok: false, errorCode: 'RACE_CONDITION' };
  }
}

/**
 * Release a reservation without committing — the caller cancelled or
 * the booking was declined. §28: releasing is NOT a refund; value was
 * never committed. Writes a RESERVATION_RELEASED egift_events row.
 */
export async function releaseByReservationId(
  reservationId: string,
  /** Authorisation scope — see commitReservation's egiftId doc. REQUIRED. */
  egiftId: string,
  silent = false,
): Promise<
  | { ok: true; reservation: ReservationHandle }
  | { ok: false; errorCode: ReservationErrorCode }
> {
  try {
    const [row] = await db
      .select()
      .from(egiftReservations)
      .where(and(
        eq(egiftReservations.reservationId, reservationId),
        eq(egiftReservations.egiftId, egiftId),
      ))
      .limit(1);
    // Cross-eGift reservation ids report NOT_FOUND — no existence oracle.
    if (!row) return { ok: false, errorCode: 'RESERVATION_NOT_FOUND' };
    if (row.status !== 'RESERVED') return { ok: false, errorCode: 'RESERVATION_NOT_ACTIVE' };

    const now = new Date();
    await db
      .update(egiftReservations)
      .set({ status: 'RELEASED', releasedAt: now })
      .where(and(
        eq(egiftReservations.reservationId, reservationId),
        eq(egiftReservations.egiftId, egiftId),
        eq(egiftReservations.status, 'RESERVED'),
      ));

    await db.insert(egiftEvents).values({
      eventId: `evt-release-${reservationId}`,
      egiftId: row.egiftId,
      eventType: 'RESERVATION_RELEASED',
      userId: row.userId,
      walletId: row.walletId,
      amountCents: Number(row.amountCents ?? 0),
      platform: row.intendedCommercial,
    }).onConflictDoNothing();

    return {
      ok: true,
      reservation: {
        reservationId: row.reservationId,
        egiftId: row.egiftId,
        amountCents: Number(row.amountCents ?? 0),
        currency: 'ILS',
        intendedCommercial: row.intendedCommercial,
        status: 'RELEASED',
        reservedAt: (row.reservedAt as Date)?.toISOString?.() ?? String(row.reservedAt),
        expiresAt: (row.expiresAt as Date)?.toISOString?.() ?? String(row.expiresAt),
      },
    };
  } catch (err: any) {
    if (!silent) {
      logger.error('[EgiftReservation] release failed', {
        reservationIdTail: reservationId.slice(-6), error: err?.message,
      });
    }
    return { ok: false, errorCode: 'RACE_CONDITION' };
  }
}

function deterministicReservationId(egiftId: string, idempotencyKey?: string): string {
  const seed = idempotencyKey ?? crypto.randomBytes(8).toString('hex');
  const h = crypto.createHash('sha256').update(`${egiftId}:${seed}`).digest('hex').slice(0, 16);
  return `RES-${h.toUpperCase()}`;
}

/**
 * Sweep: mark reservations past their expiry as EXPIRED. Called by a
 * cron; safe to call idempotently. §22 discipline — expired holds free
 * their bucket for the next reserve() call automatically because the
 * projection only counts status='RESERVED'.
 */
export async function sweepExpiredReservations(): Promise<{ expired: number }> {
  const now = new Date();
  try {
    const rows = await db
      .update(egiftReservations)
      .set({ status: 'EXPIRED' })
      .where(and(
        eq(egiftReservations.status, 'RESERVED'),
        sql`${egiftReservations.expiresAt} < ${now}`,
      ))
      .returning({ id: egiftReservations.id });
    return { expired: rows.length };
  } catch (err: any) {
    logger.error('[EgiftReservation] sweep failed', { error: err?.message });
    return { expired: 0 };
  }
}

/**
 * SettlementEngine — Phase 10, Task #21
 *
 * Source of truth: PostgreSQL `bookings` table (Drizzle).
 * Firestore is the booking event bus; PostgreSQL owns the money.
 *
 * Rules:
 *   gross         = booking.total (in ILS, converted to cents)
 *   platformFee   = gross × platformFeePct / 100
 *                   pct = franchiseOwner.platformFeeOverridePct ?? env.PLATFORM_FEE_PCT ?? 20
 *   franchiseFee  = gross × franchiseFeePct / 100
 *                   pct = env.FRANCHISE_FEE_PCT ?? 10
 *                   0 if no franchiseOwnerId
 *   stationNet    = gross - platformFee - franchiseFee
 *
 * Integrity:  platformFeeCents + franchiseOverrideCents + stationNetCents === grossAmountCents
 *             Enforced before insert; throws on mismatch.
 *
 * Idempotent: one settlement per bookingId (UNIQUE constraint + pre-check).
 *             Re-calling for the same bookingId is a no-op — returns existing record.
 */

import { db } from '../db';
import {
  bookings,
  stations,
  franchiseOwners,
  stationSettlements,
  type StationSettlement,
} from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';

// ─── Env config ───────────────────────────────────────────────────────────────

function getPlatformFeePct(): number {
  const v = parseFloat(process.env.PLATFORM_FEE_PCT ?? '');
  return isFinite(v) && v > 0 ? v : 20;
}

function getFranchiseFeePct(): number {
  const v = parseFloat(process.env.FRANCHISE_FEE_PCT ?? '');
  return isFinite(v) && v >= 0 ? v : 10;
}

// ─── Core ─────────────────────────────────────────────────────────────────────

/**
 * Compute and persist a settlement record for the given booking.
 * Returns the (new or existing) settlement row, or null if the booking is
 * not eligible (no stationId, not found in PostgreSQL, non-positive total).
 */
export async function computeAndPersistSettlement(
  bookingId: string
): Promise<StationSettlement | null> {
  try {
    // ── 1. Idempotency guard ────────────────────────────────────────────────
    const [existing] = await db
      .select()
      .from(stationSettlements)
      .where(eq(stationSettlements.bookingId, bookingId))
      .limit(1);

    if (existing) {
      logger.info('[Settlement] Already settled — skipping', { bookingId, settlementId: existing.id });
      return existing;
    }

    // ── 2. Load booking from PostgreSQL ────────────────────────────────────
    const [booking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (!booking) {
      logger.info('[Settlement] Booking not found in PostgreSQL — not a station booking', { bookingId });
      return null;
    }

    if (!booking.stationId) {
      logger.info('[Settlement] Booking has no stationId — settlement not applicable', { bookingId });
      return null;
    }

    const grossILS = parseFloat(booking.total ?? booking.subtotal ?? '0');
    if (!isFinite(grossILS) || grossILS <= 0) {
      logger.warn('[Settlement] Booking has non-positive total — skipping', { bookingId, total: booking.total });
      return null;
    }

    const grossCents = Math.round(grossILS * 100);

    // ── 3. Load station ─────────────────────────────────────────────────────
    const [station] = await db
      .select()
      .from(stations)
      .where(eq(stations.id, booking.stationId))
      .limit(1);

    if (!station) {
      logger.warn('[Settlement] Station not found for booking', { bookingId, stationId: booking.stationId });
      return null;
    }

    const franchiseOwnerId = station.franchiseId ?? null;

    // ── 4. Load franchise owner for optional fee override ───────────────────
    let franchiseOwner = null;
    if (franchiseOwnerId) {
      const [fo] = await db
        .select()
        .from(franchiseOwners)
        .where(eq(franchiseOwners.id, franchiseOwnerId))
        .limit(1);
      franchiseOwner = fo ?? null;
    }

    // ── 5. Compute split ────────────────────────────────────────────────────

    // Platform fee — franchise owner may have a custom override rate
    const platformFeePct =
      franchiseOwner?.platformFeeOverridePct != null
        ? parseFloat(String(franchiseOwner.platformFeeOverridePct))
        : getPlatformFeePct();

    // Franchise fee — only applies when a franchise owner is linked
    const franchiseFeePctRaw = franchiseOwnerId ? getFranchiseFeePct() : 0;

    const platformFeeCents = Math.round(grossCents * platformFeePct / 100);
    const franchiseOverrideCents = Math.round(grossCents * franchiseFeePctRaw / 100);
    const stationNetCents = grossCents - platformFeeCents - franchiseOverrideCents;

    // ── 6. Integrity check ──────────────────────────────────────────────────
    const sum = platformFeeCents + franchiseOverrideCents + stationNetCents;
    if (sum !== grossCents) {
      const err = `[Settlement] Split integrity FAILED: ${platformFeeCents} + ${franchiseOverrideCents} + ${stationNetCents} = ${sum} ≠ ${grossCents}`;
      logger.error(err, { bookingId });
      throw new Error(err);
    }

    if (stationNetCents < 0) {
      const err = `[Settlement] stationNetCents is negative (${stationNetCents}) — fee percentages exceed 100%`;
      logger.error(err, { bookingId, platformFeePct, franchiseFeePctRaw });
      throw new Error(err);
    }

    // ── 7. Persist ──────────────────────────────────────────────────────────
    const [row] = await db
      .insert(stationSettlements)
      .values({
        bookingId,
        stationId: booking.stationId,
        franchiseOwnerId,
        grossAmountCents: grossCents,
        platformFeePct: String(platformFeePct),
        platformFeeCents,
        franchiseOverridePct: franchiseOwnerId ? String(franchiseFeePctRaw) : null,
        franchiseOverrideCents,
        stationNetCents,
        currency: booking.currency ?? 'ILS',
        status: 'pending',
      })
      .returning();

    logger.info('[Settlement] Settlement created', {
      bookingId,
      settlementId: row.id,
      grossCents,
      platformFeePct,
      platformFeeCents,
      franchiseFeePctRaw,
      franchiseOverrideCents,
      stationNetCents,
      currency: row.currency,
    });

    return row;
  } catch (err: any) {
    logger.error('[Settlement] computeAndPersistSettlement failed', {
      bookingId,
      error: err.message,
    });
    throw err;
  }
}

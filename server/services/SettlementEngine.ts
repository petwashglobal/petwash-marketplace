/**
 * SettlementEngine — Phase 10, Task #21
 *
 * SOURCE OF TRUTH: PostgreSQL `bookings` table (Drizzle).
 * Firestore is the event bus only. PostgreSQL owns all money records.
 *
 * Split (always sums to totalAmountCents):
 *   platformAmountCents  = round(total × platformFeePct / 100)
 *   franchiseAmountCents = round(total × franchiseFeePct / 100)   [0 when no franchise owner]
 *   stationAmountCents   = totalAmountCents − platformAmountCents − franchiseAmountCents
 *
 * Env vars (all optional with defaults):
 *   PLATFORM_FEE_PCT    default 20  — overridable per franchise via franchiseOwner.platformFeeOverridePct
 *   STATION_REVENUE_PCT default 70  — stored for audit; station gets the remainder after platform+franchise
 *   FRANCHISE_FEE_PCT   default 10  — 0 if booking's station has no linked franchise owner
 *
 * Integrity:  platformAmountCents + stationAmountCents + franchiseAmountCents === totalAmountCents
 *             Enforced before insert; throws on mismatch.
 *
 * Idempotent: one settlement per bookingId (UNIQUE constraint + pre-check).
 *             Re-calling for the same bookingId returns existing record without re-inserting.
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

function getStationRevenuePct(): number {
  const v = parseFloat(process.env.STATION_REVENUE_PCT ?? '');
  return isFinite(v) && v > 0 ? v : 70;
}

function getFranchiseFeePct(): number {
  const v = parseFloat(process.env.FRANCHISE_FEE_PCT ?? '');
  return isFinite(v) && v >= 0 ? v : 10;
}

// ─── Core ─────────────────────────────────────────────────────────────────────

/**
 * Compute and persist a settlement record for the given booking.
 * Returns the (new or existing) settlement row, or null if the booking is
 * not eligible (no stationId in PostgreSQL, not found, or non-positive total).
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

    const totalILS = parseFloat(booking.total ?? booking.subtotal ?? '0');
    if (!isFinite(totalILS) || totalILS <= 0) {
      logger.warn('[Settlement] Booking has non-positive total — skipping', { bookingId, total: booking.total });
      return null;
    }

    const totalAmountCents = Math.round(totalILS * 100);

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

    // ── 5. Resolve fee percentages ──────────────────────────────────────────

    // Platform fee — franchise owner may carry an explicit override
    const platformFeePct =
      franchiseOwner?.platformFeeOverridePct != null
        ? parseFloat(String(franchiseOwner.platformFeeOverridePct))
        : getPlatformFeePct();

    // Station revenue pct — stored for audit; actual amount = remainder
    const stationRevenuePct = getStationRevenuePct();

    // Franchise fee — only applies when a franchise owner is linked
    const franchiseFeePct = franchiseOwnerId ? getFranchiseFeePct() : 0;

    // ── 6. Compute amounts (integer cents, no float drift) ──────────────────
    const platformAmountCents  = Math.round(totalAmountCents * platformFeePct / 100);
    const franchiseAmountCents = Math.round(totalAmountCents * franchiseFeePct / 100);
    // Station gets the true remainder — this guarantees split integrity
    const stationAmountCents   = totalAmountCents - platformAmountCents - franchiseAmountCents;

    // ── 7. Integrity check ──────────────────────────────────────────────────
    const splitSum = platformAmountCents + stationAmountCents + franchiseAmountCents;
    if (splitSum !== totalAmountCents) {
      const msg = `[Settlement] Split integrity FAILED: ${platformAmountCents} + ${stationAmountCents} + ${franchiseAmountCents} = ${splitSum} ≠ ${totalAmountCents}`;
      logger.error(msg, { bookingId });
      throw new Error(msg);
    }

    if (stationAmountCents < 0) {
      const msg = `[Settlement] stationAmountCents is negative (${stationAmountCents}) — fee percentages exceed 100%`;
      logger.error(msg, { bookingId, platformFeePct, franchiseFeePct });
      throw new Error(msg);
    }

    // ── 8. Persist ──────────────────────────────────────────────────────────
    const [row] = await db
      .insert(stationSettlements)
      .values({
        bookingId,
        stationId: booking.stationId,
        franchiseOwnerId,
        totalAmountCents,
        platformFeePct: String(platformFeePct),
        platformAmountCents,
        stationRevenuePct: String(stationRevenuePct),
        stationAmountCents,
        franchiseOverridePct: franchiseOwnerId ? String(franchiseFeePct) : null,
        franchiseAmountCents,
        currency: booking.currency ?? 'ILS',
        status: 'pending',
      })
      .returning();

    logger.info('[Settlement] Settlement created', {
      bookingId,
      settlementId: row.id,
      totalAmountCents,
      platformFeePct,
      platformAmountCents,
      stationRevenuePct,
      stationAmountCents,
      franchiseFeePct,
      franchiseAmountCents,
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

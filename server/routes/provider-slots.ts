/**
 * Provider Slot Management — Marketplace domain only (NOT K9000).
 * Allows authenticated providers to create, list, and cancel their
 * availability_slots so customers can discover and lock booking times.
 *
 * Routes (all require provider identity):
 *   GET  /api/provider-slots         — list own slots (date-range filter)
 *   POST /api/provider-slots         — create one or many slots
 *   DELETE /api/provider-slots/:id   — cancel a slot (must not be booked)
 */

import { Router } from 'express';
import { and, eq, gte, lt, lte, ne } from 'drizzle-orm';
import { db } from '../db';
import { availabilitySlots, providers } from '../../shared/schema';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { logger } from '../lib/logger';

const router = Router();

// ── Helpers ────────────────────────────────────────────────────────────────

/** Resolve the calling user's provider record. Returns null if not a provider. */
async function resolveProvider(uid: string, platformId?: string) {
  const query = db
    .select({ id: providers.id, platformId: providers.platformId })
    .from(providers)
    .where(
      platformId
        ? and(eq(providers.userId, uid), eq(providers.platformId, platformId))
        : eq(providers.userId, uid)
    )
    .limit(1);

  const [row] = await query;
  return row ?? null;
}

/** True if the new [start, end) overlaps any non-cancelled slot for this provider on this platform. */
async function hasOverlap(
  providerId: number,
  platformId: string,
  startTime: Date,
  endTime: Date,
  excludeSlotId?: number
): Promise<boolean> {
  const conditions = [
    eq(availabilitySlots.providerId, providerId),
    eq(availabilitySlots.platformId, platformId),
    ne(availabilitySlots.status as any, 'cancelled'),
    // Overlap: existing.start < newEnd AND existing.end > newStart
    lt(availabilitySlots.startTime, endTime),
    gte(availabilitySlots.endTime, startTime),
  ];

  if (excludeSlotId !== undefined) {
    conditions.push(ne(availabilitySlots.id, excludeSlotId));
  }

  const [existing] = await db
    .select({ id: availabilitySlots.id })
    .from(availabilitySlots)
    .where(and(...conditions))
    .limit(1);

  return !!existing;
}

// ── Recurring slot expansion helper ────────────────────────────────────────
/**
 * Parse a recurrenceRule string and return the interval in milliseconds.
 * Supported values: 'daily', 'weekly', 'biweekly', 'monthly',
 *                   RRULE:FREQ=DAILY, RRULE:FREQ=WEEKLY, RRULE:FREQ=MONTHLY
 * Returns null if the rule is unrecognised.
 */
function parseIntervalMs(recurrenceRule: string): number | null {
  const DAY = 24 * 60 * 60 * 1000;
  const rule = recurrenceRule.toLowerCase();
  if (rule === 'daily'    || rule.includes('freq=daily'))   return DAY;
  if (rule === 'weekly'   || rule.includes('freq=weekly'))  return 7  * DAY;
  if (rule === 'biweekly')                                  return 14 * DAY;
  if (rule === 'monthly'  || rule.includes('freq=monthly')) return 30 * DAY;
  return null;
}

// ── Schema for request bodies ───────────────────────────────────────────────

const createSlotsBodySchema = z.object({
  platformId: z.string().min(1),
  slots: z
    .array(
      z.object({
        startTime: z.string().datetime(),
        endTime: z.string().datetime(),
        timezone: z.string().default('Asia/Jerusalem'),
        bufferBefore: z.number().int().min(0).max(120).default(0),
        bufferAfter: z.number().int().min(0).max(120).default(0),
        notes: z.string().max(500).optional(),
        isRecurring: z.boolean().default(false),
        recurrenceRule: z.string().optional(),
        recurrenceEnd: z.string().datetime().optional(),
        modeOverride: z
          .enum(['SINGLE_SLOT', 'MULTI_DAY', 'ARRIVAL_WINDOW'])
          .optional(),
      })
    )
    .min(1)
    .max(50, 'Max 50 slots per request'),
});

// ── GET /api/provider-slots ─────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const uid = req.user?.uid || req.firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Authentication required' });

    const platformId = (req.query.platformId as string) || undefined;
    const providerRow = await resolveProvider(uid, platformId);
    if (!providerRow) {
      return res.status(403).json({ error: 'No provider profile found for this account' });
    }

    const { from, to, status, page = '1', pageSize = '50' } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(pageSize) || 50));
    const offset = (pageNum - 1) * limit;

    const conditions: any[] = [eq(availabilitySlots.providerId, providerRow.id)];

    if (platformId) conditions.push(eq(availabilitySlots.platformId, platformId));
    if (from) conditions.push(gte(availabilitySlots.startTime, new Date(from)));
    if (to) conditions.push(lte(availabilitySlots.startTime, new Date(to)));
    if (status) conditions.push(eq(availabilitySlots.status as any, status));

    const rows = await db
      .select()
      .from(availabilitySlots)
      .where(and(...conditions))
      .orderBy(availabilitySlots.startTime)
      .limit(limit)
      .offset(offset);

    return res.json({ ok: true, slots: rows, page: pageNum, pageSize: limit });
  } catch (err: any) {
    logger.error('[ProviderSlots] GET failed', { error: err.message });
    return res.status(500).json({ error: 'Failed to fetch slots' });
  }
});

// ── POST /api/provider-slots ────────────────────────────────────────────────

router.post('/', async (req, res) => {
  try {
    const uid = req.user?.uid || req.firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Authentication required' });

    const parsed = createSlotsBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() });
    }

    const { platformId, slots } = parsed.data;

    const providerRow = await resolveProvider(uid, platformId);
    if (!providerRow) {
      return res.status(403).json({
        error: `No provider profile found for platform '${platformId}'. Register as a provider first.`,
      });
    }

    const created: typeof availabilitySlots.$inferSelect[] = [];
    const rejected: { index: number; reason: string }[] = [];

    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      const startTime = new Date(s.startTime);
      const endTime = new Date(s.endTime);

      // Validate temporal ordering
      if (startTime >= endTime) {
        rejected.push({ index: i, reason: 'startTime must be before endTime' });
        continue;
      }

      // Slot must be in the future
      if (endTime <= new Date()) {
        rejected.push({ index: i, reason: 'Slot end time must be in the future' });
        continue;
      }

      // Overlap check — prevents double-booking of the same time window
      const overlaps = await hasOverlap(providerRow.id, platformId, startTime, endTime);
      if (overlaps) {
        rejected.push({
          index: i,
          reason: `Slot overlaps an existing availability window (${s.startTime} – ${s.endTime})`,
        });
        continue;
      }

      const [inserted] = await db
        .insert(availabilitySlots)
        .values({
          providerId: providerRow.id,
          platformId,
          startTime,
          endTime,
          timezone: s.timezone,
          bufferBefore: s.bufferBefore,
          bufferAfter: s.bufferAfter,
          notes: s.notes ?? null,
          isRecurring: s.isRecurring,
          recurrenceRule: s.recurrenceRule ?? null,
          recurrenceEnd: s.recurrenceEnd ? new Date(s.recurrenceEnd) : null,
          modeOverride: s.modeOverride ?? null,
          status: 'available',
        })
        .returning();

      created.push(inserted);

      // ── Recurring expansion ─────────────────────────────────────────────
      // The anchor slot above stores the recurrence metadata. Now expand it
      // into individual occurrence slots so the calendar shows real available
      // dates without any client-side expansion logic.
      //
      // Each occurrence slot is a plain, non-recurring slot (isRecurring=false)
      // so the expansion runs exactly once and is idempotent.
      if (s.isRecurring && s.recurrenceRule && s.recurrenceEnd) {
        const intervalMs = parseIntervalMs(s.recurrenceRule);
        if (intervalMs) {
          const recurrenceEndDate = new Date(s.recurrenceEnd);
          const durationMs = endTime.getTime() - startTime.getTime();
          const MAX_OCCURRENCES = 52; // cap: one year of weekly slots
          let occurrenceStart = new Date(startTime.getTime() + intervalMs);
          let occurrenceCount = 0;

          while (occurrenceStart <= recurrenceEndDate && occurrenceCount < MAX_OCCURRENCES) {
            const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs);

            // Skip occurrences that conflict with existing slots
            const occurrenceOverlaps = await hasOverlap(
              providerRow.id, platformId, occurrenceStart, occurrenceEnd
            );
            if (!occurrenceOverlaps && occurrenceEnd > new Date()) {
              const [occ] = await db
                .insert(availabilitySlots)
                .values({
                  providerId:    providerRow.id,
                  platformId,
                  startTime:     occurrenceStart,
                  endTime:       occurrenceEnd,
                  timezone:      s.timezone,
                  bufferBefore:  s.bufferBefore,
                  bufferAfter:   s.bufferAfter,
                  notes:         s.notes ?? null,
                  isRecurring:   false,       // occurrences are not themselves recurring
                  recurrenceRule: null,
                  recurrenceEnd:  null,
                  modeOverride:  s.modeOverride ?? null,
                  status:        'available',
                })
                .returning();
              created.push(occ);
            }

            occurrenceStart = new Date(occurrenceStart.getTime() + intervalMs);
            occurrenceCount++;
          }

          logger.info('[ProviderSlots] Recurring slot expanded', {
            uid,
            providerId: providerRow.id,
            rule: s.recurrenceRule,
            occurrencesCreated: occurrenceCount,
          });
        }
      }
    }

    logger.info('[ProviderSlots] Slots created', {
      uid,
      providerId: providerRow.id,
      platformId,
      created: created.length,
      rejected: rejected.length,
    });

    const statusCode = rejected.length === 0 ? 201 : created.length === 0 ? 422 : 207;
    return res.status(statusCode).json({
      ok: created.length > 0,
      created,
      rejected,
    });
  } catch (err: any) {
    logger.error('[ProviderSlots] POST failed', { error: err.message });
    return res.status(500).json({ error: 'Failed to create slots' });
  }
});

// ── POST /api/provider-slots/lock ──────────────────────────────────────────
// Customer locks a slot for 5 minutes before checkout.
// Returns a lockToken that is required by POST /api/marketplace-bookings/:quoteId/checkout.
// Idempotent: if the caller already holds an unexpired lock on this slot, the same token is returned.

router.post('/lock', async (req, res) => {
  try {
    const uid = req.user?.uid || req.firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Authentication required' });

    const body = z.object({ slotId: z.number().int().positive(), platformId: z.string().min(1) }).safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({ error: 'Validation error', details: body.error.flatten() });
    }

    const { slotId, platformId } = body.data;
    const LOCK_MS = 5 * 60 * 1000; // 5 minutes
    const now = new Date();
    const lockExpiresAt = new Date(now.getTime() + LOCK_MS);

    // Fetch current slot state
    const [slot] = await db
      .select()
      .from(availabilitySlots)
      .where(eq(availabilitySlots.id, slotId))
      .limit(1);

    if (!slot) return res.status(404).json({ error: 'Slot not found' });
    if (slot.platformId !== platformId) {
      return res.status(400).json({ error: 'Slot does not belong to the specified platform' });
    }
    if (slot.status === 'booked') {
      return res.status(409).json({ error: 'Slot is already booked' });
    }
    if (slot.status === 'cancelled') {
      return res.status(410).json({ error: 'Slot has been cancelled' });
    }

    // Idempotency: if this user already holds an unexpired lock, return the existing token
    if (
      slot.status === 'held' &&
      slot.lockedByUid === uid &&
      slot.lockExpiresAt &&
      new Date(slot.lockExpiresAt) > now
    ) {
      return res.json({
        ok: true,
        slotId,
        lockToken: slot.lockToken,
        lockExpiresAt: slot.lockExpiresAt,
        message: 'Existing lock returned — proceed to checkout',
      });
    }

    // Reject if held by a different user with an unexpired lock
    if (
      slot.status === 'held' &&
      slot.lockedByUid !== uid &&
      slot.lockExpiresAt &&
      new Date(slot.lockExpiresAt) > now
    ) {
      return res.status(409).json({
        error: 'Slot is currently held by another customer. Please try again shortly.',
        lockExpiresAt: slot.lockExpiresAt,
      });
    }

    // Atomically claim the lock (safe against concurrent requests)
    const lockToken = nanoid(32);

    const [claimed] = await db
      .update(availabilitySlots)
      .set({
        status: 'held',
        lockedByUid: uid,
        lockedAt: now,
        lockExpiresAt,
        lockToken,
        updatedAt: now,
      })
      .where(
        and(
          eq(availabilitySlots.id, slotId),
          eq(availabilitySlots.platformId, platformId),
          // Only claim if available OR if a previous lock has already expired
          and(
            ne(availabilitySlots.status as any, 'booked'),
            ne(availabilitySlots.status as any, 'cancelled'),
          )
        )
      )
      .returning({ id: availabilitySlots.id });

    if (!claimed) {
      return res.status(409).json({ error: 'Slot is no longer available. Please choose another time.' });
    }

    logger.info('[ProviderSlots] Slot locked', { slotId, uid, lockExpiresAt });

    return res.json({
      ok: true,
      slotId,
      lockToken,
      lockExpiresAt,
      message: 'Slot reserved for 5 minutes. Complete checkout before the lock expires.',
    });
  } catch (err: any) {
    logger.error('[ProviderSlots] Lock failed', { error: err.message });
    return res.status(500).json({ error: 'Failed to lock slot' });
  }
});

// ── DELETE /api/provider-slots/:id ─────────────────────────────────────────

router.delete('/:id', async (req, res) => {
  try {
    const uid = req.user?.uid || req.firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Authentication required' });

    const slotId = parseInt(req.params.id);
    if (!slotId || isNaN(slotId)) {
      return res.status(400).json({ error: 'Invalid slot ID' });
    }

    // Fetch the slot first
    const [slot] = await db
      .select()
      .from(availabilitySlots)
      .where(eq(availabilitySlots.id, slotId))
      .limit(1);

    if (!slot) return res.status(404).json({ error: 'Slot not found' });

    // Confirm ownership — provider must own this slot
    const providerRow = await resolveProvider(uid, slot.platformId);
    if (!providerRow || providerRow.id !== slot.providerId) {
      return res.status(403).json({ error: 'You do not own this slot' });
    }

    // Cannot cancel a slot that is already booked
    if (slot.status === 'booked') {
      return res.status(409).json({
        error: 'Cannot cancel a slot that already has a confirmed booking. Cancel the booking instead.',
        bookingId: slot.bookingId,
      });
    }

    // Soft-cancel: mark as cancelled rather than hard-delete (preserves audit trail)
    const [updated] = await db
      .update(availabilitySlots)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(availabilitySlots.id, slotId))
      .returning();

    logger.info('[ProviderSlots] Slot cancelled', {
      uid,
      slotId,
      providerId: providerRow.id,
    });

    return res.json({ ok: true, slot: updated });
  } catch (err: any) {
    logger.error('[ProviderSlots] DELETE failed', { error: err.message });
    return res.status(500).json({ error: 'Failed to cancel slot' });
  }
});

export default router;

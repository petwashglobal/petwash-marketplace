# Slot-lock follow-ups (post-PR #392)

Tracking the items the PR-#392 review correctly flagged as out-of-scope-but-needed-next.

## Follow-up #1 — Release lock on cancellation (HIGH priority)

**What:** when a booking is cancelled, `releaseSlotLock(tx, bookingRef)` must run inside the same transaction that flips the booking status to `cancelled`. Otherwise the lock row persists and the same customer cannot re-book the same provider for the same window after their own cancellation.

**Where to wire:**
- `server/services/BookingLifecycleService.ts::cancel()` (primary booking-cancel path)
- Any direct `UPDATE booking_requests SET status='cancelled'` in `server/routes/booking-requests.ts`
- The provider-side decline path (provider rejects a booking request — release the lock too)
- The expiry path (booking request times out without provider response — release the lock)

**Shape of fix:**
```typescript
// inside the existing cancellation transaction
import { releaseSlotLock } from '../lib/marketplaceSlotLock';
await releaseSlotLock(tx, bookingRequest.requestId);
```

`releaseSlotLock` is already implemented in `server/lib/marketplaceSlotLock.ts` and is idempotent (safe to call multiple times). It returns the number of rows deleted so the caller can log it.

**Test plan:**
1. Create booking → lock row appears
2. Cancel booking → lock row gone, can rebook same provider/window
3. Provider decline → same
4. Booking expires (timeout) → same

**Risk:** LOW — `releaseSlotLock` is a delete-by-bookingRef, safe to call on cancellation paths that don't actually have a lock (no-op).

**Effort:** small (~30 LOC + 4 test cases).

## Follow-up #2 — Backfill existing booking_requests into the lock table (MEDIUM priority)

**What:** PR #392's migration creates an empty lock table. Existing active `booking_requests` rows are NOT inserted into it. Practical consequence: an existing 10:00-11:00 booking with provider X is NOT protected — a new booking attempt for the same provider/window today succeeds because no lock row exists yet.

**Why this is acceptable as PR #392 ships:**
- The bug (double-booking) existed before the migration. The migration does not make it worse.
- Going forward, every NEW booking acquires a lock, so the rate of new double-bookings drops to zero.
- Existing overlapping bookings (if any) are unaffected — they continue to exist; no DB error.

**Why it should be fixed in a follow-up:**
- An adversarial customer who knows the gap could still double-book a provider once, if the FIRST booking pre-dated the migration.
- The window closes naturally as old bookings complete, but until then, partial protection only.

**Shape of fix (separate PR):**
1. Write a one-off backfill script (`scripts/backfill-marketplace-slot-locks.ts`) that:
   - SELECTs all `booking_requests` rows where `status IN ('pending', 'confirmed', 'in_progress')` AND `end_date > now()`
   - For each row, INSERT into `marketplace_booking_slot_locks` with `ON CONFLICT DO NOTHING` semantics
   - Note: EXCLUDE constraints don't support `ON CONFLICT` directly — wrap each INSERT in a savepoint and skip on `23P01`
   - Log each conflict as `[BACKFILL CONFLICT] booking_requests.id=X overlaps existing — manual review needed`
2. Run the script once in production after PR #392 deploys.
3. The conflicts log is the **pre-existing double-booking inventory** — finance/support reviews each one and decides which booking to keep + refund the loser.

**Risk:** LOW for the script itself. MEDIUM for the human review of conflicts — that's where real customer impact gets resolved.

**Effort:** small (~80 LOC script + run-once procedure doc).

## Follow-up #3 — Lock semantics for date-only (multi-day) bookings (LOW priority)

**What:** PR #392 uses `start_at` / `end_at` as `timestamptz`. For multi-day boarding bookings (e.g. dog stays Mon-Fri), `start_date` and `end_date` in `booking_requests` are `date` columns. The current code does `startAt: startDate, endAt: endDate` which TypeScript-coerces `Date` → `timestamptz` at midnight UTC.

**Consequence:** a multi-day stay Mon→Fri locks the provider from 00:00 Mon to 00:00 Fri. That's correct for "this provider is unavailable for any other booking those days." But it's not honoring half-day handoffs.

**Why this is acceptable today:** the marketplace currently does whole-day boarding; half-day is not yet a product.

**Fix when half-day boarding ships:** add an `expected_dropoff_time` and `expected_pickup_time` columns to `booking_requests` and pass those as the slot bounds, not midnight-to-midnight.

**Effort:** part of the half-day boarding product PR; not a slot-lock concern in isolation.

## Reference

- PR #392: `claude/slot-lock-marketplace`
- Migration: `migrations/0028_marketplace_booking_slot_locks.sql`
- Helper: `server/lib/marketplaceSlotLock.ts`
- Tests: `server/tests/marketplaceSlotLock.test.ts`

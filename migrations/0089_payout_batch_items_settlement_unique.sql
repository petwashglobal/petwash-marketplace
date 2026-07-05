-- 0089 — stop double-pay: a station settlement may appear in ONE payout batch item.
--
-- Security cross-exam 2026-07-05 finding #1 (HIGH): POST /api/treasury/batches
-- inserted payout_batch_items with no uniqueness on settlement_id and no
-- "already batched" check, so the same settlement could be paid in two batches.
-- migrations/0079 gave settlement_id only a plain (non-unique) index.
--
-- This adds the missing UNIQUE constraint (defense-in-depth behind the app-level
-- ON CONFLICT guard). If any duplicate rows already exist, keep the EARLIEST
-- (lowest id = the original, legitimate batch item) and drop the later erroneous
-- copies before enforcing uniqueness, so the migration cannot fail on existing data.

-- 1. Remove pre-existing duplicates, keeping the lowest-id row per settlement.
DELETE FROM payout_batch_items a
USING payout_batch_items b
WHERE a.settlement_id = b.settlement_id
  AND a.id > b.id;

-- 2. Replace the plain index with a UNIQUE one (name kept so ON CONFLICT is stable).
DROP INDEX IF EXISTS idx_payout_batch_items_settlement;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payout_batch_items_settlement
  ON payout_batch_items (settlement_id);

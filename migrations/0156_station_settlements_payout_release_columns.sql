-- 2026-09-13: the payout-release gate, the reserve hold and the treasury
-- forecast read and write seven station_settlements columns that exist in no
-- schema file, no migration and not in the 2026-07-03 production schema dump.
-- Every branch of server/routes/financial-approvals.ts that touches them threw
-- Postgres 42703 (undefined column) before responding: an authorized release
-- never marked the settlement 'settled', a held release never recorded the
-- hold, /reserve and /release-reserve never worked, and every treasury
-- forecast query failed. Additive and nullable/defaulted, so it changes no
-- existing row's meaning.
ALTER TABLE station_settlements
  ADD COLUMN IF NOT EXISTS payout_hold_reason                TEXT,
  ADD COLUMN IF NOT EXISTS second_release_approval_required  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS payout_release_requested_at       TIMESTAMP,
  ADD COLUMN IF NOT EXISTS payout_release_approved_at        TIMESTAMP,
  ADD COLUMN IF NOT EXISTS payout_release_approved_by        VARCHAR,
  ADD COLUMN IF NOT EXISTS held_in_reserve                   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reserve_reason                    TEXT;

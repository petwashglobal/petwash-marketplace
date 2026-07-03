-- ============================================================================
-- 05 — Host Stay: verification + rollback (tracked hotfix template, plan §E)
-- ----------------------------------------------------------------------------
-- Host Stay tables (0088) landed via CI on 2026-07-03 (run 28633508916):
--   [migrate] ✅ applied: 0088_host_stay_journey.sql
-- So this file is NOT a hotfix we need to run — it is the committed
-- VERIFICATION + ROLLBACK that plan §E requires for any table landing, and the
-- reference template for any future manual hotfix.
--
-- Run the VERIFY block read-only against prod (Neon SQL console) to confirm the
-- live shape. Run ROLLBACK only in a deliberate teardown (it DROPs data).
-- ============================================================================


-- ============================ VERIFY (read-only) ============================

-- 1. Both tables exist?  Expect two rows.
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('host_stay_details', 'booking_handover_events')
ORDER BY tablename;

-- 2. Column shape of host_stay_details — compare to shared/schema.ts hostStayDetails.
--    Expect the 24 columns below. NOTE the KNOWN DRIFT on `id`:
--      migration 0088 created  id = uuid
--      schema.ts   declares    id = varchar
--    Functionally OK (uuid reads back as text; DB fills gen_random_uuid()),
--    but flag it for reconciliation in the baseline (plan §B/§C).
SELECT column_name, data_type, is_nullable, character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'host_stay_details'
ORDER BY ordinal_position;

-- 3. Column shape of booking_handover_events — expect 11 columns; same `id` uuid/varchar drift.
SELECT column_name, data_type, is_nullable, character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'booking_handover_events'
ORDER BY ordinal_position;

-- 4. Indexes present?  Expect: idx_hsd_booking_request_id, idx_hsd_owner_id,
--    idx_bhe_booking_request_id, idx_bhe_direction (+ the PK/unique indexes).
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('host_stay_details', 'booking_handover_events')
ORDER BY tablename, indexname;

-- 5. FK integrity — host_stay_details.booking_request_id and
--    booking_handover_events.booking_request_id must reference booking_requests(id).
SELECT tc.table_name, kcu.column_name, ccu.table_name AS references_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('host_stay_details', 'booking_handover_events');

-- 6. Row counts (sanity; new feature, likely 0 until first host-stay booking).
SELECT 'host_stay_details' AS tbl, count(*) FROM host_stay_details
UNION ALL
SELECT 'booking_handover_events', count(*) FROM booking_handover_events;


-- ============================ ROLLBACK (destructive) ========================
-- ONLY for a deliberate teardown. DROPs the tables and all their data.
-- The migration is idempotent (CREATE TABLE IF NOT EXISTS), so re-applying
-- 0088 afterwards fully restores structure. There is no data to restore for a
-- brand-new feature; if rows exist, snapshot them first:
--   CREATE TABLE _bak_host_stay_details AS SELECT * FROM host_stay_details;
--   CREATE TABLE _bak_booking_handover_events AS SELECT * FROM booking_handover_events;
--
-- BEGIN;
--   DROP TABLE IF EXISTS booking_handover_events;
--   DROP TABLE IF EXISTS host_stay_details;
--   -- keep migration history consistent so the applier re-runs 0088 next time:
--   DELETE FROM _petwash_migrations WHERE filename = '0088_host_stay_journey.sql';
-- COMMIT;
--
-- Restore = re-run the migration applier (workflow_dispatch run_migrations=true),
-- or paste migrations/0088_host_stay_journey.sql.

-- Ops write-readiness probe target — the one table the health probe may write to.
--
-- WHY
-- On 2026-09-06, 12:09–12:14 UTC, the production database accepted reads and
-- refused every write (PostgreSQL SQLSTATE 25006, read_only_sql_transaction).
-- The FiscalOutboxDrainer, AsyncJobWorker, JobDispatch poller and the Cortina
-- release sweep all failed; the deploy's migration gate failed on CREATE TABLE.
-- The 5xx alert fired correctly. What did NOT exist was any signal separating
-- "database is unreachable" from "database is reachable but writes are
-- impossible" — /api/health ran `SELECT 1`, which a read-only database passes,
-- so database health stayed green for the whole window.
--
-- This table exists solely so the write probe has somewhere harmless to write.
--
-- RULES
--   • It holds NO business data — no customer, booking, payment or fiscal rows.
--     Never add a column that references one.
--   • Exactly one row, enforced by the CHECK + primary key. The probe UPDATEs
--     that row; it never INSERTs a second or grows.
--   • A committed UPDATE (not a rolled-back one) is deliberate: some read-only
--     enforcement only surfaces at COMMIT, so a rollback-only probe could report
--     writable during an outage that would still reject real work.
--
-- This is a control-plane table. Losing it costs observability, never money.

CREATE TABLE IF NOT EXISTS ops_db_write_probe (
  id             SMALLINT     PRIMARY KEY DEFAULT 1,
  last_probe_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  probe_count    BIGINT       NOT NULL DEFAULT 0,
  last_revision  TEXT,
  CONSTRAINT ops_db_write_probe_singleton CHECK (id = 1)
);

-- Seed the single row so the probe is a pure UPDATE and never has to INSERT.
INSERT INTO ops_db_write_probe (id, last_probe_at, probe_count)
VALUES (1, now(), 0)
ON CONFLICT (id) DO NOTHING;

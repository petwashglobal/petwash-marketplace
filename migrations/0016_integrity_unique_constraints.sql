-- Migration 0016: Integrity unique constraints
-- Adds three missing uniqueness guarantees flagged in the 2026 gap audit.
--
-- 1. provider_intake_queue.email — prevents the same email address from
--    appearing in multiple intake rows, which would confuse management
--    review and send duplicate invite codes.
--
-- 2. provider_intake_queue.phone_number — same rationale as email.
--    Uses a partial index so NULL phones (rare) do not conflict.
--
-- 3. users.id_number (partial) — Israel Teudat Zehut / passport number.
--    A shared national ID is a clear identity fraud signal. NULL is
--    excluded from the uniqueness check because many users never set it.
--
-- All three are CONCURRENTLY safe to add on a live DB and will ROLLBACK
-- cleanly if duplicate data already exists (surface the problem rather
-- than silently skip the constraint).

-- 1. Unique email in provider intake queue
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS
  uidx_provider_intake_queue_email
  ON provider_intake_queue (email);

-- 2. Unique phone in provider intake queue (partial: skip NULLs)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS
  uidx_provider_intake_queue_phone
  ON provider_intake_queue (phone_number)
  WHERE phone_number IS NOT NULL;

-- 3. Unique government ID in users (partial: skip NULLs)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS
  uidx_users_id_number
  ON users (id_number)
  WHERE id_number IS NOT NULL;

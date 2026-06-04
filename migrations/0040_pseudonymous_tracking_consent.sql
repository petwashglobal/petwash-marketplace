-- 0040 — pseudonymous tracking + consent level on user_interaction_logs (gap 7)
--
-- Data & Intelligence gap 7. Adds two NULLABLE columns to the existing
-- user_interaction_logs table so pre-auth/anonymous interactions can be tracked
-- by a pseudonymous (hashed) id and gated by consent — without PII.
--
-- SAFE EXPAND: adding NULLABLE columns with no default does NOT rewrite the
-- table and does not touch any existing row (instant in PostgreSQL).
--
-- ROLLBACK:
--   ALTER TABLE user_interaction_logs DROP COLUMN IF EXISTS pseudonymous_user_id;
--   ALTER TABLE user_interaction_logs DROP COLUMN IF EXISTS consent_level;

ALTER TABLE user_interaction_logs ADD COLUMN IF NOT EXISTS pseudonymous_user_id VARCHAR;
ALTER TABLE user_interaction_logs ADD COLUMN IF NOT EXISTS consent_level        VARCHAR;

CREATE INDEX IF NOT EXISTS idx_uil_pseudonymous
  ON user_interaction_logs (pseudonymous_user_id);

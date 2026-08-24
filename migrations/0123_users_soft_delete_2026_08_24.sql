-- 0123: Complete the users soft-delete audit trail so admin `delete_customer`
-- can actually deactivate a user.
--
-- Prior to this migration the admin handler at server/routes.ts:10800
-- returned 501 with CUSTOMER_SOFT_DELETE_NOT_WIRED. The users table already
-- had `soft_delete_at` (timestamp) and `activation_status` with 'deleted'
-- value — but no audit fields recording WHO did the deactivation and WHY.
--
-- This migration adds ONLY the two missing audit columns. The existing
-- soft_delete_at + activation_status carry the state itself.
--
-- ADDITIVE only. Safe to re-run (IF NOT EXISTS guards).
--
-- Hard-delete of a customer stays a manual DBA task (foreign keys across
-- ~20 tables — booking history, wallet ledger, receipts, KYC). Soft-delete
-- (setting activation_status='deleted' + soft_delete_at + these audit fields)
-- is the operational action the admin needs.

ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_by VARCHAR(128);
ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_users_activation_status ON users (activation_status);

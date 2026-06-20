-- Pet records: add sex + desexed (neutered/spayed) to customer_pets. 2026-06-20.
-- ADDITIVE — from the Pet Owner spec (sex + desexed_status were missing). Both
-- default 'unknown' so existing rows are unaffected.

ALTER TABLE customer_pets ADD COLUMN IF NOT EXISTS sex     VARCHAR DEFAULT 'unknown';
ALTER TABLE customer_pets ADD COLUMN IF NOT EXISTS desexed VARCHAR DEFAULT 'unknown';

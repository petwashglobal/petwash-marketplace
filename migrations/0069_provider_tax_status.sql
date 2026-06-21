-- 0069_provider_tax_status.sql
-- Capture the provider's Israeli business/tax classification AT APPLICATION TIME
-- (was only configured post-approval, so applications submitted with no עוסק
-- classification — a compliance + matching gap). Additive, nullable, safe.
--   osek_patur (עוסק פטור) | osek_murshe (עוסק מורשה) | company (חברה בע״מ) | not_registered

ALTER TABLE provider_applications
  ADD COLUMN IF NOT EXISTS tax_status varchar(20);

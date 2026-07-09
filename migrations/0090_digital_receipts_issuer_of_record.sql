-- 0090 — digital_receipts.issuer_of_record (CPA 2026-07-09)
-- Records which system is the official issuer of record for each receipt.
-- 'sumit' = SUMIT's document is the official חשבונית מס/קבלה and this local PW- row
-- is an internal ledger reference (SUMIT owns the numbering when wired).
-- NULL / 'self' = self-issued PW- gapless document (SUMIT dormant or below SHAAM),
-- which is fully valid under חשבונית ישראל.
-- Nullable + no default → additive and safe: existing rows read as self-issued,
-- and the app writes it best-effort (post-insert UPDATE) so a not-yet-migrated
-- prod cannot break receipt issuance.
ALTER TABLE digital_receipts ADD COLUMN IF NOT EXISTS issuer_of_record varchar(20);

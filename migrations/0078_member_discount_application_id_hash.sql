-- 0078_member_discount_application_id_hash.sql
-- DUPLICATE-ID fraud detection (Smart Admin Panel §8: "same ID/passport used by
-- more than one account").
--
-- The ID/passport is stored ENCRYPTED with a random IV (id_number_enc), so equal
-- IDs produce DIFFERENT ciphertext and cannot be equality-matched. This adds a
-- deterministic BLIND INDEX column (HMAC-SHA256 of the normalized ID) so the same
-- ID across accounts is detectable WITHOUT decrypting and without weakening the
-- reversible ciphertext (the hash is one-way). Populated by secretFieldCrypto's
-- blindIndex() at write time; backfilled by scripts/backfill-discount-id-hash.ts.
--
-- Additive only. 2026-06-25.

ALTER TABLE member_discount_applications
  ADD COLUMN IF NOT EXISTS id_hash VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_member_discount_apps_id_hash
  ON member_discount_applications (id_hash);

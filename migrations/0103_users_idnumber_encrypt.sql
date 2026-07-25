-- 0103: encrypt the users national ID (Teudat Zehut) — X-ray P1-6, 2026-07-25.
--
-- The self-service profile endpoint (server/routes/user-profile.ts) wrote
-- users.id_number in PLAINTEXT, while every other ID path (KYC / member-discount /
-- provider-onboarding) already encrypts. New writes now go to:
--   • id_number_enc  — AES-256-GCM ciphertext (secretFieldCrypto.encryptField)
--   • id_number_hash — HMAC-SHA256 blind index (secretFieldCrypto.blindIndex),
--                      used ONLY for the identity-dedup lookup (findUsersByIdAndDob);
--                      one-way, never reversible to the ID.
--
-- The legacy plaintext id_number column is left in place for now (the read path is
-- migrated to id_number_hash). A follow-up app-side script backfills enc+hash from
-- any existing plaintext rows and then clears id_number. Idempotent — safe to
-- re-run under the self-healing migration gate.
ALTER TABLE users ADD COLUMN IF NOT EXISTS id_number_enc text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS id_number_hash varchar(64);
CREATE INDEX IF NOT EXISTS idx_users_id_number_hash ON users (id_number_hash);

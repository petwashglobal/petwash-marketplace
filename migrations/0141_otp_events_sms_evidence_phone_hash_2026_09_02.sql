-- AUDIT-SMS-14 / #225 slice 2 — HMAC lookup columns for otp_events.phone_e164
-- and sms_evidence.to_phone.
--
-- Extends the phone-HMAC pattern landed in migration 0140 to the two
-- highest-volume phone-carrying event tables. Same shape: nullable
-- varchar(64) + partial index over WHERE phone_hash IS NOT NULL, so the
-- indexes stay compact while backfill catches up.
--
-- Application code that inserts into these tables now stamps phone_hash
-- alongside the raw phone (RegistrationOTPService, UnifiedVerificationService,
-- publicAuthRoutes welcome-SMS). Historical rows keep working with a null
-- phone_hash until the backfill script (follow-up slice) walks them.
--
-- Idempotent: repeat runs are safe (IF NOT EXISTS on column + index).

ALTER TABLE otp_events
  ADD COLUMN IF NOT EXISTS phone_hash varchar(64);

CREATE INDEX IF NOT EXISTS idx_otp_events_phone_hash
  ON otp_events (phone_hash)
  WHERE phone_hash IS NOT NULL;

ALTER TABLE sms_evidence
  ADD COLUMN IF NOT EXISTS to_phone_hash varchar(64);

CREATE INDEX IF NOT EXISTS idx_sms_evidence_to_phone_hash
  ON sms_evidence (to_phone_hash)
  WHERE to_phone_hash IS NOT NULL;

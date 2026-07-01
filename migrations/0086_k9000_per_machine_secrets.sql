-- 0086_k9000_per_machine_secrets.sql
-- Per-machine HMAC secrets for K9000 kiosks.
--
-- Found during a 2026-07-01 secrets audit: every K9000 kiosk shares ONE global
-- MACHINE_SECRET_KEY for HMAC request signing. If that single secret ever leaks
-- (a technician laptop, a leaked config), every station everywhere is
-- compromised simultaneously. Fixable now with zero live-traffic risk — no real
-- K9000 units are installed yet (still in storage per prior session notes).
--
-- Adds a nullable, per-kiosk encrypted secret column. NULL means "no per-kiosk
-- secret issued yet" — the security middleware falls back to the shared
-- MACHINE_SECRET_KEY for that kiosk only, so this migration is fully additive
-- and does not change behavior for any existing row until a secret is
-- explicitly issued via the new admin script/endpoint.
--
-- Additive + reversible. No money math changed.

ALTER TABLE kiosk_machines
  ADD COLUMN IF NOT EXISTS hmac_secret_encrypted text,
  ADD COLUMN IF NOT EXISTS hmac_secret_rotated_at timestamp;

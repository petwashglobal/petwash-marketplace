-- K9000 redeemed-nonce ledger — durable, fail-closed single-use guard for wash QRs.
-- 2026-06-18: the redeem path burned the token nonce only in-memory (per-process) +
-- Redis (optional). When Redis is down on multi-instance Cloud Run, the same QR could
-- be redeemed once per instance within its 45s lifetime. This table makes the nonce
-- claim atomic in Postgres (unique PK + ON CONFLICT DO NOTHING) — a replay is rejected
-- before any money moves, even with Redis down.
CREATE TABLE IF NOT EXISTS k9000_redeemed_nonces (
  nonce    text PRIMARY KEY,
  used_at  timestamptz NOT NULL DEFAULT now()
);

-- Optional housekeeping: nonces are only meaningful for the token's 45s lifetime, but
-- we keep them ~24h as an audit/replay window. A cron may prune rows older than 1 day.
CREATE INDEX IF NOT EXISTS idx_k9000_redeemed_nonces_used_at ON k9000_redeemed_nonces (used_at);

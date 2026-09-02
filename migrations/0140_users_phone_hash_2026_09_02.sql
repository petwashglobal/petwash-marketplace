-- AUDIT-SMS-14 / #225 slice 1 — add HMAC lookup column for users.phone.
--
-- Motivation: `users.phone` stores the subscriber's full E.164 number
-- unhashed so Twilio can text them. That's necessary for the sender
-- path but means any DB read grants an attacker the number and any
-- leaked backup exposes every subscriber's phone.
--
-- Fix (this slice): add a `phone_hash` column carrying an HMAC-SHA-256
-- of the normalised phone under a server secret. Application code
-- writes both fields on inserts / updates (see server/lib/phoneHmac.ts)
-- and can query on `phone_hash` for the "does this number exist"
-- lookup — the raw `phone` column stays for the sender path.
--
-- This slice does NOT drop the raw column. That's a follow-up slice
-- once every read has been migrated to phone_hash.
--
-- Idempotent: repeat runs are safe (IF NOT EXISTS on column + index).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone_hash varchar(64);

-- Non-unique index — a nulls-first index over a partial predicate lets
-- us keep the existing uniqueness constraint on the raw column while
-- allowing the hash lookup to remain O(log n).
CREATE INDEX IF NOT EXISTS idx_users_phone_hash
  ON users (phone_hash)
  WHERE phone_hash IS NOT NULL;

-- No backfill inside this migration — the HMAC secret lives in the
-- server, not in Postgres. A one-shot backfill script (see
-- scripts/backfillPhoneHash.ts, added in a follow-up slice) walks
-- rows in batches and calls phoneLookupHash() with the runtime
-- secret. Rows keep working with a null phone_hash until backfill
-- lands — writes made after this migration set both columns.

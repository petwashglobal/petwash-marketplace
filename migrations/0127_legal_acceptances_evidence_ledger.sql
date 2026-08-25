-- 0127: Canonical legal_acceptances evidence ledger.
--
-- Legal audit 2026-08-25 (CEO directive §11-§12) found that only TWO tables
-- store user acceptance evidence — signing_sessions (provider declarations)
-- and biometric_consents. ~30 customer/provider legal pages are pure
-- passive display, none of them persist a per-user acceptance row with the
-- required Israeli-Privacy-Law evidence bundle:
--   who signed / what document / which version / what language / at when
--   / from which IP / from which device fingerprint / hash of the exact
--   text as shown at acceptance time.
--
-- This table is the CANONICAL evidence ledger every one of those flows will
-- write through. Additive — no other table is modified. Idempotent via a
-- partial unique index on (user_id, document_key, doc_version) so a
-- re-submit of the SAME version is a no-op.

CREATE TABLE IF NOT EXISTS legal_acceptances (
  id                SERIAL PRIMARY KEY,
  user_id           TEXT   NOT NULL,             -- Firebase UID; joins to users.id
  document_key      TEXT   NOT NULL,             -- e.g. 'customer_tos', 'privacy_policy', 'cancellation_refund_14g'
  doc_version       TEXT   NOT NULL,             -- e.g. '2026-01-15' or a semver
  language          TEXT   NOT NULL,             -- 'he' | 'en' | 'ar' | 'ru' | ...
  accepted_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address        TEXT,                        -- resolved via req.ip only (see PR #2158)
  user_agent        TEXT,
  device_fingerprint TEXT,                       -- optional, when a client library provides one
  snapshot_hash     TEXT,                        -- sha256 of the document text AS SHOWN at accept time
  snapshot_url      TEXT,                        -- optional GCS URL for the archived PDF/HTML
  source            TEXT   NOT NULL DEFAULT 'client',  -- 'client' | 'admin_backfill' | 'docuseal' | 'migration'
  actor_role        TEXT,                        -- who initiated: 'self' | 'admin' | 'system'
  metadata          JSONB  NOT NULL DEFAULT '{}'::jsonb
);

-- Idempotency: same user re-submits the same document + version → single row.
-- Partial unique index so different versions accumulate as history.
CREATE UNIQUE INDEX IF NOT EXISTS uq_legal_acceptances_user_doc_version
  ON legal_acceptances (user_id, document_key, doc_version);

-- Admin lookup + user self-lookup both go through this covering index.
CREATE INDEX IF NOT EXISTS idx_legal_acceptances_user
  ON legal_acceptances (user_id, accepted_at DESC);

-- Analytics: which document versions are currently accepted platform-wide.
CREATE INDEX IF NOT EXISTS idx_legal_acceptances_doc_version
  ON legal_acceptances (document_key, doc_version, accepted_at DESC);

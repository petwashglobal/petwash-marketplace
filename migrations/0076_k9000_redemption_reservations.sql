-- 0076_k9000_redemption_reservations.sql
-- K9000 pre-paid redemption: reservation stage + commit/release split + recon
-- queue, per docs/design/2026-06-25-k9000-closedloop-prepaid-redemption.md.
-- Closes the Settlement-replay double-debit + the bay-hang. Idempotent; additive.

-- ── Reservation (TCC "Try" record): reserve at authorise, commit on vend, release on TTL/ceiling ──
CREATE TABLE IF NOT EXISTS k9000_redemption_reservations (
  id                   VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_ref      VARCHAR NOT NULL UNIQUE,
  user_id              VARCHAR NOT NULL,
  bay_id               VARCHAR NOT NULL,
  station_id           VARCHAR NOT NULL,
  side                 VARCHAR(5) NOT NULL,
  redemption_type      VARCHAR(20) NOT NULL,           -- canonical engine literal
  idempotency_key      VARCHAR NOT NULL,               -- token + terminalId + nayaxTransactionId
  nayax_terminal_id    VARCHAR,
  nayax_transaction_id VARCHAR,
  status               VARCHAR(16) NOT NULL DEFAULT 'reserved', -- reserved|committed|expired|cancelled
  session_id           VARCHAR,
  expires_at           TIMESTAMP NOT NULL,
  committed_at         TIMESTAMP,
  created_at           TIMESTAMP DEFAULT NOW(),
  updated_at           TIMESTAMP DEFAULT NOW()
);
-- Exactly-once Settlement (replayed/late webhook can't double-debit).
CREATE UNIQUE INDEX IF NOT EXISTS uq_k9res_idempotency ON k9000_redemption_reservations(idempotency_key);
-- ONE active reservation per bay (no two users racing the same bay).
CREATE UNIQUE INDEX IF NOT EXISTS uq_k9res_active_bay ON k9000_redemption_reservations(bay_id) WHERE status = 'reserved';
-- ONE active reservation per instrument per station (no dual-bay double-scan).
CREATE UNIQUE INDEX IF NOT EXISTS uq_k9res_active_user_station ON k9000_redemption_reservations(user_id, station_id) WHERE status = 'reserved';
-- TTL / ceiling sweep.
CREATE INDEX IF NOT EXISTS idx_k9res_status_expiry ON k9000_redemption_reservations(status, expires_at);

-- ── station_bays: device-ID completeness + the anti-hang ceiling ──
ALTER TABLE station_bays ADD COLUMN IF NOT EXISTS k9000_asset_serial VARCHAR;
ALTER TABLE station_bays ADD COLUMN IF NOT EXISTS nayax_merchant_id  VARCHAR;
ALTER TABLE station_bays ADD COLUMN IF NOT EXISTS max_wash_seconds   INTEGER DEFAULT 600; -- forces RELEASE; bay can never hang

-- ── bay_sessions: link the commit back to its reservation ──
ALTER TABLE bay_sessions ADD COLUMN IF NOT EXISTS reservation_ref VARCHAR;
ALTER TABLE bay_sessions ADD COLUMN IF NOT EXISTS commit_source   VARCHAR(16); -- cortina_settlement|spark_transaction|manual

-- ── Reconciliation exception queue (Nayax ↔ K9000 ↔ ledger ↔ SUMIT diffs) ──
CREATE TABLE IF NOT EXISTS k9000_reconciliation_breaks (
  id                 VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  recon_date         DATE NOT NULL,
  break_type         VARCHAR(48) NOT NULL,  -- settlement_without_commit | commit_without_evidence | bay_hang | doc_failure | duplicate_ref | manual_free_wash
  bay_id             VARCHAR,
  station_id         VARCHAR,
  nayax_ref          VARCHAR,
  petwash_session_id VARCHAR,
  sumit_doc_id       VARCHAR,
  expected_json      JSONB DEFAULT '{}'::jsonb,
  observed_json      JSONB DEFAULT '{}'::jsonb,
  severity           VARCHAR(12) NOT NULL DEFAULT 'warning', -- info|warning|critical
  status             VARCHAR(12) NOT NULL DEFAULT 'open',     -- open|resolved|accepted
  resolved_by        VARCHAR,
  resolved_at        TIMESTAMP,
  created_at         TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_k9recon_date_status ON k9000_reconciliation_breaks(recon_date, status);

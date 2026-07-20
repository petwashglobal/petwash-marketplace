-- 0098 — Monyx 5+1 punch card (PetWash-operated, not Nayax Core).
--
-- WHY THIS EXISTS: Nayax gates the "Campaign" module server-side; it is absent
-- from our operator account and only a Nayax distributor can switch it on (their
-- own docs say so in three separate articles). Rather than wait, we run the same
-- 5+1 offer ourselves off the Nayax transaction feed we already ingest.
--
-- CEO-confirmed rule: 5 paid qualifying washes, the 6th is free.
--
-- Idempotency is structural, not advisory: monyx_punch_events carries a UNIQUE
-- on external_transaction_id, so a replayed Nayax webhook can never punch twice.

CREATE TABLE IF NOT EXISTS monyx_punch_cards (
  id                SERIAL PRIMARY KEY,
  user_id           VARCHAR(255) NOT NULL,          -- PetWash Firebase UID (matches loyalty_profiles.user_id)
  campaign_code     VARCHAR(64)  NOT NULL DEFAULT 'PW_KS_LOYALTY_5PLUS1_2026',
  cycle             INTEGER      NOT NULL DEFAULT 1, -- a member may complete the card repeatedly
  punches           INTEGER      NOT NULL DEFAULT 0,
  punches_required  INTEGER      NOT NULL DEFAULT 5, -- 5 paid → 6th free
  reward_status     VARCHAR(24)  NOT NULL DEFAULT 'accruing', -- accruing | earned | issued | failed
  completed_at      TIMESTAMPTZ,
  reward_issued_at  TIMESTAMPTZ,
  reward_ref        VARCHAR(128),                    -- Lynx card uid / voucher ref once issued
  reward_error      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One open card per member per campaign cycle.
  CONSTRAINT uq_monyx_punch_card_user_campaign_cycle UNIQUE (user_id, campaign_code, cycle),
  CONSTRAINT ck_monyx_punch_card_punches_nonneg CHECK (punches >= 0)
);

CREATE INDEX IF NOT EXISTS idx_monyx_punch_cards_user
  ON monyx_punch_cards (user_id, campaign_code);
CREATE INDEX IF NOT EXISTS idx_monyx_punch_cards_status
  ON monyx_punch_cards (reward_status)
  WHERE reward_status IN ('earned', 'failed');

-- One row per qualifying wash. The UNIQUE on external_transaction_id is the
-- anti-double-punch guarantee — do not drop it.
CREATE TABLE IF NOT EXISTS monyx_punch_events (
  id                      SERIAL PRIMARY KEY,
  punch_card_id           INTEGER      NOT NULL REFERENCES monyx_punch_cards(id) ON DELETE CASCADE,
  user_id                 VARCHAR(255) NOT NULL,
  external_transaction_id VARCHAR(128) NOT NULL,
  amount_ils              NUMERIC(10,2),
  machine_id              VARCHAR(64),
  reversed                BOOLEAN      NOT NULL DEFAULT false,
  reversed_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT uq_monyx_punch_event_txn UNIQUE (external_transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_monyx_punch_events_card
  ON monyx_punch_events (punch_card_id);
CREATE INDEX IF NOT EXISTS idx_monyx_punch_events_user
  ON monyx_punch_events (user_id);

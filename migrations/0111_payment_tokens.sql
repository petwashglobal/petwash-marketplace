-- 0111: card-on-file token vault (CTO P0-2, 2026-07-31)
--
-- Stores ONLY the payment processor's saved-card token + customer reference so
-- Sitter/Academy/Walk/Shop can charge a returning customer at provider-accept with
-- no card re-entry. HARD RULE (PCI): there is NO card-number (PAN) column and NO
-- CVV column — we keep surrogate tokens only, which keeps PCI scope minimal.
-- Mirrors shared/schema.ts `paymentTokens`. Prefix >88 → auto-applies on push.

CREATE TABLE IF NOT EXISTS payment_tokens (
  id                    SERIAL PRIMARY KEY,
  user_id               VARCHAR(128) NOT NULL,               -- owner Firebase UID
  provider              VARCHAR(32)  NOT NULL DEFAULT 'sumit',
  processor_customer_id VARCHAR(128),                        -- e.g. SUMIT CustomerID
  processor_token_id    VARCHAR(256) NOT NULL,               -- saved-card token — the ONLY card reference
  card_brand            VARCHAR(32),                         -- display
  card_last4            VARCHAR(4),                          -- display only, NOT the PAN
  exp_month             INTEGER,
  exp_year              INTEGER,
  billing_name          VARCHAR(128),
  status                VARCHAR(16)  NOT NULL DEFAULT 'active', -- active | expired | revoked | failed
  consent_version       VARCHAR(32),
  created_at            TIMESTAMP    NOT NULL DEFAULT now(),
  revoked_at            TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_tokens_user_status
  ON payment_tokens (user_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_tokens_processor
  ON payment_tokens (provider, processor_token_id);

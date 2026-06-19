-- Member wash discount engine (additive, safe). Backs the CEO verified-discount
-- design (2026-06-20): Prestige Basic = automatic 5% (derived live, NOT stored),
-- Senior (65+) / disability = admin-approved 5% / 7% / 10% applied to K9000 WASH
-- price ONLY. No existing table is altered.
--
-- PRIVACY: this table stores NO document / ID / passport / certificate data.
-- The senior/disability review is done by POST with physical papers that are
-- DESTROYED after review. We record ONLY the decision (approved percent, who,
-- when, free-text reason / note). Never insert an ID number, scan, or image.
--
-- SCOPE: the percent here applies to K9000 wash SKUs only (single wash + wash
-- packages). Scope + the <=10 clamp are enforced in the server price path; the
-- CHECK below is a second line of defence. 2026-06-20.

CREATE TABLE IF NOT EXISTS member_wash_discounts (
  id                   SERIAL PRIMARY KEY,
  user_id              VARCHAR(255) NOT NULL,            -- Firebase UID
  discount_type        VARCHAR(32)  NOT NULL,            -- senior | disability | prestige_basic
  discount_percent     INTEGER      NOT NULL,            -- 5 | 7 | 10  (hard-capped <= 10)
  status               VARCHAR(16)  NOT NULL DEFAULT 'pending',  -- pending | approved | revoked
  verified_by_admin_id VARCHAR(255),                     -- admin UID/email who decided
  verified_at          TIMESTAMPTZ,
  source               VARCHAR(32)  NOT NULL DEFAULT 'postal_review', -- postal_review | auto_loyalty
  reason               TEXT,                             -- decision context (NO ID data)
  review_note          TEXT,                             -- admin note (NO ID data)
  expires_at           TIMESTAMPTZ,                      -- null = no expiry
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT member_wash_discounts_percent_chk
    CHECK (discount_percent >= 0 AND discount_percent <= 10),
  CONSTRAINT member_wash_discounts_type_chk
    CHECK (discount_type IN ('senior', 'disability', 'prestige_basic')),
  CONSTRAINT member_wash_discounts_status_chk
    CHECK (status IN ('pending', 'approved', 'revoked'))
);

CREATE INDEX IF NOT EXISTS idx_member_wash_discounts_user   ON member_wash_discounts (user_id);
CREATE INDEX IF NOT EXISTS idx_member_wash_discounts_status ON member_wash_discounts (status);

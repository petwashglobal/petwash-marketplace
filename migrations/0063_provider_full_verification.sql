-- Provider FULL verification — manual matching record + official-document
-- received/destroy lifecycle. ADDITIVE. PetWash Ltd, 2026-06-20.
--
-- Backs the "PENDING PETWASH REVIEW" gate: typing an ID only SUBMITS identity;
-- a PetWash admin must manually match typed details vs official document vs
-- selfie vs signed contract and record that decision here. Stores DECISIONS +
-- metadata only — never a raw ID number or document scan.

CREATE TABLE IF NOT EXISTS provider_verification_reviews (
  id                       SERIAL PRIMARY KEY,
  application_id           VARCHAR(64) NOT NULL,
  provider_id              VARCHAR(128),
  typed_details_checked    BOOLEAN NOT NULL DEFAULT FALSE,
  selfie_checked           BOOLEAN NOT NULL DEFAULT FALSE,
  official_document_checked BOOLEAN NOT NULL DEFAULT FALSE,
  contract_checked         BOOLEAN NOT NULL DEFAULT FALSE,
  name_match               VARCHAR(16) NOT NULL DEFAULT 'pending',
  dob_match                VARCHAR(16) NOT NULL DEFAULT 'pending',
  document_number_match    VARCHAR(16) NOT NULL DEFAULT 'pending',
  selfie_photo_match       VARCHAR(16) NOT NULL DEFAULT 'pending',
  contract_name_match      VARCHAR(16) NOT NULL DEFAULT 'pending',
  review_status            VARCHAR(24) NOT NULL DEFAULT 'pending_review',
  reviewed_by_admin_id     VARCHAR(128),
  reviewed_at              TIMESTAMP,
  notes                    TEXT,
  created_at               TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pvr_application ON provider_verification_reviews (application_id);
CREATE INDEX IF NOT EXISTS idx_pvr_status      ON provider_verification_reviews (review_status);
-- One active review per application (terminal reviews can be superseded).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pvr_active_application
  ON provider_verification_reviews (application_id)
  WHERE review_status NOT IN ('approved', 'rejected');

CREATE TABLE IF NOT EXISTS provider_official_documents (
  id                    SERIAL PRIMARY KEY,
  application_id        VARCHAR(64) NOT NULL,
  provider_id           VARCHAR(128),
  document_type         VARCHAR(24) NOT NULL,
  submission_method     VARCHAR(16) NOT NULL,
  file_id               VARCHAR(256),
  physical_received     BOOLEAN NOT NULL DEFAULT FALSE,
  received_at           TIMESTAMP,
  received_by_admin_id  VARCHAR(128),
  document_status       VARCHAR(16) NOT NULL DEFAULT 'pending',
  destroyed_at          TIMESTAMP,
  destroyed_by_admin_id VARCHAR(128),
  deletion_at           TIMESTAMP,
  deletion_by_admin_id  VARCHAR(128),
  legal_hold            BOOLEAN NOT NULL DEFAULT FALSE,
  legal_hold_reason     TEXT,
  created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pod_application ON provider_official_documents (application_id);
CREATE INDEX IF NOT EXISTS idx_pod_status      ON provider_official_documents (document_status);

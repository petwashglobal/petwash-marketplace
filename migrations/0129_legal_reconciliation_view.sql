-- 0129_legal_reconciliation_view.sql
--
-- READ-ONLY reconciliation view for the canonical `legal_acceptances`
-- ledger (migration 0127) vs. legacy acceptance surfaces (CEO
-- 2026-08-26 §7). The view answers "which legacy acceptances have
-- NO matching canonical row?" — the reader (admin dashboard / cron)
-- MEASURES divergence; it never promotes a document's migration
-- status. Time does not reconcile data (correction pass #2 §3).
--
-- No table mutations. No writes. Purely a projection over existing
-- rows so it can be re-run against production safely.
--
-- APPLY STATUS: BLOCKED-CEO-MERGE/DEPLOY (correction pass #2 §5).
-- A CREATE VIEW is still a schema change and must not be applied to
-- production without approval. The file is checked in so source review
-- + tests can proceed; deploy is a separate approval.
--
-- IMPORTANT: Firestore-backed surfaces (`onboarding_consent`,
-- `notification_preferences`) are OUT OF SCOPE for this view — they
-- need a nightly export to Postgres staging tables first (design
-- note captured in docs/design/... follow-up). This view covers ONLY
-- the Postgres surfaces where we can compare in-DB today:
--   • signing_sessions        (14 provider declarations)
--   • users.accepted_terms_at (customer_tos)
--   • user_consents           (grant/withdraw ledger via consentEngine)

CREATE OR REPLACE VIEW v_legacy_missing_canonical AS

-- 1) Provider declarations completed in signing_sessions but never
--    landed in legal_acceptances. The provider_ prefix + template_slug
--    map to the canonical documentKey — this UNION arm reproduces the
--    map for the 14 provider declarations in one CTE-free form.
SELECT
  'signing_sessions'::text                                          AS src,
  s.user_id                                                          AS user_id,
  CASE s.template_slug
    WHEN 'inapp-provider-decl-independent_provider'         THEN 'provider_independent_status'
    WHEN 'inapp-provider-decl-no_franchise_no_agency'       THEN 'provider_no_franchise_no_agency'
    WHEN 'inapp-provider-decl-provider_service_agreement'   THEN 'provider_agreement'
    WHEN 'inapp-provider-decl-safety_manual_acceptance'     THEN 'provider_safety_manual'
    WHEN 'inapp-provider-decl-insurance_disclosure'         THEN 'provider_insurance_disclosure'
    WHEN 'inapp-provider-decl-tax_business_status'          THEN 'provider_tax_business_status'
    WHEN 'inapp-provider-decl-privacy_data_handling'        THEN 'provider_privacy_data'
    WHEN 'inapp-provider-decl-off_platform_payment'         THEN 'provider_off_platform_payment'
    WHEN 'inapp-provider-decl-incident_reporting'           THEN 'provider_incident_reporting'
    WHEN 'inapp-provider-decl-home_hosting_protocol'        THEN 'provider_home_hosting'
    WHEN 'inapp-provider-decl-owner_home_visit_protocol'    THEN 'provider_owner_home_visit'
    WHEN 'inapp-provider-decl-walking_protocol'             THEN 'provider_dog_walking_safety'
    WHEN 'inapp-provider-decl-academy_protocol'             THEN 'provider_academy_trainer'
    WHEN 'inapp-provider-decl-pettrek_transport_protocol'   THEN 'provider_pettrek_transport'
    ELSE NULL
  END                                                                AS document_key,
  'v1'::text                                                         AS doc_version,
  COALESCE(s.language, 'he')                                         AS language,
  COALESCE(s.signed_at, s.completed_at)                              AS legacy_at
FROM signing_sessions s
LEFT JOIN legal_acceptances la
       ON la.user_id     = s.user_id
      AND la.document_key = CASE s.template_slug
        WHEN 'inapp-provider-decl-independent_provider'         THEN 'provider_independent_status'
        WHEN 'inapp-provider-decl-no_franchise_no_agency'       THEN 'provider_no_franchise_no_agency'
        WHEN 'inapp-provider-decl-provider_service_agreement'   THEN 'provider_agreement'
        WHEN 'inapp-provider-decl-safety_manual_acceptance'     THEN 'provider_safety_manual'
        WHEN 'inapp-provider-decl-insurance_disclosure'         THEN 'provider_insurance_disclosure'
        WHEN 'inapp-provider-decl-tax_business_status'          THEN 'provider_tax_business_status'
        WHEN 'inapp-provider-decl-privacy_data_handling'        THEN 'provider_privacy_data'
        WHEN 'inapp-provider-decl-off_platform_payment'         THEN 'provider_off_platform_payment'
        WHEN 'inapp-provider-decl-incident_reporting'           THEN 'provider_incident_reporting'
        WHEN 'inapp-provider-decl-home_hosting_protocol'        THEN 'provider_home_hosting'
        WHEN 'inapp-provider-decl-owner_home_visit_protocol'    THEN 'provider_owner_home_visit'
        WHEN 'inapp-provider-decl-walking_protocol'             THEN 'provider_dog_walking_safety'
        WHEN 'inapp-provider-decl-academy_protocol'             THEN 'provider_academy_trainer'
        WHEN 'inapp-provider-decl-pettrek_transport_protocol'   THEN 'provider_pettrek_transport'
        ELSE NULL
      END
WHERE s.status = 'completed'
  AND s.template_slug LIKE 'inapp-provider-decl-%'
  AND la.id IS NULL

UNION ALL

-- 2) customer_tos legacy stamp on users.accepted_terms_at but no
--    canonical row.
SELECT
  'users.accepted_terms_at'::text  AS src,
  u.id                             AS user_id,
  'customer_tos'::text             AS document_key,
  'v1'::text                       AS doc_version,
  'he'::text                       AS language,
  u.accepted_terms_at              AS legacy_at
FROM users u
LEFT JOIN legal_acceptances la
       ON la.user_id     = u.id
      AND la.document_key = 'customer_tos'
WHERE u.accepted_terms_at IS NOT NULL
  AND la.id IS NULL

UNION ALL

-- 3) consent-engine ledger (user_consents): latest-row-per-type
--    accepted=true but no canonical row.
SELECT
  'user_consents'::text                                              AS src,
  l.user_id                                                          AS user_id,
  CASE l.consent_type
    WHEN 'terms'          THEN 'customer_tos'
    WHEN 'privacy'        THEN 'privacy_policy'
    WHEN 'marketing'      THEN 'marketing_consent'
    WHEN 'provider_terms' THEN 'provider_agreement'
    WHEN 'kyc'            THEN 'provider_background_check_consent'
    ELSE NULL
  END                                                                AS document_key,
  COALESCE(l.consent_version, 'v1')                                  AS doc_version,
  COALESCE(l.locale, 'he')                                           AS language,
  l.accepted_at                                                      AS legacy_at
FROM (
  SELECT DISTINCT ON (user_id, consent_type)
         user_id, consent_type, consent_version, accepted, locale, accepted_at
  FROM user_consents
  ORDER BY user_id, consent_type, accepted_at DESC
) l
LEFT JOIN legal_acceptances la
       ON la.user_id     = l.user_id
      AND la.document_key = CASE l.consent_type
        WHEN 'terms'          THEN 'customer_tos'
        WHEN 'privacy'        THEN 'privacy_policy'
        WHEN 'marketing'      THEN 'marketing_consent'
        WHEN 'provider_terms' THEN 'provider_agreement'
        WHEN 'kyc'            THEN 'provider_background_check_consent'
        ELSE NULL
      END
WHERE l.accepted = TRUE
  AND la.id IS NULL
;

-- Duplicate probe — should always be 0 rows given the partial unique
-- index on (user_id, document_key, doc_version). Left as a view so
-- the nightly cron can alert on a > 0 result without needing to
-- store the query anywhere.
CREATE OR REPLACE VIEW v_legal_acceptance_duplicates AS
SELECT user_id, document_key, doc_version, COUNT(*)::int AS dup_count
FROM legal_acceptances
GROUP BY user_id, document_key, doc_version
HAVING COUNT(*) > 1;

-- Canonical orphans — canonical row exists but no legacy source
-- (should be near-zero; > 0 means the canonical writer fired but the
-- legacy write failed, so a legacy-driven reconciliation would miss
-- these). One arm per legacy surface we track.
CREATE OR REPLACE VIEW v_canonical_missing_legacy AS
SELECT
  la.id,
  la.user_id,
  la.document_key,
  la.doc_version,
  la.accepted_at
FROM legal_acceptances la
WHERE la.document_key = 'customer_tos'
  AND NOT EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = la.user_id AND u.accepted_terms_at IS NOT NULL
  )
UNION ALL
SELECT
  la.id, la.user_id, la.document_key, la.doc_version, la.accepted_at
FROM legal_acceptances la
WHERE la.document_key LIKE 'provider\_%'
  AND NOT EXISTS (
    SELECT 1 FROM signing_sessions s
    WHERE s.user_id = la.user_id
      AND s.status = 'completed'
      AND s.template_slug = 'inapp-provider-decl-' || (
        CASE la.document_key
          WHEN 'provider_independent_status'         THEN 'independent_provider'
          WHEN 'provider_no_franchise_no_agency'     THEN 'no_franchise_no_agency'
          WHEN 'provider_agreement'                  THEN 'provider_service_agreement'
          WHEN 'provider_safety_manual'              THEN 'safety_manual_acceptance'
          WHEN 'provider_insurance_disclosure'       THEN 'insurance_disclosure'
          WHEN 'provider_tax_business_status'        THEN 'tax_business_status'
          WHEN 'provider_privacy_data'               THEN 'privacy_data_handling'
          WHEN 'provider_off_platform_payment'       THEN 'off_platform_payment'
          WHEN 'provider_incident_reporting'         THEN 'incident_reporting'
          WHEN 'provider_home_hosting'               THEN 'home_hosting_protocol'
          WHEN 'provider_owner_home_visit'           THEN 'owner_home_visit_protocol'
          WHEN 'provider_dog_walking_safety'         THEN 'walking_protocol'
          WHEN 'provider_academy_trainer'            THEN 'academy_protocol'
          WHEN 'provider_pettrek_transport'          THEN 'pettrek_transport_protocol'
          ELSE NULL
        END
      )
  );

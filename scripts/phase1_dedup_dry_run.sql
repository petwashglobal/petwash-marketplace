-- ============================================================================
-- ############################################################################
-- ##                                                                        ##
-- ##   DRY-RUN / READ-ONLY / DO NOT WRITE                                   ##
-- ##                                                                        ##
-- ##   This script only SELECTs and produces a report.                      ##
-- ##   It does NOT merge, delete, or update anything.                       ##
-- ##                                                                        ##
-- ##   File:    scripts/phase1_dedup_dry_run.sql                            ##
-- ##   Purpose: Enumerate every legacy identity collision on `users`        ##
-- ##            before Phase 6 adds UNIQUE indexes on:                      ##
-- ##                users.phone_e164                                        ##
-- ##                users.id_number_hash                                    ##
-- ##   Owner:   support@petwash.co.il                                       ##
-- ##                                                                        ##
-- ##   Recommended output:                                                  ##
-- ##     scripts/audit/dedup_report_YYYY-MM-DD.csv                          ##
-- ##                                                                        ##
-- ##   How to run from Cloud SQL Studio:                                    ##
-- ##     1. Connect to `petwash_prod` as a READ-ONLY role                   ##
-- ##        (e.g. `readonly_auditor`).                                      ##
-- ##     2. Paste this entire file. The whole script is wrapped in a        ##
-- ##        single READ ONLY transaction so an accidental UPDATE/DELETE     ##
-- ##        pasted after it cannot fire.                                    ##
-- ##     3. For each section, "Download results as CSV" and append to       ##
-- ##        dedup_report_YYYY-MM-DD.csv (one sheet per section).            ##
-- ##                                                                        ##
-- ############################################################################
-- ============================================================================

BEGIN;
SET TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10min';
SET LOCAL lock_timeout      = '5s';
SET LOCAL search_path       = public;


-- ###########################################################################
-- SECTION A — duplicate_verified_email
-- Rows where 2+ DIFFERENT users share the same lower-cased email AND
-- at least 2 of those rows have email_verified = true.
-- ###########################################################################
WITH verified_emails AS (
  SELECT
    LOWER(TRIM(email)) AS email_normalized,
    id                 AS uid,
    created_at,
    last_login_at,
    email_verified
  FROM users
  WHERE email IS NOT NULL
    AND email <> ''
),
dupes AS (
  SELECT
    email_normalized,
    COUNT(*) FILTER (WHERE email_verified) AS verified_count,
    COUNT(*)                               AS total_count,
    ARRAY_AGG(uid           ORDER BY created_at) AS uids,
    ARRAY_AGG(created_at    ORDER BY created_at) AS created_ats,
    ARRAY_AGG(last_login_at ORDER BY created_at) AS last_logins
  FROM verified_emails
  GROUP BY email_normalized
  HAVING COUNT(*) FILTER (WHERE email_verified) >= 2
),
money AS (
  SELECT
    u.id AS uid,
    (
      COALESCE(w.cash_wallet_balance_cents,   0) > 0
      OR COALESCE(w.egift_balance_cents,      0) > 0
      OR COALESCE(w.loyalty_points_balance,   0) > 0
      OR COALESCE(w.wash_package_credits,     0) > 0
      OR COALESCE(w.promo_balance_cents,      0) > 0
      OR COALESCE(w.referral_balance_cents,   0) > 0
      OR COALESCE(u.loyalty_balance_cents,    0) > 0
      OR COALESCE(u.wash_balance,             0) > 0
      OR COALESCE(u.gift_card_balance,        0) > 0
      OR COALESCE(u.total_spent,              0) > 0
      OR EXISTS (SELECT 1 FROM bookings b
                 WHERE b.user_id = u.id AND b.status = 'confirmed')
    ) AS has_money
  FROM users u
  LEFT JOIN wallet_accounts w ON w.user_id = u.id
)
SELECT
  'duplicate_verified_email' AS report_section,
  d.email_normalized,
  d.verified_count,
  d.total_count,
  d.uids,
  d.created_ats,
  d.last_logins,
  (SELECT COUNT(*) FILTER (WHERE m.has_money)
     FROM money m WHERE m.uid = ANY(d.uids)) AS uids_with_money,
  CASE
    WHEN (SELECT COUNT(*) FILTER (WHERE m.has_money)
            FROM money m WHERE m.uid = ANY(d.uids)) >= 2 THEN 'HIGH'
    WHEN (SELECT COUNT(*) FILTER (WHERE m.has_money)
            FROM money m WHERE m.uid = ANY(d.uids)) = 1 THEN 'MEDIUM'
    WHEN (SELECT COUNT(*) FROM money m WHERE m.uid = ANY(d.uids)) = 0 THEN 'UNKNOWN'
    ELSE 'LOW'
  END AS risk,
  CASE
    WHEN (SELECT COUNT(*) FILTER (WHERE m.has_money)
            FROM money m WHERE m.uid = ANY(d.uids)) >= 2 THEN TRUE
    WHEN (SELECT COUNT(*) FILTER (WHERE m.has_money)
            FROM money m WHERE m.uid = ANY(d.uids)) = 1
         AND d.verified_count >= 2                              THEN TRUE
    ELSE FALSE
  END AS escalation_recommended
FROM dupes d
ORDER BY d.verified_count DESC, d.email_normalized;


-- ###########################################################################
-- SECTION B — duplicate_verified_phone (phone_e164, 2+ verified)
-- ###########################################################################
WITH verified_phones AS (
  SELECT
    phone_e164,
    id                 AS uid,
    created_at,
    last_login_at,
    phone_verified
  FROM users
  WHERE phone_e164 IS NOT NULL
    AND phone_e164 <> ''
),
dupes AS (
  SELECT
    phone_e164,
    COUNT(*) FILTER (WHERE phone_verified) AS verified_count,
    COUNT(*)                               AS total_count,
    ARRAY_AGG(uid           ORDER BY created_at) AS uids,
    ARRAY_AGG(created_at    ORDER BY created_at) AS created_ats,
    ARRAY_AGG(last_login_at ORDER BY created_at) AS last_logins
  FROM verified_phones
  GROUP BY phone_e164
  HAVING COUNT(*) FILTER (WHERE phone_verified) >= 2
),
money AS (
  SELECT
    u.id AS uid,
    (
      COALESCE(w.cash_wallet_balance_cents,   0) > 0
      OR COALESCE(w.egift_balance_cents,      0) > 0
      OR COALESCE(w.loyalty_points_balance,   0) > 0
      OR COALESCE(w.wash_package_credits,     0) > 0
      OR COALESCE(w.promo_balance_cents,      0) > 0
      OR COALESCE(w.referral_balance_cents,   0) > 0
      OR COALESCE(u.loyalty_balance_cents,    0) > 0
      OR COALESCE(u.wash_balance,             0) > 0
      OR COALESCE(u.gift_card_balance,        0) > 0
      OR COALESCE(u.total_spent,              0) > 0
      OR EXISTS (SELECT 1 FROM bookings b
                 WHERE b.user_id = u.id AND b.status = 'confirmed')
    ) AS has_money
  FROM users u
  LEFT JOIN wallet_accounts w ON w.user_id = u.id
)
SELECT
  'duplicate_verified_phone' AS report_section,
  d.phone_e164,
  d.verified_count,
  d.total_count,
  d.uids,
  d.created_ats,
  d.last_logins,
  (SELECT COUNT(*) FILTER (WHERE m.has_money)
     FROM money m WHERE m.uid = ANY(d.uids)) AS uids_with_money,
  CASE
    WHEN (SELECT COUNT(*) FILTER (WHERE m.has_money)
            FROM money m WHERE m.uid = ANY(d.uids)) >= 2 THEN 'HIGH'
    WHEN (SELECT COUNT(*) FILTER (WHERE m.has_money)
            FROM money m WHERE m.uid = ANY(d.uids)) = 1 THEN 'MEDIUM'
    WHEN (SELECT COUNT(*) FROM money m WHERE m.uid = ANY(d.uids)) = 0 THEN 'UNKNOWN'
    ELSE 'LOW'
  END AS risk,
  CASE
    WHEN (SELECT COUNT(*) FILTER (WHERE m.has_money)
            FROM money m WHERE m.uid = ANY(d.uids)) >= 2 THEN TRUE
    WHEN (SELECT COUNT(*) FILTER (WHERE m.has_money)
            FROM money m WHERE m.uid = ANY(d.uids)) = 1
         AND d.verified_count >= 2                              THEN TRUE
    ELSE FALSE
  END AS escalation_recommended
FROM dupes d
ORDER BY d.verified_count DESC, d.phone_e164;


-- ###########################################################################
-- SECTION C — duplicate_id_number_hash (Teudat Zehut HMAC blind index)
-- ###########################################################################
WITH hashed AS (
  SELECT
    id_number_hash,
    id            AS uid,
    first_name,
    last_name,
    created_at,
    last_login_at,
    email_verified,
    phone_verified
  FROM users
  WHERE id_number_hash IS NOT NULL
    AND id_number_hash <> ''
),
dupes AS (
  SELECT
    id_number_hash,
    COUNT(*)                                          AS total_count,
    COUNT(*) FILTER (WHERE email_verified OR phone_verified)
                                                      AS any_verified_count,
    ARRAY_AGG(uid           ORDER BY created_at)      AS uids,
    ARRAY_AGG(created_at    ORDER BY created_at)      AS created_ats,
    ARRAY_AGG(last_login_at ORDER BY created_at)      AS last_logins,
    ARRAY_AGG(COALESCE(first_name,'') || ' ' || COALESCE(last_name,'')
              ORDER BY created_at)                    AS names
  FROM hashed
  GROUP BY id_number_hash
  HAVING COUNT(*) >= 2
),
money AS (
  SELECT
    u.id AS uid,
    (
      COALESCE(w.cash_wallet_balance_cents,   0) > 0
      OR COALESCE(w.egift_balance_cents,      0) > 0
      OR COALESCE(w.loyalty_points_balance,   0) > 0
      OR COALESCE(w.wash_package_credits,     0) > 0
      OR COALESCE(w.promo_balance_cents,      0) > 0
      OR COALESCE(w.referral_balance_cents,   0) > 0
      OR COALESCE(u.loyalty_balance_cents,    0) > 0
      OR COALESCE(u.wash_balance,             0) > 0
      OR COALESCE(u.gift_card_balance,        0) > 0
      OR COALESCE(u.total_spent,              0) > 0
      OR EXISTS (SELECT 1 FROM bookings b
                 WHERE b.user_id = u.id AND b.status = 'confirmed')
    ) AS has_money
  FROM users u
  LEFT JOIN wallet_accounts w ON w.user_id = u.id
)
SELECT
  'duplicate_id_number_hash' AS report_section,
  d.id_number_hash,
  d.total_count,
  d.any_verified_count,
  d.uids,
  d.names,
  d.created_ats,
  d.last_logins,
  (SELECT COUNT(*) FILTER (WHERE m.has_money)
     FROM money m WHERE m.uid = ANY(d.uids)) AS uids_with_money,
  CASE
    WHEN (SELECT COUNT(*) FILTER (WHERE m.has_money)
            FROM money m WHERE m.uid = ANY(d.uids)) >= 2 THEN 'HIGH'
    WHEN (SELECT COUNT(*) FILTER (WHERE m.has_money)
            FROM money m WHERE m.uid = ANY(d.uids)) = 1 THEN 'MEDIUM'
    WHEN (SELECT COUNT(*) FROM money m WHERE m.uid = ANY(d.uids)) = 0 THEN 'UNKNOWN'
    ELSE 'LOW'
  END AS risk,
  CASE
    WHEN (SELECT COUNT(*) FILTER (WHERE m.has_money)
            FROM money m WHERE m.uid = ANY(d.uids)) >= 1 THEN TRUE
    WHEN d.any_verified_count >= 2                              THEN TRUE
    ELSE FALSE
  END AS escalation_recommended
FROM dupes d
ORDER BY d.total_count DESC, d.id_number_hash;


-- ###########################################################################
-- SECTION D — email_verified_and_phone_verified_cross
-- Cross-signal duplicates: A has verified phone AND lists email X;
-- B has verified email X (a different uid). Symmetric variant included.
-- ###########################################################################
WITH a_phone AS (
  SELECT
    id                       AS uid_a,
    phone_e164               AS phone_a,
    LOWER(TRIM(email))       AS email_a,
    created_at               AS created_a
  FROM users
  WHERE phone_verified = TRUE
    AND phone_e164 IS NOT NULL
    AND email      IS NOT NULL
    AND email      <> ''
),
b_email AS (
  SELECT
    id                       AS uid_b,
    LOWER(TRIM(email))       AS email_b,
    phone_e164               AS phone_b,
    created_at               AS created_b
  FROM users
  WHERE email_verified = TRUE
    AND email          IS NOT NULL
    AND email          <> ''
),
cross_pairs AS (
  SELECT
    a.uid_a,
    a.phone_a,
    a.email_a AS shared_email,
    b.uid_b,
    b.phone_b,
    a.created_a,
    b.created_b,
    'phone_A_meets_email_B' AS pattern
  FROM a_phone a
  JOIN b_email b
    ON b.email_b = a.email_a
   AND b.uid_b   <> a.uid_a

  UNION ALL

  SELECT
    ea.id                       AS uid_a,
    eb.phone_e164               AS phone_a,
    LOWER(TRIM(ea.email))       AS shared_email,
    eb.id                       AS uid_b,
    eb.phone_e164               AS phone_b,
    ea.created_at               AS created_a,
    eb.created_at               AS created_b,
    'email_A_meets_phone_B'     AS pattern
  FROM users ea
  JOIN users eb
    ON eb.phone_verified = TRUE
   AND eb.phone_e164     = ea.phone_e164
   AND eb.id             <> ea.id
  WHERE ea.email_verified = TRUE
    AND ea.phone_e164 IS NOT NULL
),
money AS (
  SELECT
    u.id AS uid,
    (
      COALESCE(w.cash_wallet_balance_cents,   0) > 0
      OR COALESCE(w.egift_balance_cents,      0) > 0
      OR COALESCE(w.loyalty_points_balance,   0) > 0
      OR COALESCE(w.wash_package_credits,     0) > 0
      OR COALESCE(w.promo_balance_cents,      0) > 0
      OR COALESCE(w.referral_balance_cents,   0) > 0
      OR COALESCE(u.loyalty_balance_cents,    0) > 0
      OR COALESCE(u.wash_balance,             0) > 0
      OR COALESCE(u.gift_card_balance,        0) > 0
      OR COALESCE(u.total_spent,              0) > 0
      OR EXISTS (SELECT 1 FROM bookings b
                 WHERE b.user_id = u.id AND b.status = 'confirmed')
    ) AS has_money
  FROM users u
  LEFT JOIN wallet_accounts w ON w.user_id = u.id
)
SELECT
  'email_verified_and_phone_verified_cross' AS report_section,
  p.pattern,
  p.shared_email,
  p.uid_a, p.phone_a, p.created_a,
  p.uid_b, p.phone_b, p.created_b,
  ma.has_money AS a_has_money,
  mb.has_money AS b_has_money,
  CASE
    WHEN ma.has_money AND mb.has_money        THEN 'HIGH'
    WHEN ma.has_money OR  mb.has_money        THEN 'MEDIUM'
    WHEN ma.has_money IS NULL
      OR mb.has_money IS NULL                 THEN 'UNKNOWN'
    ELSE 'LOW'
  END AS risk,
  CASE
    WHEN ma.has_money AND mb.has_money THEN TRUE
    WHEN ma.has_money OR  mb.has_money THEN TRUE
    ELSE FALSE
  END AS escalation_recommended
FROM cross_pairs p
LEFT JOIN money ma ON ma.uid = p.uid_a
LEFT JOIN money mb ON mb.uid = p.uid_b
ORDER BY risk DESC, p.shared_email;


-- ###########################################################################
-- SECTION E — orphan_slug_ids
-- users.id that doesn't match a Firebase UID pattern or nanoid pattern.
-- ###########################################################################
WITH money AS (
  SELECT
    u.id AS uid,
    (
      COALESCE(w.cash_wallet_balance_cents,   0) > 0
      OR COALESCE(w.egift_balance_cents,      0) > 0
      OR COALESCE(w.loyalty_points_balance,   0) > 0
      OR COALESCE(w.wash_package_credits,     0) > 0
      OR COALESCE(w.promo_balance_cents,      0) > 0
      OR COALESCE(w.referral_balance_cents,   0) > 0
      OR COALESCE(u.loyalty_balance_cents,    0) > 0
      OR COALESCE(u.wash_balance,             0) > 0
      OR COALESCE(u.gift_card_balance,        0) > 0
      OR COALESCE(u.total_spent,              0) > 0
      OR EXISTS (SELECT 1 FROM bookings b
                 WHERE b.user_id = u.id AND b.status = 'confirmed')
    ) AS has_money
  FROM users u
  LEFT JOIN wallet_accounts w ON w.user_id = u.id
)
SELECT
  'orphan_slug_ids' AS report_section,
  u.id                AS uid,
  u.email,
  u.phone_e164,
  u.first_name,
  u.last_name,
  u.email_verified,
  u.phone_verified,
  u.created_at,
  u.last_login_at,
  m.has_money,
  CASE
    WHEN m.has_money           THEN 'HIGH'
    WHEN m.has_money IS NULL   THEN 'UNKNOWN'
    ELSE 'LOW'
  END AS risk,
  CASE
    WHEN m.has_money                                 THEN TRUE
    WHEN u.email_verified OR u.phone_verified        THEN TRUE
    ELSE FALSE
  END AS escalation_recommended
FROM users u
LEFT JOIN money m ON m.uid = u.id
WHERE
  u.id !~ '^[A-Za-z0-9]{20,32}$'
  AND u.id !~ '^[A-Za-z0-9_-]{21}$'
ORDER BY (m.has_money IS TRUE) DESC, u.created_at;


-- ###########################################################################
-- SECTION F — row-count summaries (pin at top of report CSV)
-- ###########################################################################
SELECT
  (SELECT COUNT(*) FROM users)                                        AS users_total,

  (SELECT COUNT(*) FROM (
      SELECT LOWER(TRIM(email)) e
      FROM users
      WHERE email_verified = TRUE AND email IS NOT NULL AND email <> ''
      GROUP BY 1 HAVING COUNT(*) >= 2
   ) x)                                                               AS section_a_dup_verified_email_groups,

  (SELECT COUNT(*) FROM (
      SELECT phone_e164
      FROM users
      WHERE phone_verified = TRUE AND phone_e164 IS NOT NULL AND phone_e164 <> ''
      GROUP BY 1 HAVING COUNT(*) >= 2
   ) x)                                                               AS section_b_dup_verified_phone_groups,

  (SELECT COUNT(*) FROM (
      SELECT id_number_hash
      FROM users
      WHERE id_number_hash IS NOT NULL AND id_number_hash <> ''
      GROUP BY 1 HAVING COUNT(*) >= 2
   ) x)                                                               AS section_c_dup_id_number_hash_groups,

  (SELECT COUNT(*) FROM users a JOIN users b
      ON LOWER(TRIM(b.email)) = LOWER(TRIM(a.email))
     AND b.id <> a.id
   WHERE a.phone_verified = TRUE
     AND b.email_verified = TRUE
     AND a.email IS NOT NULL AND a.email <> ''
  )                                                                   AS section_d_cross_pair_estimate,

  (SELECT COUNT(*) FROM users
    WHERE id !~ '^[A-Za-z0-9]{20,32}$'
      AND id !~ '^[A-Za-z0-9_-]{21}$')                                AS section_e_orphan_slug_ids
;

COMMIT;
-- End of dry-run script. NO writes were performed.

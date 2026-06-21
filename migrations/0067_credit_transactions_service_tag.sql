-- 0067_credit_transactions_service_tag.sql
-- Tag every wallet credit with the service it belongs to. Historically
-- credit_transactions.platform was always NULL on addCredits, so a wash credit
-- was only inferable from a free-text, overloaded source_type — you could not
-- tell "K9000 or pet-sitting?" from one row. Going forward addCredits sets it;
-- this backfills existing rows from the RELIABLE credit_type enum.
-- Safe + idempotent: only fills rows where platform IS NULL; column stays
-- nullable (no NOT-NULL constraint that could fail on legacy data).

UPDATE credit_transactions
SET platform = CASE credit_type
  WHEN 'wash_package'    THEN 'k9000'
  WHEN 'egift'           THEN 'egift'
  WHEN 'loyalty_points'  THEN 'loyalty'
  WHEN 'promo_credit'    THEN 'promo'
  WHEN 'referral_credit' THEN 'referral'
  ELSE 'account_credit'
END
WHERE platform IS NULL;

-- Fast lookups / reporting by service.
CREATE INDEX IF NOT EXISTS idx_credit_transactions_platform
  ON credit_transactions (platform);

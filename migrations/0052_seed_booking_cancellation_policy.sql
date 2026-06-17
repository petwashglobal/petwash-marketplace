-- Seed a default cancellation policy so the tiered refund engine actually
-- resolves a policy. Without any row, BookingPolicyEngine.getApplicablePolicy()
-- returns null → calculateCancellation() returns canCancel:false, and the cancel
-- route falls back to a FULL refund (safe). With this row, a customer's late
-- cancel correctly refunds the tiered percent instead of 100%.
--
-- service_type 'all' is the universal fallback the engine checks when no
-- service-specific policy exists. Tiers (ex-fee, percent of gross):
--   >= 24h before  → 100% refund
--   12–24h before  →  50% refund
--   < 12h before   →   0% refund
-- Idempotent: re-running does nothing.
INSERT INTO booking_policies (
  policy_id, policy_name, policy_name_he, service_type, policy_tier,
  cancellation_rules, auto_refund_enabled, refund_processing_days,
  refund_method, is_active, effective_date, version
)
VALUES (
  'CANCEL-DEFAULT-ALL-001',
  'Default cancellation policy',
  'מדיניות ביטול ברירת מחדל',
  'all',
  'moderate',
  '{"24_hours_before":{"refund_percent":100,"fee":0},"12_hours_before":{"refund_percent":50,"fee":0},"less_than_12":{"refund_percent":0,"fee":0}}'::jsonb,
  true,
  5,
  'original_payment',
  true,
  CURRENT_DATE,
  '1.0'
)
ON CONFLICT (policy_id) DO NOTHING;

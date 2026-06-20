-- Coupon deactivation reason (additive, safe). 2026-06-20.
--
-- BUG FIX: CouponService.deactivateWithReason() runs
--   UPDATE coupons SET is_active = false, deactivate_reason = $1, updated_at = NOW() ...
-- but the column never existed, so the admin "disable coupon" action 500s in prod.
-- This adds the missing column. No data is altered; existing rows get NULL.
--
-- After this lands, the admin Discounts "Disable" flow (reason: campaign ended /
-- financial / abuse / manual) writes the reason here and to the coupon audit trail,
-- and checkout immediately stops applying the coupon (is_active = false).

ALTER TABLE coupons ADD COLUMN IF NOT EXISTS deactivate_reason TEXT;

-- Coupon admin audit trail. CouponService.writeAudit() inserts here on
-- issue / clone / deactivate, but the table never existed so the trail was
-- silently dropped (the INSERT is wrapped non-fatal). Create it so admin
-- coupon actions are actually recorded ("no audit = not acceptable").
CREATE TABLE IF NOT EXISTS coupon_audit_log (
  id            SERIAL PRIMARY KEY,
  coupon_id     INTEGER,
  admin_user_id VARCHAR NOT NULL,
  action        VARCHAR(40) NOT NULL,   -- issued_to_user | cloned | deactivated | ...
  details       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coupon_audit_log_coupon ON coupon_audit_log (coupon_id, created_at DESC);

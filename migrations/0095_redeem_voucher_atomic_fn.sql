-- H6a (go-live audit): storage.redeemVoucher calls redeem_voucher_atomic()
-- since the Replit era, but the function was never in ANY migration — a fresh
-- DB (or DR rebuild) throws 42883 on the live station/Nayax spend path.
-- Semantics mirror the caller's contract (storage.ts:1615): atomically
-- decrement remaining_amount IFF the voucher is spendable and funded;
-- flip status to USED when the balance reaches zero. Returns true on success.
-- Expiry is pre-checked by the caller; the status/fund checks here are the
-- atomic double-spend guard. CREATE OR REPLACE = safe if prod already has it.
CREATE OR REPLACE FUNCTION redeem_voucher_atomic(p_voucher_id uuid, p_amount numeric)
RETURNS boolean AS $$
DECLARE
  v_rows integer;
BEGIN
  UPDATE e_vouchers
     SET remaining_amount = remaining_amount - p_amount,
         status = CASE
                    WHEN remaining_amount - p_amount <= 0 THEN 'USED'
                    ELSE status
                  END
   WHERE id = p_voucher_id::text
     AND status IN ('ISSUED', 'CLAIMED', 'ACTIVE')
     AND remaining_amount >= p_amount
     AND p_amount > 0;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$$ LANGUAGE plpgsql;

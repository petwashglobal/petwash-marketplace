-- 2026-09-13: one SUMIT payment may fulfil exactly one order.
-- SUMIT's official Payment object carries no external identifier, so the
-- per-order binding in server/lib/sumitExternalRef.ts can never compare and was
-- inert. The first order to fulfil from a PaymentID owns it; every other order,
-- on any surface, is refused. See server/lib/sumitPaymentReturn.ts.
CREATE TABLE IF NOT EXISTS sumit_payment_claims (
  payment_id  BIGINT PRIMARY KEY,
  order_ref   TEXT NOT NULL,
  surface     TEXT NOT NULL,
  claimed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

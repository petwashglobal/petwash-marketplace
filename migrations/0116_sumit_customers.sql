-- 0116: SUMIT customer sync mapping (Phase 2 of SUMIT full-service adoption,
-- CEO 2026-08-16). Additive-only. See docs/design/2026-08-16-sumit-full-service-adoption.md.
--
-- Rationale: today `/accounting/customers/create/` is never called and no
-- PetWash member exists in SUMIT — so the SUMIT customer portal is
-- unreachable and our own chargeRecurring/chargeSavedCard/setForCustomer
-- code has no CustomerID to pass. This table is the uid → SUMIT-CustomerID
-- map that unblocks Phase 3 (dashboard link), Phase 5 (subscriptions), and
-- Phase 6 (webhook lifecycle).
--
-- Not-touched: users / customers / payment_tokens tables — the mapping is
-- separate so the SUMIT layer can be flag-gated cleanly and, if we need to,
-- reset without touching identity storage.

CREATE TABLE IF NOT EXISTS sumit_customers (
  user_id              VARCHAR(128) PRIMARY KEY,       -- Firebase UID (or customers.id.toString())
  sumit_customer_id    VARCHAR(128) NOT NULL UNIQUE,   -- SUMIT-assigned CustomerID (response field)
  customer_history_url TEXT,                           -- SUMIT CustomerHistoryURL from /accounting/customers/create/ response
  synced_at            TIMESTAMP    NOT NULL DEFAULT now(),
  source               VARCHAR(32)  NOT NULL,          -- 'signup' | 'backfill' | 'manual'
  external_reference   VARCHAR(128) NOT NULL,          -- our idempotency handle (usually = user_id)
  last_error           TEXT
);

CREATE INDEX IF NOT EXISTS idx_sumit_customers_synced_at
  ON sumit_customers (synced_at);

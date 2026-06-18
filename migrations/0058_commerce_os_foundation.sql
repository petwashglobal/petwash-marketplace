-- Commerce OS foundation — unified purchase lifecycle (additive, INERT in v1).
-- One program: docs/design/2026-06-18-petwash-commerce-os.md +
-- docs/design/2026-05-26-payment-provider-routing-and-lifecycle.md.
-- Nothing reads these yet; checkout/router/webhook-activation land in later PRs
-- behind ff.commerce.unified_purchase_lifecycle.* (default OFF). `purchases` is a
-- SHADOW row in v1 — surface-specific tables remain source of truth until a surface
-- flips to read from it. No existing table is changed. 2026-06-18.

CREATE TABLE IF NOT EXISTS purchases (
  id                 varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  surface            text NOT NULL,
  surface_ref_id     text NOT NULL,
  buyer_user_id      text NOT NULL,
  receiver_user_id   text,
  product_type       text NOT NULL,
  amount_cents       bigint NOT NULL,
  currency           text NOT NULL DEFAULT 'ILS',
  status             text NOT NULL,
  payment_method     text NOT NULL,
  segment            text NOT NULL,
  acquirer           text,
  system_of_record   text NOT NULL DEFAULT 'sumit',
  transaction_id     text,
  receipt_number     text,
  fee_snapshot_json  jsonb,
  vat_cents          bigint NOT NULL DEFAULT 0,
  rule_set_version   text,
  metadata_json      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS purchases_surface_ref_uq ON purchases (surface, surface_ref_id);
CREATE INDEX IF NOT EXISTS purchases_buyer_idx ON purchases (buyer_user_id);
CREATE INDEX IF NOT EXISTS purchases_status_idx ON purchases (status);
CREATE INDEX IF NOT EXISTS purchases_created_at_idx ON purchases (created_at);
CREATE UNIQUE INDEX IF NOT EXISTS purchases_transaction_id_uq
  ON purchases (acquirer, transaction_id) WHERE transaction_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS purchases_receipt_number_uq
  ON purchases (system_of_record, receipt_number) WHERE receipt_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS purchase_events (
  id                  varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id         varchar NOT NULL,
  surface             text NOT NULL,
  old_status          text,
  new_status          text NOT NULL,
  actor_type          text NOT NULL,
  actor_id            text,
  provider_name       text,
  provider_reference  text,
  metadata_json       jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS purchase_events_purchase_idx ON purchase_events (purchase_id, occurred_at);
CREATE UNIQUE INDEX IF NOT EXISTS purchase_events_provider_ref_uq
  ON purchase_events (provider_name, provider_reference) WHERE provider_reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS payment_provider_routes (
  id                varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  acquirer          text NOT NULL,
  surface           text,
  payment_method    text,
  segment           text,
  min_amount_cents  bigint,
  max_amount_cents  bigint,
  fee_bps           integer NOT NULL,
  fee_vat_bps       integer NOT NULL,
  fixed_fee_cents   bigint NOT NULL DEFAULT 0,
  source            text NOT NULL,
  source_url        text,
  status            text NOT NULL DEFAULT 'draft',
  effective_from    timestamptz,
  effective_to      timestamptz,
  created_by        text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_provider_routes_acquirer_idx ON payment_provider_routes (acquirer);
CREATE INDEX IF NOT EXISTS payment_provider_routes_status_idx ON payment_provider_routes (status);

-- Migration: 0031_payment_devices
--
-- Backend asset/stock management for physical payment hardware (Nayax
-- VPOS Touch credit-card readers attached to PetWash machines). This
-- migration is ADMIN INFRASTRUCTURE only — it does NOT touch:
--   - Nayax payment runtime (NayaxOnlinePaymentService, NayaxFirestoreService)
--   - K9000 polling / machine commands
--   - wallet credit/debit
--   - payment session lifecycle
--
-- Two new tables:
--   1. payment_devices            — one row per physical device (Nayax
--                                   VPOS Touch unit). Tracks lifecycle:
--                                   in_stock → installed → active → faulty
--                                   → returned. Serial number is private
--                                   (never exposed to customers).
--   2. payment_device_assignments — append-only history of which device
--                                   was assigned to which machine /
--                                   location and when. Lets ops trace
--                                   "device X was here on date Y" for
--                                   reconciliation + warranty disputes.
--
-- The 6 draft serial numbers extracted from the operator's photos are
-- NOT auto-inserted. Operator verifies each one on the admin screen
-- and clicks Save. See docs/finance/nayax-device-stock-seed.md.
--
-- Fully ADDITIVE — no existing column changes meaning, no row migration
-- needed.

BEGIN;

-- 1. payment_devices ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_devices (
  id                    SERIAL PRIMARY KEY,
  provider              VARCHAR(40)  NOT NULL DEFAULT 'nayax',  -- 'nayax' for now
  model                 VARCHAR(80)  NOT NULL,                   -- 'VPOS Touch'
  serial_number         VARCHAR(64)  NOT NULL,                   -- private; never exposed to customers
  part_number           VARCHAR(64),                             -- optional
  nayax_terminal_id     VARCHAR(64),                             -- Nayax's terminal id (separate from our serial)
  sim_iccid             VARCHAR(64),                             -- SIM / module identifier if available
  status                VARCHAR(24)  NOT NULL DEFAULT 'in_stock' -- in_stock | installed | active | inactive | faulty | returned
                        CHECK (status IN ('in_stock','installed','active','inactive','faulty','returned')),
  -- Current assignment (denormalised for fast lookups; history lives in
  -- payment_device_assignments below). NULL when status='in_stock' or
  -- 'returned'.
  assigned_machine_id   VARCHAR(64),
  assigned_location_id  VARCHAR(64),
  installation_date     TIMESTAMPTZ,
  last_seen_at          TIMESTAMPTZ,                             -- updated when admin verifies presence
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Hard uniqueness: a serial number is a physical-world identifier and
  -- must never appear twice in the system. Provider-scoped because two
  -- different vendors could theoretically reuse a serial-number space.
  CONSTRAINT payment_devices_provider_serial_unique UNIQUE (provider, serial_number)
);

CREATE INDEX IF NOT EXISTS idx_payment_devices_status            ON payment_devices (status);
CREATE INDEX IF NOT EXISTS idx_payment_devices_assigned_machine  ON payment_devices (assigned_machine_id) WHERE assigned_machine_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_devices_assigned_location ON payment_devices (assigned_location_id) WHERE assigned_location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_devices_provider          ON payment_devices (provider);

-- 2. payment_device_assignments ──────────────────────────────────────────────
-- Append-only history. Insert one row each time a device is assigned,
-- moved, or unassigned. NEVER update or delete existing rows — auditors
-- need to trace "this device was at this site on this date" without gaps.
CREATE TABLE IF NOT EXISTS payment_device_assignments (
  id              SERIAL PRIMARY KEY,
  device_id       INTEGER NOT NULL REFERENCES payment_devices(id) ON DELETE RESTRICT,
  machine_id      VARCHAR(64),
  location_id     VARCHAR(64),
  status_at_event VARCHAR(24) NOT NULL,                          -- snapshot of payment_devices.status at the moment
  event_type      VARCHAR(24) NOT NULL                           -- assigned | reassigned | unassigned | marked_faulty | activated | deactivated | returned
                  CHECK (event_type IN ('assigned','reassigned','unassigned','marked_faulty','activated','deactivated','returned')),
  performed_by    VARCHAR(128) NOT NULL,                         -- admin uid
  performed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  note            TEXT
);

CREATE INDEX IF NOT EXISTS idx_payment_device_assignments_device  ON payment_device_assignments (device_id);
CREATE INDEX IF NOT EXISTS idx_payment_device_assignments_machine ON payment_device_assignments (machine_id) WHERE machine_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_device_assignments_time    ON payment_device_assignments (performed_at DESC);

-- Append-only protection — block UPDATE / DELETE on the assignments
-- table. Same pattern used for maya_audit_log (PR #393). The /api/admin/
-- routes that move a device INSERT a new row instead of mutating.
CREATE OR REPLACE FUNCTION payment_device_assignments_block_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'payment_device_assignments is append-only — use INSERT for new events';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_device_assignments_no_update ON payment_device_assignments;
DROP TRIGGER IF EXISTS trg_payment_device_assignments_no_delete ON payment_device_assignments;

CREATE TRIGGER trg_payment_device_assignments_no_update
  BEFORE UPDATE ON payment_device_assignments
  FOR EACH ROW EXECUTE FUNCTION payment_device_assignments_block_mutation();

CREATE TRIGGER trg_payment_device_assignments_no_delete
  BEFORE DELETE ON payment_device_assignments
  FOR EACH ROW EXECUTE FUNCTION payment_device_assignments_block_mutation();

COMMIT;

-- ============================================================================
-- ROLLBACK (uncomment to revert)
-- ============================================================================
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_payment_device_assignments_no_delete ON payment_device_assignments;
-- DROP TRIGGER IF EXISTS trg_payment_device_assignments_no_update ON payment_device_assignments;
-- DROP FUNCTION IF EXISTS payment_device_assignments_block_mutation();
-- DROP TABLE IF EXISTS payment_device_assignments;
-- DROP TABLE IF EXISTS payment_devices;
-- COMMIT;

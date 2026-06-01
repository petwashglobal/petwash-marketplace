-- Migration: 0028_maya_reception_intake_foundation
--
-- PR: Maya Stage 1 — reception backend intake foundation
-- Branch: claude/maya-reception-backend-intake-foundation
--
-- Scope: adds eight maya_* tables for the PetWash reception/office-assistant
-- intake pipeline. Fully ADDITIVE — every column is nullable or has a safe
-- default; no existing table is touched; every existing INSERT/UPDATE/read
-- keeps working. Idempotent (IF NOT EXISTS on tables + indexes).
--
-- Out of scope for this PR (parked for later stages):
--   * /api/maya/* route handlers          (Stage 1b — wiring + tests)
--   * Drizzle table definitions           (Stage 1b — shared/schema.ts)
--   * /admin/maya screens                 (Stage 2)
--   * Knowledge base / FAQ                (Stage 6)
--   * PetWash Pass / K9000 redemption     (already exists in the codebase; see
--     docs/design/2026-05-22-petwash-pass-k9000-redemption.md — Maya only
--     READS that state via support_tickets; Maya does NOT change balances,
--     approve redemptions, or start K9000 machines)
--   * WhatsApp / email                    (Stage 8)
--   * Phone / voice                       (Stage 9)
--
-- This migration moves NO money. No payment execution. No wallet writes.
-- No K9000 release. No provider approval. No booking confirmation.
-- All new behavior is gated behind ff.maya.* feature flags (default OFF)
-- that Stage 1b will wire in. The tables stay empty in production until the
-- flag is flipped.
--
-- Audit: maya_audit_log is APPEND-ONLY at the DB level — a trigger raises
-- on UPDATE or DELETE. This is intentional and separate from the canonical
-- financial audit_ledger; reception/intake events do not belong on the
-- hash-chained financial ledger.
--
-- Rollback (commented at bottom): drop the maya_* tables.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- maya_conversations — one row per visitor/admin session with Maya
-- ============================================================================
CREATE TABLE IF NOT EXISTS maya_conversations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel         varchar(20) NOT NULL,
  locale          varchar(2)  NOT NULL DEFAULT 'he',
  contact_phone   varchar(32),
  contact_email   varchar(255),
  contact_name    varchar(255),
  status          varchar(20) NOT NULL DEFAULT 'open',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  CHECK (channel IN ('web','admin','test')),
  CHECK (locale  IN ('he','en')),
  CHECK (status  IN ('open','closed','archived'))
);
CREATE INDEX IF NOT EXISTS idx_maya_conversations_status
  ON maya_conversations (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_maya_conversations_created_at
  ON maya_conversations (created_at);

-- ============================================================================
-- maya_messages — append-mostly chat log within a conversation
-- ============================================================================
CREATE TABLE IF NOT EXISTS maya_messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid NOT NULL REFERENCES maya_conversations(id) ON DELETE CASCADE,
  role             varchar(20) NOT NULL,
  content          text NOT NULL,
  locale           varchar(2)  NOT NULL DEFAULT 'he',
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (role   IN ('user','maya','system','admin')),
  CHECK (locale IN ('he','en'))
);
CREATE INDEX IF NOT EXISTS idx_maya_messages_conv_created
  ON maya_messages (conversation_id, created_at);

-- ============================================================================
-- maya_leads — captured lead intake (free-form, no FK to canonical user yet)
-- ============================================================================
CREATE TABLE IF NOT EXISTS maya_leads (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid REFERENCES maya_conversations(id) ON DELETE SET NULL,
  name             varchar(255),
  phone            varchar(32),    -- E.164
  email            varchar(255),
  city             varchar(120),
  intent           text,
  source           varchar(40),    -- 'web','referral','walk-in', etc.
  status           varchar(20) NOT NULL DEFAULT 'new',
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  CHECK (status IN ('new','contacted','qualified','closed'))
);
CREATE INDEX IF NOT EXISTS idx_maya_leads_status
  ON maya_leads (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_maya_leads_phone
  ON maya_leads (phone) WHERE deleted_at IS NULL;

-- ============================================================================
-- maya_provider_intake_drafts — DRAFT-ONLY. 'approved' is intentionally NOT a
-- valid status — provider approval lives outside Maya.
-- ============================================================================
CREATE TABLE IF NOT EXISTS maya_provider_intake_drafts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id    uuid REFERENCES maya_conversations(id) ON DELETE SET NULL,
  business_name      varchar(255),
  contact_name       varchar(255),
  phone              varchar(32),
  email              varchar(255),
  city               varchar(120),
  region             varchar(120),
  services_offered   text[],
  notes              text,
  intake_status      varchar(30) NOT NULL DEFAULT 'draft',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz,
  CHECK (intake_status IN ('draft','submitted-for-review'))
);
CREATE INDEX IF NOT EXISTS idx_maya_provider_drafts_status
  ON maya_provider_intake_drafts (intake_status) WHERE deleted_at IS NULL;

-- ============================================================================
-- maya_booking_intake_drafts — DRAFT-ONLY. 'confirmed' is intentionally NOT a
-- valid status — final booking confirmation lives in the existing booking
-- system. Price is NOT stored here; it must be resolved from source-of-truth
-- at confirm time.
-- ============================================================================
CREATE TABLE IF NOT EXISTS maya_booking_intake_drafts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id       uuid REFERENCES maya_conversations(id) ON DELETE SET NULL,
  lead_id               uuid REFERENCES maya_leads(id) ON DELETE SET NULL,
  service_code          varchar(40),    -- e.g. 'single-wash'
  pet_name              varchar(120),
  pet_breed             varchar(120),
  pet_size              varchar(10),
  preferred_dates       text[],
  preferred_location    varchar(120),
  notes                 text,
  intake_status         varchar(30) NOT NULL DEFAULT 'draft',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz,
  CHECK (pet_size      IS NULL OR pet_size IN ('small','medium','large','xl')),
  CHECK (intake_status IN ('draft','submitted-for-review'))
);
CREATE INDEX IF NOT EXISTS idx_maya_booking_drafts_status
  ON maya_booking_intake_drafts (intake_status) WHERE deleted_at IS NULL;

-- ============================================================================
-- maya_tasks — reception/callback tasks
-- ============================================================================
CREATE TABLE IF NOT EXISTS maya_tasks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid REFERENCES maya_conversations(id) ON DELETE SET NULL,
  title            varchar(255) NOT NULL,
  description      text,
  assignee         varchar(255),    -- free-text owner; wire to users in 1b
  status           varchar(20) NOT NULL DEFAULT 'open',
  due_at           timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  CHECK (status IN ('open','in-progress','done','cancelled'))
);
CREATE INDEX IF NOT EXISTS idx_maya_tasks_status
  ON maya_tasks (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_maya_tasks_assignee
  ON maya_tasks (assignee) WHERE deleted_at IS NULL;

-- ============================================================================
-- maya_escalations — items Maya routes to a human (out-of-scope conversations,
-- fraud concerns, technical issues, etc.). Maya cannot resolve fraud blocks.
-- ============================================================================
CREATE TABLE IF NOT EXISTS maya_escalations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid REFERENCES maya_conversations(id) ON DELETE SET NULL,
  reason           text NOT NULL,
  severity         varchar(10) NOT NULL DEFAULT 'medium',
  status           varchar(20) NOT NULL DEFAULT 'open',
  assignee         varchar(255),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  CHECK (severity IN ('low','medium','high','critical')),
  CHECK (status   IN ('open','acknowledged','resolved'))
);
CREATE INDEX IF NOT EXISTS idx_maya_escalations_status
  ON maya_escalations (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_maya_escalations_severity
  ON maya_escalations (severity);

-- ============================================================================
-- maya_audit_log — APPEND-ONLY at the DB level.
--
-- Separate from the canonical financial audit_ledger by design: reception/
-- intake events should not pollute the hash-chained financial ledger. The
-- only Maya operations that touch the financial ledger go through the
-- existing AuditLedgerService (Stage 7+ K9000 read-only support flow).
-- ============================================================================
CREATE TABLE IF NOT EXISTS maya_audit_log (
  id           bigserial PRIMARY KEY,
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  actor_type   varchar(20) NOT NULL,
  actor_id     varchar(255),
  entity_type  varchar(40) NOT NULL,
  entity_id    varchar(64) NOT NULL,
  action       varchar(40) NOT NULL,
  payload      jsonb,
  CHECK (actor_type IN ('system','maya','admin','user'))
);
CREATE INDEX IF NOT EXISTS idx_maya_audit_entity
  ON maya_audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_maya_audit_occurred_at
  ON maya_audit_log (occurred_at);

CREATE OR REPLACE FUNCTION maya_audit_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'maya_audit_log is append-only; UPDATE/DELETE not permitted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS maya_audit_no_update ON maya_audit_log;
DROP TRIGGER IF EXISTS maya_audit_no_delete ON maya_audit_log;
CREATE TRIGGER maya_audit_no_update BEFORE UPDATE ON maya_audit_log
  FOR EACH ROW EXECUTE FUNCTION maya_audit_block_mutation();
CREATE TRIGGER maya_audit_no_delete BEFORE DELETE ON maya_audit_log
  FOR EACH ROW EXECUTE FUNCTION maya_audit_block_mutation();

-- ============================================================================
-- ROLLBACK (uncomment to revert)
-- ============================================================================
-- BEGIN;
-- DROP TRIGGER IF EXISTS maya_audit_no_update ON maya_audit_log;
-- DROP TRIGGER IF EXISTS maya_audit_no_delete ON maya_audit_log;
-- DROP FUNCTION IF EXISTS maya_audit_block_mutation();
-- DROP TABLE IF EXISTS maya_audit_log;
-- DROP TABLE IF EXISTS maya_escalations;
-- DROP TABLE IF EXISTS maya_tasks;
-- DROP TABLE IF EXISTS maya_booking_intake_drafts;
-- DROP TABLE IF EXISTS maya_provider_intake_drafts;
-- DROP TABLE IF EXISTS maya_leads;
-- DROP TABLE IF EXISTS maya_messages;
-- DROP TABLE IF EXISTS maya_conversations;
-- COMMIT;

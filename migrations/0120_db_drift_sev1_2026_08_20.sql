-- 0120: Heal 6 DB-drift SEV-1 gaps found in the 2026-08-20 audit.
--
-- Every path below was creating a live 500 in prod because the code assumed
-- a table (or a rename) that never made it into the schema. All fixes are
-- ADDITIVE (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).
-- No DROP, no ALTER TYPE, no destructive change. Safe to re-run.
--
-- The three rename gaps (refunds → booking_refunds, payout_entries →
-- provider_payout_entries, kill_switches → system_kill_switches) are
-- code-only fixes — those tables already exist under the correct names
-- in prod (verified against docs/recovery/2026-07-03-.../prod-schema).
--
-- SEV-1 gaps healed here:
--   #1 loyalty_activity_log       — loyalty award tx rolled back → NO points
--   #2 coupon_reservations         — confirmReservation() 500s → coupons dead
--   #3 system_events               — ThreatGuard / anomaly writes swallowed
--   #4 case_assignments, teams,
--      team_members, case_sla_states,
--      case_escalation_log, case_notes  — SLA-monitor errored every 5 min
--   #6 remittance_email_log        — monthly payout emails died on upsert
--
-- Apply order does not matter — every statement is independent + idempotent.


-- ═════════════════════════════════════════════════════════════════════════════
-- SEV-1 #1 — loyalty_activity_log
-- server/actions/loyaltySync.ts:102, :168, :274 — INSIDE db.transaction.
-- Missing table = 42P01 → tx rolls back → users earn no loyalty points.
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS loyalty_activity_log (
  id            bigserial   PRIMARY KEY,
  user_id       text        NOT NULL,
  points_delta  integer     NOT NULL,
  reason        text        NOT NULL,
  new_balance   integer     NOT NULL,
  new_tier      text,
  metadata      jsonb,
  created_at    timestamp   NOT NULL DEFAULT NOW()
);

-- Supports the replay-guard SELECT at loyaltySync.ts:102 which filters by
-- (user_id, reason, metadata->>'bookingId') and per-user activity listings.
CREATE INDEX IF NOT EXISTS idx_loyalty_activity_log_user_created
  ON loyalty_activity_log (user_id, created_at DESC);


-- ═════════════════════════════════════════════════════════════════════════════
-- SEV-1 #2 — coupon_reservations
-- server/services/UnifiedPricingService.ts — reserve / confirm / abandon.
-- Columns pulled from the INSERT at :292 and UPDATE / SELECT sites nearby.
-- reservation_id is text (`R-${nanoid(16)}`), issuance_id + idempotency_key
-- are nullable, order_id is set on confirm.
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS coupon_reservations (
  reservation_id         text        PRIMARY KEY,
  coupon_id              text        NOT NULL,
  issuance_id            text,
  user_id                text        NOT NULL,
  order_type             text        NOT NULL,
  gross_amount_cents     integer     NOT NULL,
  discount_amount_cents  integer     NOT NULL,
  expires_at             timestamp   NOT NULL,
  idempotency_key        text,
  status                 text        NOT NULL DEFAULT 'reserved',
  order_id               text,
  confirmed_at           timestamp,
  abandoned_at           timestamp,
  created_at             timestamp   NOT NULL DEFAULT NOW()
);

-- Reserve() does `SELECT ... WHERE user_id=$ AND coupon_id=$ AND status='reserved' AND expires_at > NOW()`
CREATE INDEX IF NOT EXISTS idx_coupon_reservations_user_coupon_status
  ON coupon_reservations (user_id, coupon_id, status);
-- Expiry sweep filters on expires_at + status.
CREATE INDEX IF NOT EXISTS idx_coupon_reservations_expires_status
  ON coupon_reservations (expires_at, status);


-- ═════════════════════════════════════════════════════════════════════════════
-- SEV-1 #3 — system_events
-- Append-only black-box recorder for platform anomalies. Fire-and-forget
-- INSERTs from SystemEventService.stamp(); reads from admin routes and the
-- backup exporter. Missing table = every write silently dropped and the
-- admin list endpoint 500s.
-- Column shape mirrors SystemEventService.ts INSERT + admin SELECT projections
-- (event_type, severity, source, platform, message, detail, booking_id,
-- user_uid, provider_uid, resolved, resolved_at, resolved_by, created_at).
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS system_events (
  id            bigserial   PRIMARY KEY,
  event_type    text        NOT NULL,
  severity      text        NOT NULL,
  source        text,
  platform      text,
  message       text        NOT NULL,
  detail        jsonb,
  booking_id    text,
  user_uid      text,
  provider_uid  text,
  resolved      boolean     NOT NULL DEFAULT FALSE,
  resolved_at   timestamp,
  resolved_by   text,
  created_at    timestamp   NOT NULL DEFAULT NOW()
);

-- Admin dashboard orders by created_at DESC on the last 24h.
CREATE INDEX IF NOT EXISTS idx_system_events_created_at
  ON system_events (created_at DESC);
-- Filtering by event_type over time is a common query.
CREATE INDEX IF NOT EXISTS idx_system_events_event_type_created
  ON system_events (event_type, created_at DESC);
-- Live-dashboard partial index: only unresolved events by severity.
CREATE INDEX IF NOT EXISTS idx_system_events_severity_unresolved
  ON system_events (severity, resolved_at)
  WHERE resolved_at IS NULL;


-- ═════════════════════════════════════════════════════════════════════════════
-- SEV-1 #4 — SLA-monitor cron (6 tables)
-- server/jobs/sla-monitor.ts, server/routes/case-actions.ts, server/routes/manager.ts.
-- Missing tables = every 5-minute SLA scan errored → no auto-escalation,
-- disputes/mismatches/refunds silently exceeded SLA with no page.
-- ═════════════════════════════════════════════════════════════════════════════

-- teams — referenced by manager.ts JOINs and workload-balancing pickTeamMember().
CREATE TABLE IF NOT EXISTS teams (
  id           serial      PRIMARY KEY,
  name         text        NOT NULL,
  description  text,
  is_active    boolean     NOT NULL DEFAULT TRUE,
  created_at   timestamp   NOT NULL DEFAULT NOW()
);

-- team_members — user_uid → role mapping, used for pickTeamMember and role gates.
CREATE TABLE IF NOT EXISTS team_members (
  id          serial      PRIMARY KEY,
  team_id     integer     NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_uid    text        NOT NULL,
  role        text        NOT NULL DEFAULT 'agent',
  is_active   boolean     NOT NULL DEFAULT TRUE,
  created_at  timestamp   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_members_user_uid ON team_members (user_uid);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id  ON team_members (team_id);

-- case_assignments — active + historical assignments. doAssign() writes here,
-- getCurrentAssignment / getOwnerRole read here.
CREATE TABLE IF NOT EXISTS case_assignments (
  id                 bigserial   PRIMARY KEY,
  case_type          text        NOT NULL,
  case_ref_id        text        NOT NULL,
  assigned_to_uid    text,
  assigned_team_id   integer,
  assigned_by_uid    text,
  note               text,
  network_scope      text,
  is_active          boolean     NOT NULL DEFAULT TRUE,
  assigned_at        timestamp   NOT NULL DEFAULT NOW()
);

-- Hot lookup: "which active assignment for this case?"
CREATE INDEX IF NOT EXISTS idx_case_assignments_case_active
  ON case_assignments (case_type, case_ref_id, is_active);
-- Workload aggregations by assignee/team.
CREATE INDEX IF NOT EXISTS idx_case_assignments_assignee_active
  ON case_assignments (assigned_to_uid, is_active);
CREATE INDEX IF NOT EXISTS idx_case_assignments_team_active
  ON case_assignments (assigned_team_id, is_active);

-- case_sla_states — one row per active case. The ON CONFLICT at
-- sla-monitor.ts:276 REQUIRES a UNIQUE constraint on (case_type, case_ref_id).
CREATE TABLE IF NOT EXISTS case_sla_states (
  id                  bigserial   PRIMARY KEY,
  case_type           text        NOT NULL,
  case_ref_id         text        NOT NULL,
  sla_status          text,
  sla_budget_hours    integer,
  age_hours           numeric(10,2),
  breach_detected_at  timestamp,
  escalated_at        timestamp,
  escalated_to_uid    text,
  last_action_at      timestamp,
  checked_at          timestamp   NOT NULL DEFAULT NOW(),
  CONSTRAINT case_sla_states_case_uniq UNIQUE (case_type, case_ref_id)
);

CREATE INDEX IF NOT EXISTS idx_case_sla_states_status
  ON case_sla_states (sla_status);

-- case_escalation_log — append-only breach + escalation audit trail.
-- INSERTs from sla-monitor doEscalate() and the sla_breached branch.
CREATE TABLE IF NOT EXISTS case_escalation_log (
  id           bigserial   PRIMARY KEY,
  case_type    text        NOT NULL,
  case_ref_id  text        NOT NULL,
  event_type   text        NOT NULL,
  from_uid     text,
  to_uid       text,
  note         text,
  created_at   timestamp   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_escalation_log_case
  ON case_escalation_log (case_type, case_ref_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_escalation_log_event
  ON case_escalation_log (event_type, created_at DESC);

-- case_notes — internal notes on a case. INSERTs from case-actions.ts POST /note
-- + auto notes from closure flow. SELECTs from GET /notes/:caseType/:caseRefId.
CREATE TABLE IF NOT EXISTS case_notes (
  id           bigserial   PRIMARY KEY,
  case_type    text        NOT NULL,
  case_ref_id  text        NOT NULL,
  author_uid   text,
  author_role  text,
  note_text    text        NOT NULL,
  created_at   timestamp   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_notes_case_created
  ON case_notes (case_type, case_ref_id, created_at ASC);


-- ═════════════════════════════════════════════════════════════════════════════
-- SEV-1 #6 — remittance_email_log
-- server/routes/prestige-pass.ts remittance flow. ON CONFLICT
-- (batch_id, provider_uid) requires that pair to be a UNIQUE constraint.
-- Also carries retry_count, last_retry_at, error_detail (per code below).
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS remittance_email_log (
  id             bigserial   NOT NULL,
  batch_id       text        NOT NULL,
  provider_uid   text        NOT NULL,
  status         text,
  sent_at        timestamp,
  retry_count    integer     NOT NULL DEFAULT 0,
  last_retry_at  timestamp,
  error_detail   text,
  created_at     timestamp   NOT NULL DEFAULT NOW(),
  PRIMARY KEY (batch_id, provider_uid),
  CONSTRAINT remittance_email_log_id_uniq UNIQUE (id)
);

CREATE INDEX IF NOT EXISTS idx_remittance_email_log_provider
  ON remittance_email_log (provider_uid, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_remittance_email_log_status
  ON remittance_email_log (status);

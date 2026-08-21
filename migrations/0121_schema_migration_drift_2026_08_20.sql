-- 0121: Heal 4 SEV missing-table drift bugs found in the 2026-08-20 schema audit.
--
-- Every path below has been silently broken in prod because a table the code
-- INSERTs / SELECTs against never made it into any migration. In three cases
-- the errors are swallowed (try/catch or "best-effort"), so the failure was
-- invisible in metrics — but the guarantee the caller was relying on
-- (idempotency, durable retry, audit trail) does not hold.
--
-- All statements are ADDITIVE + idempotent (`CREATE TABLE IF NOT EXISTS`,
-- `CREATE INDEX IF NOT EXISTS`, `CREATE UNIQUE INDEX IF NOT EXISTS`). No DROP,
-- no destructive ALTER. Safe to re-run and safe against a hand-created prod
-- table with matching columns.
--
-- The auth-adjacent `accessibility_feedback` / `accessibility_audit_log`
-- tables (publicAuthRoutes.ts) and the money-adjacent `nayax_settlement_reports`,
-- `refund_requests`, and provider-onboarding drift are DELIBERATELY NOT in
-- this file — they touch protected systems and belong to their own lanes.

-- ═════════════════════════════════════════════════════════════════════════════
-- SEV-2 #1 — google_sheets_idempotency
-- server/services/googleSheetsIntegration.ts appendFormSubmission():
--   SELECT id FROM google_sheets_idempotency WHERE idempotency_key = $1  -- line 787
--   INSERT INTO google_sheets_idempotency (idempotency_key, sheet_name, created_at)
--     VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING                       -- line 806
-- Both calls are inside try/catch that swallows the error, so every form
-- submission with an idempotencyKey has been silently double-appended to
-- Google Sheets on any retry (the header banner claims 100% legal-compliance
-- persistence — without the table, "duplicate suppressed" never fires).
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS google_sheets_idempotency (
  id               bigserial   PRIMARY KEY,
  idempotency_key  text        NOT NULL,
  sheet_name       text        NOT NULL,
  created_at       timestamp   NOT NULL DEFAULT NOW()
);

-- Backs the `SELECT id FROM ... WHERE idempotency_key = $1` short-circuit
-- and the `ON CONFLICT DO NOTHING` on the INSERT.
CREATE UNIQUE INDEX IF NOT EXISTS uq_google_sheets_idempotency_key
  ON google_sheets_idempotency (idempotency_key);


-- ═════════════════════════════════════════════════════════════════════════════
-- SEV-2 #2 — google_sheets_retry_queue
-- server/services/googleSheetsIntegration.ts queueFailedSubmission() +
-- startRetryWorker() (lines 601–672, 828–831):
--   INSERT ... (sheet_name, data, attempts, status, error_message, next_retry_at)
--   SELECT id, sheet_name, data, attempts FROM google_sheets_retry_queue
--     WHERE status = 'pending' AND next_retry_at <= NOW() AND attempts < $1
--   UPDATE ... SET status = 'completed' / 'failed' / attempts++ ...
-- Missing table = the durable retry queue for failed Google Sheets appends
-- never persists. Every failed append hits the outer catch, logs
-- "❌ CRITICAL: Failed to queue to DB", and is lost. The legal-compliance
-- 100%-persistence claim in the doc-comment does not hold in prod.
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS google_sheets_retry_queue (
  id             bigserial   PRIMARY KEY,
  sheet_name     text        NOT NULL,
  data           jsonb       NOT NULL,
  attempts       integer     NOT NULL DEFAULT 0,
  status         text        NOT NULL DEFAULT 'pending',
  error_message  text,
  next_retry_at  timestamp   NOT NULL DEFAULT NOW(),
  last_attempt   timestamp,
  created_at     timestamp   NOT NULL DEFAULT NOW()
);

-- Hot path — the worker scans pending rows whose next_retry_at has elapsed.
CREATE INDEX IF NOT EXISTS idx_gs_retry_pending_due
  ON google_sheets_retry_queue (status, next_retry_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_gs_retry_status
  ON google_sheets_retry_queue (status);


-- ═════════════════════════════════════════════════════════════════════════════
-- SEV-2 #3 — campaign_trigger_log
-- Two callers:
--   server/services/CampaignDeliveryService.ts:357, :445
--     INSERT ... ON CONFLICT (campaign_type, user_id, coupon_id) DO NOTHING
--     — the composite MUST be UNIQUE for the anchor to prevent duplicate
--       campaign sends (coupon issue + SMS).
--   server/cron/wash-reminder.ts:163, :196, :257
--     SELECT 1 ... AND sent_at > NOW() - INTERVAL — recency guard for the
--     opt-in wash-reminder marketing send (WASH_REMINDER_CRON_ENABLED).
-- Missing table = every campaign delivery + wash-reminder run errors on the
-- de-dupe / audit write. In wash-reminder the SELECT throws inside the
-- per-user try/catch and increments `errors`, so a repeat run inside the
-- 28-day window could re-send. The audit-of-blocked-consent line is lost.
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS campaign_trigger_log (
  id             bigserial   PRIMARY KEY,
  campaign_type  text        NOT NULL,
  user_id        text        NOT NULL,
  coupon_id      text,
  channel        text,
  status         text        NOT NULL,
  sent_at        timestamp   NOT NULL DEFAULT NOW()
);

-- Matches ON CONFLICT (campaign_type, user_id, coupon_id) in
-- CampaignDeliveryService.ts:447. `coupon_id IS NULL` rows (wash-reminder)
-- are handled by the partial index below; PG treats NULLs as distinct in a
-- plain unique index which would defeat the de-dupe for null-coupon campaigns.
CREATE UNIQUE INDEX IF NOT EXISTS uq_campaign_trigger_log_coupon
  ON campaign_trigger_log (campaign_type, user_id, coupon_id)
  WHERE coupon_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_campaign_trigger_log_no_coupon
  ON campaign_trigger_log (campaign_type, user_id)
  WHERE coupon_id IS NULL;

-- wash-reminder recency probe: `WHERE campaign_type=$ AND user_id=$ AND sent_at > NOW() - INTERVAL`.
CREATE INDEX IF NOT EXISTS idx_campaign_trigger_log_recency
  ON campaign_trigger_log (campaign_type, user_id, sent_at DESC);


-- ═════════════════════════════════════════════════════════════════════════════
-- SEV-2 #4 — message_reactions
-- server/routes/booking-chat.ts:1673–1687, 1734–1737 — emoji reactions on
-- booking-chat messages. Toggle logic reads then writes:
--   SELECT id FROM message_reactions WHERE message_id=$ AND user_id=$ AND reaction=$
--   INSERT ... ON CONFLICT DO NOTHING     (line 1681)
--   DELETE ... WHERE message_id=$ AND user_id=$ AND reaction=$   (line 1678)
-- Missing table = every reaction click throws 500 (`Failed to toggle reaction`)
-- and the counts endpoint at :1734 also 500s. The ON CONFLICT DO NOTHING
-- guard silently requires a UNIQUE — without it, a double-tap could insert
-- twice on race.
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS message_reactions (
  id          bigserial   PRIMARY KEY,
  message_id  text        NOT NULL,
  user_id     text        NOT NULL,
  reaction    text        NOT NULL,
  created_at  timestamp   NOT NULL DEFAULT NOW()
);

-- Backs both the toggle SELECT and the ON CONFLICT DO NOTHING at :1681.
CREATE UNIQUE INDEX IF NOT EXISTS uq_message_reactions_triplet
  ON message_reactions (message_id, user_id, reaction);
-- Backs the count aggregation at :1687 (GROUP BY reaction WHERE message_id=$).
CREATE INDEX IF NOT EXISTS idx_message_reactions_message
  ON message_reactions (message_id);

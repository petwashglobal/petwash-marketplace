-- 0083_communication_events.sql
-- Unified cross-channel communication log (CEO comms master spec §10).
-- ADDITIVE ONLY: CREATE TABLE IF NOT EXISTS + indexes. No ALTER/DROP, no data
-- migration, no money. One append-only timeline per booking across CHAT/PUSH/
-- SMS/EMAIL/CALL/SYSTEM/SUPPORT so admin/legal can reconstruct history.

CREATE TABLE IF NOT EXISTS "communication_events" (
  "id"                  serial PRIMARY KEY,
  "booking_id"          varchar,
  "thread_id"           varchar,
  "sender_user_id"      varchar,
  "receiver_user_id"    varchar,
  "channel"             varchar NOT NULL,
  "event_type"          varchar NOT NULL,
  "content_summary"     text,
  "external_message_id" varchar,
  "status"              varchar,
  "metadata_json"       jsonb,
  "created_at"          timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_comm_events_booking" ON "communication_events" ("booking_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_comm_events_channel" ON "communication_events" ("channel", "created_at");
CREATE INDEX IF NOT EXISTS "idx_comm_events_thread"  ON "communication_events" ("thread_id");

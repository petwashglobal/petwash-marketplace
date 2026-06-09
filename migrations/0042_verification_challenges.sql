CREATE TABLE IF NOT EXISTS "verification_challenges" (
  "id" serial PRIMARY KEY,
  "challenge_id" varchar(100) NOT NULL UNIQUE,
  "user_id" varchar,
  "channel" varchar(20) NOT NULL,
  "destination" varchar(320) NOT NULL,
  "purpose" varchar(80) NOT NULL,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "code_hash" varchar(128) NOT NULL,
  "attempts" integer NOT NULL DEFAULT 0,
  "max_attempts" integer NOT NULL DEFAULT 5,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "expires_at" timestamp NOT NULL,
  "verified_at" timestamp,
  "consumed_at" timestamp,
  "locked_at" timestamp,
  "ip" varchar(45),
  "user_agent" text,
  "device_id" varchar(100),
  "trace_id" varchar(50),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_verification_challenges_user_purpose_status"
  ON "verification_challenges" ("user_id", "purpose", "status");

CREATE INDEX IF NOT EXISTS "idx_verification_challenges_destination_purpose_status"
  ON "verification_challenges" ("destination", "purpose", "status");

CREATE INDEX IF NOT EXISTS "idx_verification_challenges_expires"
  ON "verification_challenges" ("expires_at");

CREATE INDEX IF NOT EXISTS "idx_verification_challenges_trace"
  ON "verification_challenges" ("trace_id");


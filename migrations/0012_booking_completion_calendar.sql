-- ============================================================
-- Migration 0012: Booking Dual-Approval + Calendar + Cancellation Tiers
-- ============================================================

-- 1. Add provider_marked_complete state to the booking_request_status enum
DO $$ BEGIN
  ALTER TYPE "booking_request_status" ADD VALUE 'provider_marked_complete';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Dual-approval completion timestamps
ALTER TABLE "booking_requests" ADD COLUMN IF NOT EXISTS "provider_completed_at" timestamp;
ALTER TABLE "booking_requests" ADD COLUMN IF NOT EXISTS "customer_approved_at" timestamp;
ALTER TABLE "booking_requests" ADD COLUMN IF NOT EXISTS "auto_approved_at" timestamp;

-- 3. Cancellation policy tier tracking
ALTER TABLE "booking_requests" ADD COLUMN IF NOT EXISTS "cancellation_tier" varchar(32);
ALTER TABLE "booking_requests" ADD COLUMN IF NOT EXISTS "cancellation_penalty_cents" integer DEFAULT 0;

-- 4. Emergency-cancel tracking (provider sudden illness / force-majeure)
ALTER TABLE "booking_requests" ADD COLUMN IF NOT EXISTS "emergency_cancel_reason" text;

-- 5. Calendar both-party sync (platform event ID + attendee flag)
ALTER TABLE "booking_requests" ADD COLUMN IF NOT EXISTS "platform_calendar_event_id" varchar(256);
ALTER TABLE "booking_requests" ADD COLUMN IF NOT EXISTS "calendar_attendees_synced" boolean DEFAULT false;

-- 6. Dispute tracking during completion approval window
ALTER TABLE "booking_requests" ADD COLUMN IF NOT EXISTS "dispute_opened_at" timestamp;
ALTER TABLE "booking_requests" ADD COLUMN IF NOT EXISTS "dispute_opened_by" varchar(16);
ALTER TABLE "booking_requests" ADD COLUMN IF NOT EXISTS "dispute_reason" text;

-- 0002_a_rebuild_catchup_enums.sql  (2026-09-18, schema-rebuild catch-up 1 of 5)
--
-- The 13 enum types shared/schema*.ts declares. Two of them (pet_temperament,
-- login_security_event_type) are created later by 0017/0018 under exactly this
-- guard; the other 11 are declared in the schema but were never created by any
-- migration file at all.
--
-- Slot 0002 (between 0001 and 0003) is deliberate: these types are referenced
-- by tables created in 0002_b, which in turn are ALTERed by migrations from
-- 0005 onwards. A type created at the end of the series cannot un-fail the
-- statements that needed it 150 files earlier.
--
-- Postgres has no CREATE TYPE ... IF NOT EXISTS, so idempotency needs the
-- DO/EXCEPTION guard -- the same one 0017 and 0018 already use, and the same
-- one 0126/0150/0151 use above the runner's fail-closed baseline. The guard is
-- required rather than stylistic: the prod-baseline PR gate
-- (.github/workflows/migration-test.yml) replays new migrations through psql
-- with ON_ERROR_STOP=1, where an unguarded duplicate would be fatal.
-- scripts/apply-pending-migrations.ts sends this file on its TRANSACTIONAL
-- path (its isNonTransactional() regex matches only CONCURRENTLY / VACUUM /
-- REINDEX / ALTER SYSTEM / CREATE|DROP DATABASE|TABLESPACE, none of which
-- appear here), so the whole file goes as one query and the runner's
-- non-dollar-quote-aware statement splitter is never applied to it.
--
-- Production already has all 13; this file is a no-op there.

DO $$ BEGIN
  CREATE TYPE "public"."credit_type" AS ENUM('egift', 'wash_package', 'loyalty_points', 'promo_credit', 'referral_credit');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."redeemable_platform" AS ENUM('walker', 'sitter', 'pettrek', 'k9000', 'plush_lab', 'all');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."booking_lifecycle_status" AS ENUM('inquiry', 'quote_sent', 'quote_expired', 'deposit_pending', 'deposit_received', 'owner_confirmed', 'provider_confirmed', 'in_progress', 'owner_completion_review', 'provider_completion_review', 'completed', 'cancelled', 'refunded', 'disputed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."booking_request_status" AS ENUM('pending', 'meet_greet_requested', 'accepted', 'declined', 'meet_greet_scheduled', 'meet_greet_completed', 'payment_pending', 'confirmed', 'in_progress', 'provider_marked_complete', 'completed', 'reviewed', 'cancelled', 'disputed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."egift_event_type" AS ENUM('PURCHASED', 'CREDITED_TO_WALLET', 'REDEEM_STARTED', 'REDEEMED', 'REDEEM_FAILED', 'REFUNDED', 'EXPIRED', 'VOIDED', 'RESERVED', 'RESERVATION_RELEASED', 'VALUE_RESTORED', 'PURCHASE_REFUNDED', 'FROZEN', 'UNFROZEN', 'ADJUSTMENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."login_security_event_type" AS ENUM('login_success', 'new_device_login', 'new_browser_login', 'new_location_login', 'high_risk_login');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."octopus_booking_status" AS ENUM('DRAFT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."octopus_ledger_type" AS ENUM('BOOKING_CREATED', 'PAYMENT_CAPTURED', 'WALLET_DEBIT', 'WALLET_CREDIT', 'PROVIDER_EARNING', 'PLATFORM_FEE', 'INVOICE_ISSUED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."octopus_platform" AS ENUM('PETSITTER', 'PETTREK', 'ACADEMY', 'PETWASH_HUB');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."octopus_role" AS ENUM('CUSTOMER', 'PROVIDER', 'ADMIN', 'FINANCE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."pet_temperament" AS ENUM('calm', 'nervous', 'high_energy', 'needs_careful_handling', 'staff_assistance_recommended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."pet_wash_platform" AS ENUM('sitter_suite', 'walk_my_pet', 'pet_trek', 'groomers', 'training_academy', 'k9000_wash', 'plush_lab', 'daycare', 'paw_finder');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."marketplace_service_type" AS ENUM('pet_sitting', 'house_sitting', 'daycare', 'dog_walking', 'drop_in_visit', 'pet_taxi', 'grooming', 'training', 'k9000_wash', 'avatar_creation');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Migration: Prestige (privilege_members) firebase_uid identity linking
-- CEO FLY MODE II §12–§20 (2026-08-29)
--
-- Direction: "ONE HUMAN = CANONICAL FIREBASE UID. Email is contact
-- information, verified identity signal, legacy reconciliation key — NOT
-- the durable PetWash human primary identity."
--
-- The privilege_members.firebase_uid column ALREADY EXISTS in the Drizzle
-- schema (shared/schema.ts line 11923, nullable varchar(255)). What this
-- migration adds is the enforcement:
--
--   1. A PARTIAL UNIQUE INDEX so that whenever a firebase_uid IS SET, no
--      two rows can share it — one human, one membership. Legacy rows
--      with firebase_uid IS NULL are unaffected until they are linked
--      through the reconciliation rule (see server/services/prestigeIdentityLink.ts).
--
--   2. A companion NON-UNIQUE index for the "look this member up by UID"
--      case that admin / me-status / capability aggregator will lean on
--      once linking is live. The partial-unique index also serves reads
--      but Postgres prefers a separate btree for planner shape.
--
-- Preserves every existing field: memberId, tier, points, benefits,
-- history, joinDate, marketingConsent, legal acceptance, rewards. This
-- is an ADDITIVE constraint — no data is rewritten. Safe to run against
-- production. Safe to re-run (IF NOT EXISTS guards).
--
-- Run command (production):
--   psql $DATABASE_URL -f migrations/0134_privilege_members_firebase_uid_2026_08_29.sql
-- Or via drizzle-kit:
--   npx drizzle-kit push
--
-- ROLLBACK: DROP INDEX IF EXISTS ... (see the DROP block at the bottom,
-- commented out; uncomment only if the migration must be reversed. The
-- partial-unique index is a data-integrity guarantee; do not drop it
-- silently once linking is live.)

DO $$ BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'privilege_members'
  ) THEN
    -- Partial UNIQUE index: enforces one-firebase_uid → one-row when the
    -- column is populated. Legacy NULL rows share nothing, allowing the
    -- reconciliation rule to link them one at a time under application
    -- control without a big-bang cutover.
    CREATE UNIQUE INDEX IF NOT EXISTS idx_privilege_members_firebase_uid_unique
      ON privilege_members (firebase_uid)
      WHERE firebase_uid IS NOT NULL;

    -- Fast lookup by UID for the aggregator + admin surfaces. The
    -- partial-unique index above can serve reads too, but planners
    -- occasionally choose a scan when the predicate is complex; a
    -- dedicated btree keeps the "who is this UID's Prestige member?"
    -- lookup on a hot path deterministic.
    CREATE INDEX IF NOT EXISTS idx_privilege_members_firebase_uid_lookup
      ON privilege_members (firebase_uid);
  END IF;
END $$;

-- Rollback block (do NOT uncomment unless intentionally reversing):
-- DROP INDEX IF EXISTS idx_privilege_members_firebase_uid_unique;
-- DROP INDEX IF EXISTS idx_privilege_members_firebase_uid_lookup;

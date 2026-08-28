-- CEO 2026-08-28 §12 (safety summary must reach the person holding the leash)
--
-- The KYA-scoped pet safety flags (aggression, escape risk, allergies,
-- feeding & handling instructions, vet contact) were captured by the
-- owner in Add-a-Pet, sent by the client in the walk + sitter booking
-- payloads as `petSafetySnapshot`, and then silently DROPPED by the
-- server routes. Providers saw an empty specialInstructions field on
-- their Today card and only found out about the biter after grabbing
-- the leash.
--
-- Fix: give both booking tables a `pet_safety_snapshot jsonb` column so
-- the server can persist the shape the client already sends. Nullable
-- (rolling deploys land server before client update, and legacy rows
-- have no snapshot). Additive — no destructive change to existing rows.

ALTER TABLE walk_bookings
  ADD COLUMN IF NOT EXISTS pet_safety_snapshot jsonb;

ALTER TABLE sitter_bookings
  ADD COLUMN IF NOT EXISTS pet_safety_snapshot jsonb;

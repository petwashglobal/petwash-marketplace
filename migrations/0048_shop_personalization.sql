-- 0048_shop_personalization.sql
-- Engraving / personalisation support: lets a customer attach custom text (e.g. the
-- pet's name + phone) to a cart line, carried through to the order line. Powers the
-- name-engraved collar / ID tag products (the in-house engraving machine).
--
-- Additive only — nullable jsonb columns, safe on existing rows. Shape (app-enforced):
--   { "engravingText": "Rex", "engravingPhone": "050-1234567", "notes": "..." }

ALTER TABLE "shop_cart_items"
  ADD COLUMN IF NOT EXISTS "personalization" jsonb;

ALTER TABLE "shop_order_items"
  ADD COLUMN IF NOT EXISTS "personalization" jsonb;

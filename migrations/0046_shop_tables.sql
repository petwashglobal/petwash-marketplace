-- Shop schema — the documented blocker for server/routes/shop.ts + ShopService.ts.
-- Codex wrote a full raw-SQL shop backend that queries these 7 tables; they did not
-- exist, so every /api/shop/* route 503'd (SHOP_DISABLED) / would 500. This migration
-- creates them so the catalog + cart + orders can function once SHOP_ENABLED=true.
--
-- ADDITIVE ONLY: CREATE TABLE IF NOT EXISTS, no ALTER/DROP, no data migration. Money
-- behavior (checkout charging via wallet/escrow) stays gated by the SHOP_ENABLED env
-- flag and the existing ShopService logic — this migration only adds storage.
-- Columns match ShopService.ts raw SQL exactly (cents-based pricing, bilingual fields).

CREATE TABLE IF NOT EXISTS "shop_products" (
  "id" serial PRIMARY KEY,
  "sku" varchar(64) NOT NULL UNIQUE,
  "name_he" varchar(200) NOT NULL,
  "name_en" varchar(200),
  "description_he" text,
  "description_en" text,
  "category" varchar(60) NOT NULL,
  "brand" varchar(80),
  "price_cents" integer NOT NULL,
  "compare_at_cents" integer,
  "weight_grams" integer NOT NULL DEFAULT 0,
  "stock_quantity" integer NOT NULL DEFAULT 0,
  "images" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "is_featured" boolean NOT NULL DEFAULT false,
  "is_active" boolean NOT NULL DEFAULT true,
  "sales_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_shop_products_category_active" ON "shop_products" ("category", "is_active");
CREATE INDEX IF NOT EXISTS "idx_shop_products_active_sales" ON "shop_products" ("is_active", "sales_count");

CREATE TABLE IF NOT EXISTS "shop_product_variants" (
  "id" serial PRIMARY KEY,
  "product_id" integer NOT NULL REFERENCES "shop_products"("id"),
  "name_he" varchar(120),
  "name_en" varchar(120),
  "price_delta_cents" integer NOT NULL DEFAULT 0,
  "sku" varchar(64),
  "stock_quantity" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_shop_variants_product" ON "shop_product_variants" ("product_id");

CREATE TABLE IF NOT EXISTS "shop_carts" (
  "id" varchar PRIMARY KEY,
  "user_id" varchar NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_shop_carts_user_status" ON "shop_carts" ("user_id", "status");

CREATE TABLE IF NOT EXISTS "shop_cart_items" (
  "id" serial PRIMARY KEY,
  "cart_id" varchar NOT NULL REFERENCES "shop_carts"("id"),
  "product_id" integer NOT NULL REFERENCES "shop_products"("id"),
  "variant_id" integer REFERENCES "shop_product_variants"("id"),
  "quantity" integer NOT NULL DEFAULT 1,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_shop_cart_items_cart" ON "shop_cart_items" ("cart_id");

CREATE TABLE IF NOT EXISTS "shop_orders" (
  "id" serial PRIMARY KEY,
  "order_number" varchar(40) NOT NULL UNIQUE,
  "user_id" varchar NOT NULL,
  "cart_id" varchar,
  "status" varchar(30) NOT NULL DEFAULT 'payment_required',
  "payment_ref" varchar(120),
  "payment_method" varchar(20),
  "subtotal_cents" integer NOT NULL DEFAULT 0,
  "discount_cents" integer NOT NULL DEFAULT 0,
  "delivery_cents" integer NOT NULL DEFAULT 0,
  "gift_wrap_cents" integer NOT NULL DEFAULT 0,
  "net_cents" integer NOT NULL DEFAULT 0,
  "vat_cents" integer NOT NULL DEFAULT 0,
  "total_cents" integer NOT NULL DEFAULT 0,
  "delivery_method" varchar(30),
  "delivery_address_id" integer,
  "coupon_code" varchar(32),
  "notes" text,
  "language" varchar(5) NOT NULL DEFAULT 'he',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_shop_orders_user" ON "shop_orders" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_shop_orders_status" ON "shop_orders" ("status");

CREATE TABLE IF NOT EXISTS "shop_order_items" (
  "id" serial PRIMARY KEY,
  "order_id" integer NOT NULL REFERENCES "shop_orders"("id"),
  "product_id" integer,
  "variant_id" integer,
  "quantity" integer NOT NULL,
  "unit_price_cents" integer NOT NULL,
  "line_total_cents" integer NOT NULL,
  "vat_cents" integer NOT NULL DEFAULT 0,
  "name_he" varchar(200),
  "name_en" varchar(200),
  "sku" varchar(64),
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_shop_order_items_order" ON "shop_order_items" ("order_id");

CREATE TABLE IF NOT EXISTS "shop_delivery_addresses" (
  "id" serial PRIMARY KEY,
  "user_id" varchar NOT NULL,
  "full_name" varchar(120) NOT NULL,
  "phone" varchar(20) NOT NULL,
  "street" varchar(200) NOT NULL,
  "city" varchar(80) NOT NULL,
  "zip_code" varchar(12),
  "notes" varchar(300),
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_shop_addresses_user" ON "shop_delivery_addresses" ("user_id");

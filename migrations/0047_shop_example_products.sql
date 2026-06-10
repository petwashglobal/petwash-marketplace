-- 0047_shop_example_products.sql
-- EXAMPLE catalog ONLY — placeholder products so the storefront is viewable before
-- the real China-supplier catalog is signed. Every row is clearly marked EXAMPLE in
-- its description and uses the SKU prefix "EX-". Safe to delete wholesale later:
--   DELETE FROM shop_products WHERE sku LIKE 'EX-%';
--
-- Mirrors the category model of petbarn.com.au / habitat.com.au (treats by type,
-- name-engraved collars/tags, toys, accessories, apparel) per CEO direction
-- 2026-06-10. Bilingual HE/EN. Prices are illustrative retail (margin baked in);
-- weight_grams is set so ShopService.estimateDelivery() returns real numbers.
-- Idempotent: ON CONFLICT (sku) DO NOTHING.

INSERT INTO shop_products
  (sku, name_he, name_en, description_he, description_en, category, brand,
   price_cents, compare_at_cents, weight_grams, stock_quantity, tags, is_featured)
VALUES
  -- ── Treats (חטיפים) ──
  ('EX-TREAT-CHICKEN', 'חטיפי עוף מיובש', 'Air-Dried Chicken Treats',
   'דוגמה בלבד — חטיף עוף 100% לאילוף. יוחלף במוצר אמיתי מהספק.',
   'EXAMPLE ONLY — 100% chicken training treat. Replace with real supplier item.',
   'treats', 'PetWash', 3490, 3990, 150, 100, '["dog","training","example"]'::jsonb, true),

  ('EX-TREAT-DENTAL', 'מקלות דנטליים', 'Dental Chew Sticks',
   'דוגמה בלבד — מקלות לניקוי שיניים, אריזת 7.',
   'EXAMPLE ONLY — dental cleaning sticks, pack of 7.',
   'treats', 'PetWash', 2990, NULL, 220, 100, '["dog","dental","example"]'::jsonb, false),

  ('EX-TREAT-CAT', 'חטיף סלמון לחתול', 'Salmon Cat Treats',
   'דוגמה בלבד — חטיף סלמון לחתולים.',
   'EXAMPLE ONLY — salmon treats for cats.',
   'treats', 'PetWash', 2490, NULL, 80, 100, '["cat","example"]'::jsonb, false),

  -- ── Personalised / engraving (the engraving-machine line) ──
  ('EX-COLLAR-NAME', 'קולר עם שם הכלב חרוט', 'Personalised Name Collar',
   'דוגמה בלבד — קולר עור עם שם הכלב ומספר טלפון בחריטה. דורש שדה טקסט מותאם בקופה.',
   'EXAMPLE ONLY — leather collar laser-engraved with your dog''s name + phone. Needs a custom-text field at checkout.',
   'personalised', 'PetWash', 8900, 11900, 90, 50, '["dog","engraving","personalised","example"]'::jsonb, true),

  ('EX-TAG-NAME', 'תג זיהוי חרוט', 'Engraved ID Tag',
   'דוגמה בלבד — תג מתכת עם שם וטלפון בחריטה, ייצור עצמי במכונת החריטה.',
   'EXAMPLE ONLY — metal ID tag engraved with name + phone, made in-house on the engraving machine.',
   'personalised', 'PetWash', 4900, NULL, 25, 80, '["dog","cat","engraving","personalised","example"]'::jsonb, true),

  -- ── Toys (צעצועים) ──
  ('EX-TOY-ROPE', 'צעצוע חבל לעיסה', 'Rope Tug Toy',
   'דוגמה בלבד — צעצוע חבל כותנה למשיכה ולעיסה.',
   'EXAMPLE ONLY — cotton rope tug-and-chew toy.',
   'toys', 'PetWash', 3900, NULL, 180, 100, '["dog","example"]'::jsonb, false),

  ('EX-TOY-BALL', 'כדור גומי מקפץ', 'Bouncy Rubber Ball',
   'דוגמה בלבד — כדור גומי עמיד למשחקי הבאה.',
   'EXAMPLE ONLY — durable rubber fetch ball.',
   'toys', 'PetWash', 2900, NULL, 120, 100, '["dog","example"]'::jsonb, false),

  -- ── Accessories (אביזרים) ──
  ('EX-LEASH-STD', 'רצועת הליכה', 'Standard Walking Leash',
   'דוגמה בלבד — רצועת ניילון 1.5 מטר עם ידית מרופדת.',
   'EXAMPLE ONLY — 1.5m nylon leash with padded handle.',
   'accessories', 'PetWash', 5900, 6900, 200, 60, '["dog","example"]'::jsonb, false),

  ('EX-BOWL-STEEL', 'קערת נירוסטה', 'Stainless Steel Bowl',
   'דוגמה בלבד — קערת אוכל נירוסטה נגד החלקה.',
   'EXAMPLE ONLY — non-slip stainless steel food bowl.',
   'accessories', 'PetWash', 4500, NULL, 350, 70, '["dog","cat","example"]'::jsonb, false),

  -- ── Apparel / branded (ביגוד) ──
  ('EX-APPAREL-BANDANA', 'בנדנה ממותגת PetWash', 'PetWash Branded Bandana',
   'דוגמה בלבד — בנדנה לצוואר עם לוגו PetWash.',
   'EXAMPLE ONLY — neck bandana with the PetWash logo.',
   'apparel', 'PetWash', 3500, NULL, 60, 90, '["dog","branded","example"]'::jsonb, false)
ON CONFLICT (sku) DO NOTHING;

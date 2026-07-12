-- 0092_seed_loyalty_rewards.sql
-- Pre-populate the Prestige "points buy moments" rewards catalog with the
-- experiences from docs/loyalty/petwash-prestige-blueprint-2026.md, as INACTIVE
-- DRAFTS (is_active = false). Nothing is member-redeemable until an admin reviews,
-- prices, and activates each one via PATCH /api/loyalty/admin/rewards/:id — so
-- there is no risk of members spending points on a reward that cannot yet be
-- fulfilled (fulfillment wiring lands in a later #15 slice). points_cost values
-- are PLACEHOLDER drafts for CEO review (earn rate is 1 pt per ₪1). Idempotent.
INSERT INTO rewards_marketplace
  (code, name, description, type, category, points_cost, cash_value, currency,
   stock, max_redemptions_per_user, min_tier, is_active, is_featured, display_order, valid_until)
VALUES
  ('FREE_WASH_K9000', 'Free K9000 Wash',
   'Redeem points for a full self-service K9000 wash — on us.',
   'free_wash', 'wash', 550, 55, 'ILS', NULL, 4, NULL, false, true, 1, '2035-12-31'),
  ('PRIVATE_WASH_HOUR', 'Private Wash Hour',
   'A private, unhurried hour at a K9000 bay reserved just for you and your pet.',
   'vip_experience', 'experience', 1800, NULL, 'ILS', NULL, 1, 'silver', false, true, 2, '2035-12-31'),
  ('SPA_GROOM_VOUCHER', 'Spa-Grade Groom',
   'A full spa-grade grooming session with a vetted Pet Wash groomer.',
   'voucher', 'experience', 3000, NULL, 'ILS', NULL, 1, 'gold', false, false, 3, '2035-12-31'),
  ('PETCARE_MASTERCLASS', 'Pet-Care Masterclass',
   'A seat at a Pet Wash Academy masterclass on caring for your pet.',
   'vip_experience', 'experience', 1500, NULL, 'ILS', NULL, 1, NULL, false, false, 4, '2035-12-31'),
  ('GIFT_A_WASH', 'Gift a Wash to Someone You Love',
   'Turn your points into a wash you can gift to a friend or family member.',
   'voucher', 'wash', 700, 55, 'ILS', NULL, 5, NULL, false, false, 5, '2035-12-31')
ON CONFLICT (code) DO NOTHING;

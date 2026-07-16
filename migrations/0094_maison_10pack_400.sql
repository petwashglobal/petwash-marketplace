-- Maison Collection (10-wash pack) ₪440 → ₪400 — CEO pricing decision
-- 2026-07-15 (A5 audit: restore the per-wash ladder 50 → 44 → 40).
-- Code surfaces already updated in #1426; the server-charge SKU in the same
-- PR as this migration. This aligns the live DB row that /api/packages serves.
UPDATE wash_packages
   SET price = 400.00
 WHERE wash_count = 10
   AND price = 440.00;

-- 2026-09-13: every PawFinder photo upload returned 500 in production.
-- /api/paw-finder/upload runs `SELECT ... FROM paw_finder_posts WHERE image_hash = $1`
-- for duplicate-photo detection, and /posts writes image_hash — but the column was
-- never in the production table (0008 declared it; the table was created from
-- shared/schema.ts, which did not). Postgres: column "image_hash" does not exist.
-- A photo is required, so nobody could post a lost or found pet.
ALTER TABLE paw_finder_posts ADD COLUMN IF NOT EXISTS image_hash VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_paw_finder_posts_image_hash ON paw_finder_posts (image_hash);

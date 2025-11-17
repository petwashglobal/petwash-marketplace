-- Migration: Update users.loyalty_tier default from 'new' to 'bronze'
-- Date: 2025-11-17
-- Purpose: Align database default with 7-tier luxury loyalty system (Bronze→Royal)

-- Step 1: Change column default to 'bronze'
ALTER TABLE users ALTER COLUMN loyalty_tier SET DEFAULT 'bronze';

-- Step 2: Backfill existing users with 'new' tier to 'bronze' tier (idempotent)
UPDATE users 
SET loyalty_tier = 'bronze' 
WHERE loyalty_tier = 'new';

-- Step 3: Also update customers table for consistency
ALTER TABLE customers ALTER COLUMN loyalty_tier SET DEFAULT 'bronze';

UPDATE customers 
SET loyalty_tier = 'bronze' 
WHERE loyalty_tier = 'new';

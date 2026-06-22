-- Build C: long-stay / house-hosting rate engine.
-- Adds per-provider rate-card fields. All additive and default OFF, so existing
-- rate cards and quotes are unchanged until a provider sets a value.
-- APPLY in prod (CEO/ops). Safe, non-destructive.

ALTER TABLE provider_rate_cards
  ADD COLUMN IF NOT EXISTS biweekly_discount_percent integer DEFAULT 0,        -- 14-29 nights (between weekly & monthly)
  ADD COLUMN IF NOT EXISTS cleaning_fee_cents        integer DEFAULT 0,        -- one-time, overnight/per-night stays only
  ADD COLUMN IF NOT EXISTS security_deposit_percent  integer DEFAULT 0,        -- refundable HOLD, not part of the charge total
  ADD COLUMN IF NOT EXISTS nightly_rate_progression  jsonb,                    -- { night1Percent, nights2to7Percent, nights8to30Percent, night31PlusPercent }; null = flat rate
  ADD COLUMN IF NOT EXISTS peak_date_ranges          jsonb DEFAULT '[]'::jsonb; -- [{ start:'YYYY-MM-DD', end:'YYYY-MM-DD', surchargePercent }]

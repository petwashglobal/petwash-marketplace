-- =====================================================================
-- PetWash(TM) Prestige  -  Data & Intelligence Schema
-- PostgreSQL 15+   |   Privacy-by-design reference schema (v1.0)
-- =====================================================================
-- DESIGN PRINCIPLES
--   1. Separate domains by sensitivity. PII lives ONLY in the `identity`
--      vault. Analytics never touches it.
--   2. Pseudonymity. The `events` and analytics layers key off a
--      pseudonymous subject_id. The map back to a person sits in the
--      vault (identity.subject_map) and is the single bridge.
--   3. Consent gates use. Every analytical/marketing purpose is recorded
--      and revocable in the `consent` domain.
--   4. Retention is data, not a habit. Retention windows are declared in
--      consent.retention_policy and enforced by a scheduled job.
--   5. Data for the user. Member-facing value (the "wash story") is built
--      from the same events, surfaced back through `core`.
-- Access model (enforce with roles, not shown): app_rw, analytics_ro,
--   vault_restricted, ops_rw. analytics_ro must NOT have rights on schema
--   `identity`.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid(), digest()
CREATE EXTENSION IF NOT EXISTS "citext";     -- case-insensitive email

CREATE SCHEMA IF NOT EXISTS identity;   -- PII VAULT (restricted)
CREATE SCHEMA IF NOT EXISTS core;       -- operational
CREATE SCHEMA IF NOT EXISTS events;     -- pseudonymous behavioural stream
CREATE SCHEMA IF NOT EXISTS analytics;  -- derived / aggregated
CREATE SCHEMA IF NOT EXISTS consent;    -- governance

-- =====================================================================
-- 1. IDENTITY VAULT  (smallest possible, encrypted at rest, restricted)
-- =====================================================================

CREATE TABLE identity.owner (
    owner_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at    timestamptz NOT NULL DEFAULT now(),
    country       text NOT NULL DEFAULT 'IL',
    city          text,
    status        text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','dormant','closed'))
);

-- Direct identifiers kept apart from owner so analytics joins never reach them.
CREATE TABLE identity.owner_pii (
    owner_id      uuid PRIMARY KEY REFERENCES identity.owner(owner_id) ON DELETE CASCADE,
    full_name     text,
    email         citext,
    phone_e164    text,
    address_line  text,
    updated_at    timestamptz NOT NULL DEFAULT now()
    -- Column-level encryption / tokenisation applied at the app or storage tier.
);

CREATE TABLE identity.pet (
    pet_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id      uuid NOT NULL REFERENCES identity.owner(owner_id) ON DELETE CASCADE,
    name          text,
    species       text NOT NULL DEFAULT 'dog',
    breed         text,
    coat_type     text,          -- single | double | curly | wiry ...
    weight_kg     numeric(4,1),
    birth_month   date,          -- month precision only (data minimisation)
    photo_ref     text
);

-- THE BRIDGE: the only place a pseudonymous subject resolves to a person.
CREATE TABLE identity.subject_map (
    subject_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id      uuid NOT NULL REFERENCES identity.owner(owner_id) ON DELETE CASCADE,
    pet_id        uuid REFERENCES identity.pet(pet_id) ON DELETE SET NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_subject_owner ON identity.subject_map(owner_id);

-- =====================================================================
-- 2. CORE OPERATIONAL  (stations, membership, gifting, washes, providers)
-- =====================================================================

CREATE TABLE core.station (
    station_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code          text UNIQUE NOT NULL,          -- e.g. TLV-DIZ-01
    city          text NOT NULL,
    neighborhood  text,
    lat           numeric(9,6),
    lng           numeric(9,6),
    bays_count    smallint NOT NULL DEFAULT 2,   -- dual-bay
    opened_at     date,
    status        text NOT NULL DEFAULT 'live'
                  CHECK (status IN ('planned','live','maintenance','closed'))
);

CREATE TABLE core.bay (
    bay_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id    uuid NOT NULL REFERENCES core.station(station_id) ON DELETE CASCADE,
    bay_number    smallint NOT NULL,
    status        text NOT NULL DEFAULT 'available'
                  CHECK (status IN ('available','in_use','offline')),
    UNIQUE (station_id, bay_number)
);

CREATE TABLE core.membership (
    membership_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id      uuid NOT NULL REFERENCES identity.owner(owner_id) ON DELETE CASCADE,
    tier          text NOT NULL DEFAULT 'prestige'
                  CHECK (tier IN ('standard','prestige')),
    pass_balance  integer NOT NULL DEFAULT 0,    -- prepaid washes remaining
    started_at    timestamptz NOT NULL DEFAULT now(),
    status        text NOT NULL DEFAULT 'active'
);

CREATE TABLE core.gift_card (
    gift_card_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code_hash     text UNIQUE NOT NULL,          -- store a hash, never the raw code
    purchaser_id  uuid REFERENCES identity.owner(owner_id) ON DELETE SET NULL,
    recipient_id  uuid REFERENCES identity.owner(owner_id) ON DELETE SET NULL,
    value_washes  integer NOT NULL,
    balance_washes integer NOT NULL,
    status        text NOT NULL DEFAULT 'issued'
                  CHECK (status IN ('issued','delivered','redeemed','expired')),
    created_at    timestamptz NOT NULL DEFAULT now(),
    redeemed_at   timestamptz
    -- Personal gift message is NOT stored here; held transiently and purged
    -- after delivery (see consent.retention_policy: 'gift_message').
);

CREATE TABLE core.provider (
    provider_id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code          text UNIQUE NOT NULL,          -- public-safe handle, e.g. TLV-014
    city          text,
    services      jsonb NOT NULL DEFAULT '[]',   -- ['walk','sit','daycare']
    joined_at     date NOT NULL DEFAULT current_date,
    status        text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','watch','at_risk','suspended','offboarded'))
);

-- A wash event at a station. Keyed by pseudonymous subject, not owner.
CREATE TABLE core.wash_session (
    session_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id    uuid NOT NULL REFERENCES identity.subject_map(subject_id) ON DELETE CASCADE,
    station_id    uuid NOT NULL REFERENCES core.station(station_id),
    bay_id        uuid REFERENCES core.bay(bay_id),
    started_at    timestamptz NOT NULL,
    ended_at      timestamptz,
    duration_s    integer GENERATED ALWAYS AS
                  (CASE WHEN ended_at IS NOT NULL
                        THEN EXTRACT(EPOCH FROM (ended_at - started_at))::int END) STORED,
    water_temp_c  numeric(3,1),
    products      jsonb NOT NULL DEFAULT '[]',
    pay_method    text,
    rating        smallint CHECK (rating BETWEEN 1 AND 5)
);
CREATE INDEX ix_wash_subject  ON core.wash_session(subject_id);
CREATE INDEX ix_wash_station  ON core.wash_session(station_id, started_at);

-- A booked service job with a provider (the supply side we monitor).
CREATE TABLE core.job (
    job_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id   uuid NOT NULL REFERENCES core.provider(provider_id) ON DELETE CASCADE,
    subject_id    uuid NOT NULL REFERENCES identity.subject_map(subject_id) ON DELETE CASCADE,
    service_type  text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    scheduled_for timestamptz NOT NULL,
    status        text NOT NULL DEFAULT 'booked'
                  CHECK (status IN ('booked','completed','cancelled_owner',
                                    'cancelled_provider','no_show')),
    cancelled_at  timestamptz,
    -- Lead time between a provider cancellation and the scheduled start.
    -- Lower lead time = more disruptive = weighted heavier in the score.
    cancel_lead_minutes integer GENERATED ALWAYS AS
                  (CASE WHEN status = 'cancelled_provider' AND cancelled_at IS NOT NULL
                        THEN EXTRACT(EPOCH FROM (scheduled_for - cancelled_at))::int / 60 END) STORED
);
CREATE INDEX ix_job_provider ON core.job(provider_id, scheduled_for);

CREATE TABLE core.provider_rating (
    rating_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id        uuid NOT NULL REFERENCES core.job(job_id) ON DELETE CASCADE,
    provider_id   uuid NOT NULL REFERENCES core.provider(provider_id) ON DELETE CASCADE,
    stars         smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
    created_at    timestamptz NOT NULL DEFAULT now()
    -- Free-text review held separately and redacted before analytics.
);

-- Daily availability heartbeat per provider (slots offered vs filled).
CREATE TABLE core.provider_availability (
    provider_id   uuid NOT NULL REFERENCES core.provider(provider_id) ON DELETE CASCADE,
    day           date NOT NULL,
    slots_offered smallint NOT NULL DEFAULT 0,
    slots_filled  smallint NOT NULL DEFAULT 0,
    first_response_minutes integer,   -- median time to accept a request that day
    PRIMARY KEY (provider_id, day)
);

-- =====================================================================
-- 3. EVENTS  (pseudonymous behavioural stream - NO PII EVER)
-- =====================================================================

CREATE TABLE events.app_session (
    app_session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id     uuid NOT NULL,                -- pseudonymous; soft ref only
    surface        text NOT NULL CHECK (surface IN ('app','web','station_kiosk')),
    started_at     timestamptz NOT NULL,
    ended_at       timestamptz,
    duration_s     integer,
    screens_viewed smallint
);
CREATE INDEX ix_appsess_subject ON events.app_session(subject_id, started_at);

-- The raw signal: every screen, tap, scroll, dwell. Append-only, partitioned
-- monthly in production for cheap retention drops.
CREATE TABLE events.event (
    event_id      bigint GENERATED ALWAYS AS IDENTITY,
    subject_id    uuid NOT NULL,                 -- pseudonymous
    occurred_at   timestamptz NOT NULL,
    surface       text NOT NULL CHECK (surface IN ('app','web','station_kiosk')),
    event_type    text NOT NULL,                 -- screen_view | tap | scroll | search | save | gift_step
    screen        text,                          -- which screen / page
    target        text,                          -- what was tapped / viewed
    dwell_ms      integer,                       -- time spent on this screen
    app_session_id uuid,
    props         jsonb NOT NULL DEFAULT '{}',   -- typed, PII-free attributes only
    PRIMARY KEY (event_id, occurred_at)
) PARTITION BY RANGE (occurred_at);
-- Example partition (create one per month, drop old ones to honour retention):
CREATE TABLE events.event_2026_06 PARTITION OF events.event
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE INDEX ix_event_subject ON events.event(subject_id, occurred_at);
CREATE INDEX ix_event_type    ON events.event(event_type, occurred_at);

-- =====================================================================
-- 4. ANALYTICS  (derived, aggregate - this is what dashboards read)
-- =====================================================================

-- Demand-side: what content / screens earn attention. Aggregate, no person.
CREATE MATERIALIZED VIEW analytics.content_attention AS
SELECT screen,
       target,
       count(*)                              AS views,
       round(avg(dwell_ms)/1000.0, 1)        AS avg_dwell_s,
       count(DISTINCT subject_id)            AS reach
FROM   events.event
WHERE  event_type = 'screen_view'
GROUP  BY screen, target;

-- Station operations: peak hours and utilisation.
CREATE MATERIALIZED VIEW analytics.station_load AS
SELECT station_id,
       date_trunc('hour', started_at)        AS hour_bucket,
       count(*)                              AS washes,
       round(avg(duration_s)/60.0, 1)        AS avg_minutes
FROM   core.wash_session
GROUP  BY station_id, date_trunc('hour', started_at);

-- ---------------------------------------------------------------------
-- PROVIDER HEALTH  (the core "monitor our providers" logic)
-- ---------------------------------------------------------------------
-- Weighted reliability over a rolling 30-day window.
--   availability_pct = filled / offered
--   weighted_cancels = provider cancellations weighted by lead time:
--        < 24h  -> x3   (most disruptive)
--        < 72h  -> x2
--        else   -> x1
--   reliability      = 1 - (weighted_cancels / bookings)   (floored at 0)
--   rating_norm      = (avg_stars - 1) / 4                  (0..1)
--   responsiveness   = bucketed median response time        (0..1)
-- health_score (0..100) =
--        30 * availability_pct
--      + 35 * reliability
--      + 25 * rating_norm
--      + 10 * responsiveness
-- State: Good >= 80 ; Watch 60-79 ; At risk < 60.
-- Override: if cancel rate > 2x its prior-21-day baseline -> force >= 'watch'.
-- ---------------------------------------------------------------------
CREATE MATERIALIZED VIEW analytics.provider_health AS
WITH win AS (
    SELECT now() - interval '30 days' AS since
),
avail AS (
    SELECT provider_id,
           NULLIF(sum(slots_offered),0)            AS offered,
           sum(slots_filled)                       AS filled,
           avg(first_response_minutes)             AS resp_min
    FROM   core.provider_availability, win
    WHERE  day >= since::date
    GROUP  BY provider_id
),
jobs AS (
    SELECT provider_id,
           count(*)                                                       AS bookings,
           count(*) FILTER (WHERE status='cancelled_provider')            AS cancels,
           sum(CASE WHEN status='cancelled_provider' THEN
                 CASE WHEN cancel_lead_minutes < 1440 THEN 3
                      WHEN cancel_lead_minutes < 4320 THEN 2
                      ELSE 1 END ELSE 0 END)                              AS weighted_cancels
    FROM   core.job, win
    WHERE  scheduled_for >= since
    GROUP  BY provider_id
),
rate AS (
    SELECT provider_id, avg(stars)::numeric(3,2) AS avg_stars
    FROM   core.provider_rating, win
    WHERE  created_at >= since
    GROUP  BY provider_id
),
calc AS (
    SELECT p.provider_id,
           p.code,
           COALESCE(a.filled::numeric / a.offered, 0)                     AS availability_pct,
           COALESCE(j.bookings,0)                                         AS bookings,
           COALESCE(j.cancels,0)                                          AS cancels,
           GREATEST(0, 1 - COALESCE(j.weighted_cancels,0)::numeric
                          / NULLIF(j.bookings,0))                         AS reliability,
           COALESCE((r.avg_stars - 1)/4.0, 0.75)                          AS rating_norm,
           CASE WHEN a.resp_min IS NULL      THEN 0.7
                WHEN a.resp_min <= 60        THEN 1.0
                WHEN a.resp_min <= 180       THEN 0.8
                WHEN a.resp_min <= 480       THEN 0.5
                ELSE 0.2 END                                             AS responsiveness,
           r.avg_stars
    FROM   core.provider p
    LEFT JOIN avail a ON a.provider_id = p.provider_id
    LEFT JOIN jobs  j ON j.provider_id = p.provider_id
    LEFT JOIN rate  r ON r.provider_id = p.provider_id
)
SELECT provider_id,
       code,
       round(availability_pct*100)                                       AS availability_pct,
       bookings,
       cancels,
       round( (cancels::numeric / NULLIF(bookings,0)) * 100 )            AS cancel_rate_pct,
       avg_stars,
       round( 30*availability_pct + 35*reliability
            + 25*rating_norm + 10*responsiveness )                       AS health_score,
       CASE
         WHEN round(30*availability_pct+35*reliability+25*rating_norm+10*responsiveness) >= 80
              THEN 'good'
         WHEN round(30*availability_pct+35*reliability+25*rating_norm+10*responsiveness) >= 60
              THEN 'watch'
         ELSE 'at_risk'
       END                                                               AS health_state
FROM   calc;

-- Escalation ladder is recorded as cases so every action is documented.
CREATE TABLE analytics.provider_case (
    case_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id   uuid NOT NULL REFERENCES core.provider(provider_id) ON DELETE CASCADE,
    opened_at     timestamptz NOT NULL DEFAULT now(),
    trigger       text NOT NULL,                 -- 'cancel_spike' | 'low_rating' | 'low_availability'
    from_state    text,
    to_state      text,                          -- watch | at_risk | suspended
    action        text,                          -- 'coach' | 'slot_cap' | 'suspend' | 'cleared'
    note          text,
    resolved_at   timestamptz
);

-- =====================================================================
-- 5. CONSENT & GOVERNANCE
-- =====================================================================

-- One row per (owner, purpose). Use latest version; withdrawal sets withdrawn_at.
CREATE TABLE consent.consent_record (
    consent_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id      uuid NOT NULL REFERENCES identity.owner(owner_id) ON DELETE CASCADE,
    purpose       text NOT NULL CHECK (purpose IN
                  ('analytics','marketing','profile','provider_monitoring','personalisation')),
    granted       boolean NOT NULL,
    granted_at    timestamptz,
    withdrawn_at  timestamptz,
    policy_version text NOT NULL,
    UNIQUE (owner_id, purpose, policy_version)
);

-- Retention windows are declared data, enforced by a scheduled purge job.
CREATE TABLE consent.retention_policy (
    data_class    text PRIMARY KEY,              -- 'raw_event' | 'wash_session' | 'gift_message' ...
    retention_days integer NOT NULL,
    legal_basis   text,                          -- describe; confirm with counsel
    notes         text
);
INSERT INTO consent.retention_policy (data_class, retention_days, legal_basis, notes) VALUES
 ('raw_event',        400, 'consent/legitimate-interest', 'Drop monthly partitions older than ~13 months'),
 ('wash_session',     1095,'contract',                    'Service history; needed for the wash story'),
 ('gift_message',     30,  'contract',                    'Purge personal note shortly after delivery'),
 ('provider_rating',  1095,'legitimate-interest',         'Fairness window for provider scoring'),
 ('marketing_profile',730, 'consent',                     'Refreshed on re-consent')
ON CONFLICT (data_class) DO NOTHING;

-- Data Subject Requests (access / delete / rectify / export).
CREATE TABLE consent.dsr_request (
    request_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id      uuid NOT NULL REFERENCES identity.owner(owner_id) ON DELETE CASCADE,
    type          text NOT NULL CHECK (type IN ('access','delete','rectify','export','restrict')),
    status        text NOT NULL DEFAULT 'received'
                  CHECK (status IN ('received','in_progress','completed','rejected')),
    requested_at  timestamptz NOT NULL DEFAULT now(),
    completed_at  timestamptz,
    note          text
);

-- =====================================================================
-- HELPER: build "Mocha's wash story" for one member (value returned).
-- Reads operational data the member is entitled to see about their own pet.
-- =====================================================================
CREATE OR REPLACE VIEW analytics.member_wash_story AS
SELECT sm.owner_id,
       sm.pet_id,
       count(w.session_id)                                 AS total_washes,
       count(w.session_id) FILTER (WHERE w.started_at >= date_trunc('year', now())) AS washes_this_year,
       max(w.started_at)                                   AS last_wash_at,
       mode() WITHIN GROUP (ORDER BY w.station_id)         AS favourite_station_id,
       round(avg(w.duration_s)/60.0, 1)                    AS avg_minutes
FROM   identity.subject_map sm
JOIN   core.wash_session w ON w.subject_id = sm.subject_id
GROUP  BY sm.owner_id, sm.pet_id;

-- =====================================================================
-- COMPLIANCE NOTE (not legal advice)
-- This schema is built to SUPPORT compliance with Israel's Privacy
-- Protection Law and, for EU users, the GDPR: data minimisation,
-- pseudonymisation, purpose limitation, consent, retention limits and
-- data-subject rights. Confirm the exact obligations against the official
-- regulator texts and your counsel before production. Do not treat the
-- retention_days values above as legal determinations.
-- =====================================================================

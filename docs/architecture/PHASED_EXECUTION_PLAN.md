# PetWash — Phased Execution Plan
> Safe execution order. Each phase must complete before next begins.
> One PR per domain only. No mixed PRs. No deletions without telemetry proof.

---

## Phase A — Safe Observability Only
**Goal**: Gain visibility without changing any business logic.
**Merge freely — zero risk to existing flows.**

### A1 — Startup Secret Visibility (DONE — PR A)
- [x] `GOOGLE_SERVICE_ACCOUNT_JSON` presence checked and logged at startup
- [x] Startup fails loudly if Twilio credentials missing
- [x] Startup fails loudly if Firebase credentials missing

### A2 — Integration Health Endpoint (DONE — PR A)
- [x] `GET /api/admin/integration-health` endpoint returns live/dead status for all integrations

### A3 — Sunset Date Fix (DONE — current PR B commit `9e3c5043`)
- [x] Changed `Sunset: Sat, 31 May 2025` → `Sunset: Sun, 31 Aug 2025` in `server/routes/provider-applications.ts` line 96

### A4 — Gemini Key Fix (IMMEDIATE — Track A, next 1 PR)
**File**: `server/index.ts` lines 5-6
**Action**: Remove the block that deletes `GEMINI_API_KEY` when `GOOGLE_API_KEY` exists
**Why safe**: Only adds the key back — no behavior change, just stops silent breakage
**PR name**: `fix: stop deleting GEMINI_API_KEY at startup`

### A5 — Provider Applications Deprecation Telemetry (DONE — PR B)
- [x] All 6 public handlers of `/api/provider-applications` now emit `[DEPRECATED_ENDPOINT]` structured log
- [x] RFC 8594 Deprecation + Sunset + Link headers on all responses

---

## Phase B — Canonical Route Enforcement
**Goal**: Fix duplicate rendering without changing business logic.
**All changes are pure redirects or route consolidations.**

### B1 — Loyalty Route Deduplication
**Files**: `client/src/App.tsx` lines 706-712
**Action**: Change `/loyalty/join` and `/vito` from rendering `PrivilegeSignup` directly to `<Redirect to="/privilege">`
**Why safe**: Same component, same destination — only changes the URL in the browser bar
**Outcome**: One canonical loyalty join URL (`/privilege`); analytics and attribution unified
**PR name**: `fix: redirect loyalty/join and vito to canonical /privilege`

### B2 — Provider Intent Preservation Verification
**Files**: `ProviderOnboarding.tsx`
**Action**: Audit that `?type=X` query param is read and pre-filled correctly when user arrives after auth redirect
**Why**: If the type param is lost after sign-in redirect, provider submits without type — broken KYC flow
**Outcome**: Confirmed or fixed — walker/sitter/trainer type preserved through auth bounce
**PR name**: `fix: preserve provider type param through auth redirect`

### B3 — Legacy Auth Alias Cleanup (OPTIONAL — low priority)
**Action**: `/signin`, `/login`, `/signup`, `/register` already redirect — confirm no external links use these; add 301 redirect in nginx/CDN if possible
**PR name**: `chore: document legacy auth alias redirects`

---

## Phase C — Dead Path Deprecation + Removal
**Prerequisite**: Phase A telemetry must run in production for at least 1 full deployment cycle (2-7 days)
**Gate**: Zero `[DEPRECATED_ENDPOINT]` log entries in production logs

### C1 — Remove Provider Applications Dead Path
**Files to remove**:
- `client/src/pages/BecomeProvider.tsx` (never mounted — line 76 lazy import in App.tsx must also be removed)
- `server/routes/provider-applications.ts` (remove entirely after confirming zero calls)
- Unmount from `server/routes.ts` line 10553
**DB**: After code removal, drop `provider_applicants` table (with backup)
- Remove `providerApplicants` export from `shared/schema-enterprise.ts`
**PR name**: `feat(provider): remove dead provider-applications path after zero-call telemetry`

### C2 — Audit and Deprecate simple-auth
**Files**: `server/routes/simple-auth.ts` (if exists), `POST /api/simple-auth/signup`, `POST /api/simple-auth/login`
**Action**: Add telemetry logging to both endpoints; confirm no live frontend callers
**Threshold**: Zero calls for 7 days → remove
**PR name**: `fix: audit simple-auth endpoints`

### C3 — Audit and Remove Octopus Bookings
**Table**: `octopus_bookings` (schema.ts line 11833)
**Action**: Check if `POST /api/platforms/*` is called by any live frontend component; if zero — deprecate + remove
**PR name**: `fix: audit octopus bookings path`

---

## Phase D — Booking Architecture Consolidation
**CRITICAL — Treat as a major project. Must not be rushed.**
**Prerequisite**: Phases A, B, C complete.

### D1 — Confirm the Bug (SPIKE — 1 day)
**Test**: Create a walk booking as a test user. Check if it appears in `/bookings` (CustomerBookings page).
**Expected result**: It does NOT appear — confirming the bug proven in DATA_TRUTH_MAP.md.
**Evidence**: `GET /api/bookings/my-bookings` queries Firestore only (`bookings.ts` lines 363-401).

### D2 — Unified Booking Read Endpoint
**File**: `server/routes/bookings.ts` — `GET /my-bookings` handler
**Action**: Aggregate all 4 booking sources:
```
Firestore:  bookings where customerId == uid
Postgres:   walk_bookings where user_id == uid
Postgres:   sitter_bookings where customer_id == uid
Postgres:   trainer_bookings where customer_id == uid
```
Merge by date, return unified array with `source` field (so UI can show service type icon)
**PR name**: `fix(bookings): unify my-bookings to include walk/sitter/trainer tables`

### D3 — Audit Booking Request and Marketplace Booking Paths
**Endpoints**: `/api/booking-requests/*`, `/api/marketplace-bookings/*`, `/api/unified-booking/*`
**Action**: Trace each one — does it produce a confirmed booking in any table? If yes, add to D2 aggregation. If no real bookings produced — deprecate.

### D4 — Provider Booking View Unification
Confirm `/provider-os` shows bookings from all vertical tables (walk, sitter, trainer), not just one.

---

## Phase E — Messaging and Integration Cleanup
**Prerequisite**: Phase A complete (startup health visible)

### E1 — Email Idempotency Enforcement
**File**: All send paths in `server/services/`, `server/email/`
**Action**: Before every `sgMail.send()` call, check `notification_logs` for idempotency key. If key exists and status = `sent` → skip. After send → write key.
**PR name**: `fix(email): enforce notification_logs idempotency before every send`

### E2 — Gmail Fallback Logic
**Action**: Gmail fallback must ONLY fire if SendGrid returns a 4xx/5xx error AND the idempotency key is not yet marked `sent`. Current code may fire both independently.
**PR name**: `fix(email): gate gmail fallback behind sendgrid failure + idempotency check`

### E3 — SMS Priority Fix
**Action**: Confirm all SMS sends use `TWILIO_MESSAGING_SERVICE_SID` when available, falling back to `TWILIO_PHONE_NUMBER`. Log which path was used.
**PR name**: `fix(sms): enforce messaging service SID priority`

### E4 — Weather Policy Decision
**Action**: Define and document: is weather a blocking gate or advisory-only for outdoor services?
If blocking gate: implement acknowledgment step in walk/outdoor booking confirmation.
If advisory: document that explicitly as intentional — no code change needed.
**PR name**: `fix(weather): enforce acknowledgment gate OR document advisory-only policy`

---

## Phase F — Data Layer Cleanup
**Only after Phases C, D, E are complete.**

### F1 — `admin_users` Table Consolidation
**Action**: Verify all admin auth checks use `users` table with role field. If `admin_users` is only a mirror — remove it and update all reads to use `users` directly.
**PR name**: `feat(data): dissolve admin_users into users with role`

### F2 — `customers` Table FK Enforcement
**Action**: Add FK from `customers.user_id` → `users.uid`; ensure no customer profile is created without a matching `users` row.
**PR name**: `feat(data): enforce FK between customers and users tables`

### F3 — Loyalty Subscription Deduplication
**Action**: Decide whether `loyalty_profiles` or `user_subscriptions` is the canonical loyalty record. Migrate data to canonical table; add FK. Remove duplicate.
**PR name**: `feat(loyalty): consolidate loyalty_profiles and user_subscriptions`

---

## PR Sequencing Summary

| PR | Phase | Change | Risk | Gate |
|---|---|---|---|---|
| PR A | A | Startup validation + health endpoint | None | None |
| PR B | A/C | Provider-applications deprecation telemetry | None | In progress — merge now |
| PR B-fix | A | Sunset date corrected | None | Done (commit 9e3c5043) |
| PR B2 | B | Loyalty route redirect deduplication | None | None |
| PR B3 | B | Provider type param preservation | Low | Audit first |
| PR C1 | C | Remove dead BecomeProvider + provider-applications | Low | Zero log calls for 7+ days |
| PR C2 | C | Audit simple-auth | Low | Telemetry first |
| PR D1 | D | Walk/sitter/trainer in my-bookings (SPIKE) | High if done wrong | Spike + review |
| PR D2 | D | Unified my-bookings endpoint | Medium | Spike complete |
| PR E1 | E | Email idempotency | Medium | Phase A complete |
| PR E2 | E | Gmail fallback gate | Medium | E1 merged |
| PR F1 | F | admin_users dissolution | Medium | Phase C complete |

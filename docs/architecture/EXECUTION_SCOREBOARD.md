# EXECUTION_SCOREBOARD.md
> Branch: copilot/fix-loyalty-flow-issues (HEAD: 9a6e5dc1)  
> Last updated: 2026-04-17 (session 2 — deliverables added)  
> Source documents: BOOKING_VERIFICATION_MATRIX.md, MESSAGING_TRUTH_MAP.md, MESSAGING_ACCEPTANCE_MATRIX.md, DATA_TRUTH_MASTER.md, AUTH_ROLE_TRUTH_MAP.md, INTEGRATION_HEALTH_MASTER.md, CLOUD_RUN_DEGRADED_MODE_RUNBOOK.md, POPUP_CONSENT_MAP.md, PROVIDER_DEPRECATION_PLAN.md, LOYALTY_TRUTH_MAP.md, IDENTITY_TRUTH_MAP.md

---

## PR Scoreboard

| # | Domain | Root Cause Proven | Fix PR | Telemetry Added | Acceptance Passed | Safe to Deprecate | Next Step |
|---|---|---|---|---|---|---|---|
| 1 | Booking Read Truth | ✅ YES — walk/sitter/trainer bookings written to separate Postgres tables, customer history only read `booking_requests` | ✅ Stage B (commit 2332da16) | ✅ `[BOOKING_UNIFIED_READ]`, `[BOOKING_WRITE]`, `[BOOKING_MISMATCH_REPAIRED]` | ⚠️ PENDING — telemetry must show non-zero `previouslyMissing` counts across 30 days | ❌ Not yet | Monitor `[BOOKING_UNIFIED_READ]` logs; then Stage C: expose marketplace `bookings` table |
| 2 | Messaging Deduplication | ✅ YES — `booking_requests` creation fires two overlapping dispatchers: `dispatchNotification` (direct) + `eventPublisher.publishEvent(BOOKING_CREATED)` → `NotificationService` | ✅ PR committed this session | ✅ `[BOOKING_WRITE_SOURCE]` comment + event-bus canonical comment | ✅ PASSED — direct `dispatchNotification` removed; event handler now covers push+in_app+email+sms | ❌ Not yet | Monitor notification logs for 30 days to confirm zero duplicate deliveries; then consolidate all dispatchers to System 3 (PetWashNotificationEngine) |
| 3 | Identity Truth Repair | ✅ YES — `users` and `customers` both store email, loyaltyTier, totalSpent, washBalance, loyaltyPoints with independent write paths | ✅ PR committed this session (read-side only) | ✅ `[IDENTITY_SPLIT_WRITE]` telemetry on divergence detection | ✅ READ-SIDE PASSED — `GET /api/auth/identity` canonical reader live | ❌ Not yet | IDENTITY_TRUTH_MAP.md Stage 2: redirect frontend to /api/auth/identity; Stage 3: mirror writes; Stage 4: deprecate customers table |
| 4 | Marketplace Booking Wire-Up | ✅ YES — 0% wired: `marketplace-bookings.ts` + `super-app-bookings.ts` exist with full CRUD, zero frontend consumers | ❌ Not yet | ❌ Not yet | ❌ NOT PASSED | ❌ Not yet | Decision gate: check write volume in production logs; if zero → formal deprecation PR; if non-zero → minimal activation PR |
| 5 | Cloud Run Crash-Proof Init | ✅ YES — HubSpot and Spotify use Replit-only OAuth (`X_REPLIT_TOKEN`) and crash on Cloud Run startup; Gemini has zero startup validation | ✅ PR committed this session | ✅ `[HUBSPOT_DEGRADED]`, `[SPOTIFY_DEGRADED]` on non-Replit startup | ✅ PASSED — non-Replit env logs DEGRADED and skips init; Spotify /status returns `{connected:false,reason:'degraded'}`; no throw | ❌ Not yet | Monitor `[HUBSPOT_DEGRADED]` / `[SPOTIFY_DEGRADED]` logs on Cloud Run for 30 days to confirm zero crashes |
| 6 | Popup / Consent Suppression | ✅ YES — PromoAdPopup fired on `/consent-onboarding` + `/notification-consent`, interrupting post-signup consent chain | ✅ commit c34bbe6f | ✅ SUPPRESSED_PATH_PREFIXES updated | ✅ PASSED | ✅ YES — dead popup components (4) safe to delete after 30 days | Remove KenzoWelcomePopup, LoyaltyWelcomeModal, VIPLoyaltyPopup, TierUpgradeModal in separate cleanup PR |
| 7 | Provider Deprecation | ✅ YES — two competing submit endpoints (`/api/provider-onboarding/apply` canonical vs `/api/provider-applications` deprecated) | ✅ Deprecated with `logDeprecatedCall()` + RFC 8594 headers (prior to this branch) | ✅ `logDeprecatedCall()` active | ⚠️ PENDING — need 30-day zero-caller proof | ❌ Not yet | Monitor telemetry; if zero callers for 30 days → PR to remove `/api/provider-applications` |
| 8 | Loyalty Flow Isolation | ✅ YES — no cross-contamination found; enrollment is atomic (prestige-join.ts); no wrong price bug (enrollment is free) | ✅ N/A — no code was broken | ✅ N/A | ✅ PASSED | ✅ YES — dead loyalty modals safe to delete | Remove dead modal components in same cleanup PR as item 6 |

---

## PR 1 — Booking Read Truth Repair

**Root cause:** Walk, sitter, and trainer bookings are written to separate Postgres tables (`walk_bookings`, `sitter_bookings`, `trainer_bookings`). The customer history endpoint `GET /api/booking-requests` previously only read `booking_requests`. Providers had no active/completed history routes wired in the frontend despite them existing in the backend.

**Files changed:**
- `server/routes/booking-requests.ts` — unified read layer aggregates all 4 booking sources (Stage B)
- `server/routes/provider-dashboard-v2.ts` — `/bookings` and `/booking-counts` now include walk + sitter bookings
- `client/src/pages/walk-my-pet/WalkerDashboard.tsx` — wired `/walker/active` and `/walker/completed` (previously 0 consumers)
- `client/src/pages/sitter-suite/OwnerDashboard.tsx` — fixed query key
- `client/src/pages/sitter-suite/SitterDetail.tsx` — fixed cache invalidation key

**Telemetry added:** `[BOOKING_UNIFIED_READ]`, `[BOOKING_WRITE] walk`, `[BOOKING_WRITE] sitter`, `[BOOKING_MISMATCH_REPAIRED]`

**What was deliberately not changed:** No table schema changes. No write path changes. Marketplace `bookings` table reads not yet exposed (0% wired — needs decision gate first).

**Acceptance criteria status:**
- ✅ Walk bookings appear in customer history
- ✅ Sitter bookings appear in customer history
- ✅ Trainer bookings appear in customer history
- ✅ Walker dashboard shows active walk and completed history
- ⚠️ Marketplace bookings: NOT yet wired (separate PR 4)

---

## PR 2 — Messaging Deduplication

**Root cause:** `booking_requests` creation (booking-requests.ts) fired two separate notification dispatchers simultaneously:
1. `eventPublisher.publishEvent('BOOKING_CREATED')` → `NotificationEventHandlers.ts:467` → `NotificationService.sendNotification()` (push + in_app)
2. Direct `dispatchNotification({ channels: ['in_app', 'email', 'sms'] })` immediately after

Result: Provider received `in_app` × 2 + push + email + SMS = 5 notification events per booking.

**Before:**
```
booking_requests POST /create
├── publishEvent(BOOKING_CREATED) → push + in_app for provider and customer
└── dispatchNotification({ channels: ['in_app', 'email', 'sms'] })  ← DUPLICATE in_app
```

**After:**
```
booking_requests POST /create
└── publishEvent(BOOKING_CREATED) → NotificationEventHandlers
    ├── customer: push + in_app
    └── provider: push + in_app + email + sms  ← ALL channels in one canonical path
```

**Files changed:**
- `server/routes/booking-requests.ts` — removed lines 400-428 (direct dispatchNotification block)
- `server/services/events/NotificationEventHandlers.ts` — provider channelsOverride updated from `['push', 'in_app']` to `['push', 'in_app', 'email', 'sms']`

**Telemetry added:** `[BOOKING_WRITE_SOURCE]` comment in event publish call (idempotency note)

**Acceptance criteria:**
- ✅ One `BOOKING_CREATED` event → one notification per channel per recipient
- ✅ Provider receives: push ×1 + in_app ×1 + email ×1 + sms ×1 (was: in_app ×2 + push ×1 + email ×1 + sms ×1)
- ✅ Event bus aggregateId = requestId → same booking submitted twice does not re-fire
- ✅ Email + SMS not lost (moved to event handler)

**What was deliberately not changed:** Walk/sitter owner notifications (dispatchNotification in walk-my-pet.ts, sitter-suite.ts) are on separate paths and were not touched. No changes to NotificationService, PetWashNotificationEngine, or TwilioSMSService.

---

## PR 3 — Identity Truth Repair (Read-Side)

**Root cause:** `users` (schema.ts:35) and `customers` (schema.ts:339) both store email, firstName, lastName, phone, loyaltyTier, totalSpent, washBalance, loyaltyPoints with independent write paths. No single endpoint served as the canonical profile reader — 6 competing endpoints existed.

**Before:**
```
Customer asks "who am I?" →
  /api/auth/me           (mobile JWT → users)
  /api/auth/me-session   (Firebase session cookie → Firestore users/{uid})
  /api/session/whoami    (Firebase claims only — no profile fields)
  /api/me/role           (users.role only)
  /api/profile           (users row — Firebase auth)
  /api/customers/me      (customers row — legacy email/password)
→ Returns different name/phone/loyalty if split-truth has diverged
```

**After:**
```
/api/auth/identity  →  users (canonical) + customers (backward-compat) → unified response
  - role from Firebase custom claims (authoritative)
  - all loyalty/balance fields from users
  - isVerified / termsAccepted bridged from customers if users fields are absent
  - [IDENTITY_SPLIT_WRITE] logged on divergence
```

**Files changed:**
- `server/routes.ts` — added `GET /api/auth/identity` canonical reader
- `docs/architecture/IDENTITY_TRUTH_MAP.md` — full split-truth analysis and 4-stage repair plan

**Telemetry added:** `[IDENTITY_SPLIT_WRITE]` on any detected divergence between users and customers rows

**Acceptance criteria:**
- ✅ `GET /api/auth/identity` returns unified profile (users as source)
- ✅ Backward-compat fields from customers merged without overwriting users fields
- ✅ `[IDENTITY_SPLIT_WRITE]` log fires when divergence detected
- ✅ No data modified — read-only unification
- ✅ IDENTITY_TRUTH_MAP.md documents all 15 split-truth fields and 4-stage repair plan

**What was deliberately not changed:** No writes to users or customers. No column altered or dropped. All existing endpoints left intact. Legacy `/api/customers/me` unchanged. No data migration.

---

## PR 4 — Marketplace Booking Wire-Up (PENDING)

**Root cause:** `marketplace-bookings.ts` and `super-app-bookings.ts` are fully mounted with CRUD endpoints but zero frontend consumers exist. Customers see no marketplace booking flow despite backend being ready.

**Decision gate (run before any code):**
```
grep -r "marketplace-bookings\|super-app-bookings" server/logs/
```
If write volume = 0 in production → formal deprecation PR (unmount routes, add 410 Gone)
If write volume > 0 → minimal activation PR (add frontend query key + CustomerBookings list)

**What must NOT change:** Backend routes (do not remove without proof). Table schema.

---

## PR 5 — Cloud Run Crash-Proof Init

**Root cause:** `server/hubspot.ts` and `server/spotify.ts` both call a Replit-only OAuth connector (`REPLIT_CONNECTORS_HOSTNAME` + `REPL_IDENTITY`). On Cloud Run, neither env var exists. When any request triggers `getAccessToken()`, it throws `'X_REPLIT_TOKEN not found for repl/depl'`. While request handlers catch this, the `setInterval` retry loop in hubspot.ts runs from module load, and the error surfaces in Cloud Run logs as an apparent crash.

**Before:**
```typescript
// hubspot.ts / spotify.ts — getAccessToken()
if (!xReplitToken) {
  throw new Error('X_REPLIT_TOKEN not found for repl/depl'); // throws on Cloud Run
}
```

**After:**
```typescript
const IS_REPLIT = !!(process.env.REPL_IDENTITY || process.env.WEB_REPL_RENEWAL || process.env.REPLIT_CONNECTORS_HOSTNAME);
if (!IS_REPLIT) {
  logger.warn('[HubSpot] [HUBSPOT_DEGRADED] Replit-only integration — running in degraded mode');
}
// In getAccessToken():
if (!IS_REPLIT) { throw new Error('[HUBSPOT_DEGRADED] Not a Replit environment'); }
// In syncUserToHubSpot / trackHubSpotEvent:
if (!IS_REPLIT) { return { degraded: true }; } // never throws
// In getSpotifyUserProfile:
if (!IS_REPLIT) { return null; } // never throws
// In /status route: handles null profile gracefully → { connected: false, reason: 'degraded' }
```

**Files changed:**
- `server/hubspot.ts` — IS_REPLIT guard + startup warn + syncUserToHubSpot/trackHubSpotEvent degraded return
- `server/spotify.ts` — IS_REPLIT guard + startup warn + getSpotifyUserProfile/getSpotifyNowPlaying null return
- `server/routes/spotify.ts` — `/status` route handles null profile (no crash on `.displayName`)

**Telemetry added:** `[HUBSPOT_DEGRADED]`, `[SPOTIFY_DEGRADED]` on startup + on each skipped call

**Acceptance criteria:**
- ✅ Cloud Run startup: both modules log DEGRADED on startup, never throw
- ✅ Any request to Spotify /status → `{ connected: false, reason: 'degraded' }` (200, not 500)
- ✅ syncUserToHubSpot/trackHubSpotEvent return `{ degraded: true }` on Cloud Run — callers' `.catch()` never triggered
- ✅ On Replit: IS_REPLIT=true, behavior unchanged

**Runbook:** See `docs/architecture/CLOUD_RUN_DEGRADED_MODE_RUNBOOK.md`

**What was deliberately not changed:** HubSpot and Spotify functionality on Replit is untouched. The Replit connector auth flow is identical. setInterval retry queue unchanged. No callers were modified.

---

## Current Status and Next Stage (Updated 2026-04-17 Session 2)

| PR | Status | Next Required Action | Owner | When |
|---|---|---|---|---|
| PR 1 — Booking reads | ✅ DONE | Monitor `[BOOKING_UNIFIED_READ]` telemetry 30 days. Then: expose marketplace `bookings` table read | Telemetry team | 30-day window |
| PR 2 — Messaging dedup | ✅ DONE | Monitor `notificationLogs` for duplicate deliveries 30 days. Then Stage C: consolidate BOOKING_COMPLETED to single path | Engineering | 30-day window |
| PR 3 — Identity reads | ✅ READ-SIDE DONE | Wave 1 frontend: SecuritySettings.tsx + AuthHealthCheck migrate first. Then Wave 2: useIdentity() adaptor hook. See IDENTITY_TRUTH_MAP.md Stage 2 | Frontend | Next sprint |
| PR 4 — Marketplace wire-up | ❌ BLOCKED | Run decision gate: check write volume in prod logs before any code | Product | Before next sprint |
| PR 5 — Cloud Run | ✅ DONE | Monitor Cloud Run logs for `[HUBSPOT_DEGRADED]` + `[SPOTIFY_DEGRADED]` 30 days | DevOps | 30-day window |
| PR 6 — Popup suppression | ✅ DONE | 30-day zero-use window → PR to remove 4 dead popup components | Engineering | 30-day window |
| PR 7 — Provider deprecation | ⏳ TELEMETRY RUNNING | Zero-caller window must complete before code removal | Engineering | 30-day window |
| PR 8 — Loyalty isolation | ✅ DONE | Remove dead loyalty modals in same PR as PR 6 cleanup | Engineering | After PR 6 window |

---

## Deliverables Completed (Session 2)

| Deliverable | File | Status |
|---|---|---|
| PR2 event-by-event proof | `docs/architecture/MESSAGING_ACCEPTANCE_MATRIX.md` | ✅ Created |
| PR3 frontend migration plan | `docs/architecture/IDENTITY_TRUTH_MAP.md` — Stage 2 section | ✅ Added |
| PR5 operations runbook | `docs/architecture/CLOUD_RUN_DEGRADED_MODE_RUNBOOK.md` | ✅ Created |
| Scoreboard update | This file | ✅ Updated |

---

## Architecture Work Priority Order

**DO NOT start new feature work before these are stable:**

1. ✅ `stabilize` — PR5 Cloud Run infra stable (done)
2. ✅ `deduplicate` — PR2 messaging dedup (done)
3. ✅ `unify reads` — PR3 identity read unification (done)
4. ⏳ `observe` — 30-day telemetry window active for PR1, PR2, PR5, PR7
5. ❌ `remove legacy` — do not remove any legacy code until telemetry window complete

**What MUST NOT happen:**
- Writes to `customers` are not yet mirrored to `users`. PR3 is read-side only. Write split-truth still exists.
- Do not remove `/api/auth/user`, `/api/simple-auth/me`, or `/api/customers/me` until zero-caller proven.
- Do not remove dead provider code (`/api/provider-applications`) until PR7 telemetry window is complete.

---

## Execution Order (per problem statement rules)

1. ✅ **Observability and truth** — BOOKING_VERIFICATION_MATRIX.md + 7 other truth maps (done)
2. ✅ **Unified reads** — Stage B booking read unification (done)
3. ✅ **Deduplication** — PR 2 (messaging), PR 3 (identity reads), PR 5 (infra) (done)
4. ⏳ **Verification** — Monitor telemetry for 30 days before next step
5. ⏳ **Frontend migration** — PR3 Wave 1+2 (next sprint, after observation window started)
6. ❌ **Deprecation with telemetry** — provider-applications after 30-day zero-caller proof
7. ❌ **Removal after proof** — Not yet
8. ❌ **Migrations or deeper consolidation** — Not yet

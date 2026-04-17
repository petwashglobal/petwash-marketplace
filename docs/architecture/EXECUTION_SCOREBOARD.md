# EXECUTION_SCOREBOARD.md
> Branch: copilot/fix-loyalty-flow-issues (HEAD: 3dedd735)  
> Last updated: 2026-04-17 (session 5 — enforcement/rejection rules added to PR standard)  
> Source documents: BOOKING_VERIFICATION_MATRIX.md, MESSAGING_TRUTH_MAP.md, MESSAGING_ACCEPTANCE_MATRIX.md, DATA_TRUTH_MASTER.md, AUTH_ROLE_TRUTH_MAP.md, INTEGRATION_HEALTH_MASTER.md, CLOUD_RUN_DEGRADED_MODE_RUNBOOK.md, POPUP_CONSENT_MAP.md, PROVIDER_DEPRECATION_PLAN.md, LOYALTY_TRUTH_MAP.md, IDENTITY_TRUTH_MAP.md, PR_REVIEW_STANDARD.md  
>
> **PR Standard (MANDATORY):** Every PR on this platform must include all six sections defined in `docs/architecture/PR_REVIEW_STANDARD.md` and use the template at `.github/PULL_REQUEST_TEMPLATE.md`.  
> Sections: (1) Technical Root Cause · (2) Exact Code Change · (3) Acceptance Proof · (4) Business Impact · (5) Remaining Risk · (6) What Is Not Solved Yet

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

**Business impact:**
- **User problem reduced:** Pet parents who booked dog walks or sitter stays could not see those bookings in their history — the app showed only self-service wash station bookings. After PR1, all booking types appear in one unified history. Walker and sitter providers can now also see their active jobs and completed history, which were previously unreachable.
- **Risk still remaining:** The 30-day telemetry window must confirm actual real-world mismatches (`previouslyMissing > 0`). If `[BOOKING_MISMATCH_REPAIRED]` logs show zero in production, the read unification had no business impact and was a code-only improvement.
- **Not solved yet:** Marketplace bookings (PR4 decision gate) are still disconnected. A customer who books via the marketplace flow still cannot see those bookings in their history. The write-side does not yet guarantee all booking types land in the same table.

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

**Business impact:**
- **User problem reduced:** Providers were receiving the same "new booking request" notification 2–5 times per event (e.g., two in-app banners within seconds of each other). This made the platform feel broken and untrustworthy. After PR2, a provider receives exactly one push, one in-app, one email, and one SMS per booking event.
- **Risk still remaining:** The `booking_completed` and `booking_accepted` events still run through multiple parallel notification paths (direct `dispatchNotification` + event bus). A customer confirming a completed booking or a provider accepting a request may still see duplicate inbox notifications. This is documented in MESSAGING_ACCEPTANCE_MATRIX.md.
- **Not solved yet:** The notification architecture still has three parallel dispatch systems (`dispatchNotification`, `PetWashNotificationEngine`, `NotificationEventHandlers`). PR2 fixed the `booking_created` path only. Stage C must consolidate all events — especially `booking_completed` — into a single path before messaging can be called fully clean.

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

**Business impact:**
- **User problem reduced:** Support staff or admins calling different identity endpoints for the same user could get different names, loyalty tiers, or wallet balances — depending on which table was last written. This caused confusing support experiences and silent data inconsistencies. The new `/api/auth/identity` endpoint gives one consistent read regardless of which table holds the freshest data.
- **Risk still remaining:** The write split is completely untouched. If a user updates their phone number via the Firebase flow, the `customers` table is not updated. If a legacy action updates `customers.loyaltyTier`, the `users` table is not updated. The next read from `/api/auth/identity` will return the `users` value — but the `[IDENTITY_SPLIT_WRITE]` telemetry will fire, signaling divergence. The inconsistency is now visible, but not yet healed.
- **Not solved yet:** All 30+ frontend screens still call the old identity endpoints (`/api/auth/user`, `/api/simple-auth/me`, etc.). Until Wave 2 migration is complete, the clean unified endpoint exists but is not used by any production screen. The frontend migration plan is in IDENTITY_TRUTH_MAP.md Stage 2. Write-side mirroring (Stage 3) has not started.

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

**Business impact:**
- **User problem reduced:** None yet — PR4 has not been executed.
- **Risk still remaining:** Two fully-built booking backends (`marketplace-bookings.ts`, `super-app-bookings.ts`) exist with zero production consumers. Every month they are not removed or wired adds dead code maintenance cost and the risk someone accidentally activates them without a frontend.
- **Not solved yet:** The decision gate (check write volume in production logs) has not been run. Until that check proves zero writes, neither the removal nor the activation path can proceed safely.

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

**Business impact:**
- **User problem reduced:** Cloud Run deployments were generating error-level log noise from HubSpot and Spotify token failures on every startup and on every request that touched those integrations. DevOps and on-call engineers were investigating these as crashes when they were actually expected gaps. Alert fatigue was masking real problems. After PR5, Cloud Run startup is clean — two predictable `DEGRADED` warn lines, no error noise.
- **Risk still remaining:** HubSpot CRM contacts are not created or updated from Cloud Run. Any user who registers, joins loyalty, or triggers a tracked event on the Cloud Run deployment will not appear in HubSpot until either a Replit sync or a long-lived HubSpot token is provisioned. This is a CRM data gap, not a product gap.
- **Not solved yet:** This PR creates a safe degraded mode — it is not a fix. HubSpot and Spotify will never work on Cloud Run without a proper long-lived token solution. The runbook (`CLOUD_RUN_DEGRADED_MODE_RUNBOOK.md`) describes the recovery path when a permanent solution is ready.

---

## PR 6 — Popup / Consent Suppression

**Root cause:** `PromoAdPopup` fired on `/consent-onboarding` and `/notification-consent`, interrupting the post-signup consent flow chain.

**Business impact:**
- **User problem reduced:** New users going through the required post-signup consent screens (notification permissions, terms) were hit with marketing popups mid-flow. This caused some users to abandon consent, skip required steps, or complete them out of sequence. After PR6, the consent flow runs uninterrupted on these paths.
- **Risk still remaining:** Four dead popup components (`KenzoWelcomePopup`, `LoyaltyWelcomeModal`, `VIPLoyaltyPopup`, `TierUpgradeModal`) remain in the codebase. They can be imported and activated by mistake in a future feature branch.
- **Not solved yet:** The 30-day zero-use verification window has not completed. Cleanup PR to delete the four components has not been executed.

---

## PR 7 — Provider Deprecation

**Root cause:** Two competing provider application submit endpoints existed: `/api/provider-onboarding/apply` (canonical) and `/api/provider-applications` (deprecated).

**Business impact:**
- **User problem reduced:** Providers submitting applications via the deprecated endpoint received a response, but their application data was routed to a different table or code path than the canonical one. This created split application state and inconsistent review flows. The deprecated endpoint now returns RFC 8594 deprecation headers and logs all calls, making the problem visible.
- **Risk still remaining:** The deprecated endpoint is still live and still processes requests. If any mobile app version, third-party integration, or old link is still calling it, data continues to split. Zero-caller proof has not yet been achieved.
- **Not solved yet:** The deprecated endpoint has not been removed. Removal requires 30 days of zero caller logs. That window is currently running.

---

## PR 8 — Loyalty Flow Isolation

**Root cause:** Investigation confirmed no cross-contamination in loyalty enrollment. Prestige join is atomic. No wrong-price bug.

**Business impact:**
- **User problem reduced:** The investigation confirmed that loyalty enrollment is not broken. Users joining prestige correctly receive the expected tier and benefits. No incorrect charges were found (enrollment is free).
- **Risk still remaining:** Dead loyalty modal components remain in the codebase and can confuse future developers or be accidentally re-activated.
- **Not solved yet:** Loyalty does not send an email confirmation on join. Notifications rely on Firestore client-side reads, not push or email. This is a known gap documented in MESSAGING_ACCEPTANCE_MATRIX.md. Cleanup PR for dead modals has not been executed.

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

## Deliverables Completed

| Deliverable | File | Session | Status |
|---|---|---|---|
| PR2 event-by-event proof | `docs/architecture/MESSAGING_ACCEPTANCE_MATRIX.md` | 2 | ✅ Created |
| PR3 frontend migration plan | `docs/architecture/IDENTITY_TRUTH_MAP.md` — Stage 2 section | 2 | ✅ Added |
| PR5 operations runbook | `docs/architecture/CLOUD_RUN_DEGRADED_MODE_RUNBOOK.md` | 2 | ✅ Created |
| Scoreboard PR2/PR3/PR5 marked done | This file | 2 | ✅ Updated |
| Business impact notes — all 8 PRs | This file — each PR section | 3 | ✅ Added |
| Mandatory 6-point PR checklist template | `.github/PULL_REQUEST_TEMPLATE.md` | 4 | ✅ Created |
| PR review standard reference document | `docs/architecture/PR_REVIEW_STANDARD.md` | 4 | ✅ Created |
| Enforcement/rejection rules — PR standard | `docs/architecture/PR_REVIEW_STANDARD.md` — Enforcement section | 5 | ✅ Added |
| Rejection reminder block — PR template | `.github/PULL_REQUEST_TEMPLATE.md` — top of file | 5 | ✅ Added |

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

# EXECUTION_SCOREBOARD.md
> Branch: copilot/fix-loyalty-flow-issues (HEAD: c34bbe6f)  
> Last updated: 2026-04-17  
> Source documents: BOOKING_VERIFICATION_MATRIX.md, MESSAGING_TRUTH_MAP.md, DATA_TRUTH_MASTER.md, AUTH_ROLE_TRUTH_MAP.md, INTEGRATION_HEALTH_MASTER.md, POPUP_CONSENT_MAP.md, PROVIDER_DEPRECATION_PLAN.md, LOYALTY_TRUTH_MAP.md

---

## PR Scoreboard

| # | Domain | Root Cause Proven | Fix PR | Telemetry Added | Acceptance Passed | Safe to Deprecate | Next Step |
|---|---|---|---|---|---|---|---|
| 1 | Booking Read Truth | ✅ YES — walk/sitter/trainer bookings written to separate Postgres tables, customer history only read `booking_requests` | ✅ Stage B (commit 2332da16) | ✅ `[BOOKING_UNIFIED_READ]`, `[BOOKING_WRITE]`, `[BOOKING_MISMATCH_REPAIRED]` | ⚠️ PENDING — telemetry must show non-zero `previouslyMissing` counts across 30 days | ❌ Not yet | Monitor `[BOOKING_UNIFIED_READ]` logs; then Stage C: expose marketplace `bookings` table |
| 2 | Messaging Deduplication | ✅ YES — `booking_requests` creation fires two overlapping dispatchers: `dispatchNotification` (direct) + `eventPublisher.publishEvent(BOOKING_CREATED)` → `NotificationService` | ✅ Partial (commit c34bbe6f adds owner notification; dedup fix pending) | ✅ `[BOOKING_WRITE] walk`, `[BOOKING_WRITE] sitter` (new) | ❌ NOT PASSED — duplicate send on booking_request creation still live | ❌ Not yet | Remove direct `dispatchNotification` call at booking-requests.ts:413; keep event path only |
| 3 | Identity Truth Repair | ✅ YES — `users` and `customers` both store email, loyaltyTier, totalSpent, washBalance, loyaltyPoints with independent write paths | ❌ Not yet | ❌ Not yet | ❌ NOT PASSED | ❌ Not yet | Map all `customers` writes → redirect to `users`; mark `customers` as read-only derived |
| 4 | Marketplace Booking Wire-Up | ✅ YES — 0% wired: `marketplace-bookings.ts` + `super-app-bookings.ts` exist with full CRUD, zero frontend consumers | ❌ Not yet | ❌ Not yet | ❌ NOT PASSED | ❌ Not yet | Decision gate: check write volume in production logs; if zero → formal deprecation PR; if non-zero → minimal activation PR |
| 5 | Cloud Run Crash-Proof Init | ✅ YES — HubSpot and Spotify use Replit-only OAuth (`X_REPLIT_TOKEN`) and crash on Cloud Run startup; Gemini has zero startup validation | ❌ Not yet | ❌ Not yet | ❌ NOT PASSED | ❌ Not yet | Gate HubSpot + Spotify behind `IS_REPLIT` env check; add Gemini degraded-mode log |
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

## PR 2 — Messaging Deduplication (PENDING)

**Root cause:** `booking_requests` creation (booking-requests.ts:388 + :413) fires two separate notification paths:
1. `eventPublisher.publishEvent('BOOKING_CREATED')` → `NotificationEventHandlers.ts:467` → `NotificationService.sendNotification()`
2. Direct `dispatchNotification()` call at booking-requests.ts:413

Result: provider receives in_app × 2 + email + SMS + push = 5 notification events for 1 booking.

**Fix required:**
- Remove booking-requests.ts:413-427 (direct `dispatchNotification` call)
- Keep the event-driven path (line 388) as the single canonical path
- Add `idempotencyKey` to event payload to prevent duplicate delivery on retry

**Files to change:** `server/routes/booking-requests.ts`

**What must NOT change:** The event bus path, NotificationEventHandlers.ts, the PetWashNotificationEngine retry logic.

---

## PR 3 — Identity Truth Repair (PENDING)

**Root cause:** `users` (schema.ts:35) and `customers` (schema.ts:339) both store: email, loyaltyTier, totalSpent, washBalance, loyaltyPoints, phone. Any endpoint that updates one table but not the other silently diverges.

**Fix required (reads first, no migration):**
1. Audit all `customers` table write endpoints — flag any that don't also write `users`
2. Add `[IDENTITY_SPLIT_WRITE]` telemetry log on any endpoint that writes `customers` without `users`
3. Create `GET /api/auth/identity` single canonical profile reader (accepts bearer or session cookie)

**What must NOT change:** No DROP or ALTER TABLE. No data migration. Existing `customers` reads untouched.

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

## PR 5 — Cloud Run Crash-Proof Init (PENDING)

**Root cause:**
- `server/hubspot.ts`: calls `X_REPLIT_TOKEN` on module load → `ReferenceError` on Cloud Run startup
- `server/routes/spotify.ts`: same pattern
- `server/lib/gemini-client.ts`: no startup validation; first AI feature call fails silently with no log

**Fix required:**
```typescript
// hubspot.ts — wrap in env check
if (!process.env.REPL_ID) {
  logger.warn('[HubSpot] Replit-only integration — skipping init (not Replit env)');
  return;
}

// gemini-client.ts — add degraded mode log
if (!geminiKey) {
  logger.warn('[DEGRADED_MODE] Gemini AI key missing — all AI features disabled');
}
```

**Files to change:** `server/hubspot.ts`, `server/routes/spotify.ts`, `server/lib/gemini-client.ts`

**Acceptance criteria:** `docker run` (simulating Cloud Run) binds port within 10s; startup health returns 200; HubSpot/Spotify log `[SKIPPED]` not `[ERROR]`.

**What must NOT change:** HubSpot and Spotify functionality on Replit (gated, not removed).

---

## Execution Order (per problem statement rules)

1. ✅ **Observability and truth** — BOOKING_VERIFICATION_MATRIX.md + 7 other truth maps (done)
2. ✅ **Unified reads** — Stage B booking read unification (done)
3. ⏳ **Verification** — Monitor telemetry for 30 days before next step
4. ⏳ **Deduplication** — PR 2 (messaging), PR 3 (identity reads)
5. ⏳ **Deprecation with telemetry** — provider-applications after 30-day zero-caller proof
6. ❌ **Removal after proof** — Not yet
7. ❌ **Migrations or deeper consolidation** — Not yet

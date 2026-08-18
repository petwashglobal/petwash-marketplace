# Open PR / Branch Dependency Map — 2026-08-18

Supersedes the 2026-08-17 draft on branch `claude/pr-dependency-map`. Adds today's ProviderToday work, corrects the PR #1870 vs §§6-7 mislabel confirmed by branch reconciliation, and lists the new stacked branches so the CEO knows the required merge order.

Older `claude/pr-*` branches (danger series, egift copy series, loyalty copy series, P0-14x series, etc.) are omitted — those are separate merge lanes with their own history documented in prior maps.

## CRITICAL — Do not confuse PR #1870 with §§6-7

Branch reconciliation ran 2026-08-18 confirmed:

| Item | Fact |
|---|---|
| PR #1870 head branch | `sprint/auth-identity-change` @ `bbe97040d` — **1 commit** |
| PR #1870 actual scope | pin-auth hardening ONLY — `pin-auth.ts`, `pinAuthIdentity.regression.test.ts`, `Settings.tsx`, `PinKeypad.tsx` |
| PR #1870 body | Advertises "Email change (in progress) / Mobile change (in progress)" — **aspirational only, the diff has neither** |
| PR-AUTH-SECURITY-9 §§6-7 (email/mobile change) authoritative branch | `claude/pr-auth-security-9` @ `f485b8e20` — the ONLY branch in the repo shipping `auth-change-email.ts`, `auth-change-mobile.ts`, `ChangeEmailPanel.tsx`, `ChangeMobilePanel.tsx`, `AuthChangeEmailConfirm.tsx`, and migration `0116_email_mobile_change_requests.sql` |
| Overlap / conflict between #1870 and pr-auth-security-9 | **None** — #1870 edits `pages/Settings.tsx`; §§6-7 edits `pages/SecuritySettings.tsx` (different file). No shared file. |
| Recommendation | Land #1870 for pin-auth OR amend its description to drop the misleading email/mobile bullets. §§6-7 needs a separate PR opened from `claude/pr-auth-security-9` — none currently exists. |

## Merge-order recommendation (safe → dependent)

### Wave 1 — SAFE (no dependencies, no shared file conflicts expected)

| Branch | Files | Sensitivity | Notes |
|---|---|---|---|
| `claude/pr-legal-cookies` | 1 (client/src/pages/legal/Cookies.tsx) | UI wiring | LANE F spec |
| `claude/pr-drawer-franchise-referral` | 2 (App.tsx, PetWashHeader.tsx) | UI wiring | none |
| `claude/pr-provider-pending-flow` | 2 (ProviderPending.tsx, provider-applications.ts) | contract normalization | LANE C spec |
| `claude/pr-provider-pending-contrast` | 1 (ProviderPending.tsx) | CSS-only | LANE C spec asserts contrast > 1.15 |
| `claude/pr-account-activation-sms-canonical` | 1 (AccountActivation.tsx) | auth-code (client-side URL swap) | LANE F spec |
| `claude/pr-company-cta` | 3 (Municipal, Locations, PartnershipEnquiryDialog) | UI wiring → /api/contact | LANE F spec |
| `claude/pr-admin-client-contracts` | 4 (AdminUsers, AdminWalletDashboard, MarketplaceIntelligenceDashboard, audit doc) | false-success → real error | none yet |
| **`claude/pr-tsc-clean-language-props`** *(new 2026-08-18)* | 1 (client/src/App.tsx) | 2-line dead-prop strip; unblocks project-wide tsc | none needed |

### Wave 2 — SECURITY (money/auth code — merge after Wave 1, verify tests)

| Branch | Files | Sensitivity | Notes |
|---|---|---|---|
| `claude/pr-nav-header-hygiene` | 1 (PetWashHeader.tsx) | UI cleanup | LANE F spec |
| `claude/pr-admin-auth-gaps` | 2 (adminAuth.ts, rbac.ts) | AUTH POLICY | LANE F test proves 3 CVE cases fail on origin/main and pass on merge |
| `claude/pr-prestige-sse-bearer` | 2 (prestige-pass.ts, PrestigePassWallet.tsx) | AUTH POLICY (SSE session-cookie only, P0 patched) | LANE F spec |
| `claude/pr-ws-match-auth` | 1 (matching-ws.ts) | AUTH POLICY (WS verifyClient, P0) | TBD |
| **`claude/pr-provider-today-server-gate`** *(new 2026-08-18)* | 1 (server/routes.ts) | AUTH POLICY (requireProviderActive on /api/provider-dashboard/v2 mount) | needed — behavioral test TBD |

### Wave 3 — MONEY (per LANE B — merge only after CEO sign-off + concurrency-test rerun)

| Branch | Files | Sensitivity | Notes |
|---|---|---|---|
| `claude/lane-b-confirm-refund-writers` | 5 (bookingMutationLock.ts NEW, WalletService, BookingLifecycleService, prestige-pass.ts, sitter-suite.ts, walk-my-pet.ts) | MONEY / RACE | 30/30 grep-pin regression tests pass; live DB race tests need CI Postgres fixture with btree_gist |
| `claude/pr-billing-refund-idempotent` | 1 (server/routes/billing.ts) | MONEY — pg_advisory_xact_lock on refund | need behavioral test |
| `claude/pr-bookings-confirm-firestore-txn` | 1 (server/routes/bookings.ts) | MONEY — Firestore txn on confirm | need behavioral test |
| `claude/pr-booking-expiry-atomic-transition` | 1 (server/jobs/booking-expiry.ts) | MONEY — conditional UPDATE WHERE status | need behavioral test |

### Wave 4 — LARGE AUTH

| Branch | Files | Sensitivity | Notes |
|---|---|---|---|
| `claude/pr-auth-security-9` | ~15 files (Remember-me, WICG autocomplete, PIN identity, Security status page, Passkey, Change password, **§§6-7 Email/Mobile change**, Logout hardening) | AUTH POLICY | 4 integration specs; **THIS is the branch that contains the real email/mobile change work — NOT PR #1870** |

### Wave 5 — PROVIDER TODAY UX (stacked)

| Branch | Files | Sensitivity | Stack |
|---|---|---|---|
| `claude/pr-provider-today-dashboard` | 2 (App.tsx, pages/ProviderToday.tsx NEW ~399 LOC) | UI — new `/provider/today` route | **base** — merge first |
| `claude/pr-provider-today-meet-greet` | 2 (pages/ProviderToday.tsx, server/routes/provider-dashboard-v2.ts) | UI + server DTO widening — meet-greet-aware CTA + /upcoming SQL widens to include `meet_greet_scheduled` | **stacked on** `claude/pr-provider-today-dashboard` — merge SECOND |

**Merge order for Wave 5 is enforced by stacking**: `claude/pr-provider-today-meet-greet` was branched from `claude/pr-provider-today-dashboard`, not main. Landing it directly against main without the base first would put the file additions in the wrong order but the diff would still apply cleanly since the base is additive-only. Safer to merge in order.

### Wave 6 — DOCS / MAPS

| Branch | Files | Notes |
|---|---|---|
| `claude/pr-dependency-map` (2026-08-17 draft) | 1 (`docs/audit/OPEN-PR-DEPENDENCY-MAP.md`) | **Superseded by this file** — CLOSE without merging or accept this file's version on conflict |
| (this branch) | 1 (same path) | current authoritative map |

### Test-only

| Branch | Purpose |
|---|---|
| `claude/lane-c-provider-pending-e2e` | E2E for `claude/pr-provider-pending-flow` — merge together |
| `claude/lane-f-playwright-shipped-prs` | Per-PR coverage for Waves 1+2 above — merge after those |

### Audit-only (never merged — reference docs)

| Branch | Content |
|---|---|
| `claude/lane-d-hamburger-audit` | Full hamburger sweep audit |
| `claude/lane-e-contract-audit` | Client↔server contract rescan report |

## Conflict / supersession risks

### File `client/src/components/PetWashHeader.tsx`
Touched by 3 branches: `claude/pr-nav-header-hygiene`, `claude/pr-drawer-franchise-referral`, `claude/pr-auth-security-9`. **Conflict likely** — resolve in order nav-hygiene → drawer-franchise → auth-security-9.

### File `server/routes/prestige-pass.ts`
Touched by 2 branches: `claude/pr-prestige-sse-bearer` and `claude/lane-b-confirm-refund-writers`. Different sections (SSE handler at ~line 2160 vs admin refund handler further down). Should merge cleanly.

### File `client/src/App.tsx`
Touched by 4 branches this map covers: `claude/pr-drawer-franchise-referral`, `claude/pr-auth-security-9`, `claude/pr-provider-today-dashboard`, `claude/pr-tsc-clean-language-props`. Each touches a different section (drawer routes vs auth routes vs new ProviderToday route vs 2 unrelated legacy prop drops on lines 1906/2264). Manual rebase should resolve cleanly.

### File `client/src/pages/ProviderToday.tsx`
Touched by 2 branches, one stacks on the other: `claude/pr-provider-today-dashboard` creates it; `claude/pr-provider-today-meet-greet` extends `resolvePrimary()`, `FocusCard`, `NextRow`. Merge base first, or the second PR's diff won't cleanly apply against main.

### File `server/routes/provider-dashboard-v2.ts`
Touched by `claude/pr-provider-today-meet-greet` (widens /upcoming SQL + adds meetGreetDate to toV1Shape). No other sprint branch modifies this file.

### File `server/routes.ts`
Touched by `claude/pr-provider-today-server-gate` (adds `requireProviderActive` middleware at v2 mount around line 12769). Small diff, low conflict surface. If `claude/pr-auth-security-9` adds route mounts elsewhere they should not collide.

### File `client/src/pages/SecuritySettings.tsx` vs `client/src/pages/Settings.tsx`
Two different files — see PR #1870 vs pr-auth-security-9 clarification at top. No overlap.

## Do-NOT-merge until CEO decision

- **`claude/lane-b-confirm-refund-writers`** — money code. LANE B's audit doc has per-fix money-invariance proof, but CEO must approve before merge.
- **`claude/pr-billing-refund-idempotent` / `claude/pr-bookings-confirm-firestore-txn` / `claude/pr-booking-expiry-atomic-transition`** — same "money code" gate.
- **All Wave 5 (Provider Today) branches** — CEO ordered "NO MERGES" during current sprint.
- **`claude/pr-auth-security-9`** — CEO to review integration surface (13 files, migration 0116).

## Superseded / close-without-merging

| Branch | Superseded by | Why |
|---|---|---|
| `claude/pr-dependency-map` (2026-08-17 draft) | this file | Stale — missing today's ProviderToday work, missing §§6-7 clarification, missing today's server-gate PR |

None of the other listed branches supersede each other. Every branch closes its own distinct set of defects.

## Coordinator's own in-thread contributions (2026-08-17..18)

- `claude/pr-admin-client-contracts` — 6 of 9 LANE E defects fixed, 2 rejected as false positive, 1 filed NEEDS-DESIGN
- `claude/pr-provider-pending-contrast` — WCAG AA compliance for progress bar (LANE C follow-up)
- `claude/pr-provider-today-dashboard` — `/provider/today` focus surface (WhatIDog benchmark)
- `claude/pr-provider-today-meet-greet` — meet-greet-aware CTA on ProviderToday (+ /upcoming widened for `meet_greet_scheduled` bookings)
- `claude/pr-tsc-clean-language-props` — 2 legacy TS2322 errors on App.tsx cleared
- `claude/pr-provider-today-server-gate` — `requireProviderActive` at `/api/provider-dashboard/v2` mount (CEO §2 — RequireAuth alone is not enough)
- This doc — `docs/audit/OPEN-PR-DEPENDENCY-MAP.md`

## Deferred / still-open work (from prior sprints)

Continues from the 2026-08-17 map — subagents killed by rate-limit before pushing during Round 3. Reschedule after session limits reset. Newly-added items from CEO 2026-08-18 super-app directive tracked in `docs/architecture/2026-08-18-master-product-architecture.md`.

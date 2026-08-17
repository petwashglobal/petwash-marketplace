# Open PR Dependency Map — 2026-08-17

Focused on branches shipped in the 2026-08-15 → 2026-08-17 CEO fire-order sprint. Older `claude/pr-*` branches (danger series, egift copy series, loyalty copy series, P0-14x series, etc.) are omitted from this map — those are separate merge lanes with their own history.

## Merge-order recommendation (safe → dependent)

Merge in this order to minimize conflicts.

### Wave 1 — SAFE (no dependencies, no shared file conflicts expected)

| Branch | Files | Sensitivity | Tests |
|---|---|---|---|
| `claude/pr-legal-cookies` | 1 (client/src/pages/legal/Cookies.tsx) | UI wiring | LANE F spec |
| `claude/pr-drawer-franchise-referral` | 2 (App.tsx, PetWashHeader.tsx) | UI wiring | none |
| `claude/pr-provider-pending-flow` | 2 (ProviderPending.tsx, provider-applications.ts) | contract normalization | LANE C spec |
| `claude/pr-provider-pending-contrast` | 1 (ProviderPending.tsx) | CSS-only | LANE C spec asserts contrast > 1.15 |
| `claude/pr-account-activation-sms-canonical` | 1 (AccountActivation.tsx) | auth-code (client-side URL swap) | LANE F spec (URL invariants) |
| `claude/pr-company-cta` | 3 (Municipal, Locations, PartnershipEnquiryDialog) | UI wiring → /api/contact | LANE F spec |
| `claude/pr-admin-client-contracts` | 4 (AdminUsers, AdminWalletDashboard, MarketplaceIntelligenceDashboard, audit doc) | false-success → real error | none yet |

### Wave 2 — SECURITY (money/auth code — merge after Wave 1, verify tests)

| Branch | Files | Sensitivity | Tests |
|---|---|---|---|
| `claude/pr-nav-header-hygiene` | 1 (PetWashHeader.tsx) | UI cleanup | LANE F spec |
| `claude/pr-admin-auth-gaps` | 2 (adminAuth.ts, rbac.ts) | AUTH POLICY | LANE F integration test proves 3 CVE cases fail on origin/main and pass on merge |
| `claude/pr-prestige-sse-bearer` | 2 (prestige-pass.ts, PrestigePassWallet.tsx) | AUTH POLICY (SSE session-cookie only, P0 patched) | LANE F spec |
| `claude/pr-ws-match-auth` | 1 (matching-ws.ts) | AUTH POLICY (WS verifyClient, P0) | needed — no behavioral coverage yet, TBD |

### Wave 3 — MONEY (per LANE B — merge only after CEO sign-off + concurrency-test rerun)

| Branch | Files | Sensitivity | Tests |
|---|---|---|---|
| `claude/lane-b-confirm-refund-writers` | 5 (bookingMutationLock.ts NEW, WalletService, BookingLifecycleService, prestige-pass.ts, sitter-suite.ts, walk-my-pet.ts) | MONEY / RACE | 30/30 grep-pin regression tests pass; live DB race tests need CI Postgres fixture with btree_gist |

### Wave 4 — LARGE AUTH (multi-commit, coordinate with Wave 2)

| Branch | Files | Sensitivity | Tests |
|---|---|---|---|
| `claude/pr-auth-security-9` | 13 files (see LANE A report) | AUTH POLICY (Remember-me, Security status, PIN, Passkey, Logout) | 4 integration specs |

### Test-only (merge whenever, or bundle with feature PRs they cover)

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
Touched by 3 branches:
- `claude/pr-nav-header-hygiene` — dead-code purge + logout debounce + return-to
- `claude/pr-drawer-franchise-referral` — repoints Franchise href
- `claude/pr-auth-security-9` — logout hardening (uses closeAllEventSources + full cache clear)

**Conflict likely** — resolve in order nav-hygiene → drawer-franchise → auth-security-9. All three add distinct changes; a manual rebase of drawer + security onto hygiene should merge cleanly.

### File `client/src/pages/AdminWalletDashboard.tsx`
Touched by 1 branch this sprint (`claude/pr-admin-client-contracts`). No conflict expected.

### File `server/routes/prestige-pass.ts`
Touched by 2 branches:
- `claude/pr-prestige-sse-bearer` — SSE handler
- `claude/lane-b-confirm-refund-writers` — /admin/wallet/refund lock wrap

Different sections of the file (SSE handler at ~line 2160 vs admin refund handler further down). Should merge cleanly but eyeball on conflict prompt.

### File `server/routes/pin-auth.ts`
Touched by `claude/pr-auth-security-9` (full rewrite, 993→530 lines). If any other branch adds PIN logic, expect large conflict; nothing in this sprint touches it.

### File `client/src/pages/SignUpLuxury.tsx`
Touched by `claude/pr-auth-security-9` (autocomplete audit changes). No other sprint branch touches this file.

### File `server/adminAuth.ts` and `server/middleware/rbac.ts`
Touched by `claude/pr-admin-auth-gaps`. No conflict from other sprint branches.

## Supersession

None — every sprint branch closes its own distinct set of defects. The old audit-only branches from prior sprints (`claude/pr-p0-141-atomic-idempotency` etc.) are NOT superseded by anything in this sprint; they remain their own separate merge lanes.

## Do-not-merge until CEO decision

- **`claude/lane-b-confirm-refund-writers`** — money code. LANE B's audit doc has per-fix money-invariance proof, but CEO must approve before merge.
- **§6/§7 of `claude/pr-auth-security-9`** — email/mobile change flows deferred to CEO design decision (~1200 LOC + 2 new migrations). Not on this branch — see `docs/audit/PR-AUTH-SECURITY-9-NEEDS-CEO-DESIGN.md`.
- **Anything shipped by rate-limited-killed agents in this sprint's Round 3** — 12 subagents launched with isolated worktrees all failed to push (session limit + container restart wiped worktrees). Nothing to merge.

## Deferred / still-open work

- **AGENT 1** (email/mobile change) — killed by rate limit before pushing. Reschedule after 5:30am UTC.
- **AGENT 2** (admin client contracts) — killed before pushing. This coordinator shipped the equivalent in-thread as `claude/pr-admin-client-contracts`.
- **AGENT 3** (money concurrency remaining) — killed. LANE B's PLAUSIBLE-VERIFY items (billing.ts /refund, bookings.ts:500 Firestore confirm, booking-expiry cron) still open.
- **AGENT 4** (booking journey E2E) — killed before writing specs.
- **AGENT 5** (provider full journey beyond pending) — killed. Contrast fix shipped in-thread as `claude/pr-provider-pending-contrast`.
- **AGENT 6** (customer/hub/pets) — killed.
- **AGENT 7** (Prestige/eGift/SUMIT customer UX) — killed.
- **AGENT 8** (stations/K9000/QR) — killed.
- **AGENT 9** (hamburger continuation) — killed after starting on Media.tsx download-kit relabel.
- **AGENT 10** (realtime security behavioral tests) — killed before writing inventory.
- **AGENT 11** (improved contract scanner) — killed before starting.
- **AGENT 12** (Playwright personas) — killed before fixtures.
- **AGENT 13** (mobile/RTL/a11y) — never launched (disk full at spawn).
- **AGENT 14** (privacy/logging sweep) — never launched.
- **AGENT 15** (uploads/SSRF/open-redirect) — never launched.

## Coordinator's own in-thread contributions (Round 3)

- `claude/pr-admin-client-contracts` — 6 of 9 LANE E defects fixed, 2 rejected as false positive, 1 filed NEEDS-DESIGN
- `claude/pr-provider-pending-contrast` — WCAG AA compliance for progress bar (LANE C follow-up)
- This doc — `docs/audit/OPEN-PR-DEPENDENCY-MAP.md`

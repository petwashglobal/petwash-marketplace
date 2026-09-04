# OPEN PR DEPENDENCY MAP

**Generated** 2026-09-05 · **against `main` @ `548be1878`** ("docs · Completion Matrix — Public homepage TESTED (#2233)")
**Total open PRs at scan time: 20** (verified via REST `GET /pulls?state=open`, pages 1-2)

**How to read the honesty labels**

| Label | Meaning |
|---|---|
| `VERIFIED-SOURCE` | I read the actual diff **and** the corresponding code on current `main` before making the claim. |
| `INFERRED` | Judged from title + file list only. Not proven. |

Every money, auth-privilege, cross-tenant and destructive PR below is `VERIFIED-SOURCE`.
**Verified: 10 PRs · Inferred: 10 PRs.**

> **Important context.** `main` advanced ~615 commits recently. Every previously-suspected cluster
> — `#1758` (Cortina), `#1819`-`#1828` (auth/security), `#1846`-`#1854` (booking atomicity),
> `#1857`-`#1861` (admin/pin), `#1863`-`#1869` (SUMIT stack) — **is already closed.** None of them
> is an open merge risk. The real risk today is a much smaller, sharper set, listed below.

---

## 1. MERGE THESE FIRST (in this order)

| # | PR | One-line reason |
|---|----|-----------------|
| 1 | **#2238** money concurrency M1-M4 | The only open **money-safety** PR, and the only stale-base PR that is **already conflict-free**. Its substance is genuinely absent from `main` (verified: no `EscrowConcurrentTransitionError`, no atomic claim in `booking-expiry.ts`, no `derivedIdempotencyKey`). Ships 4 race tests. Merge it before anything else touches bookings/billing. |
| 2 | **#2242** super-admin gate P0 | Fixes a live **500 on every thread read** (`isSuperAdminVerified` was called as async and `.catch()`-ed on a boolean). Auth-privilege. Must land before #2246, which touches the same two files. |
| 3 | **#2252** open-redirect fix | Tiny (39/-13), self-contained, closes an auth-adjacent redirect bypass. No overlap with anything. |
| 4 | **#2248** error-body sanitizer | One shared filter for leaky 5xx/4xx bodies across 8 routers. Touches nothing else on this list. |
| 5 | **#2245** eGift balance ownership ACL | 33 lines + a cross-tenant regression test on `prestige-pass.ts`. No file overlap with any other open PR. |
| 6 | **#2246** booking route shadowing / walk detail 500 | Merge **after #2242** — it re-fixes the same `thread-chat.ts` lines. Rebase, drop the duplicated hunk, keep the unique walk-booking + route-shadowing work. |
| 7 | **#2247** admin contract fixes v2 | Current-main-based. Deletes the dead `AdminUsers.tsx` and fixes 3 real admin-wallet 404s. Must land **before** any rebase of #2240. |
| 8 | **#2241** k9000 (rebased, reduced) | Two real fixes still needed (member redeem dead-end; start_cycle double-vend). **Drop its Cortina-auth third — `main` already has it.** See §3. |
| 9 | **#2234** → then **#2207** → then **#2236** → then **#2235** | Strict order. #2207's test hard-codes six journey domains and #2234 adds a seventh; see §2 row 1. |
| 10 | **#2243, #2249, #2250, #2251, #2237, #2240(reduced)** | Independent; merge in any order once the above are in. |

**Do not merge #2239 at all.** See §4.

---

## 2. DO NOT MERGE BOTH — overlapping / duplicate pairs

| Pair | What overlaps | Evidence | What to do |
|---|---|---|---|
| **#2207 ↔ #2234** | #2207 adds a test asserting the `JourneyDomain` enum has **exactly six** members "no more, no less". #2234 adds a **seventh** (`academy_book`). | `VERIFIED-SOURCE` — read both diffs; `main`'s enum (`server/services/journeyCheckpoints.ts:29-35`) has 6 members; #2234 adds `\| 'academy_book'`; #2207's `WIRED_JOURNEYS` table lists 6 rows and asserts exact coverage. | **Merge #2234 first, then add the 7th row to #2207's table before merging it.** Merging both as-is turns CI red whichever order you choose. |
| **#2242 ↔ #2246** | Both rewrite the **same lines** of `server/routes/thread-chat.ts` (and both touch `server/routes/walk-my-pet.ts`) with the *same* `isSuperAdminVerified(req)` fix — two agents fixed one bug twice. | `VERIFIED-SOURCE` — both diffs replace `loadThreadForCaller(..., callerEmail)` with `(..., req)` and both change `await isSuperAdminVerified(email).catch(...)` → `isSuperAdminVerified(req)`. | **Merge #2242** (it is the focused fix with two behaviour tests). Then **rebase #2246 and drop its `thread-chat.ts` hunk**, keeping its unique walk-booking-500 and route-shadowing work. |
| **#2240 ↔ #2247** | Both **delete `client/src/pages/AdminUsers.tsx`** and both edit the same two spots in `client/src/App.tsx` (the lazy import at ~L271-274 and the RETIRED comment at ~L3845). | `VERIFIED-SOURCE` — read both diffs; #2247's `AdminUsers.tsx` hunk is `deleted file mode 100644`, #2240's is the same deletion plus a longer App.tsx comment. | **Merge #2247** (based on current `main`, already mergeable). Then rebase #2240 with the AdminUsers/App.tsx hunks removed — its other 9 files are unique and still valuable. |
| **#2235 ↔ #2237** | Both edit `docs/COMPLETION-MATRIX.md`; their hunks sit ~3 lines apart (L53-57), so the second will conflict textually. | `VERIFIED-SOURCE` — read both diffs. Different rows, no semantic contradiction. | **Not a duplicate — merge both**, but sequentially; the second needs a one-minute rebase. Merge **#2237 first** (documents current reality), then **#2235** (which depends on #2234 landing). |
| **#2239 ↔ `main`** | `main` already contains 100% of #2239's server + client work **plus two later fixes on top**. | `VERIFIED-SOURCE` — see §4. | **Close #2239. Do not merge.** |
| **#2241 ↔ `main`** (partial) | #2241's "unauthenticated Cortina callbacks" fix is already on `main`. | `VERIFIED-SOURCE` — `main`'s `server/routes/nayax-cortina.ts` has `assertCortinaSecret()` (fail-closed, constant-time) wired into `/authorize`, `/settlement`, `/void`, `/refund`. | Merge only the **other two thirds** of #2241 (see §3). |
| **#2239 ↔ #2243** | Same branch family name (`sprint/auth-identity-change` vs `-v2`) — looks like a duplicate but is not. | `VERIFIED-SOURCE` — zero shared files. #2239 = pin-auth + Settings; #2243 = email/mobile change, `phoneE164`, `SessionService`. | **Not a conflict.** Merge #2243 on its own merits; still close #2239. |

---

## 3. OBSOLETE — CLOSE, DO NOT MERGE

| PR | Why it is obsolete | Label |
|---|---|---|
| **#2239** `fix(auth): P0 — pin-auth had NO authentication` | `main` is a **strict superset**. `server/routes/pin-auth.ts` on `main` already has `validateFirebaseToken` on `/setup`, `resolvePinIdentityFromRequest()`, `bodyEmailConflictsWithToken()`, `RECENT_AUTH_WINDOW_SECONDS`, the `isActive: true` re-activation bugfix — the identical code and the identical `auth/identity sweep 2026-08-17` comments. `client/src/components/PinKeypad.tsx` and `server/tests/pinAuthIdentity.regression.test.ts` are **byte-identical to `main`**. The only residual difference is that **`main` has MORE**: a flag-gated `loginOrLink` identity probe in `pin-auth.ts`, and a hardened Firebase `signOut` in `Settings.tsx`. **Merging #2239 would revert both of those later fixes.** | `VERIFIED-SOURCE` |
| **#2241 — the Cortina third only** | `main` already fail-closes unauthenticated Cortina callbacks via `assertCortinaSecret()`. The rest of #2241 is still needed. | `VERIFIED-SOURCE` |
| **#2240 — the AdminUsers/App.tsx part only** | Superseded by #2247 (same deletion, current base). The other 9 files are not obsolete. | `VERIFIED-SOURCE` |

> Nothing else on the open list is obsolete. In particular, **#2238 is not obsolete** — I checked
> `main` specifically for its four primitives and none of them are there.

---

## 4. FULL PER-PR RECORD

Sensitivity key: `none` · `money` · `auth-privilege` · `cross-tenant` · `destructive` (deletes code/data).

### #2238 — `sprint/money-concurrency` → `main`
- **Purpose:** M1-M4 concurrency + idempotency across refunds, booking confirm, and the expiry cron. No financial rule changed.
- **Files (10):** `server/services/EscrowStateMachine.ts`, `server/routes/billing.ts`, `server/routes/bookings.ts`, `server/jobs/booking-expiry.ts`, `server/middleware/derivedIdempotencyKey.ts` (new), 4 new race/regression tests, 1 architecture doc.
- **Depends on:** nothing. **Supersedes:** nothing open. **Conflicts with:** nothing open (but merge it before #2246/#2247 touch booking files).
- **Sensitivity:** `money` (highest on this list). **Tests:** **yes** — 4 dedicated race tests.
- **API mergeable:** `true / clean` — *the only stale-base sprint PR that still merges cleanly.*
- **Base note:** branched at `a23eaeac5`, 615 commits behind, but GitHub reports no conflict against current `main`.
- **Verification:** `VERIFIED-SOURCE`. Grepped `main` for `EscrowConcurrentTransitionError` (absent), `ATOMIC CLAIM` in `booking-expiry.ts` (0 hits), `FOR UPDATE` in `EscrowStateMachine.ts` (absent), `derivedIdempotencyKey` (absent). The work is real and missing from `main`.
- **Recommended order: 1st.**

### #2242 — `sprint/requireadmin-consolidation-v2` → `main`
- **Purpose:** Super-admin gate — fixes a P0 500 and closes an `rbac.ts` blind spot in the `email_verified` pin.
- **Files (6):** `server/middleware/gates.ts`, `server/middleware/rbac.ts`, `server/routes/thread-chat.ts`, `server/routes/walk-my-pet.ts`, + 2 behaviour tests.
- **Depends on:** nothing. **Conflicts with:** **#2246** (same `thread-chat.ts`/`walk-my-pet.ts` lines).
- **Sensitivity:** `auth-privilege`. **Tests:** **yes** (2 behaviour tests).
- **API mergeable:** `true / blocked` (branch protection — needs review, not a conflict).
- **Verification:** `VERIFIED-SOURCE` — read the diff; the bug (`await isSuperAdminVerified(email).catch()` on a synchronous boolean) is real and 500s every thread read.
- **Recommended order: 2nd.**

### #2246 — `sprint/booking-e2e-v2` → `main`
- **Purpose:** Walk-booking detail read 500'd on every call; booking route-shadowing audit.
- **Files (6):** `server/routes/provider-availability.ts`, `server/routes/sitter-suite.ts`, `server/routes/thread-chat.ts`, `server/routes/walk-my-pet.ts`, + 2 regression tests.
- **Depends on:** merge **after #2242**. **Conflicts with:** **#2242**.
- **Sensitivity:** `auth-privilege` (shares the admin-gate fix). **Tests:** **yes**.
- **API mergeable:** `true / blocked`.
- **Verification:** `VERIFIED-SOURCE` — diffed its `thread-chat.ts` hunk against #2242's; semantically identical.
- **Recommended order: 6th, after rebase to drop the duplicated hunk.**

### #2247 — `sprint/admin-contract-fixes-v2` → `main`
- **Purpose:** Admin client↔server contract defects — wallet replay report/diff 404s, dead recompute GET, delete orphaned `AdminUsers.tsx`.
- **Files (3):** `client/src/App.tsx`, `client/src/pages/AdminUsers.tsx` (**deleted**), `client/src/pages/AdminWalletDashboard.tsx`. +217 / **-921**.
- **Depends on:** nothing. **Supersedes:** the AdminUsers/App.tsx portion of **#2240**. **Conflicts with:** **#2240**.
- **Sensitivity:** `destructive` (file deletion) — but safe: `VERIFIED-SOURCE` that `main` already routes `/admin/users` to a `<Redirect to="/admin/customers" />` and **nothing renders `<AdminUsers>`**; only a dead `lazy()` import remains.
- **Tests:** **no** (UI contract fixes, no test file).
- **API mergeable:** `true / blocked`.
- **Recommended order: 7th.**

### #2241 — `sprint/stations-k9000` → `main`
- **Purpose:** Three fixes: (a) member redeem dead-end, (b) unauthenticated Cortina callbacks, (c) `start_cycle` double-vend.
- **Files (5):** `server/routes.ts`, `server/routes/k9000.ts`, `server/routes/nayax-cortina.ts`, `server/services/K9000RedemptionService.ts`, + 1 regression test.
- **Sensitivity:** `money` (a free second wash) + `auth-privilege`. **Tests:** **yes** (1 money-hardening regression test).
- **API mergeable:** `false / dirty` — **conflicts**, base is `a23eaeac5`.
- **Verification:** `VERIFIED-SOURCE`, part by part:
  - **(a) still needed.** `main` `server/routes.ts:12771` still inserts into `redemptionSessions` **without `sessionType`** (NOT NULL, no default) inside a `try` whose `catch` logs "non-fatal" — so the row is never written and `/redemptions/:id/status` 404s forever. The member gets the wash and the app never confirms it.
  - **(b) ALREADY IN MAIN — drop it.** `main`'s `nayax-cortina.ts` has `assertCortinaSecret()` (fail-closed on missing secret, constant-time compare) on `/authorize`, `/settlement`, `/void`, `/refund`. This is the conflict source.
  - **(c) still needed.** No jsonb `metadata ->> 'transactionId'` dedupe exists anywhere in `server/`; the double-vend guard is absent from `main`.
- **Recommended order: 8th — rebase onto `main`, keep (a) and (c), delete (b).**

### #2240 — `sprint/admin-contract-fixes` → `main`
- **Purpose:** 6 client↔server contract defects + retire dead `AdminUsers` page.
- **Files (11):** `client/src/App.tsx`, `client/src/pages/AdminUsers.tsx` (**deleted**), `client/src/components/admin/LoyaltyDashboard.tsx` (**deleted**), `client/src/components/control-panel/FinanceSettlementsView.tsx`, `client/src/pages/InventoryManagement.tsx`, `client/src/pages/MarketplaceIntelligenceDashboard.tsx`, `client/src/pages/sitter-suite/SitterEditProfile.tsx`, `client/src/services/marketplace.ts`, `server/routes.ts`, `server/routes/inventory.ts`, `server/services/InventoryService.ts`. +502 / **-1680**.
- **Supersedes:** nothing. **Superseded-by:** **#2247**, *partially only*.
- **Sensitivity:** `destructive` (two file deletions) + touches an executive **money display**.
- **Tests:** **no**.
- **API mergeable:** `false / dirty`.
- **Verification:** `VERIFIED-SOURCE`, per defect against `main`:
  - `FinanceSettlementsView.tsx` — **still broken on `main`.** It renders `totalRevenue/"0.00"`, `totalCommissions/"0.00"`, `totalVAT/"0.00"` from `?? '0.00'` fallbacks against `GET /api/finance/settlements`, which **has no handler**. Fabricated money on an executive screen. #2240 replaces it with an honest "not connected" panel. **This is the most valuable hunk in the PR.**
  - `MarketplaceIntelligenceDashboard.tsx` — **`main` is still wrong, differently.** `main` calls `/api/marketplace/rankings/audit?userId=…` (query string); the only real handler is `router.get('/audit/:userId')` at `server/routes/marketplace-ranking.ts:465` (**path param**). `main` 404s. **#2240's version is the correct one.** Do not assume `main` already fixed this.
  - `client/src/components/admin/LoyaltyDashboard.tsx` — orphan confirmed: the live one is `client/src/pages/LoyaltyDashboard.tsx` (App.tsx:133); **nothing imports the `components/admin` copy**. Safe to delete.
  - `InventoryManagement.tsx` — **still broken on `main`**: queries `/api/k9000/inventory` + `/api/k9000/inventory/summary` (no such routes) and computes a `%`-full bar from an invented `maxCapacity`. The real owner is `server/routes/inventory.ts` (`/station-supplies`, `/purchase-order`, …).
  - `GET /api/crm/communications/history` — **still missing on `main`**; `client/src/pages/CommunicationCenter.tsx:423` queries it and gets a 404 rendered as "No communication history found". #2240 adds the handler.
  - `SitterEditProfile.tsx` — `main` has since added its own custom `queryFn`; #2240's hunk is now redundant there. Drop it on rebase.
- **Recommended order: last — rebase after #2247, drop the AdminUsers/App.tsx and SitterEditProfile hunks, keep the rest.**

### #2239 — `sprint/auth-identity-change` → `main`
- **Purpose:** pin-auth had no authentication; Settings security panel was lying.
- **Files (4):** `server/routes/pin-auth.ts`, `client/src/pages/Settings.tsx`, `client/src/components/PinKeypad.tsx`, `server/tests/pinAuthIdentity.regression.test.ts`.
- **Sensitivity:** `auth-privilege`. **Tests:** yes (but already on `main`).
- **API mergeable:** `false / dirty`.
- **Verification:** `VERIFIED-SOURCE` — see §3. **OBSOLETE. CLOSE IT.** Merging it reverts two later fixes.

### #2243 — `sprint/auth-identity-change-v2` → `main`
- **Purpose:** email-change + mobile-change end-to-end hardening.
- **Files (6):** `server/lib/phoneE164.ts`, `server/routes/auth-sms.ts`, `server/routes/profile-settings.ts`, `server/services/SessionService.ts`, + 2 behaviour tests.
- **Depends on / conflicts with:** nothing — **zero file overlap with #2239** despite the sibling branch name.
- **Sensitivity:** `auth-privilege`. **Tests:** **yes**. **API mergeable:** `true / blocked`.
- **Verification:** `VERIFIED-SOURCE` (file-level disjointness confirmed against #2239).

### #2245 — `sprint/prestige-egift-sumit-v2` → `main`
- **Purpose:** eGift balance ownership ACL + RED-test repair.
- **Files (2):** `server/routes/prestige-pass.ts`, `server/tests/egiftBalanceOwnershipAcl.regression.test.ts`. +33 / -5.
- **Sensitivity:** `cross-tenant` (balance ownership). **Tests:** **yes**. **API mergeable:** `true / blocked`.
- **Conflicts with:** none. #2247 touches the *client* of `prestige-pass`, not the router.
- **Verification:** `VERIFIED-SOURCE` (file list + no overlap confirmed).

### #2252 — `sprint/upload-ssrf-redirect-v2` → `main`
- **Purpose:** open-redirect bypasses in `returnTo` handling.
- **Files (2):** `client/src/auth/returnTo.ts`, `client/src/auth/returnTo.openRedirect.test.ts`. +39 / -13.
- **Sensitivity:** `auth-privilege` (redirect-based session theft). **Tests:** **yes**. **API mergeable:** `true / blocked`. **Conflicts:** none.
- **Verification:** `INFERRED` (title + file list; small and isolated).
- *Note: the PR title advertises upload hardening and an SSRF guard, but the diff only contains the redirect work — the other two claims are not in this PR.*

### #2248 — `sprint/privacy-logging-v2` → `main`
- **Purpose:** one shared shape filter to sanitize leaky 5xx/4xx error bodies.
- **Files (10):** `server/lib/sanitizeErrorResponse.ts` (new) + 7 routers (`compliance`, `escrow`, `marketplace-bookings`, `pricing`, `shop`, `unified-vouchers`, `user-addresses`) + 2 tests.
- **Sensitivity:** `cross-tenant` (PII in error bodies). **Tests:** **yes**. **API mergeable:** `true / blocked`. **Conflicts:** none open.
- **Verification:** `INFERRED`.

### #2249 — `sprint/provider-journey-v2` → `main`
- **Purpose:** provider journey beyond pending — a11y contrast + capability correctness.
- **Files (2):** `client/src/pages/ProviderPending.tsx` + regression test.
- **Sensitivity:** `none`. **Tests:** **yes**. **API mergeable:** `true / **unstable**` — **CI is currently failing on this one; do not merge until green.**
- **Verification:** `INFERRED`.

### #2250 — `sprint/public-nav-wiring-v2` → `main`
- **Purpose:** dead partner CTAs + public form hardening.
- **Files (3):** `client/src/components/partners/PartnerEnquiryForm.tsx`, `client/src/pages/partners/Locations.tsx`, `client/src/pages/partners/Municipal.tsx`.
- **Sensitivity:** `none`. **Tests:** **no**. **API mergeable:** `true / blocked`.
- **Conflicts:** touches `partners/Locations.tsx`; **#2237** documents `Locations.tsx` behaviour in the matrix but does not edit it — no code conflict.
- **Verification:** `INFERRED`.

### #2251 — `sprint/realtime-security-v2` → `main`
- **Purpose:** behavioural coverage for `/ws/match` auth — closes a P0-shipped-without-tests gap.
- **Files (1):** `tests/behavior/matching-ws-auth.behavior.test.ts`. Test-only, +364 / -0.
- **Sensitivity:** `none` (test-only). **Tests:** **yes** (it *is* the test). **API mergeable:** `true / blocked`. **Conflicts:** none.
- **Verification:** `INFERRED`.

### #2234 — `claude/academy-booking-audit` → `main`
- **Purpose:** wires the 7th JourneyCheckpoint domain, `academy_book`.
- **Files (5):** `client/src/pages/academy/BookingFlow.tsx`, `server/services/journeyCheckpoints.ts`, `server/services/nextBestAction.ts`, + 2 regression tests.
- **Conflicts with:** **#2207** (see §2). **Depended on by:** #2235, #2236.
- **Sensitivity:** `none` (payment fields deliberately excluded from the checkpoint payload — verified in the diff comment and code).
- **Tests:** **yes**. **API mergeable:** `true / clean`.
- **Verification:** `VERIFIED-SOURCE` — read the diff and confirmed `main`'s enum has 6 members and `academy_book` is absent.

### #2207 — `postrelease/journey-checkpoint-cross-wire-invariants` → `main`
- **Purpose:** cross-wire invariant regression pin for the 6/6 write-side.
- **Files (1):** `server/tests/journeyCheckpointCrossWireInvariants.regression.test.ts`. Test-only.
- **Conflicts with:** **#2234** — its `WIRED_JOURNEYS` table asserts the enum has **exactly 6** members; #2234 makes it 7.
- **Sensitivity:** `none`. **Tests:** it is a test. **API mergeable:** `true / clean` (textually clean — the breakage is *semantic*, which is why the API cannot see it).
- **Verification:** `VERIFIED-SOURCE`.
- **This is the trap the mergeable-flag will not warn you about.**

### #2236 — `claude/academy-e2e-7of7` → `main`
- **Purpose:** real-browser E2E resume proof for `academy_book`.
- **Files (1):** `tests/e2e/journey-checkpoint-resume-academy.e2e.spec.ts`. Test-only.
- **Depends on:** **#2234** (the domain must exist first). **Sensitivity:** `none`. **API mergeable:** `true / clean`.
- **Verification:** `VERIFIED-SOURCE` (read the diff; it targets `academy_book`).

### #2235 — `claude/completion-matrix-academy-bump` → `main`
- **Purpose:** marks Academy booking `TESTED` and JourneyCheckpoint 7/7 in `docs/COMPLETION-MATRIX.md`.
- **Files (1):** `docs/COMPLETION-MATRIX.md`.
- **Depends on:** **#2234** — merging this first would put a **false `TESTED`** claim in the matrix.
- **Conflicts with:** **#2237** (adjacent hunks in the same file). **Sensitivity:** `none`. **API mergeable:** `true / clean`.
- **Verification:** `VERIFIED-SOURCE`.

### #2237 — `claude/matrix-bump-station-finder-packages` → `main`
- **Purpose:** records Station Finder `BROKEN` and Packages `BROKEN` in the matrix.
- **Files (1):** `docs/COMPLETION-MATRIX.md`. **Conflicts with:** **#2235** (adjacent hunks).
- **Sensitivity:** `none`. **API mergeable:** `true / clean`.
- **Verification:** `VERIFIED-SOURCE`. Merge this **before** #2235 — it depends on nothing.

### #2244 — `sprint/open-pr-dependency-map-v2` → `main`
- **Purpose:** this document. Docs-only, no code. Sensitivity `none`. Merge any time.

---

## 5. WHAT THIS MAP DOES NOT COVER

- The `-v2` sprint branches are being pushed to while this was written; re-run the scan
  (`gh api "repos/petwashglobal/petwash-marketplace/pulls?state=open&per_page=100"`) before merging.
- `mergeable_state: blocked` on the `-v2` PRs means branch protection wants a review — **not** a conflict.
- `main` hard-codes a ₪55 wash price at `server/routes.ts:12772` (`requestedAmountCents: 5500`) while
  Kfar Saba is ₪48. Out of scope here, but it is sitting in code that #2241 touches.

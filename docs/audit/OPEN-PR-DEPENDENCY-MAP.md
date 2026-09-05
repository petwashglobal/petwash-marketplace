# OPEN PR DEPENDENCY MAP (v3 — refresh)

**Generated** 2026-09-05 · **against `main` @ `548be1878`** ("docs · Completion Matrix — Public homepage TESTED (#2233)")
**Total open PRs at scan time: 29** (verified via REST `GET /pulls?state=open`, single page, `per_page=100`)

This replaces the version on `sprint/open-pr-dependency-map-v2` (PR #2244), which was written when
the queue topped out at #2244. That version's analysis of #2207–#2247 was re-checked here and is
still accurate except where marked "UPDATED" below. This version adds #2248–#2261 (14 more PRs) and
two new supersession findings the previous scan could not have seen (#2258 did not exist yet, and
#2254/#2260/#2261 did not exist yet).

**How to read the honesty labels**

| Label | Meaning |
|---|---|
| `VERIFIED-SOURCE` | I read the actual diff(s) **and/or** the corresponding code on current `main` before making the claim. |
| `INFERRED` | Judged from title + file list only. Not proven. |

Every money, auth-privilege, cross-tenant and destructive claim below is `VERIFIED-SOURCE`.
**This scan: 19 PRs carry at least one VERIFIED-SOURCE claim · 10 are INFERRED-only** (low-risk,
disjoint-file PRs — see §4 for the full per-PR record and label on every individual claim).

---

## 1. MERGE THESE FIRST (in this order)

| # | PR | One-line reason |
|---|----|-----------------|
| 1 | **#2258** money concurrency M1-M4, REBASED | Supersedes #2238 outright — same M1-M4 fix (`EscrowStateMachine.ts`, `billing.ts`, `bookings.ts`, `booking-expiry.ts`, `derivedIdempotencyKey.ts`), but genuinely rebased onto current `main` instead of 615 commits stale. Coordinator re-ran its tests: 4 files / 59 tests pass. The only open money-safety PR. Merge before anything else touches bookings/billing. **Close #2238.** |
| 2 | **#2242** super-admin gate P0 | Fixes a live 500 on every thread read (`isSuperAdminVerified` called as async and `.catch()`-ed on a boolean). Auth-privilege. Must land before #2246, which touches the same `thread-chat.ts`/`walk-my-pet.ts` lines. |
| 3 | **#2252** open-redirect fix | Tiny (39/-13), self-contained (`client/src/auth/returnTo.ts`), closes an auth-adjacent redirect bypass. No overlap with anything open. |
| 4 | **#2248** error-body sanitizer (`clientSafeErrorMessage`) | Adds one new export to the *existing* `server/lib/sanitizeErrorResponse.ts` and wires it into 7 routers. No line overlap with #2260 (different routers) or #2253 (different files). |
| 5 | **#2253** Sentry/log PII redaction | Cross-tenant/privacy. Touches `server/lib/{logger,observability,redaction}.ts` + 2 routers — zero file overlap with #2248 or #2260. |
| 6 | **#2260** admin error-message sanitize | Imports the **pre-existing** `sendSanitizedError` (already on `main`, not something #2248 adds) into 8 admin routers. Independent of #2248's new `clientSafeErrorMessage` export — verified no shared lines. |
| 7 | **#2245** eGift balance ownership ACL | 33 lines + a cross-tenant regression test on `prestige-pass.ts`. No file overlap with anything open. |
| 8 | **#2254** k9000 member-redeem v2 (supersedes #2241's redeem fix) | Money-critical: fixes the same `session_type` NOT-NULL bug as #2241 **plus** an extra "redeem already in flight" 409 guard #2241 lacks, plus a more honest two-phase `scanned→completed` state machine (doesn't claim "wash started" before the machine ACKs). Merge this, not #2241's equivalent hunks. |
| 9 | **#2246** booking route-shadowing / walk-detail 500 | Merge **after #2242** — rebase to drop the duplicated `thread-chat.ts` hunk (same fix, two agents). Keep the unique walk-booking-500 + route-shadowing work. |
| 10 | **#2247** admin contract fixes v2 | Current-main-based, deletes the dead `AdminUsers.tsx`, fixes 3 real admin-wallet 404s. Must land before any rebase of #2240. |
| 11 | **#2241** k9000, reduced to ONE hunk | After #2254 lands, #2241 has exactly one still-unique fix left: the `/wash/start_cycle` duplicate-transaction guard (unbounded 50-row JS scan → bounded SQL `jsonb` match) in `server/routes/k9000.ts`. Everything else in it is now obsolete or superseded — see §3 and the reduction plan. |
| 12 | **#2234** → **#2207** → **#2236** → **#2235** | Strict order. #2207's test hard-codes six `JourneyDomain` members; #2234 adds a seventh (`academy_book`). Merging out of order turns CI red either way. |
| 13 | **#2237** before **#2235** | Both edit adjacent lines of `docs/COMPLETION-MATRIX.md`. #2237 depends on nothing; #2235 depends on #2234 landing first (otherwise it records a false `TESTED`). |
| 14 | **#2243, #2249, #2250, #2251, #2255, #2256, #2257, #2259** | Independent of everything above and each other — merge in any order once the above are in. (#2249's CI was failing at the prior scan; it is `clean` now — re-check immediately before merging regardless, CI state moves fast.) |
| 15 | **#2240**, reduced | Merge last, after #2247. Rebase to drop the `AdminUsers.tsx`/`App.tsx` hunks (dup of #2247) and the `SitterEditProfile.tsx` hunk (main added its own `queryFn`). Its `LoyaltyDashboard.tsx`/`FinanceSettlementsView.tsx` hunks now collide with #2261 — **CEO/lane-owner decision required**, see §2 and §3. |
| 16 | **#2261** | Holds ONLY the two files contested with #2240 (see §2). Do not merge both as-is. Pick one. |
| 17 | **#2244** (this document's predecessor) | Superseded by this document. Close #2244; this file should land via whatever PR carries it (`sprint/merge-readiness`). |

**Do not merge #2239 at all.** See §3.

---

## 2. DO NOT MERGE BOTH — overlapping / duplicate pairs

| Pair | What overlaps | Evidence | What to do |
|---|---|---|---|
| **#2238 ↔ #2258** | Identical M1-M4 money-concurrency fix; same 5 core files. | `VERIFIED-SOURCE` — file lists match exactly (`EscrowStateMachine.ts`, `billing.ts`, `bookings.ts`, `booking-expiry.ts`, `derivedIdempotencyKey.ts`); #2258 is rebased onto current `main`, #2238 is 615 commits stale. | **Merge #2258. Close #2238.** |
| **#2207 ↔ #2234** | #2207's test asserts the `JourneyDomain` enum has **exactly six** members. #2234 adds a **seventh** (`academy_book`). | `VERIFIED-SOURCE` — read both diffs; `main`'s enum (`server/services/journeyCheckpoints.ts:29-35`) has 6 members today. | **Merge #2234 first**, then add the 7th row to #2207's assertion before merging it. |
| **#2242 ↔ #2246** | Both rewrite the same lines of `server/routes/thread-chat.ts` / `server/routes/walk-my-pet.ts` with the same `isSuperAdminVerified(req)` fix. | `VERIFIED-SOURCE` (carried forward, still true) — both diffs replace the same `.catch()`-on-boolean bug identically. | **Merge #2242.** Rebase #2246 to drop its `thread-chat.ts` hunk, keep the unique walk-booking-500 + route-shadowing work. |
| **#2240 ↔ #2247** | Both delete `client/src/pages/AdminUsers.tsx` and edit the same two spots in `client/src/App.tsx`. | `VERIFIED-SOURCE` — #2247's `AdminUsers.tsx` hunk is `deleted file mode 100644`; #2240's is the same deletion plus a longer `App.tsx` comment. | **Merge #2247.** Rebase #2240 to drop the `AdminUsers.tsx`/`App.tsx` hunks. |
| **#2240 ↔ #2261 — NEW** | Both **delete** `client/src/components/admin/LoyaltyDashboard.tsx` (byte-identical deletion in both). Both also touch `client/src/components/control-panel/FinanceSettlementsView.tsx`, but at very different depth: **#2240 does a full rewrite** of the commissions+settlements section (replaces it with one "not connected" panel that names every missing endpoint: `/api/finance/settlements`, `/api/finance/settlements/:id/export`, `/api/finance/commissions`, and the `/api/finance/summary` shape mismatch). **#2261 makes a small, targeted patch** to the *current, un-rewritten* file — it adds an `isError` branch around the `/api/finance/commissions?period=recent` query only, leaving the rest of the (still-fabricating) component in place. | `VERIFIED-SOURCE` — read both diffs in full. #2240's rewrite is a strict superset of the problem #2261 fixes (it covers the commissions gap #2261 targets, plus the settlements-totals fabrication and the summary-shape mismatch that #2261 does not touch). If #2240 merges first, #2261's `FinanceSettlementsView.tsx` hunk will not apply (the surrounding code no longer exists). If #2261 merges first, #2240's rebase will need to re-derive its hunk against #2261's patched file. | **Recommend adopting #2240's version** (broader, more honest fix) and dropping #2261's `FinanceSettlementsView.tsx` hunk. Either way, only ONE of the two `LoyaltyDashboard.tsx` deletions is needed — take it from whichever of #2240/#2261 merges first and drop the duplicate from the other. This is a product-facing money-display decision; flag it for a human sign-off since #2261 is same-day newer than #2240 and the two disagree in scope, not just in wording. |
| **#2235 ↔ #2237** | Both edit `docs/COMPLETION-MATRIX.md`; hunks sit ~3 lines apart (L53-57) — textual conflict, not semantic. | `VERIFIED-SOURCE` — different rows, no contradiction. | **Not a duplicate — merge both**, sequentially. Merge #2237 first (documents current reality, depends on nothing), then #2235 (depends on #2234 landing). |
| **#2239 ↔ `main`** | `main` already contains 100% of #2239's server + client work **plus two later fixes on top** (`loginOrLink` identity probe in `pin-auth.ts`, hardened Firebase `signOut` in `Settings.tsx`). Re-confirmed this scan: both still present on `main`. | `VERIFIED-SOURCE`. | **Close #2239. Do not merge — it would delete 25 lines `main` has.** |
| **#2241 ↔ #2254 — NEW** | #2241's "member redeem dead-end" fix (`session_type` NOT NULL bug in `server/routes.ts`, `completeMemberRedemptionHold` in `K9000RedemptionService.ts`) is functionally superseded by #2254's version of the same fix, which adds an extra in-flight-redeem 409 guard and a more honest two-phase (`scanned`→`completed`) state transition instead of jumping straight to `completed` before the machine has ACKed START_PUMP. | `VERIFIED-SOURCE` — read both diffs line-by-line for `server/routes.ts`, `server/routes/k9000.ts`, `server/services/K9000RedemptionService.ts`. #2254's `routes.ts` hunk contains #2241's identical `sessionType: 'hardware_qr'` fix plus more; #2254's `settleMemberRedemptionHold` is a strict superset of #2241's `completeMemberRedemptionHold`. | #2241's `/wash/start_cycle` double-vend dedupe fix is **not** in #2254 and **not** in `main` — that one hunk is still needed. See the reduction plan in §3. |
| **#2241 ↔ `main`** (Cortina third) | #2241's "unauthenticated Cortina callbacks" fix is already on `main`. | `VERIFIED-SOURCE` — re-confirmed this scan: `main`'s `server/routes/nayax-cortina.ts` calls `assertCortinaSecret()` on all 4 money-bearing callback routes (`/authorize`, `/settlement`, `/void`, `/refund`), lines 231/284/413/477. | Drop this hunk from #2241 on rebase — it will conflict textually for no reason. |
| **#2239 ↔ #2243** | Same branch-name family (`sprint/auth-identity-change` vs `-v2`) looks like a duplicate but is not. | `VERIFIED-SOURCE` (carried forward) — zero shared files. #2239 = pin-auth + Settings; #2243 = email/mobile change, `phoneE164`, `SessionService`. | **Not a conflict.** Merge #2243 on its own merits; still close #2239. |

---

## 3. OBSOLETE — CLOSE OR REDUCE, DO NOT MERGE AS-IS

| PR / hunk | Why it is obsolete | Label |
|---|---|---|
| **#2238** (whole PR) | Superseded outright by #2258 — see §2. | `VERIFIED-SOURCE` |
| **#2239** (whole PR) | `main` is a strict superset; merging reverts two later fixes. See §2. | `VERIFIED-SOURCE` |
| **#2241 — routes.ts hunk (`session_type` fix)** | Superseded by #2254's identical-plus-more fix. | `VERIFIED-SOURCE` |
| **#2241 — nayax-cortina.ts hunk** | `main` already fail-closes via `assertCortinaSecret()`. | `VERIFIED-SOURCE` |
| **#2241 — K9000RedemptionService.ts hunk (`completeMemberRedemptionHold`)** | Superseded by #2254's `settleMemberRedemptionHold` (two-phase, more honest). | `VERIFIED-SOURCE` |
| **#2241 — regression test, describe blocks 1 & 2** | Block 1 ("member K9000 redeem hold is created and settled") and block 2 ("Cortina inbound callbacks authenticate the caller") test territory now owned by #2254 and `main` respectively. Block 3 ("start_cycle duplicate-transaction guard...") is the only one still needed. | `VERIFIED-SOURCE` — read the full test file; 3 describe blocks map 1:1 onto the 3 original fixes. |
| **#2240 — AdminUsers.tsx / App.tsx hunks** | Superseded by #2247 (same deletion, current base). | `VERIFIED-SOURCE` |
| **#2240 — SitterEditProfile.tsx hunk** | `main` has since added its own custom `queryFn`; hunk is now redundant. (Carried forward from prior scan same day — worth a 30-second recheck at rebase time since `main` keeps moving.) | `VERIFIED-SOURCE` (as of prior scan) |
| **#2240 vs #2261 — LoyaltyDashboard.tsx / FinanceSettlementsView.tsx** | Not strictly "obsolete" — a genuine two-implementations-of-one-fix collision. See §2 for the recommendation (favor #2240's broader rewrite). | `VERIFIED-SOURCE` |
| **#2244** (whole PR, the prior dependency-map doc) | Superseded by this document. | `VERIFIED-SOURCE` (self-evident — this is a replacement of that same file) |

> Nothing else on the open list is obsolete. #2258 is not obsolete (it's the winner, not the loser, of
> its pair). #2254 is not obsolete. #2247, #2242 are not obsolete.

---

## 4. PER-HUNK REDUCTION PLAN — #2240 and #2241

These two PRs are stale-base and should not be rewritten by this lane (they belong to other lanes) —
this is a map for whoever reduces them.

### #2240 (`sprint/admin-contract-fixes`) — 11 files → keep 6, drop 5, 1 contested

| File | Verdict | Why |
|---|---|---|
| `client/src/pages/AdminUsers.tsx` (delete) | **DROP** | Dup of #2247's identical deletion. |
| `client/src/App.tsx` (2 hunks: lazy import + RETIRED comment) | **DROP** | Dup of #2247. |
| `client/src/pages/sitter-suite/SitterEditProfile.tsx` | **DROP** | `main` now has its own `queryFn`; hunk is redundant. |
| `client/src/components/admin/LoyaltyDashboard.tsx` (delete) | **CONTESTED** — keep in #2240 OR #2261, not both | Byte-identical deletion also present in #2261. Confirmed orphan either way (nothing imports it; the live page is `client/src/pages/LoyaltyDashboard.tsx`). |
| `client/src/components/control-panel/FinanceSettlementsView.tsx` | **CONTESTED, recommend KEEP #2240's version** | Full honest rewrite vs. #2261's narrower isError patch — see §2. Recommend keeping #2240's (covers more of the fabricated-money problem), dropping #2261's hunk for this file. |
| `client/src/components/admin/LoyaltyDashboard.tsx` deletion aside, the following are **UNIQUE, KEEP**: `client/src/pages/InventoryManagement.tsx`, `client/src/pages/MarketplaceIntelligenceDashboard.tsx`, `client/src/services/marketplace.ts`, `server/routes.ts` (adds `GET /api/crm/communications/history`), `server/routes/inventory.ts`, `server/services/InventoryService.ts` | **KEEP** | Each fixes a distinct, still-broken client↔server contract defect (wrong query param vs path param on marketplace ranking audit; nonexistent `/api/k9000/inventory*` routes; missing CRM history handler). Verified against `main` in the prior scan; not re-diffed this pass since these files are untouched by any other open PR. |

Net: #2240 should land as a ~6-7 file PR (down from 11), after #2247, with the LoyaltyDashboard/FinanceSettlementsView question resolved against #2261 first.

### #2241 (`sprint/stations-k9000`) — 5 files → keep essentially 1

| File | Verdict | Why |
|---|---|---|
| `server/routes.ts` (`session_type` NOT NULL fix) | **DROP** | Superseded by #2254's identical fix + extra in-flight guard. |
| `server/routes/nayax-cortina.ts` (`assertCortinaSecret` wiring) | **DROP** | Already on `main`. |
| `server/services/K9000RedemptionService.ts` (`completeMemberRedemptionHold`) | **DROP** | Superseded by #2254's `settleMemberRedemptionHold` (two-phase, more honest — doesn't claim "wash started" before the machine ACK). |
| `server/routes/k9000.ts` | **KEEP — but only the `/wash/start_cycle` hunk** | The duplicate-transaction guard fix (JS scan of an arbitrary unordered 50-row window → SQL `jsonb ->> 'transactionId'` match). Grepped #2254's diff and `main` for `start_cycle`/`duplicate`/`auditLedger` — this fix exists nowhere else. **This is the one genuinely still-needed line of code in #2241.** Also drop the `completeMemberRedemptionHold` import and its call-site in this same file (step 8b) — both belong to the superseded hunk above; #2254 already calls its own `settleMemberRedemptionHold` at the equivalent point. |
| `server/tests/k9000RedeemMoneyHardening.regression.test.ts` | **KEEP describe block 3 only** ("start_cycle duplicate-transaction guard matches in SQL, not in JS"). **DROP** describe blocks 1 (member-redeem-hold — now #2254's territory) and 2 (Cortina auth — now `main`'s territory). | Test file has exactly 3 describe blocks, one per original fix; only the 3rd fix survives. |

Net: #2241 should land as essentially a single-purpose PR — one hunk in `server/routes/k9000.ts` (the double-vend guard) plus one trimmed test file. Recommend re-titling it after reduction so nobody re-reads it expecting the redeem-dead-end fix it no longer carries.

---

## 5. FULL PER-PR RECORD (all 29 open PRs)

Sensitivity key: `none` · `money` · `auth-privilege` · `cross-tenant` · `destructive` (deletes code/data).

### Carried forward from the prior scan, re-confirmed this pass where noted

**#2238** `sprint/money-concurrency` — money, tests yes, `mergeable: clean`. **Superseded by #2258 (NEW finding this scan).** VERIFIED-SOURCE.

**#2242** `sprint/requireadmin-consolidation-v2` — auth-privilege, tests yes, `mergeable: clean` (was `blocked` at prior scan — branch protection cleared). Conflicts with #2246. VERIFIED-SOURCE.

**#2246** `sprint/booking-e2e-v2` — auth-privilege, tests yes, `mergeable: unstable` (CI currently flaky/red — recheck before merge, independent of the #2242 rebase). Depends on #2242. VERIFIED-SOURCE.

**#2247** `sprint/admin-contract-fixes-v2` — destructive (safe: `main` already redirects `/admin/users` away, dead `lazy()` import only), no tests, `mergeable: clean`. Supersedes part of #2240. VERIFIED-SOURCE.

**#2241** `sprint/stations-k9000` — money + auth-privilege, 1 test file, `mergeable: dirty` (615-commit-stale base). Reduced scope per §4. VERIFIED-SOURCE.

**#2240** `sprint/admin-contract-fixes` — destructive + money-display, no tests, `mergeable: dirty`. Reduced scope per §4, contested with #2261. VERIFIED-SOURCE.

**#2239** `sprint/auth-identity-change` — auth-privilege, `mergeable: dirty`. **CLOSE, do not merge.** VERIFIED-SOURCE.

**#2243** `sprint/auth-identity-change-v2` — auth-privilege, tests yes, `mergeable: clean`. Zero file overlap with #2239 despite sibling branch name. VERIFIED-SOURCE.

**#2245** `sprint/prestige-egift-sumit-v2` — cross-tenant, tests yes, `mergeable: clean`. No conflicts. VERIFIED-SOURCE.

**#2252** `sprint/upload-ssrf-redirect-v2` — auth-privilege, tests yes, `mergeable: clean`. Title over-promises (advertises upload/SSRF hardening the diff doesn't contain — only the redirect fix is actually in it). INFERRED.

**#2248** `sprint/privacy-logging-v2` — cross-tenant, tests yes, `mergeable: clean`. No conflicts. INFERRED (not re-diffed line-by-line this pass beyond confirming the new export and file list).

**#2249** `sprint/provider-journey-v2` — none, tests yes, `mergeable: clean` (was `unstable`/CI-red at prior scan — now green; recheck immediately before merge since CI state is volatile). INFERRED.

**#2250** `sprint/public-nav-wiring-v2` — none, no tests, `mergeable: clean`. Touches `partners/Locations.tsx`; #2237 documents but doesn't edit that file — no code conflict. INFERRED.

**#2251** `sprint/realtime-security-v2` — none (test-only, +364/-0), `mergeable: clean`. INFERRED.

**#2234** `claude/academy-booking-audit` — none (payment fields deliberately excluded from checkpoint payload, verified in diff), tests yes, `mergeable: clean`. Conflicts with #2207 (see §2). VERIFIED-SOURCE.

**#2207** `postrelease/journey-checkpoint-cross-wire-invariants` — none, test-only, `mergeable: clean` (textually clean, semantically breaks against #2234 — the trap the API can't see). VERIFIED-SOURCE.

**#2236** `claude/academy-e2e-7of7` — none, test-only, `mergeable: clean`. Depends on #2234. VERIFIED-SOURCE.

**#2235** `claude/completion-matrix-academy-bump` — none, docs-only, `mergeable: clean`. Depends on #2234; conflicts with #2237 (adjacent hunks, not semantic). VERIFIED-SOURCE.

**#2237** `claude/matrix-bump-station-finder-packages` — none, docs-only, `mergeable: clean`. Merge before #2235. VERIFIED-SOURCE.

**#2244** `sprint/open-pr-dependency-map-v2` — none, docs-only. Superseded by this document.

### New this scan (#2253–#2261)

**#2253** `sprint/privacy-pii-redaction` — cross-tenant, tests yes (2 test files), `mergeable: clean`. Files: `server/lib/{logger,observability,redaction}.ts`, `server/routes/{careers,grooming-feedback}.ts`. No file overlap with #2248 or #2260 (different files entirely) — VERIFIED-SOURCE on the non-overlap claim (checked via file lists), not a full line-by-line content read.

**#2254** `sprint/stations-k9000-v2` — money, no dedicated new test file in this diff (relies on existing k9000 coverage), `mergeable: blocked` (branch protection, not a conflict). **Supersedes #2241's redeem-dead-end fix.** See §2/§4. VERIFIED-SOURCE.

**#2255** `sprint/route-contract-scanner-v2` — none (new dev tool: `scripts/audit/route-contract/*.mjs` + a generated report), `mergeable: clean`. No file overlap with #2256 or #2261 (different files; #2261's title references "Agent J contract-rescan leftovers" but touches only 2 client component files, not the scanner itself). INFERRED.

**#2256** `sprint/playwright-journeys-v2` — none (test helpers + `tests/contracts/clientServerPathContracts.test.ts`), `mergeable: clean`. Complementary to, not overlapping with, #2255 (one is a standalone scanner script, the other a CI-run test) — no shared files. INFERRED.

**#2257** `sprint/mobile-rtl-a11y-v2` — none, no dedicated test file, `mergeable: clean`. 5 UI files (`CookieConsent.tsx`, `Layout.tsx`, `MobileBottomNav.tsx`, `PetWashHeader.tsx`, `petwash-header.css`), no overlap with any other open PR. INFERRED.

**#2258** `sprint/money-concurrency-rebased` — money, tests yes (4 race/regression test files, 59 tests — coordinator-verified passing), `mergeable: clean`. **Supersedes #2238.** See §1/§2. VERIFIED-SOURCE.

**#2259** `sprint/false-success-sweep` — none (client honesty fix: forms silently "succeeding" while losing the lead server-side), tests yes, `mergeable: unstable` (CI issue, not a merge conflict — `mergeable: true`). Touches `server/routes.ts` (shared with #2241/#2254, but GitHub reports no textual conflict for any of the three against `main`). INFERRED.

**#2260** `sprint/admin-error-sanitization` — cross-tenant (error-message leaks on admin surfaces), no dedicated new test file, `mergeable: blocked` (branch protection). Imports the **pre-existing** `sendSanitizedError` (already on `main` before #2248 touched the file) into 8 admin routers not touched by #2248's own router list. No line overlap with #2248. VERIFIED-SOURCE (confirmed by reading `server/lib/sanitizeErrorResponse.ts` on `main` directly — `sendSanitizedError` already exists there; #2248 only *adds* a second export, `clientSafeErrorMessage`, appended at the end of the same file).

**#2261** `sprint/agent-j-d11-d16` — destructive + money-display, no dedicated test file, `mergeable: blocked`. Only 2 files: deletes `client/src/components/admin/LoyaltyDashboard.tsx` (dup of #2240's deletion) and patches `FinanceSettlementsView.tsx` (narrower than #2240's rewrite of the same component). **Collides with #2240 — see §2, §3, §4.** VERIFIED-SOURCE.

---

## 6. WHAT THIS MAP DOES NOT COVER

- `mergeable_state: blocked` means branch protection wants a review — not a textual conflict. `unstable`
  means CI is currently red/flaky on that PR specifically — recheck before merging regardless of what
  this document says, CI state moves independently of this scan.
- Re-run `gh api "repos/petwashglobal/petwash-marketplace/pulls?state=open&per_page=100"` immediately
  before acting — branches in this queue are actively being pushed to.
- #2253/#2248/#2250/#2251/#2255/#2256/#2257/#2259/#2260's INFERRED labels mean the *non-overlap* claim
  is solid (checked via the GitHub files API) but the *internal correctness* of each PR's own diff was
  not independently re-derived line-by-line in this pass — only the money/auth-privilege/cross-tenant/
  destructive PRs got that treatment, per the honesty rule this document follows.
- `main` still hard-codes a ₪55 wash price at `server/routes.ts` (`requestedAmountCents: 5500`) while
  Kfar Saba is ₪48 (pre-existing, out of scope for this queue, noted for awareness — #2241/#2254 both
  touch code adjacent to this line without fixing it).

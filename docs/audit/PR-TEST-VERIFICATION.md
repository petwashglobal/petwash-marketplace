# PR test-claim verification — 2026-09-05

Independent re-run of each sprint PR's own touched test files, from a clean
`origin/main`-based worktree (`/Users/nirhadadnewmacbook2026/pw-agents/verify`).
Method for every PR: `git fetch origin <branch>` → `git checkout --detach FETCH_HEAD` →
`git diff --name-only origin/main...HEAD | grep -E '\.(test|spec)\.[tj]sx?$'` →
`npx vitest run <those files>`. No full `tsc`, no full `vitest`, no full `vite build`
(cost-discipline constraint for this pass — see notes below).

Numbers below are exact `vitest` summary lines, not estimates.

## Priority 1

| PR | Branch | Test files touched | `vitest run` result | Claim | Verdict |
|---|---|---|---|---|---|
| #2242 | sprint/requireadmin-consolidation-v2 | 9 | Test Files 9 passed (9) / Tests **87** passed (87) | "90/90 pass" | **CLAIM-OVERSTATED** — all tests that exist pass, but the actual count is 87, not 90 |
| #2245 | sprint/prestige-egift-sumit-v2 | 13 (23 files changed total, only 13 are test files) | Test Files 13 passed (13) / Tests **99** passed (99) | "181 tests green, 27 files" | **CLAIM-OVERSTATED** — real diff has 13 test files and 99 tests, all passing; the claimed 27 files / 181 tests do not match this branch's actual diff against `origin/main` |
| #2252 | sprint/upload-ssrf-redirect-v2 | 4 | Test Files 4 passed (4) / Tests **239** passed (239) | "unverified by anyone" | **CLAIM-CONFIRMED** (as "unverified") — now verified: all 4 files / 239 tests pass |
| #2248 | sprint/privacy-logging-v2 | 3 | Test Files 3 passed (3) / Tests **69** passed (69). Per-file: `errorBody5xxNoInternals.behavior.test.ts` = 9, `clientSafeErrorMessage.behavior.test.ts` = 42, `customerErrorLeakSweep.regression.test.ts` = 18 (extra, not mentioned in claim) | "9 wire-level + 42 behavioral" | **CLAIM-CONFIRMED** — 9 and 42 match exactly; the 18 extra (customerErrorLeakSweep) also pass and only strengthen the claim |
| #2253 | sprint/privacy-pii-redaction | 2 | `piiLogRedaction.behavior.test.ts` = 15 passed, `selfServiceProjectionAgent14.regression.test.ts` = 9 passed. Total Tests **24** passed (24) | "15 redactor + 9 projection" | **CLAIM-CONFIRMED** — exact match, both files, all pass |

## Priority 2

| PR | Branch | Test files touched | `vitest run` result | Claim | Verdict |
|---|---|---|---|---|---|
| #2254 | sprint/stations-k9000-v2 | **0** (fetched fresh at HEAD `2a20eb294`) | n/a | n/a | **NO-TESTS** — another agent is actively pushing this branch; at the moment fetched, the diff against `origin/main` contains zero `.test./.spec.` files. Recheck later before merge. |
| #2246 | sprint/booking-e2e-v2 | 12 (fetched fresh at HEAD `e3b2ec93e`) | Test Files 12 passed (12) / Tests **67** passed (67) | (none stated — "another agent active, same handling") | **VERIFIED** — tests exist and all pass at time of check; branch is live, re-verify before merge in case of further pushes |
| #2247 | sprint/admin-contract-fixes-v2 | **0** | n/a — 13 non-test files changed (routes, services, dashboards), zero test files in the diff | "VERIFIED-SOURCE only, no tests run" | **CLAIM-CONFIRMED** — confirmed zero test files exist in this diff |
| #2249 | sprint/provider-journey-v2 | 4 | Test Files 4 passed (4) / Tests **52** passed (52) — **zero failures** in this PR's own touched files | "94/98 pass, 4 pre-existing failures in another lane's file" | **COULD-NOT-FULLY-VERIFY** — this PR's own 4 touched test files are 100% green (52/52), consistent with "4 failures live in another lane's file" (i.e., not in files this PR touches). Could NOT confirm the 94/98 total, because that implies a broader run across other lanes' files, which is out of scope for per-PR touched-file verification under the cost constraint. Nothing observed contradicts the claim, but nothing confirms the specific 94/98 figure either. |

## Priority 3

| PR | Branch | Test files touched | `vitest run` result | Claim | Verdict |
|---|---|---|---|---|---|
| #2260 | sprint/admin-error-sanitization | 1 (`server/tests/adminErrorSanitizationSprint.regression.test.ts`) | Test Files 1 passed (1) / Tests **70** passed (70) | "70/70" | **CLAIM-CONFIRMED** — exact match |
| #2259 | sprint/false-success-sweep | 1 (`server/tests/falseSuccessSweep.regression.test.ts`) | Test Files 1 passed (1) / Tests **17** passed (17) | "17/17" | **CLAIM-CONFIRMED** — exact match |
| #2251 | sprint/realtime-security-v2 | 4 (`tests/behavior/matching-ws-auth.behavior.test.ts`=16, `matching-ws-hardening.behavior.test.ts`=7, `prestige-sse-auth.behavior.test.ts`=13, `prestige-sse-lifecycle.behavior.test.ts`=6) | Test Files 4 passed (4) / Tests **42** passed (42), matching the coordinator's earlier re-run of the same 4 files | "51 total" | **CLAIM-OVERSTATED** — this branch's entire diff against `origin/main` contains only these 4 test files; no 5th file exists to supply the remaining 9. Confirmed count is 42, all passing, not 51 |
| #2261 | sprint/agent-j-d11-d16 | 0 — diff is 4 non-test client files only (`LoyaltyDashboard.tsx`, `FinanceSettlementsView.tsx`, `CommunicationCenter.tsx`, `InventoryManagement.tsx`) | n/a | none stated | **NO-TESTS** — confirmed zero test files in the diff |
| #2243 | sprint/auth-identity-change-v2 | 3 (`client/src/lib/identityChangeErrors.behavior.test.ts`=8, `server/tests/emailChangeIdentity.behavior.test.ts`=15, `server/tests/phoneE164.behavior.test.ts`=5) | Test Files 3 passed (3) / Tests **28** passed (28) | "42 vitest passing" | **CLAIM-OVERSTATED** — only 3 test files exist in this diff, totaling 28 tests, all passing. No test file supplying the other 14 exists in the branch's diff against `origin/main` |
| #2255 | sprint/route-contract-scanner-v2 | 0 — diff is 1 doc (`docs/audit/ROUTE-CONTRACT-CONFIRMED.md`) + 3 scanner scripts (`scripts/audit/route-contract/{clientCalls,scan,serverRoutes}.mjs`) | n/a | none stated | **NO-TESTS** — a static analysis tool + its findings doc, no automated test coverage of the scanner itself |
| #2256 | sprint/playwright-journeys-v2 | 1 vitest file in-diff (`tests/contracts/clientServerPathContracts.test.ts`); diff also adds 3 non-test e2e helper libs (`tests/e2e/helpers/{concurrentSubmit,crossUserIdor,persistenceAfterReload}.ts`) consumed by pre-existing `tests/e2e/*.e2e.spec.ts` journey files that are NOT part of this PR's diff | Test Files 1 passed (1) / Tests **7** passed (7) for the in-diff vitest file. The pre-existing Playwright e2e journeys: **COULD-NOT-RUN** — `npx playwright test ... --project=chromium` fails immediately with `Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@playwright/test' imported from playwright.config.ts`. Confirmed `@playwright/test` is absent from `node_modules` entirely (only `playwright` is a listed dependency in `package.json`); this is a package-installation gap, not merely a missing browser binary — worth flagging as sharper than the expected "only webkit cached" framing, since even webkit can't be reached without `@playwright/test` resolving first | none stated | **COULD-NOT-RUN** (e2e layer) / **CLAIM N/A, but in-diff test passes** (vitest layer) — this PR's own new vitest contract test is fully green (7/7); the Playwright journeys it supports could not be executed in this sandbox at all, for a reason one level more fundamental than the anticipated missing-browser blocker |
| #2257 | sprint/mobile-rtl-a11y-v2 | 0 — diff is 5 non-test files (`CookieConsent.tsx`, `Layout.tsx`, `MobileBottomNav.tsx`, `PetWashHeader.tsx`, `petwash-header.css`) | n/a | none stated | **NO-TESTS** — confirmed zero test files in the diff |
| #2250 | sprint/public-nav-wiring-v2 | 1 (`client/src/__tests__/publicNavDeadControls.regression.test.ts`) | Test Files 1 passed (1) / Tests **18** passed (18) | "27 tests green incl. an 18-assertion mutation-verified pin" | **CLAIM-OVERSTATED** — the 18-assertion pin itself is confirmed exact (18/18 pass), but this diff against `origin/main` contains only that one test file; the claimed total of 27 tests could not be found anywhere in the branch |
| #2254 (recheck) | sprint/stations-k9000-v2 | 2 (`server/tests/k9000GenerateQrPendingRace.behavior.test.ts`, `server/tests/k9000RedeemHoldSettle.behavior.test.ts`) — fetched fresh at HEAD `190c41125` | Test Files 2 passed (2) / Tests **21** passed (21) | none stated | **STATE CHANGED — now VERIFIED** — at the Priority 2 check this branch had 0 test files (`NO-TESTS`, HEAD `2a20eb294`); the active agent has since pushed 2 new commits adding both test files, and all 21 tests pass at current HEAD `190c41125` |

## Failures requiring pre-existing-vs-PR-caused triage

**None.** Every test file actually run across all 7 Priority-1/2 PRs (#2242, #2245, #2252, #2248, #2253, #2246, #2249) and all 9 Priority-3 items (#2260, #2259, #2251, #2261, #2243, #2255, #2256, #2257, #2250, plus the #2254 recheck) passed with zero failures. There was nothing to triage against `origin/main` because no failure was observed anywhere in this pass. The one non-pass result (#2256's Playwright e2e layer) was a hard environment error before any test executed, not a test failure — so there is nothing to compare against `origin/main` either; the same `ERR_MODULE_NOT_FOUND` would occur there too since `@playwright/test` is absent from `package.json` entirely, not branch-specific.

## Summary — claims that did NOT hold as stated

- **#2242** — claimed 90/90, actual 87/87 (all pass, but the claimed count is wrong).
- **#2245** — claimed 181 tests / 27 files, actual diff only contains 13 test files / 99 tests (all pass, but claimed scope does not match the real diff — nearly half the claimed test count/files could not be found in this branch at all).
- **#2249** — claimed "94/98 pass, 4 pre-existing failures elsewhere" could not be fully verified from this PR's own diff (only 52 tests exist in files this PR touches, all passing); the 94/98 headline figure is unconfirmed either way.
- **#2251** — claimed 51 total, actual 42 (all pass; the diff simply doesn't contain a 5th file to supply the other 9).
- **#2243** — claimed 42 vitest passing, actual 28 (all pass; same pattern — claimed count exceeds what the diff actually contains).
- **#2250** — claimed 27 tests including an 18-assertion pin; the 18-assertion pin is exact and green, but the diff contains no other test file, so 27 total could not be confirmed.

## Claims independently confirmed exact-match

- #2248 (9 wire-level + 42 behavioral — exact)
- #2253 (15 redactor + 9 projection — exact)
- #2247 (no tests, confirmed zero test files)
- #2260 (70/70 — exact)
- #2259 (17/17 — exact)

## Priority 3 notes

- Six of nine Priority-3 items plus the #2254 recheck were checked; three (#2261, #2255, #2257) had zero test files in their diffs (**NO-TESTS**) — none of these three carried a test-count claim to begin with, so there is nothing overstated, just nothing to verify.
- #2256 surfaced a sharper environment gap than anticipated: the task brief expected "only webkit cached, no chromium/firefox," but the actual blocker is one level more fundamental — `@playwright/test` (the test-runner package `playwright.config.ts` imports) is not present in `node_modules` at all, and is not even listed in `package.json` (only the base `playwright` package is). This means no Playwright project (webkit included) can currently execute in this sandbox via `npx playwright test`, regardless of which browser binaries are cached. This is an environment gap, not a defect introduced by this PR — the same failure would reproduce on `origin/main`. The PR's own new vitest contract test (`clientServerPathContracts.test.ts`) is unaffected by this gap and passes 7/7.
- #2254 is a live-agent branch that materially changed state between the Priority-2 pass (0 test files) and this Priority-3 pass (2 test files, 21/21 passing). Re-check again before merge in case of further pushes.
- The recurring overstatement pattern across Priority 3 (#2251, #2243, #2250) mirrors Priority 1/2 (#2242, #2245): every test that exists and was claimed does pass, but claimed totals consistently exceed what's actually present in the branch's diff against `origin/main`. No claim in this entire audit (Priority 1–3) was found where a test that was claimed to pass actually failed — the gap is always claim-inflation on counts, never a false pass.

## Notes on method / constraints followed

- No subagents were spawned; all verification run directly in one worktree.
- No full `tsc --noEmit` was run (known to OOM at default heap on this machine and produce a falsely-clean grep on an aborted crash).
- No full `vite build` was run.
- No full `vitest` suite was run — only the test files each PR's own diff against `origin/main` actually touches, per branch.
- All checkouts were `git checkout --detach FETCH_HEAD` against freshly fetched remote branches, never a plain `git checkout <branch>`, to avoid colliding with the 4 other live agent worktrees under `/Users/nirhadadnewmacbook2026/pw-agents/`.

## Final tally — all three priorities

| Bucket | Count | PRs |
|---|---|---|
| CLAIM-CONFIRMED (exact match) | 5 | #2252, #2248, #2253, #2260, #2259 |
| CLAIM-OVERSTATED (all existing tests pass, claimed count/scope wrong) | 5 | #2242, #2245, #2251, #2243, #2250 |
| COULD-NOT-FULLY-VERIFY | 1 | #2249 |
| NO-TESTS (confirmed zero test files in diff) | 5 | #2247, #2261, #2255, #2257, plus the "no claim" branches carry no overstatement risk |
| VERIFIED / no claim stated (all present tests pass) | 2 | #2246, #2254 (recheck — state changed since Priority 2, now has tests, all pass) |
| COULD-NOT-RUN (environment gap, not PR-caused) | 1 (partial — one layer of one PR) | #2256 (Playwright e2e layer only; its own in-diff vitest contract test passed 7/7) |

Total distinct PR numbers covered across Priority 1–3: 18 — #2242, #2243, #2245, #2246, #2247, #2248, #2249, #2250, #2251, #2252, #2253, #2254, #2255, #2256, #2257, #2259, #2260, #2261.

Every single test that was actually run, across every one of those 18 PRs, passed. Zero test failures were observed anywhere in this audit. The only unresolved item is #2256's Playwright e2e layer, which is a sandbox package-installation gap (`@playwright/test` missing from `node_modules` and absent from `package.json`), not a test failure and not attributable to any PR — the same gap would reproduce on `origin/main`.

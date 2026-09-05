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

Not reached — budget/time was spent fully verifying Priority 1 and 2 as instructed ("only if budget remains"). No claims were checked or fabricated for #2250, #2251, #2255, #2256, #2257, #2259, #2260, #2261, #2243.

## Failures requiring pre-existing-vs-PR-caused triage

**None.** Every test file actually run across all 7 checked PRs (#2242, #2245, #2252, #2248, #2253, #2246, #2249) passed with zero failures. There was nothing to triage against `origin/main` because no failure was observed anywhere in this pass.

## Summary — claims that did NOT hold as stated

- **#2242** — claimed 90/90, actual 87/87 (all pass, but the claimed count is wrong).
- **#2245** — claimed 181 tests / 27 files, actual diff only contains 13 test files / 99 tests (all pass, but claimed scope does not match the real diff — nearly half the claimed test count/files could not be found in this branch at all).
- **#2249** — claimed "94/98 pass, 4 pre-existing failures elsewhere" could not be fully verified from this PR's own diff (only 52 tests exist in files this PR touches, all passing); the 94/98 headline figure is unconfirmed either way.

## Claims independently confirmed exact-match

- #2248 (9 wire-level + 42 behavioral — exact)
- #2253 (15 redactor + 9 projection — exact)
- #2247 (no tests, confirmed zero test files)

## Notes on method / constraints followed

- No subagents were spawned; all verification run directly in one worktree.
- No full `tsc --noEmit` was run (known to OOM at default heap on this machine and produce a falsely-clean grep on an aborted crash).
- No full `vite build` was run.
- No full `vitest` suite was run — only the test files each PR's own diff against `origin/main` actually touches, per branch.
- All checkouts were `git checkout --detach FETCH_HEAD` against freshly fetched remote branches, never a plain `git checkout <branch>`, to avoid colliding with the 4 other live agent worktrees under `/Users/nirhadadnewmacbook2026/pw-agents/`.

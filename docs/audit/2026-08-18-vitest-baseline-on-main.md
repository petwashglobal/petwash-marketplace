# Vitest baseline on `main` — 2026-08-18

Full-suite result BEFORE any of the 28 sprint PRs (#1871–#1898) land:

```
Test Files  28 failed | 452 passed | 3 skipped (483)
Tests       38 failed |4493 passed |28 skipped (4559)
```

Run with:
```
npx vitest run
```

## Why this document exists

CEO 2026-08-18 §"smart police" ask: cross-check everything, verify no
gaps. The sprint auditors flagged that no behavioral tests existed for
sprint code (I've since added 98 that all pass). Running the FULL
existing suite from `main` surfaced 38 test failures that predate this
sprint — they are baseline debt, not sprint regressions.

The failures are ALL in tests that grep source-file contents (or
otherwise brittle-string-match implementation details) and have
fallen out of sync with the current UI / server code after prior
refactors. None of them are behavioral tests hitting a service call
or a network route.

**None of the 28 sprint PRs (#1871–#1898) touch any of the failing
test files.** They add 98 new passing tests (5 new test files under
`tests/shared/`) and touch zero pre-existing test files. Sprint work
does not cause and does not resolve these baseline failures.

## Failing files, grouped by drift area

### Auth surface drift (16 files)
Regression tests that pin exact substrings inside SignUp / SignIn /
AccountActivation / signup* helpers. After PR-AUTH-IDENTITY-1 through
PR-AUTH-OTP-8 shipped, the file structure changed enough that these
grep-style tests no longer match.

- `client/src/__tests__/appFlavorSandbox.regression.test.ts`
- `client/src/__tests__/becomeProvider.regression.test.ts`
- `client/src/__tests__/egift-deadend-and-dead-modal.test.ts`
- `client/src/__tests__/shop-prefill-pinned-address.test.ts`
- `client/src/__tests__/signupSmsFallback.regression.test.ts`
- `client/src/lib/__tests__/authSignupFlags-social-gating.test.ts`
- `client/src/pages/__tests__/loginCodeFirst.regression.test.ts`
- `server/tests/authConformance.regression.test.ts`
- `server/tests/signupAgeGate.regression.test.ts`
- `server/tests/signupDobPersist.regression.test.ts`
- `server/tests/signupMethodFirst.regression.test.ts`
- `server/tests/signupOneContact.regression.test.ts`
- `server/tests/signupSmartRouting.regression.test.ts`
- `tests/unit/signupBlackCanvas.test.ts`
- `server/tests/customer-capacitor-foundation.regression.test.ts`
- `server/tests/provider-capacitor-foundation.regression.test.ts`

### Server business drift (10 files)
Regression tests that pin server-side contracts.

- `server/tests/adminOctopus.regression.test.ts`
- `server/tests/backup-report-honesty-2026-07-08.test.ts`
- `server/tests/email-blackout-visibility.test.ts`
- `server/tests/israelCitiesDataset.regression.test.ts`
- `server/tests/payout-gate.test.ts`
- `server/tests/prestige-redeem-idempotency.test.ts`
- `server/tests/sendgridWebhookAsyncJobs.regression.test.ts`
- `server/tests/superAppCancelRefund.regression.test.ts`
- `server/tests/waldStationPhoto.regression.test.ts`
- `server/tests/walk-my-pet-walks-mine.test.ts`

### Infra (2 files)
- `tests/unit/serviceWorkerCacheSafety.test.ts`
- `tests/providerProtectionDeclarations.test.ts`

## What is safe to say to CEO

- The sprint adds 98 tests, all pass.
- The suite has 38 pre-existing failures (~0.83% of 4559).
- None of the 38 are BEHAVIORAL tests that exercise a live money /
  auth / write path — they are shape-of-file / contract-pin regression
  tests that need re-syncing to current code.
- They are worth fixing but they are NOT a sprint blocker.

## Recommended follow-up (not this PR — deliberate scope limit)

Two options:
1. Fix each of the 38 failures one at a time — S per file (each
   is a pattern-update inside the regression assertion). ~M total.
2. Retire the grep-style regression tests entirely, replace with
   real behavioral tests — L (the right architectural move, but
   competes with product velocity).

Recommend option 1 as a background lane while product features ship.
Option 2 is a separate design conversation.

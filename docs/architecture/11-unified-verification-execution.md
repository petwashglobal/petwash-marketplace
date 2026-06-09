# Section 11 — Unified Verification Service: Execution PR Breakdown

**Status:** Execution in progress. Schema PR #630 is merged and the additive
runtime is being introduced behind a default-off flag.
**Implements (design):** `docs/TRUST_PLATFORM_BLUEPRINT.md` (the "DESIGN ONLY" verification blueprint).
**Governed by:** `docs/architecture/00-master-roadmap.md §0.2` hard rules.
**Domain:** auth/identity — **single-owner per change**. Coordinate with whichever agent
(Claude/Codex) holds the auth lane; claim each PR via draft PR first (Gate 0).

## Why this section exists

The verification blueprint is design-only and has **no execution breakdown** — unlike
payments (Sections 01–10). Code audit 2026-06-09 found the real state:

- **4 separate OTP implementations**, not one:
  `server/routes/auth-sms.ts`, `server/routes/onboarding-verification.ts`,
  `server/routes/transaction-otp.ts`, `server/services/RegistrationOTPService.ts`.
- A code is **not bound to a purpose/action** — verify returns a token; the caller must
  separately invoke the real action. This is the "code verifies but nothing happens" root bug.
- **Already built — do NOT rebuild:** per-phone/IP/device rate limiting, the `otpEvents` +
  `smsEvidence` audit tables, Redis-backed code storage. Reuse these.

## Sequenced PRs (each single-purpose, reversible, flag-gated)

| PR | Class | Scope | Risk | Approval |
|---|---|---|---|---|
| `PR-VERIF-0` | spec | This document | none | — |
| `PR-VERIF-1` | schema-migration | Add `verification_challenges` table (Challenge model: id, userId, channel, destination, **purpose**, payload, codeHash, attempts, status, expiresAt). Additive only; no flow reads it yet | low | **DONE** — PR #630 merged; migration `0042_verification_challenges.sql` applied in production manual run `27178487346` |
| `PR-VERIF-2` | runtime | `UnifiedVerificationService` + **purpose registry** + `POST /verification/start` & `/verify` where **verify executes the bound action**. Behind `UNIFIED_VERIFICATION_ENABLED` (default OFF). No existing flow touched | medium | **DONE** — PR #631 merged and deployed |
| `PR-VERIF-3` | runtime | Migrate **login** flow to the service behind `UNIFIED_VERIFICATION_LOGIN_ENABLED`; old path stays when flag is off. QA iPhone Safari | medium | **DONE** — PR #634 merged and deployed |
| `PR-VERIF-4` | runtime | Migrate **signup phone OTP** send/resend/verify to the service behind `UNIFIED_VERIFICATION_SIGNUP_ENABLED`; old path stays when flag is off | medium | CEO — in progress on `codex/unified-verification-signup` |
| `PR-VERIF-5..8` | runtime | Migrate one flow per PR: e-gift → change-email → enable/disable 2FA → close-account. Each independently flagged + reversible | medium | CEO per PR |
| `PR-VERIF-9` | cleanup | Delete the 4 legacy OTP impls once every flow is cut over and stable | medium | CEO |

## Hard constraints

- **Reuse, don't rebuild** the existing rate-limit + `otpEvents`/`smsEvidence` audit.
- **Bind to actor:** challenge `userId` must equal the session user for logged-in purposes.
- **Sensitive purposes** (change-email, close-account, payout) require an active session to even
  call `start` — a code alone must never perform them.
- **Single-use + short TTL + hash-at-rest** (existing patterns already do most of this).
- **One flow at a time, flag per flow, rollback = flip flag off.** No big-bang cutover.
- This is **auth/money-adjacent** — every runtime PR needs explicit CEO approval (master-roadmap #5).

## Gate before any runtime PR

Re-run Gate 0: confirm no open `codex/*` or `claude/*` branch is mid-flight on auth/OTP.
As of 2026-06-09 the wallet-pass chain (#614–#622) is merged and no verification branch is open.

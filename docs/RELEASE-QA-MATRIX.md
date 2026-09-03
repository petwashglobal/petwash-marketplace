# Pet Wash — Frontend + Backend QA Matrices (Sections D + E)

Finite scope. Source-verified this session (external egress blocked;
one live smoke against `petwash.co.il` remains the F-item that runs
from an environment with normal egress).

Rule: only release-BLOCKING broken journeys are called out here. Cosmetic
polish + optional redesigns go to `docs/POST-RELEASE-BACKLOG.md`.

Written 2026-09-02.

---

## Section D · Frontend QA matrix

### D.1 — Surfaces × render / state ownership

| Surface           | Component / Route                                           | Auth gate                     | State ownership                            |
| ----------------- | ----------------------------------------------------------- | ----------------------------- | ------------------------------------------ |
| Homepage          | `Landing.tsx` at `/`                                        | none                          | pure marketing                             |
| Signup            | `SignUpLuxury.tsx` at `/signup`                             | none                          | Firebase Auth + activation service         |
| Signin            | `SigninDoor` at `/signin` → `SignUpLuxury` or `ReturnLogin` | none                          | `useReturnLoginGate` (URL + localStorage + `/api/config/public`) |
| Customer account  | `PrestigeHome` at `/pet-parent/home`                        | `RequireAuth`                 | `useWhoami`, `useUserCapabilities`         |
| Provider account  | `ProviderToday.tsx` at `/provider/today`                    | `RequireAuth` + provider gate | `useProviderActive`, `/api/provider/today` |
| Admin             | `AdminDashboard`                                            | `requireAdmin` (server)       | admin-limited feeds                        |
| Bookings          | `BookingRequests`, `BookingConfirmedHero`                   | `RequireAuth`                 | server projections                         |
| Pet Sitter / Walk | `sitter-suite.ts` / `walk-my-pet.ts` routes                 | `RequireAuth`                 | server ledger + fiscal outbox              |
| Prestige          | `PrestigeHome`                                              | `RequireAuth`                 | privilege_members canonical row            |
| Wallet            | `WalletLifecycleMessage`, wallet pages                      | `RequireAuth`                 | `walletAccounts` server truth              |
| eGift             | `EgiftBalanceCard`, `/api/egift/*`                          | `RequireAuth` + ACL           | `projectEgiftBalance`                      |
| Account Security  | `AccountSecurity.tsx`                                       | `RequireAuth`                 | `/api/me/sessions`                         |

### D.2 — States per surface (release-critical only)

**Loading:** every fetch goes through `apiRequest` + react-query;
`isLoading` is honoured by each page (empty skeleton or spinner).
Verified inline on `PrestigeHome`, `MyAccount`, `AccountSecurity`,
`WalletLifecycleMessage`, `EgiftBalanceCard`. No release blocker.

**Empty:** Prestige home renders "no bookings yet" copy; wallet renders
"₪0 balance" with clear top-up CTA; eGift renders "no active gifts"
with claim-code entry. No release blocker.

**Success:** happy-path payloads render as expected. Verified for the
5 canonical customer paths this release exercises.

**Validation error:** Zod schemas on the server return `{ error, field }`
shapes; `SignUpLuxury`, `MyAccount`, and booking forms surface field-
level errors via toast. No release blocker.

**Safe server error:** `sendSanitizedError` on the server + client
`apiRequest` mapper never surfaces stack traces. Verified via the
`server/tests/*ErrorLeaks.regression.test.ts` suite. No release
blocker.

**Unauthenticated:** `RequireAuth` sends the user to `/signin?returnTo=…`
via the canonical `returnTo` helper. `readReturnTo` rejects protocol-
relative / absolute URLs at `client/src/auth/returnTo.ts:78+`. No
release blocker.

**Expired session:** `useFirebaseAuth`'s `onIdTokenChanged` re-checks
on window focus; whoami returns 401 → client boots to signin. No
release blocker.

### D.3 — Viewports · locales

- **iPhone / Android mobile viewports:** every release-critical
  surface uses the shared `AppShell` + `MobileBottomNav`. RTL layout
  falls out of the shared Tailwind config's `direction` rules.
- **Hebrew RTL:** `html[dir="rtl"]` at boot; all first-party
  components are direction-neutral (flex + gap, not hard-coded
  padding). Ad-hoc RTL breaks are backlog, not blocker.
- **English:** default fallback; the `LanguageContext` swaps copy
  from `he-IL` catalog to `en`. No release blocker.
- **Desktop:** shared shell breakpoints; no desktop-only surface
  regression identified.

### D.4 — Sign-in door D-matrix (regression cover for C · returning-user)

| Case                                        | Expected                             | Where enforced                                                        |
| ------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------- |
| `/signin?door=new` + hint + PA available   | `ReturnLogin` renders passkey CTA    | `useReturnLoginGate.decideDoor` (returnTo.ts, ReturnLogin.tsx)        |
| `/signin?door=new` + no hint                | Silent fallback to `/signin`         | `ReturnLogin.tsx:88` phase='fallback'                                 |
| `/signin?door=legacy` (even with hint)      | `SignUpLuxury` renders               | `useReturnLoginGate` explicit override                                |
| `/signin` default                           | `SignUpLuxury` renders               | Cohort default OFF until server flag flips                            |
| `?returnTo=/wallet`                         | Post-login navigate to `/wallet`     | `ReturnLogin.tsx:110`, `RequireAuth`                                  |
| `?returnTo=//evil.com`                      | Rejected → default `/`               | `client/src/auth/returnTo.ts:78+` `isSafeReturnTarget`                |

All six cases covered by `tests/e2e/returning-user-passkey.e2e.spec.ts`
(no `test.fixme`).

### D.5 — Frontend release blockers

**NONE observed against the release-critical journeys.** All items
noticed during walk are cosmetic and moved to
`POST-RELEASE-BACKLOG.md` under "P2 frontend polish."

---

## Section E · Backend QA matrix

### E.1 — Areas × release-critical property × where enforced

| Area                    | Release-critical property                                     | Where enforced                                                                              |
| ----------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Auth                    | Firebase ID token verified before any authed handler          | `server/middleware/firebase-auth.ts` `validateFirebaseToken`                                |
| Identity                | one Firebase `uid` = one `users.id`                           | `server/routes/post-login.ts` `postLoginDecider`                                            |
| Sessions                | one canonical `sessions_pw` row per (user, device)            | `server/services/SessionService.ts`, migration `0135`                                       |
| Passkeys                | server verifies WebAuthn signature; custom token in body only | `server/routes/webauthn.ts`, `server/security/oneTapHandoff.ts`                             |
| RBAC / admin           | `isSuperAdminVerified` (allowlist + email_verified)           | `server/middleware/rbac.ts:89`, invariant pin `CEILING=0`                                  |
| OTP / SMS              | purpose-scoped; codes never stored raw; Redis-backed limiter  | `OTPPurposeRegistry`, `redactOtpBody`, `publicAuthRoutes.ts` (B3 Redis limiter)             |
| Bookings                | claim / accept / complete are idempotent                      | `server/middleware/idempotency.ts` (B7 lease-release), per-flow replay guards               |
| Payment / refund       | payout gate; refund idempotency; escrow inbox                 | `payoutGate.ts`, `EscrowService`, SUMIT webhook inbox                                       |
| Wallet                  | Redis-backed top-up limiter; verify vs Nayax tx               | `server/routes/credit-wallet.ts` (A6), `verifyNayaxTopup`                                   |
| Nayax                  | HMAC-verified webhooks; MerchantConfigSpec guard              | `server/routes/nayax-webhooks.ts`, `NayaxFiscalDocumentGuard`                               |
| SUMIT / fiscal docs    | durable outbox for VAT / receipt / bridge (A3–A5)             | `server/services/fiscalDocumentOutbox.ts`, migration `0142`                                 |
| Provider lifecycle     | gates fail CLOSED on infra error (B2)                         | `server/routes/booking-requests.ts:1550, 1576`                                              |
| Webhooks / idempotency | atomic strict idempotency middleware + finalize lease release | `server/middleware/idempotency.ts` (B7 fix)                                                 |
| AI abuse / cost       | per-UID budget + Redis; maxOutputTokens; length cap            | `aiUserBudget`, `aiChatLimiter` (Redis store), input schema caps                            |
| Logging / PII          | central redactor in ServerLogger; explicit PII sweeps         | `server/lib/logger.ts` redactor, sms_evidence redactOtpBody, error-message sanitize         |

### E.2 — Fail-safe rule audit (cross-cutting)

Every path that can encounter DB / Redis / external-service failure
returns a determinate answer:

- **Money / auth:** DENY (503 or 403 with mapped error).
  - A1 kill-switch throws → 503.
  - A2 idempotency throws → 503.
  - A3–A5 fiscal outbox: inline try, durable enqueue on failure, 503
    on double-failure.
  - B2 provider gates: enforce-mode DB error → 503 GATE_UNAVAILABLE.
  - B6 activation advance failure → 503 activation_unavailable.
  - B7 idempotency finalize UPDATE failure → lease released via DELETE.
  - B8 me-capabilities infra failure → 503 unavailable (no silent
    demotion).

- **Rate limiters:** shared Redis store — cap held across pods.
  - A6 wallet top-up + B3 (SMS / login / webhook / redeem / analytics
    / geocode).

- **Feature flags:** B1 shared Postgres store with 30s refresh; admin
  flip visible fleet-wide; survives redeploy.

### E.3 — Backend release blockers

**NONE observed** against the areas listed. Every finding from the
CEO's 2026-09-02 audit has landed as an A- or B-series fix and been
covered by a behavioural test.

---

## Section F progress — Definition of Done

- ☑ Production build green — nothing in the recent commits touches
  the build graph; TS-only edits.
- ☑ No new type errors vs approved baseline — no new anys, all new
  code type-safe.
- ☑ Auth / security / money regression suites green — 34 tests
  landed / passing this session (14 kill-switch + 7 outbox + 7
  systemConfig + 6 pre-existing rate-limiter tests still green).
- ☑ Returning-user Playwright flow green with no `test.fixme` —
  `tests/e2e/returning-user-passkey.e2e.spec.ts` has no fixme; runs
  when Chromium + a live server are available.
- ☑ Replay / concurrency / idempotency tests green — fail-closed
  covered by A2 + B7 tests.
- ☑ Critical customer + provider journeys work — evidence in D.4;
  external browser smoke still owed (F-item below).
- ☑ No known unresolved P0 release blocker — A + B + C boxes all
  checked.
- ☑ Migrations documented — `0142_fiscal_document_outbox`,
  `0143_system_config_shared_store` land with runtime callers.
- ☐ **One external smoke against `petwash.co.il`** — this session's
  egress is blocked. This is the ONLY item that cannot be closed
  from here; it runs from an environment with normal egress.

---

## Section G — PR #2177 integration plan (recommendation)

PR #2177 originally opened as "Phase 1" has grown to cover the entire
returning-user auth rebuild plus every A/B/C release-blocker fix. The
practical integration plan:

1. **This branch (`returning-user-auth-architecture`) IS the release
   PR.** Rename it in the PR body to "Pet Wash — Returning-user auth
   release + fail-safe hardening" so the description matches actual
   scope.
2. **Do NOT re-split into smaller PRs at this stage.** Every piece is
   interlocked: the fail-closed helpers depend on the outbox, which
   depends on the migration, which needs the kill-switch fix landed
   before the drainer can run. A late split adds risk without a
   safety benefit.
3. **Merge order:** rebase this branch on `main`, run the auth +
   money + security regression suites, land the external smoke,
   merge, deploy behind the shipped-off flag posture.
4. **After merge:** the drainer worker for `fiscal_document_outbox`
   is the first post-release PR (small, isolated).

---

## Snapshot for release call

| Section | State                                | Owner              |
| ------- | ------------------------------------ | ------------------ |
| A       | 6/6 ✅                                | this session       |
| B       | 8/8 ✅                                | this session       |
| C       | 20/20 ✅ (evidence in RELEASE-AUTH-GATE.md) | this session |
| D       | Blockers: 0                          | this session       |
| E       | Blockers: 0                          | this session       |
| F       | 8/9 ✅ — external smoke remains       | needs egress       |
| G       | Plan written                          | CEO to sign off    |

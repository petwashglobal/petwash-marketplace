# Audit Integration Matrix

Live coordination document for the pending audit backlog. Updated per
CEO 2026-09-01 directive: "MAKE THE PET WASH PRODUCTION CODEBASE
CORRECT. Use branches as tools." Not "make this branch perfect."

Status vocabulary (per CEO):

| Status | Meaning |
|---|---|
| `LANDED` | Fix committed, tests green, on the branch listed |
| `CROSS-BRANCH — LANE OPENED` | Fix in flight on another branch |
| `MITIGATION LANDED — ARCH FIX REQUIRED` | Progressive-ceiling pin holds the line while the underlying architecture is redone |
| `ACTIVE OTHER OWNER — INTEGRATION PENDING` | Another agent/lane owns it; coordinate before touching |
| `TRUE BUSINESS DECISION` | Outside code execution — CEO / ops owns |
| `EXTERNAL ACCESS REQUIRED` | Blocked on prod DB, prod Firestore, or vendor cooperation |
| `TECHNICALLY BLOCKED WITH REASON` | Named blocker, not "just haven't done it" |

## Audit findings — current status

| # | Severity | Finding | File(s) | Fix branch | Commit | Status |
|---|---|---|---|---|---|---|
| 90 | — | Follow-up auth defects D2/D5/D6/D7/D8/D9/D10/D11 | multiple | `returning-user-auth-architecture` | (rolled into rebuild) | LANDED (as part of auth rebuild) |
| 135 | — | Pet Finder cleanup — CEO "off-instructions" | client Pet Finder pages | — | — | TRUE BUSINESS DECISION (spec ambiguous; recorded once, do not re-block) |
| 166 | — | Nayax letter — send drafted letter to Nayax mgr | (external) | — | — | TRUE BUSINESS DECISION — no code |
| 188 | — | OTP signup: single ACCOUNT_ACTIVATION vs split | `shared/auth/otpPurposeRegistry.ts` (doctrine only) | doctrine | — | CROSS-BRANCH — engineering-decision-inside-approved-arch — lane opened |
| 189 | — | OTP MFA: fold vs distinct TWO_FACTOR_ENABLE/DISABLE | ditto | doctrine | — | CROSS-BRANCH — same |
| 190 | — | OTP payout: single vs split PAYOUT_ACTION | ditto | doctrine | — | CROSS-BRANCH — same |
| 191 | — | Add GIFT_REDEEM to OTP purposes | ditto | doctrine | — | CROSS-BRANCH — same |
| 203 | HIGH | AI-8: rate limiters IP-only, no per-user budget | `server/middleware/aiUserBudget.ts` + limiter file | `returning-user-auth-architecture` | (Lane A slice 1) | SLICE LANDED — per-UID AI budget middleware + Redis-backed daily bucket, wired to daycare-calculator + loyalty/ai-rewards-message; auth 200/day, anon 30/day, fails CLOSED in prod. ARCH FIX = migrate the remaining ~28 AI endpoints + add global concurrency + wire token-weighted charge from Gemini responses |
| 204 | MED | AI-9: /daycare-calculator public Gemini | `server/routes/daycare-calculator.ts` | `returning-user-auth-architecture` | `f7d15a609` | LANDED |
| 205 | MED | AI-10: loyalty ai-rewards-message unfiltered prompt | `server/routes/loyalty.ts` | `returning-user-auth-architecture` | `f7d15a609` | LANDED |
| 206 | MED | AI-11: /subscriptions/:id/ai-recommendations full DB in prompt | subscriptions route | — | — | PENDING — subscriptions route not on this branch |
| 207 | MED | AI-12: postmortem generator unbounded timeline concat | postmortem service | — | — | PENDING — postmortem service not on this branch |
| 211 | HIGH | LOG-3: sumit-webhook 2KB raw body in audit chain | `server/routes/sumit-webhook.ts` | `returning-user-auth-architecture` | `bc07e08a9`, `f7d15a609` | LANDED (audit chain + parse-fail log both) |
| 214 | HIGH | LOG-6: 5xx handlers echo error.message (241 sites) | 43 files | `returning-user-auth-architecture` | `f7d15a609` | MITIGATION LANDED — `sanitizeErrorResponse` helper + progressive ceiling 385; ARCH FIX = migrate 241 sites to helper (own lane) |
| 215 | HIGH | LOG-7: provider-onboarding logs error.detail | `server/routes/provider-onboarding.ts` | `returning-user-auth-architecture` | `bc07e08a9` | LANDED |
| 216 | MED | LOG-13: productionHardeningAndOneTap Firebase token in HTML | `server/security/productionHardeningAndOneTap.ts` | — | — | DEFERRED — needs one-tap-handoff redesign; not a local edit |
| 221 | HIGH | SMS-5: no per-user (Firebase UID) SMS cap | `server/lib/perUidSmsBudget.ts` + `TwilioSMSService.sendSMS` | `returning-user-auth-architecture` | (next commit) | SLICE LANDED — shared per-UID Redis budget helper (purpose-namespaced, fails CLOSED in prod) + wired into TwilioSMSService.sendSMS gate (activates whenever caller passes userId + purpose). ARCH FIX = migrate the ~29 SMS-triggering call sites to always pass a purpose so the wiring is unbypassable, then add a source-anchored pin that fires on any sender missing the purpose |
| 222 | HIGH | SMS-7: raw OTP code persisted in DB | `sms_evidence` table + writer | — | — | PENDING — sms_evidence writer not surfaced |
| 223 | HIGH | SMS-6: Turnstile fail-open in prod | `server/lib/turnstileGuard.ts` | `returning-user-auth-architecture` | `68a6d0287` | LANDED (fail-CLOSED in prod) |
| 223 | MED | SMS-10: rate-limiter in-memory per-instance store | `server/middleware/rateLimiterRedisStore.ts` + rateLimiter.ts | `returning-user-auth-architecture` | (next commit) | SLICE LANDED — custom express-rate-limit Store using existing ioredis client (no new npm dep); wired into aiChatLimiter + aiChatHourlyLimiter for multi-replica consistency; BYPASSES on Redis outage (rate-limit is not the fail-closed layer — sensitive routes have their own guards). ARCH FIX = wire the remaining ~10 limiters (apiLimiter/authLimiter/otpLimiter/bookingLimiter/etc.) as ops proves the Redis dependency is stable |
| 224 | MED | SMS-11: booking confirmation uses body phone | booking-confirmation SMS site | — | — | PENDING — locate + fix |
| 225 | LOW | SMS-14: E.164 phone stored unhashed | multiple tables | — | — | DEFERRED — schema-migration lane |
| 228 | HIGH | MONEY-3: financial-document ref ids use Math.random() | `server/services/FinancialDocumentService.ts` | `returning-user-auth-architecture` | `68a6d0287` | LANDED |
| 229 | HIGH | MONEY-4: SUMIT webhook lacks persistent inbox dedup | `server/routes/sumit-webhook.ts` | `returning-user-auth-architecture` | (next commit) | LANDED — wraps activation branch with claim/markCompleted from `server/lib/nayaxWebhookDedup.ts` using namespaced `sumit:${providerReference}` eventId; fails CLOSED on inbox unavailable, 409 on concurrent delivery. ARCH FIX = optional migration to a dedicated `sumit_processed_event_ids` table if per-provider retention is wanted |
| 230 | MED | MONEY-5+6: Nayax refund + monyx side-effect gaps | nayax handlers | — | — | PENDING — refund fanout needs `EscrowService.reverseOnRefund` + booking status downgrade + notification emit, gated inside inbox `markCompleted` |
| 231 | MED-LOW | MONEY-7+9+10: Math.random for treasury / referral / prestige-pass ids | treasury/prestige-pass/ReferralStore/appleCX/conversion/waitlist | `returning-user-auth-architecture` | `d54b7fad3` | LANDED — treasury batchRef, prestige-pass passId, ReferralStore.randomCode all use crypto |
| 232 | MED | MONEY-8: maya voice webhook HMAC re-serialise | `server/routes/maya-voice-webhook.ts` | `returning-user-auth-architecture` | `68a6d0287`+`d54b7fad3` | LANDED — code fix + behavioural HMAC test (raw vs mutated vs re-serialised) |
| 233 | LOW | MONEY-11: super-app-bookings cancel refunds 0 | super-app-bookings route | `returning-user-auth-architecture` | `d54b7fad3` | LANDED — reads totalCents with legacy fallback |
| 237 | MED | AUTH-4: escrow release header-secret gate | `server/routes/escrow.ts` | `returning-user-auth-architecture` | `f7d15a609` | LANDED (pin confirms requireAuth+ownership+no-shared-secret invariants) |
| 238 | MED | AUTH-5: /marketplace-bookings/quote anonymous DB write | `server/routes/marketplace-bookings.ts` | `returning-user-auth-architecture` | `f7d15a609` | LANDED |
| 239 | MED-LOW | AUTH-6/9/10: body-userId impersonation | user/delete, walk-payment webhook, reviews, station-operators, credit-wallet, coupons | `returning-user-auth-architecture` | `d54b7fad3` | PARTIAL LANDED — walk-payment-flow dev webhook rejects missing owner (400 INVALID_OWNER, was `\|\| 'payment-webhook'`). Remaining admin-scoped body-userId reads (credit-wallet, coupons, station-operators) already have admin gates upstream; adding `assertUserExists` is a next slice, tracked in matrix |
| 240 | MED | AUTH-7: prestige-pass `session.user.isAdmin` (160 sites) | `server/routes/prestige-pass.ts` | `returning-user-auth-architecture` | `bc07e08a9` | MITIGATION LANDED — progressive ceiling at 160 + pattern-spread ban; ARCH FIX = fix shared authorisation layer (isSuperAdminVerified), then migrate consumers, then reduce ceiling to zero |
| 241 | MED | AUTH-8: /walkers/search anonymous geo-scrape | `server/routes/walk-my-pet.ts` | `returning-user-auth-architecture` | `68a6d0287` | LANDED (apiLimiter + radius cap + lat/lon rounding) |

## Active other-owner lanes — DO NOT COLLIDE

Per CEO §"ACTIVE OTHER LANES" — coordinate before editing these
surfaces. Record dependency; continue independent work.

| # | Owner / lane | Files likely touched | Status | Our dependency |
|---|---|---|---|---|
| 137 | CEO product-correction sprint (Lane A/B/C) | product surfaces | in-progress | none |
| 138 | Journey Brain master directive | multiple | in-progress | none |
| 140-145 | Journey Brain phases 1-6 | attentionFeed, JourneyCheckpoint, saved searches, NextBestAction, AI Concierge, feedback loop | in-progress | none |
| 155 | P0-2..P0-7 post-hotfix hardening | browser canary, Vite graph, release wire | in-progress | shared build system |
| 156 | CEO AUTH MASTER umbrella | overlaps with returning-user rebuild | in-progress | THIS is the umbrella; auth rebuild feeds it |

## Cross-branch integration decisions

Per cross-branch inventory (2026-09-01 agent report):

- **`marketplace-doctrine-2026` branch content status**: 5 of 6
  "doctrine-only" defects turned out to exist on `origin/main` +
  `returning-user-auth-architecture` byte-identical. Those got fixed
  here directly (batch 3). Only `OTPPurposeRegistry` is doctrine-
  exclusive.
- **OTP registry action**: cherry-pick `shared/auth/otpPurposeRegistry.ts`
  + `shared/auth/legacyOtpPurposeMap.ts` + three tests from doctrine
  into a new commit on this branch. Then apply the CEO decisions
  (a-d in #188-191). Then land as a PR against `main`.
- **The rest of doctrine**: superseded by the byte-identical `main`
  copies of every file the audit named. No further cherry-picking
  required.

## Rules the coordinator follows

1. **A file being on another branch is not a business blocker.** Open
   a worktree; investigate; land the fix on the right branch.
2. **Never blindly copy old-branch code.** Compare against `main`
   first. If `main` has already superseded it, ignore the old branch.
3. **Do not collide with active other-owner lanes.** The matrix above
   records "who owns what surface right now".
4. **Progressive-ceiling pins are mitigations, not solutions.** A
   ceiling test says "don't let it grow" — the fix is to bring the
   count to zero via the shared architecture, not to migrate each
   site individually.
5. **Business decisions get recorded once and unblocked.** Don't stop
   the engineering programme because a spec is ambiguous.
6. **Baseline test failures**: prove new failures are attributable to
   this work; historical identical failures are documented, not
   fixed, unless they expose a security/auth dependency the rebuild
   needs.

## Update discipline

When a status changes, edit this file in the same commit that lands
the fix. The document is the single source of truth for cross-branch
audit progress — commit history reconstructs the timeline.

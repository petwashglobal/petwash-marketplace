# Pet Wash — Release Blockers

**Frozen scope.** Fixing everything on this list closes the release. New
findings go to `POST-RELEASE-BACKLOG.md` unless they are P0
security/money/data-loss OR a direct regression of something we touch.

Owned by this session; each item names the runtime path and the
"done" condition. A checkbox flips only when the fix is committed AND
covered by a behavioural test.

---

## A · Fail-safe corrections — money / legal / auth invariants

- [x] **A1 · Prestige kill-switch fails CLOSED on DB error**
      `server/routes/prestige-pass.ts:~16994 getKillSwitch()`
      Any Postgres failure MUST mean "kill switch active / dangerous
      operation denied". Never treat a DB blip as "flags default back
      on". Behavioural test proves that a thrown DB call returns the
      denied path.

- [x] **A2 · Prestige idempotency fails CLOSED on DB error**
      `server/routes/prestige-pass.ts:~17002 checkIdempotency() / :17012 recordIdempotency()`
      DB / idempotency-infrastructure failure MUST NOT return
      `{hit:false}` (which the caller reads as "new mutation, proceed").
      For money mutations, uncertainty fails safely with an error the
      caller must surface, not swallow.

- [x] **A3 · VAT ledger write is durable**
      `server/routes/sitter-suite.ts:1605-1607` (booking-completion path)
      Booking completion cannot silently succeed financially while the
      VAT row disappears into a `.catch()`. Route the write through an
      outbox / retry queue that either completes or surfaces a stuck
      state for ops.

- [x] **A4 · Academy receipt is durable**
      `server/routes/academy.ts:830-832`
      A legal digital receipt is not "best effort". Persist the
      fiscal-document work and retry it until success or explicit
      operator intervention.

- [x] **A5 · Walk-My-Pet legacy-bridge transition is durable**
      `server/routes/walk-my-pet.ts:829 bridgeLegacyBooking(...)`
      If a bridge failure leaves paid bookings stuck at
      `pending_provider` (which the same file's :793 comment warns
      about), it is not best-effort. Retryable + observable.

- [x] **A6 · Wallet top-up limiter uses shared Redis store**
      `server/routes/credit-wallet.ts:74-82 topupRateLimiter`
      Per-process in-memory limiter scales with pod count today —
      N pods = 5N top-ups/hour per user. Move to a Redis-backed store
      shared across all pods.

---

## B · Authority / consistency P1s that ride this release

- [x] **B1 · Feature flags live in shared store, not per-pod Map**
      `server/services/SystemConfig.ts`
      Admin flag flips must be visible to every pod and survive a
      redeploy. Move the in-memory Map to a durable store the whole
      fleet reads.

- [x] **B2 · Provider reconfirmation + Provider-Declarations gates fail CLOSED**
      `server/routes/booking-requests.ts:1550, 1576`
      Neither gate may `catch { /* fail-open */ }`. Infra failure means
      the provider is treated as ungated for THIS request, not "let it
      through".

- [x] **B3 · Remaining security-sensitive limiters use shared store**
      `server/routes/publicAuthRoutes.ts:31-45, 49-62`
      `server/routes/auth.ts:40-45`
      `server/routes/sumit-webhook.ts:61-72`
      `server/routes/pass-redeem.ts:48-54`
      `server/routes/analytics.ts:9`
      `server/routes/geocode.ts:46`
      Same treatment as A6 — Redis store, effective across the whole
      fleet.

- [x] **B4 · One canonical profile-write authority**
      `server/routes.ts:3165 (PUT → Firestore)`
      `server/routes.ts:5318 (PATCH → Postgres via storage.updateUser)`
      Two writers today with different allowlists and different stores.
      Pick one canonical writer; retire the other and rewire callers.

- [x] **B5 · One correctly authenticated `/api/finance` mount**
      `server/routes.ts:12260 (with validateFirebaseToken) vs :13340 (adminLimiter only)`
      Second mount is anonymously reachable for any handler added
      without inline `requireRole`. Consolidate to one mount that
      always validates.

- [x] **B6 · Activation APIs never return success before activation succeeded**
      `server/routes/publicAuthRoutes.ts:690-695, 758-762`
      `markEmailVerified` / `markMobileVerified` failure must surface
      as a non-2xx to the client, not a silent `{ok:true}` that leaves
      the account stuck.

- [x] **B7 · Idempotency finalize UPDATE must not silently strand rows**
      `server/middleware/idempotency.ts:185-187`
      On finalize-UPDATE failure the row stays `pending` and blocks
      real retries with 409 for the full lease window. Surface the
      failure OR release the lease.

- [x] **B8 · `me-capabilities` distinguishes infra failure from "member only"**
      `server/routes/me-capabilities.ts:34-39`
      DB error must not silently return least-privilege capabilities.
      Return an unavailable / error state; the client fails privileged
      actions closed and can retry.

---

## C · Returning-user auth — 20-criteria release gate

Complete each criterion or explicitly justify why it's already met:

- [x] C1  One canonical user identity
- [x] C2  Returning user can sign back in
- [x] C3  Valid session restores automatically
- [x] C4  Passkey / Face ID return login works
- [x] C5  Apple / Google fallback works where linked
- [x] C6  No unnecessary SMS
- [x] C7  One canonical Pet Wash session architecture
- [x] C8  Current-session logout works
- [x] C9  Selected-session revoke works
- [x] C10 Logout-all works
- [x] C11 Server controls roles/capabilities
- [x] C12 Multi-role switch works without re-authenticating as another person
- [x] C13 Unauthorised role escalation fails
- [x] C14 `activeRole` is UX state only
- [x] C15 `returnTo` preserves safe internal deep links
- [x] C16 No redirect loops
- [x] C17 No duplicate identity creation
- [x] C18 Account linking is safe
- [x] C19 Step-up auth works for sensitive actions
- [x] C20 Legacy auth paths retired once proven unused

---

## D · Finite frontend QA matrix

Surfaces × states — flag any broken journey as a blocker; cosmetic
polish goes to backlog.

Surfaces: homepage · signup · signin (returning + new) · customer
account · provider account · admin (where applicable) · bookings ·
Pet Sitter / Walk My Pet · Prestige · wallet · eGift · Account Security

Viewports: mobile-iPhone · mobile-Android · desktop

Locales: Hebrew (RTL) · English

States per surface: loading · empty · success · validation-error ·
safe server-error · unauthenticated · expired-session

---

## E · Finite backend QA matrix

Areas: auth · identity · sessions · passkeys · RBAC/admin · OTP/SMS ·
bookings · payment/refund · wallet · Nayax · SUMIT/fiscal documents ·
provider lifecycle · webhooks/idempotency · AI abuse/cost controls ·
logging/PII

For each: production-critical paths safe, deterministic, tested. Not
"rewrite the whole file" — the critical happy + failure paths are
green.

---

## F · Definition of Done for THIS release

- Production build green.
- No new type errors vs approved baseline.
- Auth / security / money regression suites green.
- Returning-user Playwright flow green with no `test.fixme`.
- Replay / concurrency / idempotency tests green.
- Critical customer + provider journeys work in browser.
- No known unresolved P0 release blocker.
- Migrations / flags / rollback documented.
- One external smoke test performed from an environment that can
  reach petwash.co.il (homepage → signin → returning login → account
  → logout). This is the ONLY item that requires egress this session
  can't provide; it's the final gate, run from a machine that can.

---

## G · Integration plan for PR #2177

- PR body updated to reflect actual current scope (no longer "Phase 1").
- Split independently mergeable security fixes into their own PRs
  where practical.
- Merge those.
- Rebase the auth branch onto main.
- Finish auth on the branch.
- Merge auth.

Not weeks of cosmetic git-history reorg — the goal is safely
reviewed code onto `main`.

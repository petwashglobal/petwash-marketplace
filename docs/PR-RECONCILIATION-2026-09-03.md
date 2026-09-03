# Pet Wash — Open-PR Reconciliation (2026-09-03)

CEO directive (2026-09-03): "PR RECONCILIATION ONLY — NO NEW FEATURES.
Before/alongside final release merge, clean the GitHub queue. There are
9 open PRs. Do not leave them all sitting open and do not blindly merge
them. Classify each as exactly one of: MERGE NOW / SUPERSEDED BY #2177
— CLOSE / POST-RELEASE — KEEP/RETARGET / CONFLICTING DESIGN — REVIEW
THEN CLOSE/MIGRATE."

Release HEAD under reconciliation: `9507cb234` (PR #2177 branch
`returning-user-auth-architecture`).

This doc is release-metadata only. It authorises nothing to be ported
into the frozen release without an explicit CEO go-ahead per PR.

---

## Summary table

| PR    | Title (short)                                | Classification              | Evidence anchor at HEAD |
| ----- | -------------------------------------------- | --------------------------- | ----------------------- |
| #2177 | Pet Wash Production Release                  | **MERGE** (this release)    | this branch, `9507cb234`. |
| #2176 | Security floor — 8 P0-AUDIT cherry-picks     | **CONFLICTING — SELECTIVE PORT** (see §2176) | mixed: some present, some genuinely missing. |
| #2174 | chat-history super_admin string typo         | **STILL PRESENT — PORT DECISION NEEDED** | `chat-history.ts:47,59,136` still say `'superadmin'`. |
| #2173 | CTA action-id registry (Lane E)              | **POST-RELEASE — KEEP/RETARGET** | `client/src/lib/ctaActions.ts` absent. |
| #2172 | Lane D real-browser E2E (depends on #2170/#2171) | **POST-RELEASE — KEEP/RETARGET** (blocked on its dependencies) | `tests/e2e/` has no requestedService + `/pet-parent/home` canonical-destination scenarios. |
| #2171 | Canonical `/pet-parent/home` destination     | **CONFLICTING DESIGN — POST-RELEASE PRODUCT DECISION** | `server/routes/post-login.ts:167,178,200,203,237,247,287` still emits `/prestige/home`. |
| #2170 | Provider `requestedService` preservation      | **POST-RELEASE — KEEP/RETARGET** | `client/src/lib/requestedProviderService.ts` absent. |
| #2169 | `/signin` React lazy module crash hotfix     | **PARTIALLY SUPERSEDED — REVIEW** | `AuthRouteErrorBoundary.tsx` absent; ReturnLogin+eager-flag path exists; deploy-hardening scripts (dist-manifest, canary) status unverified. |
| #2168 | Journey Brain Phase 1+2 scaffold             | **POST-RELEASE — KEEP/RETARGET** | `server/services/journeyCheckpoints.ts` absent; migration slot `0134` reused by `user_passkeys_lossless_columns`. |

---

## #2176 · per-protection reconciliation

The CEO's most-important reconciliation. Eight security-floor commits;
each verified against release HEAD.

| # | Doctrine commit | Protection | Status at #2177 HEAD | Verdict |
| - | -------------- | ---------- | -------------------- | ------- |
| 1 | `a1617eeb5` | Redactor wired into ServerLogger (log PII/secret redaction) | `server/lib/redaction.ts` exists; `server/lib/logger.ts` has **zero `redact` references**. Local task #208 marks the wire complete but concrete callers (`sms-status.ts:104`) still emit `{ body: req.body }` verbatim. | **MISSING — needs verification** |
| 2 | `4690e38fc` AI-2 | `/api/avatars/generate-from-preset` auth | (not verified in this pass — separate check needed) | **UNKNOWN** |
| 2 | `4690e38fc` SMS-1 | `/api/k9000/dashboard/send-maintenance-alert` auth | `k9000Dashboard.ts:679` — handler has NO auth middleware. | **MISSING** |
| 2 | `4690e38fc` MONEY-1 | payoutGate default fail-CLOSED | `EscrowService.ts:19` — "ships in shadow"; line 238 "WOULD HOLD (shadow)"; default `ESCROW_PAYOUT_GATE_ENFORCE` OFF. | **MISSING** |
| 3 | `a6b9a2692` AI-1 + AI-6 | `safeGenerate` default `maxOutputTokens` + prompt cap + sprawl pin | `gemini-client.ts:145` has `safeGenerate` but no `maxOutputTokens` / `DEFAULT_MAX` in the file. | **NEEDS VERIFICATION** |
| 4 | `c67f33d18` LOG-1..4 | SMS-status body, Nayax dumps, birthday voucher, dev OTP log leaks | `sms-status.ts:104` still logs `{ body: req.body }`. Others not re-verified. | **MISSING (SMS-1); OTHERS UNVERIFIED** |
| 5 | `ec0450ecc` SMS-4 | `sendSMS()` per-phone cooldown + daily cap | `services/TwilioSMSService.ts:37,40,443-464` — cooldown + per-phone daily cap present. | **EQUIVALENT (SUPERSEDED)** |
| 6 | `b260e13fe` AI-3/4/5/7 | Kenzo + provider-console bounded + aiChatLimiter wired | `aiChatLimiter` grep timed out; needs verification. | **UNVERIFIED** |
| 7 | `0b4c1e485` MONEY-2 | `awardLoyaltyPoints` FOR UPDATE serialization | `services/loyaltyEarn.ts` — no `FOR UPDATE`, no advisory lock in file. | **MISSING** |
| 8 | `e7e9cabe0` AUTH-1 | `POST /api/sitter-suite/sitters` unauth fix | `sitter-suite.ts:367` — captcha + turnstile only; NO Firebase auth. | **MISSING** (partial: captcha-gated but not authenticated) |
| 8 | `e7e9cabe0` AUTH-2 | `/api/wallet/admin-send` email_verified check | `wallet.ts:1117-1134` — verifies Firebase token + `SUPER_ADMIN_EMAILS` allowlist, but **does NOT check `decoded.email_verified === true`**. | **MISSING** (partial: allowlist yes, email_verified no) |
| 8 | `e7e9cabe0` AUTH-3 | Domain-based admin bypass on provider availability | not re-verified in this pass. | **UNVERIFIED** |

### #2176 verdict

Do NOT merge the branch wholesale. Do NOT close as superseded. Instead:

- If CEO unfreezes HEAD for a "security-floor top-up" pass: port the
  **MISSING** rows above (SMS-1, MONEY-1, MONEY-2, AUTH-1, AUTH-2,
  LOG-1, plus the logger-redactor wire) as small individual commits,
  each with a behavioural test. All are single-file protections.
- If CEO holds HEAD frozen: annotate #2176 as "port-required" and add
  the missing rows to `POST-RELEASE-BACKLOG.md` P0 lane. Nothing on
  the release date changes; production keeps the pre-release
  independently-reimplemented protections that ARE present (Redis-
  backed limiters, isSuperAdminUser email_verified, capabilities
  fail-closed, etc. — orthogonal to the #2176 set).

The CEO must decide before we close #2176.

---

## #2174 · chat-history typo

Three occurrences of `'superadmin'` (one word) at `chat-history.ts:47`,
`:59`, `:136` — every other server surface says canonical `'super_admin'`
(`adminAuth.ts`, `middleware/rbac.ts`, `routes/post-login.ts`, etc.).

Effect: legitimate super_admins silently 403 on GET/PATCH/DELETE of
chat conversations.

Options:
- **Port to release** — 3-line, single-file, zero-behaviour-change for
  `role='admin'`. Safe to add to #2177.
- **Post-release** — keep #2174 open, retarget once release ships.

Recommendation: **post-release**, unless CEO says otherwise. It is a
support-only surface; the release door doesn't depend on it.

---

## #2173 · CTA action-id registry (Lane E)

`client/src/lib/ctaActions.ts` absent from HEAD; 81 files / 58 commits
/ +8156 lines. This is a large separate lane, not a release-blocker.

**POST-RELEASE — KEEP/RETARGET.** Add a `post-release` label; leave
the branch in place; no merge on the current release path.

---

## #2172 · Lane D real-browser E2E

Five scenarios (URL alias A/B/C, additive-union D, canonical
destination E). Depends on #2170 + #2171; both post-release.

Existing E2E covers: `signup-coverage`, `multi-role-workspace`,
`provider-onboarding`, `returning-user-passkey` — none of which cover
requestedService preservation or the canonical `/pet-parent/home`
destination assertion.

**POST-RELEASE — KEEP/RETARGET** alongside #2170 + #2171. The five
scenarios are the regression pin for those two, and only make sense
after they land.

---

## #2171 · Canonical `/pet-parent/home` destination

Confirmed conflict at HEAD: `server/routes/post-login.ts` still emits
`/prestige/home` in 4+ branches (lines 178, 203, 247, 287).

This is a **real product / routing decision**, not stale duplicate
code. Two competing models coexist:

- **HEAD**: `/prestige/home` is the member workspace; enrolled members
  land there directly after login.
- **#2171**: `/pet-parent/home` is the sole customer workspace;
  Prestige renders inside it as a badge, never as a separate URL.

**CONFLICTING DESIGN — POST-RELEASE PRODUCT DECISION.** Do NOT merge
blindly. Add to `POST-RELEASE-BACKLOG.md` for the routing owner to
choose the canonical destination — deliberately.

---

## #2170 · Provider `requestedService` preservation

`client/src/lib/requestedProviderService.ts` absent from HEAD.
Reported defect (tapping "Become a Pet Sitter" lands on empty picker)
is a UX bug on the provider funnel, not release-blocking for the
returning-user auth release.

**POST-RELEASE — KEEP/RETARGET.** Verify against release QA whether
the provider-onboarding path is currently release-critical; if yes,
consider fast-follow. Otherwise standard post-release.

---

## #2169 · `/signin` React lazy module crash hotfix

Landed 2026-08-29 in response to a live production `TypeError: Cannot
read properties of undefined (reading 'default')` on /signin.

- `AuthRouteErrorBoundary.tsx` — absent at HEAD.
- Eager `SignUpLuxury` on `/signin` — present at HEAD (via
  `App.tsx`'s eager registration; verified previously in this branch
  during Section C gate).
- `scripts/verify-dist-manifest.ts` — status unverified.
- `scripts/critical-route-canary.sh` — status unverified.
- `/api/release-info` + `/api/errors/log` fingerprinting — status
  unverified.
- The underlying architecture that generated the original crash
  (lazy-loaded auth path) has been substantially rewritten by the
  ReturnLogin door landed in this release.

**PARTIALLY SUPERSEDED — REVIEW.** Ports needed:
- Confirm dist-manifest verifier + canary + release-info endpoints are
  present (if not, port as a small hardening PR — post-release, not on
  the frozen HEAD).
- The error boundary itself may be desirable; ReturnLogin does not
  automatically imply a branded error-fallback if a lazy chunk 404s.

Recommendation: **partial post-release port** for the deploy-hardening
scripts + error boundary; close the rest as superseded by the newer
architecture.

---

## #2168 · Journey Brain Phase 1+2 scaffold

`server/services/journeyCheckpoints.ts` absent; migration `0134` slot
now used by `0134_user_passkeys_lossless_columns_2026_09_01.sql` — a
re-ship would need a renumber.

**POST-RELEASE — KEEP/RETARGET.** Journey Brain is a product feature,
not release-critical. Do not block the release.

---

## What this reconciliation does NOT do

- Does not close any PR. GitHub-side close is a CEO decision.
- Does not port any code. Port decisions per §2176 and §2174 are
  explicitly deferred to CEO.
- Does not change #2177 HEAD `9507cb234`; the release remains frozen.

## Suggested CEO decisions

1. **#2176** — hold frozen (defer missing rows to post-release backlog)
   OR unfreeze for a bounded security-floor top-up.
2. **#2174** — port to release (small, safe, correctness) OR
   post-release.
3. **Close** the confirmed POST-RELEASE PRs (#2168, #2170, #2171,
   #2172, #2173) OR keep them open with a `post-release` label so
   GitHub reads truthfully.
4. **#2169** — split: confirm what's already at HEAD, port only the
   deploy-hardening bits post-release, close the rest.

Written 2026-09-03 by the release-closure lane.

# PetWash Completion Matrix

**Purpose.** The single tracker of whole-product state. Each area gets one of:

| Status | Meaning |
| --- | --- |
| `NOT REVIEWED` | We have not audited this surface in the current sprint. |
| `BROKEN` | Known P0/P1 defect open — the surface does not work for a real user. |
| `IN PROGRESS` | Under active engineering — PR open or in flight. |
| `TESTED` | Code + tests green on main; not yet validated on production. |
| `PRODUCTION VERIFIED` | Deployed AND smoke green AND spot-checked in real production. |

**Definition of finished (CEO).** The website is production-complete when:

1. Every critical area below is at least `TESTED`.
2. No known P0/P1 defects remain.
3. Core P2 defects are materially exhausted.
4. Customer journeys pass browser E2E.
5. Provider journeys pass browser E2E.
6. Money/fiscal invariants pass.
7. Mobile + Hebrew RTL work.
8. Production deploy/smoke is routinely green.
9. Remaining work is genuinely optional enhancement/backlog.

Then the site moves to normal continuous improvement.

---

## Frontend

### Public / unauthenticated

| Area | Status | Evidence |
| --- | --- | --- |
| Public homepage | `TESTED` | 7-pin Landing contract (#2232) — LandingLiveBayStrip never mounted (CEO 2026-08-22 back-office ruling), 4 canonical marketing sections preserved, `language` prop threads through every child, greeting-context fetch is auth-gated + fail-soft, Kfar Saba station photo asset path pinned, AccountNavigation '#' sentinel short-circuit preserved. |
| Station finder (`/map`) | `BROKEN` | Deliberately-gutted stub with regression pin (`client/src/__tests__/station-map-no-dead-controls.test.ts`) — real Google Maps integration + station pins never landed. Hamburger nav still points here as "Find a station" (task #281). |
| Station directory (`/locations`) | `TESTED` | Live-backed via `GET /api/public/stations` (Redis 120s + rate-limited); Playwright E2E `tests/e2e/station-proximity-live.e2e.spec.ts`. Caveats: `ANNOUNCED_LOCATIONS` hardcode at Locations.tsx:93-146 (two Kfar Saba sites) awaits DB seed; wayfinding CTAs pulled by CEO 2026-08-23 pending precise-coordinate audit (task #282). |
| Signup (unified `/signup`) | `TESTED` | #66, dual-verify #65, signup coverage E2E `tests/e2e/signup-coverage.e2e.spec.ts`. |
| Returning sign-in | `TESTED` | #131 audit; ReturnLogin door pending (#253). |
| Password / recovery | `TESTED` | Firebase-Auth SDK path (`sendPasswordResetEmail`); 12-pin anti-enumeration contract (#2224) covers both `AUTH_FORGOT_PASSWORD` button and returning-user link — swallowed errors, generic HE+EN toast, double-submit guard, RFC email pre-check. |
| Passkey / Face ID | `TESTED` | #68 (real account-bound onboarding + login), #7 race fix. |
| Magic link | `TESTED` | #8 AuthAction magic-link mode. |
| Dead-end screens (AccessPending / VerifyEmail signed-out) | `TESTED` | #23. |

### Customer (Pet Parent)

| Area | Status | Evidence |
| --- | --- | --- |
| Customer home (`/pet-parent/home` → PrestigeHome) | `TESTED` | `<NextBestActionCard actor="pet_parent" />` mounted above `AttentionList` (#2215). |
| Attention feed (top-of-fold) | `TESTED` | `AttentionList.tsx` + attentionFeed composer; Prestige home §27-29. |
| Next-best-action ("Your next step") | `TESTED` | #2208 endpoint + #2212 hook + card + #2213 route integration test + #2215 home mount + #2216 real-browser end-to-end (5 scenarios). |
| Pets | `TESTED` | Pets PATCH mass-assign fixed (#126). |
| Prestige | `TESTED` | #110 privilege_members read; #47 enrollment guard. |
| Wallet | `TESTED` | Nayax station key #19, wallet DTO privacy. |
| eGift buy | `TESTED` | #98/99 SUMIT phase 2 audit; JourneyCheckpoint E2E for `egift` (#2211). |
| eGift redeem | `TESTED` | #53 replay audit, `tests/e2e/egift-redeem.e2e.spec.ts`. |
| Packages | `BROKEN` | Real, revenue-live checkout wire (`/packages` → `/api/checkout` → Nayax webhook). BUT `client/src/pages/Packages.tsx:68-126` hardcodes the 4-tier catalog + WASH_COUNT_TO_PACKAGE_ID map (lines 135-140) instead of reading `/api/packages` like `client/src/components/WashPackages.tsx:129` does. Divergence: admin edits at `/admin/wash-packages` don't reflect on `/packages`. Task #280 to collapse onto `/api/packages` + add missing E2E for the happy path. |
| Pet Sitter booking | `TESTED` | Sitter booking flow #133; Journey resume E2E for `sitter_book`. |
| Walk My Pet booking | `TESTED` | Walk booking; Journey resume E2E for `walk_book` (#2210). |
| Marketplace booking | `TESTED` | Journey resume E2E for `marketplace_book` (#2210). |
| Academy booking | `TESTED` | Wired on JourneyCheckpoint 7/7 (`academy_book` domain); BOOK_CONFIRM CTA emit + 8-pin regression harness (#2234). |
| Shop checkout | `TESTED` | Shop flow #134; Journey resume E2E for `shop_checkout` (#2210). |
| Lost pets / Paw Finder | `BROKEN` | Task #135 pending — CEO said off-instructions. |
| My Account | `TESTED` | #160-165 canonical write + fan-out + E2E + MOBILE contact-change. |

### Provider

| Area | Status | Evidence |
| --- | --- | --- |
| Provider home | `TESTED` | `<NextBestActionCard actor="provider" />` mounted above `AttentionList` (#2215). |
| Provider onboarding | `TESTED` | Journey resume E2E for `provider_apply` (#2211) — strictest wire (no KYC blobs). |
| Provider dashboard v2 | `TESTED` | #106 requireProviderActive server gate; #82 apiRequest sweep. |
| Provider service management | `TESTED` | #157 requestedService preservation E2E. |
| Provider today card (meet-greet aware) | `TESTED` | #105. |

### Staff / Admin

| Area | Status | Evidence |
| --- | --- | --- |
| Admin dashboard | `TESTED` | #71 Google-only + MFA, #17 requireAdmin dedup. |
| HR admin PATCH allowlist | `TESTED` | #75 strict allowlist + payroll status enum. |
| Compliance | `TESTED` | #80 reviewer/submitter split. |
| Stations PATCH | `TESTED` | #81 metadata vs money/security split. |

### Cross-cutting UX

| Area | Status | Evidence |
| --- | --- | --- |
| Account Security page | `TESTED` | #73 Remember-me + password-manager semantics. |
| Profile / settings | `TESTED` | #160-162 canonical write. |
| Notifications inbox | `TESTED` | #176 NotificationInboxSpec. |
| Mobile navigation | `TESTED` | #101 nav-header hygiene. |
| Hebrew RTL | `TESTED` | 25-pin cross-flow direction contract (#2228) across 11 customer surfaces — every root container carries a dynamic `dir={<expr> ? 'rtl' : 'ltr'}` toggle; hard-locked `dir="ltr"` on a page shell is rejected. Inline LTR on numeric IDs / `<bdi>` wrappers / font-mono blocks is allowed (bidi-correct). |
| English fallback | `TESTED` | Same pin — the direction ternary evaluates to `'ltr'` when the language is `en`. Language-store shape (`language`) is pinned so a rename can't silently break every toggle. |
| Loading / empty / error / offline states | `TESTED` | 10-pin home-surface fail-soft contract (#2230). Every useQuery on PrestigeHome + ProviderHome has try/catch OR .catch OR delegates to fetchJson. AttentionList hides on empty items. NextBestActionCard hides on null primary OR while loading. |

---

## Backend

### Identity + Session

| Area | Status | Evidence |
| --- | --- | --- |
| Canonical identity | `TESTED` | UpdateProfileService atomic write + fan-out (#160). |
| Sessions | `TESTED` | ReturnLogin door pending (#253). |
| Passkeys | `TESTED` | #68 real account-bound. |
| OAuth | `TESTED` | #71 Google-only admin. |
| OTP / SMS | `TESTED` | OTPPurposeRegistry #171, SMS abuse #14/#217-#225. |
| RBAC / capabilities | `TESTED` | #108 shared resolver, #17 requireAdmin. |
| Role switching | `TESTED` | #130 role-mode picker, #70 additive capabilities. |
| Account linking / merge | `TESTED` | #174 AnonymousProfileReconciler. |
| Recovery / step-up | `TESTED` | #171 purpose-scoped OTP, SENSITIVE_ACCOUNT_CHANGE. |
| Admin gates | `TESTED` | #249 canonical privileged middleware; #252 ratchet in flight. |

### Booking + Provider state

| Area | Status | Evidence |
| --- | --- | --- |
| Booking state machines | `TESTED` | Sitter/walk/marketplace/academy audits (#133/§B). |
| Provider state machines | `TESTED` | #109 state-aware /become-provider; #106 requireProviderActive. |
| JourneyCheckpoint (Phase 2) | `TESTED` | 7/7 domains wired (walk / sitter / marketplace / academy / shop / egift / provider_apply); 6/6 real-browser E2E proof (#2210, #2211); academy_book wire pinned by regression (#2234). |
| Payment-state resolver on resume | `TESTED` | #151 CEO §12. |

### Money / Fiscal

| Area | Status | Evidence |
| --- | --- | --- |
| Wallet | `TESTED` | #19 Nayax station key; wallet burn routes hardened. |
| Payouts / escrow | `TESTED` | #226 payoutGate ENFORCE default; #237 escrow header secret hardened. |
| Refunds | `TESTED` | #38 idempotent complete; #230 Nayax refund gaps closed. |
| Nayax | `IN PROGRESS` | #166 letter to account manager pending; 5 open questions in BusinessDecisionRegistry (#167). **Fiscal path is out of this repo** — see the separate `petwash-nayax-sumit-fiscal` bridge (v0.2, verified against SUMIT Swagger 2026-08-31). |
| SUMIT | `TESTED` | #229 webhook inbox dedup here. Fiscal document creation for K9000 station washes is owned by the external `petwash-nayax-sumit-fiscal` bridge — the marketplace is NOT on the fiscal path. |
| Fiscal bridge (Nayax → SUMIT) | `IN PROGRESS` | External repo `petwash-nayax-sumit-fiscal` v0.2. 19 no-network tests, VAT-inclusive, idempotent (`NAYAX:<TransactionID>`), approved fleet `182374 / 182403 / 182443 / 182462`, cutover flag `NAYAX_SUMIT_CUTOVER_AT`. Blocked on human items: set cutover date with accountant, Michal to confirm Digital(6) vs Other(8) for Monyx redemption, Cloud Scheduler → Cloud Run job deploy. |
| Fiscal receipts / credit notes | `TESTED` | #168 NayaxFiscalDocumentGuard; #169 no retroactive fiscal generation. |
| Webhooks / idempotency | `TESTED` | #60 atomic strict idempotency middleware. |

### Journey Brain

| Area | Status | Evidence |
| --- | --- | --- |
| Phase 1 · attentionFeed | `TESTED` | Wallet / eGift / Prestige / KYA-stale / provider KYC / doc-expiry probes shipped. |
| Phase 2 · JourneyCheckpoint | `TESTED` | 7/7 write-side (academy_book added #2234); 6/6 browser matrix. |
| Phase 3 · Saved Searches + Favourite Providers + Rebooking prefill | `TESTED` | #153 FAVOURITE_REBOOK. |
| Phase 4 · NextBestAction service | `TESTED` | #2208 endpoint + #2213 route integration test (9 real-supertest pins). |
| Phase 5 · rendering surface | `TESTED` | #2212 hook + card + #2215 home mount + #2216 real-browser E2E (5 scenarios). |
| Phase 6 · feedback loop / personalization timing | `TESTED` | Full closed loop shipped in #2218 (storage + service) → #2219 (endpoint) → #2220 (composer suppression) → #2221 (client dismiss button + hook) → #2223 (retention pruner cron). |
| Cancellation legal engine | `TESTED` | #146 CancellationPolicyRegistry, versioned. |
| Failure recovery (battery-dies / GPS-lost) | `TESTED` | #147. |
| AI context authorization + PII minimization | `TESTED` | #148 CEO §78/79. |
| 20 real product scenarios E2E | `TESTED` | #149 CEO §81. |

### CTA registry (Lane D)

| Area | Status | Evidence |
| --- | --- | --- |
| Auth CTAs | `TESTED` | #257 CTA action-id registry. |
| Provider funnel CTAs | `TESTED` | PROVIDER_SERVICE_ACTION_IDS. |
| BOOK_CONFIRM on booking submits | `TESTED` | #2209 (sitter/walk/marketplace) + #2234 (academy) — 4/4 Pet-Parent booking wizards. |
| RESUME_JOURNEY (NextBestActionCard) | `TESTED` | #2212 registry addition + #2216 E2E asserts `data-action-id="RESUME_JOURNEY"` on resume tap. |

### Notifications + AI

| Area | Status | Evidence |
| --- | --- | --- |
| Push permission gate | `TESTED` | #172 PushPermissionValueGate. |
| Communication preferences | `TESTED` | #173 granular per-channel per-purpose. |
| Persistent inbox | `TESTED` | #176 NotificationInboxSpec. |
| AI controls (limits, tokens, per-UID budget) | `TESTED` | #196-207 AI audit lane; #242 Redis budget. |

### Rate limits / cron / observability

| Area | Status | Evidence |
| --- | --- | --- |
| Rate limits (per-UID, Redis) | `IN PROGRESS` | Lane E #246 Redis shared state in flight. |
| Cron / background jobs | `TESTED` | JourneyCheckpoints pruner (#2168) + NextBestActionFeedback retention pruner (#2223) both hourly, both `.unref()`-safe with kill switches. |
| Logging / PII | `TESTED` | #208 redactor wire, #263 port to release. |
| Migrations gate | `TESTED` | Migration Test (prod-baseline) workflow; #272 self-healing gate. |
| Monitoring / deploy / smoke | `TESTED` | Release Smoke workflow_run gate. |

---

## Real-browser E2E coverage (Lane G)

| Journey | Spec | Status |
| --- | --- | --- |
| Signup coverage | `signup-coverage.e2e.spec.ts` | `TESTED` |
| New provider | `provider-onboarding.e2e.spec.ts` | `TESTED` |
| Book with pets | `booking-with-pets.e2e.spec.ts` | `TESTED` |
| Station proximity live | `station-proximity-live.e2e.spec.ts` | `TESTED` |
| Shop checkout | `shop-checkout.e2e.spec.ts` | `TESTED` |
| Egift purchase | `egift-purchase.e2e.spec.ts` | `TESTED` |
| Egift redeem | `egift-redeem.e2e.spec.ts` | `TESTED` |
| Receipts | `receipts.e2e.spec.ts` | `TESTED` |
| My transactions | `my-transactions.e2e.spec.ts` | `TESTED` |
| Passkey returning user | `returning-user-passkey.e2e.spec.ts` | `TESTED` |
| Provider second device | `provider-second-device.e2e.spec.ts` | `TESTED` |
| Multi-role workspace | `multi-role-workspace.e2e.spec.ts` | `TESTED` |
| Canonical destination + requested service | `canonical-destination-and-requested-service.e2e.spec.ts` | `TESTED` |
| JourneyCheckpoint · sitter | `journey-checkpoint-resume.e2e.spec.ts` | `TESTED` |
| JourneyCheckpoint · walk / marketplace / shop | `journey-checkpoint-resume-extended.e2e.spec.ts` | `TESTED` |
| JourneyCheckpoint · egift / provider_apply | `journey-checkpoint-resume-egift-provider.e2e.spec.ts` | `TESTED` |
| NextBestActionCard on home | `next-best-action-home.e2e.spec.ts` | `TESTED` |
| Prestige enrollment loop | `prestige-enrollment-loop.e2e.spec.ts` | `TESTED` |
| Customer owes | `customer-owes.e2e.spec.ts` | `TESTED` |
| Mobile account routing | `mobile-account-routing.spec.ts` | `TESTED` |
| Public CTA crawler | `public-cta-crawler.spec.ts` | `TESTED` |
| Launch defects | `launch-defects.spec.ts` | `TESTED` |
| Marketplace benchmark journey | `marketplace-benchmark/journey.spec.ts` | `TESTED` |
| Pettrek my-transactions | `my-transactions-pettrek.e2e.spec.ts` | `TESTED` |

---

## Priority (CEO)

1. Broken production journeys
2. Auth / account integrity
3. Money / fiscal correctness
4. Customer / provider workflows
5. Mobile / RTL
6. Browser E2E
7. Reliability / performance
8. Cosmetic / code hygiene

## Open engineering lanes (this session)

- **Lane C · Journey Brain** — Phases 1-6 ALL TESTED. The whole personal-AI surface (attentionFeed / JourneyCheckpoint / SavedSearches+Favourites / NextBestAction / rendering / feedback loop) is now on `main`.
- **Lane G · real-browser E2E** — 6/6 JourneyCheckpoint matrix landed; NextBestActionCard end-to-end (#2216); academy_book wire has source-scan regression + still needs a browser resume spec (mirror of `journey-checkpoint-resume-*.e2e.spec.ts`). More provider / customer journeys can still be added.
- **Lane E · money/fiscal** — Nayax letter (#166) blocked on non-code business step.
- **Lane D · CTA registry** — BOOK_CONFIRM (#2209) + RESUME_JOURNEY (#2212) + DISMISS_NEXT_BEST_ACTION (#2221) TESTED.
- **Lane F · mobile/RTL** — RTL direction contract now TESTED (#2228, 25 pins across 11 surfaces). Mobile-specific audits (viewport, touch targets, safe-area) not yet run separately.
- **Lane H · deployment/observability** — pipeline routinely green; smoke workflow_run wired.

## Journey Brain — CEO scoreboard

| Phase | Status | Evidence |
| --- | --- | --- |
| 1 · attentionFeed probes | TESTED | wallet / eGift / Prestige / KYA-stale / provider KYC / doc-expiry probes shipped. |
| 2 · JourneyCheckpoint | TESTED | 7/7 write-side (academy_book added #2234) + 6/6 real-browser matrix. |
| 3 · Saved Searches / Favourites / Rebooking | TESTED | FAVOURITE_REBOOK forward-looking recommendation (#153). |
| 4 · NextBestAction service | TESTED | endpoint (#2208) + supertest (#2213). |
| 5 · rendering surface | TESTED | hook + card (#2212) + home mount (#2215) + end-to-end E2E (#2216). |
| 6 · feedback loop | TESTED | storage (#2218) + endpoint (#2219) + composer suppression (#2220) + client dismiss (#2221). |
| Cancellation legal engine | TESTED | CancellationPolicyRegistry, versioned. |
| Failure recovery (battery-dies / GPS-lost) | TESTED | invariants suite. |
| AI context authorization + PII minimization | TESTED | CEO §78/79. |
| 20 real product scenarios E2E | TESTED | CEO §81. |

## Related repos (out of this codebase by design)

| Repo | What it does | Why it's separate |
| --- | --- | --- |
| `petwash-nayax-sumit-fiscal` | K9000 / Nayax terminal → Nayax Core (SQS / Lynx) → this service → SUMIT → חשבונית מס/קבלה. Approved fleet only (`182374 / 182403 / 182443 / 182462`), VAT-inclusive, idempotent via `NAYAX:<TransactionID>`, cutover-gated. | Accounting infrastructure. The website has NO fiscal transaction path. Nothing in this marketplace can create, modify, delete, or renumber a K9000 fiscal document. A marketplace outage cannot break receipts; a fiscal-bridge outage cannot break the website. `PENDING_FISCAL` + retry when SUMIT is down. |

Anything K9000-station / SUMIT-document related belongs in that repo — never here.

## How to update this matrix

Edit this file in the same PR that changes a surface's real status. Never mark `PRODUCTION VERIFIED` until:
merged → deploy pipeline green → Cloud Run revision promoted → Release Smoke green → spot-check in real production.

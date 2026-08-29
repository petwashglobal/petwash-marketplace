# PetWash Journey Brain — Master Punch List

*As of the head of `claude/explain-project-structure-5KdqP` — 2026-08-28*

Merged: PR #2167 (68 commits, all substantive CI gates green).
Open:   PR #2168 (Journey Brain Phases 1-6 scaffold + wizard write-path).

This document consolidates every open loose end across CEO Master
Directives 2026-08-28. Grouped by system, not by phase, so a
downstream commit can pick the highest-value gap without re-reading
the whole directive.

---

## 1. Journey Brain — Phase 1 (attention probes)

Landed (12 probes):

| Actor | Domain | Status |
|---|---|---|
| pet_parent | booking (5 statuses × 6 mappings) | ✅ |
| pet_parent | egift (owner_uid, 30d expiry window) | ✅ |
| pet_parent | wallet (cash + wash packages) | ✅ |
| pet_parent | prestige (privilege_members, no benefit invention) | ✅ |
| pet_parent | kya-stale (medical_consent_updated_at NULL or > 90d) | ✅ |
| pet_parent | pet_passport (vaccine reminder) | ✅ |
| pet_parent | refund (in-flight statuses only) | ✅ |
| pet_parent | journey-resume (Phase 2 checkpoints) | ✅ |
| pet_parent | saved-search "still looking?" (Phase 3) | ✅ |
| provider | booking (5 statuses) | ✅ |
| provider | payout available (canonical ledger read, never mutates) | ✅ |
| provider | doc-expiry (insurance + KYC 30d window, urgent past-due) | ✅ |

Open (Phase 1 tail):

- [ ] **shop abandoned cart** — depends on Phase 2 JourneyCheckpoint
  writes from the shop checkout wizard
- [ ] **provider pricing coach nudge** (CEO §19) — read the local median
  and emit a `PROVIDER_PRICING_ABOVE_MEDIAN` NBA reason
- [ ] **provider calendar-intelligence nudge** (CEO §20) — "You usually
  mark Fridays unavailable; Friday is currently open — keep it?"
- [ ] **provider availability stale** — emit `PROVIDER_AVAILABILITY_STALE`
  when the last availability slot in the future is > 14 days out

## 2. Journey Brain — Phase 2 (JourneyCheckpoint)

Landed: migration 0134 + drizzle + service (save/get/list/clear) +
resume probe + write-path route.

Open:

- [ ] **Wizard writes** — walk_booking, sitter_booking,
  marketplace_booking, shop_checkout, egift_purchase, provider_apply
  need actual POST /api/journey/checkpoints calls at each safe step
  (PROVIDER_SELECTED / DETAILS_ENTERED / PAYMENT_PREVIEW)
- [ ] **Payment-state resolver** (CEO §12): on resume, resolve the
  external transaction — return `PAYMENT_CONFIRMED / PAYMENT_PENDING
  / PAYMENT_FAILED / NO_PAYMENT`. No "Pay again" shortcut.
- [ ] **Shop cart reprice-on-resume** (CEO §13): a stale price must
  never confirm; the wizard reprices server-side before
  presenting the checkout continuation
- [ ] **eGift reservation TTL release** (CEO §14): expired
  reservations return to the pool automatically
- [ ] **Nightly cleanup** for expired checkpoints (cron)
- [ ] **Client resume UI**: "Continue booking / Continue checkout"
  chip on the concierge card when a JOURNEY_RESUME_SAVED reason is
  present

## 3. Journey Brain — Phase 3 (Saved Searches + Favourites)

Landed: migration 0135 + drizzle + both services + saved-search
probe + write-path route + star/list/is-favourite endpoints.

Open:

- [ ] **Wizard writes** — walk/sitter/marketplace search screens call
  POST /api/journey/searches on each meaningful filter change (debounced)
- [ ] **Star icon on provider cards** — client component reads GET
  /api/journey/favourites/:domain/:providerId and lets the user star
- [ ] **"Book Maya again" rebook prefill** — server DTO reads the
  most-recent completed booking with same (provider, pet, service) and
  returns a prefill payload the concierge attaches to a FAVOURITE_REBOOK NBA
- [ ] **Recommender integration**: rank favourites above random when
  they're available for the requested slot (never bypass eligibility)

## 4. Journey Brain — Phase 4 (NextBestAction)

Landed: shared/lib DTO, closed-enum ReasonCode, composer with
attention passthrough + reason-code mapping + confirmation gate, route
`/api/next-best-action/{pet-parent|provider}`.

Open:

- [ ] **Forward-looking recommendations**: FAVOURITE_REBOOK when a
  favourite exists + a matching completed booking with the same
  provider/pet; PRESTIGE_BENEFIT_AVAILABLE with a specific benefit
- [ ] **Recommendation scoring**: `recommendationScore 0..1` from a
  simple linear model (recency × frequency × availability)
- [ ] **Composer reads countRecentDismisses** to soft-down-rank a
  reason the user has told us they're not interested in (already-shipped
  Phase 6 service exposes it)

## 5. Journey Brain — Phase 5 (Concierge UX)

Landed: hook + component + mounts on PrestigeHome + POSDashboard.
Every card carries a "Why am I seeing this?" info button.

Open:

- [ ] **Morning-greeting header** (CEO §61): "Good morning, Nir. 2
  things need attention. Prestige Gold · 1 reward available." (uses
  time-of-day + attention count + Prestige tier)
- [ ] **Client dismissal wires** — Not interested / Don't remind again
  / Show fewer offers like this — each posts an event via
  POST /api/journey/events (Phase 6 endpoint is already live)
- [ ] **Chat concierge** (CEO §63): "What do I need to do today?"
  answers by reading the same NBA feed, no separate LLM call

## 6. Journey Brain — Phase 6 (Feedback)

Landed: migration 0136 + drizzle + service + 6-event vocabulary +
POST/GET/DELETE /api/journey/events + `forgetReason` deletes only
preference telemetry.

Open:

- [ ] **Composer feedback**: NextBestAction reads
  countRecentDismisses(user, reasonCode) and demotes priority for a
  reason the user consistently dismisses
- [ ] **Adaptive proactive-timing engine** (CEO §25 §60):
  importance × urgency × user pref × recent notification load × quiet
  hours — a scored gate that decides push / in-app / stay silent
- [ ] **Personalization settings page** (CEO §54 §60): Use my booking
  history / Use saved-favourites / Personalized offers / Proactive
  reminders / Marketing (separate). Quiet hours picker. "Clear
  recommendation history" (calls DELETE /events/:reasonCode for every
  code).

## 7. Cancellation Legal Engine

Not started — CEO §38 §39 §40 §41 §42 §71 §72 §73.

- [ ] **CancellationPolicyRegistry** versioned by (country ×
  transactionType × serviceType × bookingPhase × consumerCategory? ×
  reason × timestamp)
- [ ] **CancellationQuote DTO** { grossAmount, refundableAmount,
  cancellationFee, clearingFee, deliveryAdjustment,
  fundingLegRefunds[], providerImpact, fiscalAction, policyVersion }
- [ ] **Preview UI before confirm** — CEO §39 refund destination
  breakdown (Card / eGift / Wallet)
- [ ] **Audit record** — quote shown + timestamp + policyVersion +
  userConfirmation + actualReversal + fiscalCreditDocument
- [ ] **Online cancellation discoverable** (CEO §73) — no hiding it in
  support chat

**DO NOT hardcode Israeli 5% / ₪100 formula on every cancellation** —
that specific outcome depends on transaction type, timing, consumer
category, and law version.

## 8. Failure Recovery Invariants

Not started — CEO §28 §29 §30 §31 §32 §33 §70.

- [ ] **Battery death** never cancels a booking / marks provider
  absent / completes a job / charges a cancellation fee. Server
  resumes on reconnect from last heartbeat.
- [ ] **Active walk + provider phone dies** → state
  `SERVICE_IN_PROGRESS`, tracking `GPS_UNAVAILABLE`, customer sees
  "Last update 7 minutes ago". NO fake GPS.
- [ ] **Timeline evidence**: service started HH:MM, GPS active,
  lost, restored. Keep the raw events.
- [ ] **Provider offline**: attention stays server-side. Next login
  "you have a booking request waiting". Never depend on push alone.
- [ ] **Failure UX copy**: "We received your payment. Your receipt is
  still being prepared. You do not need to pay again."

## 9. AI Context Authorization

Not started — CEO §57 §78 §79.

- [ ] **ai-context.ts builder**: ingest userUid + intent + explicit
  scope grant, project the minimal DTO, stamp a scope-token the AI
  call must echo back
- [ ] **Never hand the LLM a full row and ask it to decide what the
  user can see** — authorization happens BEFORE the AI call
- [ ] **PII minimisation**: "payout details verified" not the account
  number
- [ ] **Recommender safety** (CEO §57): rank on approved features
  only; never race / religion / medical / other protected inference

## 10. 20 real product scenarios E2E (CEO §81)

Not started. Build a `server/tests/journeyScenarios/*.test.ts` folder
with one file per scenario. Each seeds state, calls the composer,
and pins the specific reasonCode + destination + priority + copy.

1. incomplete signup
2. incomplete provider application
3. pet KYA stale
4. pending booking
5. provider accepted / payment due
6. abandoned payment
7. payment succeeded while phone died
8. provider no response
9. provider declined
10. booking tomorrow
11. active walk
12. GPS lost
13. provider completed
14. customer confirmation
15. review
16. refund pending
17. eGift remaining
18. Prestige benefit available
19. provider document expiring
20. provider payout available

## 11. From the earlier CEO 2026-08-26 §73 P0 punch list

Still open items after PR #2167 merged:

- [ ] **§54 §55 UI scanner runtime checks** — currently anchor-pins
  only; add a live-render check that mounts each surface in headless
  and asserts the CTA fires the expected server call
- [ ] **§26 Prestige+Provider runtime E2E proof** — playwright test
  covering the same identity holding both role bundles across a
  single session
- [ ] **§70 ProviderOnboarding.tsx monolith refactor** — split the
  1963-line file into 6 sections (Profile / Identity / Insurance /
  Background / Bank / Declarations)

## 12. Non-Journey-Brain follow-ups

- [ ] **Task #90** — auth follow-up defects from audit 2026-08-16
  (D2/D5/D6/D7/D8/D9/D10/D11)
- [ ] **Task #135** — Pet Finder cleanup (CEO called it off-instructions)

---

**No merge without CEO.** This list is source truth; a downstream
commit deducts an item, adds a link to its PR, and adds any new gaps
it exposes.

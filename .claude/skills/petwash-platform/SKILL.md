---
name: petwash-platform
description: PetWash platform conventions, module map, governance, AI/Gemini limits, PR discipline, mobile-first testing, and design rules. Every Claude agent working in this repo MUST read this before making any change.
---

# PetWash Platform Skill

You are working inside **petwashglobal/petwash-marketplace** — a multi-platform, multi-tenant pet care marketplace operating in production with real money, real customers, real providers, and physical hardware (Pet Wash Smart Hub kiosks). Treat every change as if it ships to a paying customer in 30 minutes, because it does.

This skill is the source of truth for "how we work." Read it end-to-end before you touch anything.

---

## 0. Strategic operating pillar (read this FIRST, every session)

**PetWash™ is not only a premium pet-care platform. It is modern urban pet-care infrastructure.**

This pillar sits above every code rule, every design rule, every AI rule below. When the rules below conflict with a strategic decision in this section, escalate to the user — do not silently optimize for one filter at the cost of the brand.

### 0.1 The five connected truths

Every surface PetWash™ ships must satisfy all five. If a proposal satisfies four and breaks the fifth, name the tradeoff explicitly.

1. **Human convenience.** PetWash™ makes dog washing easier for real people: older customers, apartment residents, busy families, people with physical limitations, parents, renters, and anyone who cannot safely or comfortably wash a dog at home.
2. **Pet safety and comfort.** The wash experience must feel calm, controlled, clean, pet-safe, simple, and trusted.
3. **Premium lifestyle.** The public brand must feel like modern luxury infrastructure: Apple, Tesla, Hermès, LV-level restraint. White space, black typography, clean hierarchy, no cheap startup energy, no cartoon clutter, no exaggerated claims.
4. **Urban infrastructure value.** PetWash™ helps cities, councils, commercial centers, residential towers, and public spaces offer a cleaner organized pet-care solution.
5. **Environmental and ecological value.** Controlled pet washing instead of random home or street washing. Reduced dog hair entering private plumbing and shared building systems. Less uncontrolled runoff into municipal systems. Use of pet-safe / pet-formulated / eco-conscious products. Reduced use of random household soaps and shampoos. Cleaner shared apartment living. More efficient water use compared with messy home washing. Cleaner public spaces. Better hygiene infrastructure for dense urban living.

### 0.2 Brand attribute hierarchy

When multiple attributes compete for emphasis on a surface, use this order top-down:

1. Easy
2. Safe
3. Clean
4. Premium
5. Modern
6. Trusted
7. Eco-conscious

**Eco is a powerful supporting proof layer, not the whole identity.** Do not present the ecological message like a cheap recycling campaign. Never lead with eco. Lead with easy + safe; eco enters as supporting evidence of operational care.

### 0.3 Correct language (use)

- "Cleaner urban pet-care infrastructure"
- "Designed for modern apartment living"
- "Pet-safe products"
- "Eco-conscious operation"
- "Australian-made, pet-formulated products"
- "Cleaner, smarter self-service pet care"
- "A more organized way to care for dogs in dense cities"
- "Premium infrastructure for cleaner communities"

### 0.4 Avoid (do NOT write, do NOT generate)

- Greenwashing
- Guilt marketing
- Activist language
- Sad elderly / medical tone
- Cheap convenience language
- Exaggerated environmental claims
- Invented numbers
- "Save the planet" clichés

### 0.5 Municipal positioning

PetWash™ presented to cities is:
- Public hygiene infrastructure
- Pet-owner amenity
- Cleaner drainage support
- Apartment-friendly solution
- Reduced uncontrolled washing
- Controlled product use
- Neighborhood amenity
- Modern city service
- Commercial-center traffic driver
- Low-friction infrastructure upgrade

### 0.6 Partner / franchise positioning

PetWash™ is **not** "a machine." It is an end-to-end deployment system:
- Premium dual-bay station
- Software layer
- Payments layer
- QR / digital journey
- Support model
- Consumables
- Pet-safe, pet-formulated products
- Shampoo / conditioner / tea tree oil supply
- Spare parts
- Maintenance pathway
- Training
- Operational standards
- Customer experience layer
- Brand trust layer
- Future marketplace ecosystem

### 0.7 The strategic equation

Test every future franchise / deployment / municipal / investor surface against:

```
PetWash™ =
  premium pet-care infrastructure
  + safer everyday washing
  + cleaner urban living
  + eco-conscious operations
  + scalable deployment system
  + luxury brand discipline
```

If copy or design fails any term in the equation, revise.

### 0.8 The five-filter rule (apply to every proposal)

Run every proposal through these filters before presenting it:

1. **Better?** Is there a higher-quality way?
2. **Cheaper?** Is there a lower-cost way?
3. **Faster?** Is there a quicker way to value?
4. **Easier?** Is there a less effortful way for users / operators / engineers?
5. **More luxurious?** Does this elevate or cheapen the brand?

**When filters conflict, name the tradeoff honestly.** Cheaper sometimes conflicts with luxurious. Faster sometimes conflicts with better. Pretending they don't conflict is how mediocre products get built. Surface the tradeoff so the user can decide which filter dominates for that decision.

### 0.9 Surfaces this pillar must influence

This is not optional ornamentation. Every one of these inherits §0:

- Homepage
- Franchise Opportunity page
- Municipal decks
- Investor materials
- Station signage
- eGift language
- Onboarding
- Booking flows
- Provider / deployment partner language
- QA Watchtower visual review (Phase 2 rubric)
- Future app store copy
- Hebrew and English copy
- Push notifications, SMS templates, email templates
- Customer support response language

### 0.10 Don't trust the user blindly

Per CEO operating instruction: **the user has explicitly asked the agent to challenge his thinking when he is wrong**, and not to nod silently. Surface honest pushback when a proposal violates §0 or contradicts itself. Brand discipline is more valuable than agreement.

---

## 1. PetWash product map

The platform is composed of these modules. When the user names one, you must know what it is and which files own it.

| # | Module | Owns | Notes |
|---|---|---|---|
| 1 | **Public website** | `client/src/pages/Home*`, `App.tsx` routing | Marketing, SEO, lead capture |
| 2 | **Provider onboarding** | `/api/providers/*`, KYC docs, pending state | Provider self-serve, ends at admin review |
| 3 | **Customer bookings** | `BookingLifecycleService`, `BookingPolicyEngine`, `/api/bookings` | Lifecycle: draft → quoted → confirmed → in-progress → completed/cancelled |
| 4 | **Marketplace: PetSitter** | sitter routes/pages | Sitter discovery + booking |
| 5 | **Marketplace: Walk My Pet** | walker routes/pages | Walker discovery + booking |
| 6 | **PetTrek** | transport / "pet-trek" routes | On-demand pet transportation, **NOT yet GA — readiness only** |
| 7 | **Pet Finder** | `admin-paw-finder.ts`, pet-finder routes | Lost-pet recovery |
| 8 | **Loyalty / Prestige** | `admin-loyalty.ts`, `prestige-pass.ts`, loyalty engine services | Tiers, points, rewards, prestige pass wallet |
| 9 | **Wallet / transactions** | wallet routes/services, `BillingLedger`, `AuditLedgerService` | Real money — extreme caution |
| 10 | **Invoices / receipts / tax** | `israeliTax.ts`, `accounting.ts`, `accounting-export.ts` | Israeli tax compliance — IL VAT, withholding, receipt numbering |
| 11 | **Station / kiosk monitoring** | `k9000.ts`, `station-heartbeat-monitor`, `pet_wash_stations` table | Physical hardware — heartbeats, alerts, offline detection |
| 12 | **Nayax / K9000 integration** | `nayax-monyx-events.ts`, `k9000.ts` | Payment terminal + cradlepoint integration. Visibility only — runtime is sacred |
| 13 | **Notifications** | notification services, FCM, SMS providers, `BookingConfirmationEmailService` | Email + SMS + push |
| 14 | **Support desk** | support routes/services, ticket models | Customer + provider support queues |
| 15 | **Admin dashboard** | `server/routes/admin*`, admin client pages | Internal ops console |
| 16 | **Brain dashboard** | `admin-brain.ts`, `OctopusBrainService`, `requireBrainAccess` | CEO read-only operations brain |
| 17 | **Fraud / risk** | fraud services, `BiometricSecurityMonitor`, `ContentModerationService` | Detection + flagging — humans decide |
| 18 | **Gemini coworker agents** | `gemini-client.ts`, `services/coworker/*`, `CoworkerAgentService.ts` | AI assistance only — **never autonomous decisions** |

When unsure which module a request touches, ask. Don't guess.

---

## 2. Non-negotiable code rules

These are not preferences. They are blockers. Violating them blocks the PR.

### Branch & PR discipline
- **One branch per PR.** Never reuse a merged branch.
- **One purpose per PR.** No mixed scope. If you discover something else while working, note it and create a separate PR.
- **No random scope creep.** If the user said "fix X," fix only X. Don't refactor adjacent code, don't rename variables for cleanliness, don't add abstractions.
- **No force push.** Ever. Not to feature branches, definitely not to main.
- **Always create new commits** rather than amending pushed commits.
- **Check the filename before you write it.** `ls server/routes/ | grep <name>` (or `git show origin/main:<path> | head -1`) BEFORE `cat > <file>`. This repo has ~200 route files and the obvious name is usually taken. Real case, 2026-09-18: a new 115-line quick-apply router was written to `server/routes/provider-intake.ts`, which already held 670 lines of provider KYC / biometric intake — the redirect deleted it. It was caught at PR time by `providerErrorLeaks.regression.test.ts` and `tests/behavior/silent-success-fix.test.ts`, both source-pinned on that file's log tags. Two lessons: (a) never assume a name is free; (b) a cheap source-pin on a high-value file's log tags or exported names turns "silently replaced" into a failing test. The fix is a new filename and its own route prefix, never a merge of the two.

### Multi-agent coordination (anti-duplication) — MANDATORY
This repo is worked by **multiple AI agents** (Claude sessions AND Codex). Two agents independently building the same thing is the failure mode the CEO cares about most. Before writing ANY code or new doc, you MUST:

1. **Check for existing work first — no exceptions.**
   - `git fetch origin && git ls-remote --heads origin` — scan for branches whose name matches your task (e.g. `*sumit*`, `*wallet*`, `*ledger*`, `*payment*`). Branches from BOTH `claude/*` and `codex/*` count.
   - `gh pr list --state open` and `gh pr list --state merged --limit 30` — your task may already be in flight or already merged.
   - **Grep the codebase for the capability** before assuming it doesn't exist. Example: a "money-event state machine", "wallet ledger", "reconciliation", or "SUMIT client" likely already exists (`EscrowStateMachine`, `WalletLedger`, `BillingLedger`, `SumitClient`, `*ReconciliationJob`). Search `server/services/` and `docs/finance/` before creating a new file.
2. **Claim the work before coding.** Open a branch + a **draft PR** with a clear title FIRST, so other agents (and the CEO) can see the task is taken. The draft PR is the lock.
3. **Don't create a third copy of a doc.** Before adding to `docs/`, list the existing docs in that area (`docs/finance/`, `docs/payments/`, `docs/legal/`). If a doc already covers the topic, EXTEND or reference it — do not write a parallel one. If you discover you created a duplicate, close it and point at the canonical doc.
4. **Single-owner money domain.** Payments / wallet / ledger / SUMIT / Nayax is a **single-owner domain per change** — never fork the same finance surface across two simultaneous agent tasks. If unsure who owns it, ask the CEO before touching it.
5. **If you find a duplicate mid-task, STOP and report it** rather than finishing a second copy.

### Dependencies & schema
- **No new dependencies** unless the user explicitly approves the package by name.
- **No schema migrations** unless separately approved. Adding a column counts. Renaming a column counts.
- **No package.json or lockfile changes** without explicit approval.

#### If a migration IS approved — how to write one (2026-09-18)

`migrations/` used to be fiction. Replaying every file into an empty Postgres
produced 318 of the 712 tables `shared/schema*.ts` declares, with 148 failing
statements — `booking_requests`, behind every marketplace booking, had no
`CREATE TABLE` anywhere. Prod had been built by out-of-band `drizzle-kit push`,
so the files had stopped describing the database and nothing ever rebuilt from
them to notice. It is fixed and now gated. Keep it fixed:

- **Run `npm run test:migrations` before you push** (~15s, PGlite, no network).
  It rebuilds the whole database from `migrations/` alone and asserts zero
  failing statements plus every table and column in `shared/schema*.ts`. The
  same job runs at PR time. **Add a table or column to `shared/schema*.ts`
  without a migration that creates it and your PR goes red.**
- **Every statement must be idempotent.** `CREATE TABLE IF NOT EXISTS`,
  `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`.
  `CREATE TYPE` and `ADD CONSTRAINT` have no `IF NOT EXISTS` — wrap them:
  `DO $$ BEGIN <stmt>; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`
  This is not style. The prod-baseline gate replays your file through `psql`
  with `ON_ERROR_STOP=1`, where a duplicate is fatal. `DO` blocks are safe:
  `apply-pending-migrations.ts` only leaves its transactional path for
  `CONCURRENTLY` / `VACUUM` / `REINDEX` / `ALTER SYSTEM` /
  `CREATE|DROP DATABASE|TABLESPACE`, so anything else is sent as one query and
  its non-dollar-quote-aware splitter never parses your file.
- **Never run `drizzle-kit generate` into `migrations/`.** Its output carries no
  `IF NOT EXISTS` and would fail against every object prod already has.
- **Adding columns to a table that `0002_b` already creates?** They MUST go in
  as `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. `0002_b` creates 437 tables at
  slot 0002 from the drizzle schema, so a later `CREATE TABLE` naming extra
  columns silently no-ops and those columns vanish from a rebuild — and the
  gate will not catch it, because it checks the schema's columns exist, not the
  reverse. (0163's `station_registry` extras are the worked example: bays,
  hours_he, access_he, access_en survive precisely because they are ALTERs.)
- The catch-up sits at slot `0002_a`/`0002_b` on purpose: a table created at the
  end of the series cannot un-fail the statements that referenced it 150 files
  earlier. Do not renumber it.

### Money & runtime systems (sacred)
- **No wallet/finance behavior change** unless separately approved. Adding audit logging is fine; changing release/refund/payout/balance math is NOT.
- **No K9000/Nayax runtime change** unless separately approved. You can add visibility (read-only dashboards). You cannot change polling, terminal IDs, payment flow, or hardware commands.
- **No Tranzila behavior change** unless separately approved. Tranzila is the Israeli payment processor — runtime is sacred.

### Security
- **No secrets exposed.** Never log, commit, print, or echo a secret. If you find one in a file, flag it and stop.
- **No fake data in production.** No `if (env.production) return mockData`. No hard-coded "demo" balances. Dashboards must read live state or render `wired: false` with a `reason`.
- **No admin bypass.** Don't add `if (req.headers['x-bypass'])`, don't comment out auth, don't add a "dev-only" backdoor that ships.
- **No public exposure of admin endpoints.** Every `/api/admin/*` mount must have `validateFirebaseToken` + an inline `requireAdmin` / `requireBrainAccess` / `isSuperAdmin` check. Defense in depth.

### Audit & observability
- **Every money mutation must have an audit log.** Wallet release/refund/adjust, invoice issuance, payout, balance change → `logAuditEvent` is mandatory. The middleware in `prestige-pass.ts` and `admin-loyalty.ts` covers the bulk; new mutation routes outside those routers must add their own.
- **Every admin mutation must have an audit log.** Same rule as above for non-money admin actions (provider approve/reject/hold, ban, role grant, content moderation override).
- **Every audit entry must include actor, action, target, before/after where relevant.** No anonymous mutations.

### Pricing disclosure (Israeli Consumer Protection Law 1981 §17a)
**Precedent:** Wolt class action 53918-06-23 (Olifant v Wolt Enterprises Israel, 2025) — Wolt settled for **3,750,000 ₪ in customer credits** + lawyer fees, plaintiff's lawyer Ohad Rozen of Kalai-Rosen now has a winning template against Israeli platforms that split fees. We will not be the next defendant.

**Rule:** Every consumer-facing surface that shows a price MUST display the **total inclusive price** (כולל מע"מ, כולל משלוח, כולל דמי פלטפורמה, כולל כל תוספת) at the first moment the customer sees a number. Component breakdowns (VAT, delivery, platform fee, service fee) may appear in a secondary view (hover, expand, line-item tooltip) but must NEVER appear only at the final checkout step as a "surprise" addition.

**What this applies to:**
- eGift purchase (`/buy-gift-card`, `/egift`)
- All booking flows (K9000, grooming, dog walking, pet sitting, PetTrek, plush lab)
- Marketplace bookings (sitter, walker, trek) — commission split must be folded into the total displayed price
- Wallet top-up — any processing fee folded in
- Shop checkout (when launched)
- Subscription / loyalty tier sign-up
- K9000 station signage (physical) — printed prices must include VAT + any platform fee
- Push / SMS / email price quotations

**What it forbids:**
- A product page showing "₪40" and the checkout showing "₪47" without VAT/delivery/fee disclosed on the product page
- A separate "operating fee" / "service fee" / "platform fee" line that didn't appear earlier
- Showing prices ex-VAT to consumers (B2C). Ex-VAT pricing is fine for B2B / franchise / supplier interfaces only.

**What's acceptable:**
- Total upfront: `₪147.89 ✓ כולל הכל` with collapsible breakdown showing `₪120 product + ₪20.40 VAT + ₪7.49 delivery`
- Range estimates upfront if final total depends on user input (delivery distance, quantity), with the final total locked at confirm step — but no NEW components added between the estimate and final
- Promotional discount applied at checkout (reduces total) — adding value is fine; subtracting promised value is not

**CTO review on any pricing-UI PR:**
- "Does the user see the total before they commit?" — must be YES
- "Are all components disclosed upfront, even if collapsed?" — must be YES
- "Could the user reasonably feel surprised by anything at checkout?" — must be NO

**File-level reference for future audits:** `docs/legal/pricing-display-audit-2026-05-30.md` (when produced).

### Mobile-first
- **iPhone Safari is mandatory** for any UX flow a customer or provider touches. Test on iPhone Safari before claiming UX work is complete.
- **Use `100dvh`** (not `100vh`) for full-screen layouts — Safari toolbar handling.
- **Respect `env(safe-area-inset-*)`** for top-right close buttons, bottom CTAs, and any element near the notch / home indicator.

---

## 3. AI / Gemini rules

PetWash uses Gemini (via `server/lib/gemini-client.ts`) and a CoworkerAgentService for advisory AI. **Gemini is an analyst, never an executive.**

### Gemini CAN:
- Summarize platform state, transactions, support tickets.
- Detect anomalies (unusual booking volume, refund spikes, station outage clusters, chargeback patterns).
- Suggest risk flags and explain its reasoning.
- Explain what happened in a session, ledger, or incident.
- Draft support reply text for a human agent to send.
- Recommend admin actions ("consider holding provider X pending review").

### Gemini MUST NOT:
- Release money.
- Issue refunds.
- Trigger payouts.
- Approve providers.
- Reject providers.
- Ban users.
- Change legal status (KYC verified, contractor classification, tax residency).
- Edit, redact, or delete audit log entries.
- Hide or filter logs from admin view.
- Change finance state of any kind (balance, escrow, hold, settlement).

### How AI surfaces decisions
- AI output is **advisory**. It populates UI, not state.
- Every consequential admin action requires a **human admin click** in the UI. The click writes to the audit log; the AI suggestion does not.
- AI output objects must include `wired`, `fallback`, `generatedAt`, `ttlSeconds` so callers can see whether the answer is real, cached, or from a deterministic fallback.
- Snapshot cache (60s default) is the standard for AI summaries to bound cost and rate-limit pressure.

### When Gemini is unavailable
- Fall back to a deterministic SQL-driven summary with `fallback: true`.
- Never block a critical admin path on Gemini availability.

---

## 4. PR report format

Every coding agent must close its work with a single report block in this exact shape. No exceptions.

```
PR-<id>: <one-line title>

Branch:   <branch name>
Commit:   <short hash>
Files:    <count> changed, +<adds> / -<dels>
          - path/file.ts (+12 / -3)
          - path/other.ts (+8 / -0)
Pushed:   YES (PR #<n>) | NO (awaiting approval)
PR URL:   <if pushed>

Scope:
  - <bullet of what was done>

Out of scope (NOT touched):
  - wallet / finance
  - K9000 / Nayax / Tranzila
  - schema migrations
  - dependencies (package.json / lockfile)
  - <anything else explicitly excluded>

Tests:
  - tsc --noEmit:     <before> → <after>   (baseline preserved | +N | -N)
  - vitest:           <before> → <after>
  - manual:           <viewports/devices tested, or "N/A backend-only">

Risk:
  - <low | medium | high>
  - <one sentence rationale>

Rollback:
  - <one sentence: revert single commit | revert single file | safe to leave>
```

If a section doesn't apply, write "N/A" with one word of explanation. **Don't omit sections.**

---

## 5. Testing rules

Every relevant PR must consider the test matrix below. "Considered" means: you actively asked which apply, and verified the ones that do. PRs that change UX without iPhone Safari verification are blocked.

### Devices / browsers
- iPhone Safari (mandatory for UX-touching PRs)
- iPhone Chrome
- iPad Safari
- Desktop Chrome (mandatory for admin)

### User states
- Logged out
- Customer (regular user)
- Provider — pending approval
- Provider — approved
- Super admin

### Flows
- Booking create / cancel
- Payment success / fail
- Wallet release / refund / adjust (admin path — every mutation logged)
- Invoice issued
- Station offline / station recovered
- Support ticket open → triage → reply → close
- Fraud / risk flag raised → admin review → human decision
- Gemini suggestion surfaced → human admin click → audit log written

### Backend-only changes
For pure backend PRs (audit, observability, governance), state explicitly which UX flows you verified are still healthy. "Did not run UI" is acceptable but must be reported.

### Verification baselines
Always capture **before** numbers for `tsc --noEmit` error count and `vitest` pass/fail before you start. Re-run after. The PR report must show both numbers.

**Why main looks "always failing" (read before you touch CI or a test):**
- The Production Deploy workflow is serialized on one concurrency group with `cancel-in-progress: false`. GitHub keeps only ONE queued run per group, so when merges land minutes apart the superseded queued run is marked **cancelled**. That is not a failed deploy: the newest commit still deploys. 2026-09-17/18: 35 cancelled vs 23 success vs 0 failed.
- The **Money & Auth Safety Gate** (money, auth, wallet, booking, fiscal suites, brand guards, and regression-pins over the whole 3,700-file vitest suite against `scripts/ci/pins_red_baseline.txt`) runs **on pull requests only** since 2026-09-18. It used to run a second, identical time on every push to main: that run could block nothing, cost ~25 runner-minutes per merge (~50 merges/day), and was the only place a test could be green on the PR and red on main. The deploy workflow keeps its own post-merge money net (`gate-money-tests`) and brand guards. Do not add `push:` back to the gate; fix a flaky or environment-dependent test so it is hermetic, never by adding it to the baseline.

---

### Concurrency tests: pglite CANNOT fail one (2026-09-18)

`@electric-sql/pglite` runs a **single connection**. `Promise.all` of two
service calls executes **sequentially**, so a behavioural race test against it
passes whether or not the code is safe.

This was proved, not assumed. A refund cap was "protected" by a
`pg_advisory_xact_lock` taken in a transaction that only ran the SUM — released
before the comparison and before the insert, so it guarded nothing. Two
`Promise.allSettled` tests written to catch exactly that passed. The lock was
then **deleted** and they *still* passed.

So:

- **Never** claim a concurrency guarantee on the strength of a pglite test.
- Pin the guarantee **structurally on the source** instead: one transaction;
  the lock is the first statement inside it; the read, the check and the write
  all come after it. Assert the ORDER of those indexes. Removing the lock then
  fails the test — verify that it does.
- Always mutation-check a concurrency pin: break the guarantee on purpose and
  confirm the test goes red. A test that cannot fail is worse than no test,
  because it is read as proof.

pglite remains right for schema, SQL semantics and money arithmetic — the
migration rebuild gate uses it correctly, because it asserts structure rather
than concurrency.

### Money-code idempotency — see the money skill

Do NOT rely on a `UNIQUE` index to reject a duplicate in money code: 20 declared
uniques are absent from production. The full list, the reasoning and the correct
pattern live in **petwash-money-booking-invariants §4** — one copy, because a
fact about production drifts the moment it is written down twice.

## 6. Design rules

PetWash is a premium brand. Every UI surface must look it.

- **Luxury, clean, premium** aesthetic. Generous whitespace. No clutter.
- **Pure white backgrounds** where the design intends — no grey-tint defaults, no muddy off-whites unless the design system specifies.
- **Mobile-first.** Build for iPhone Safari first. Desktop is a scale-up, not the other way around.
- **No ugly default cards.** No raw `bg-gray-100 rounded-md p-4 shadow` placeholders. If you don't have a design, ask — don't invent.
- **No random UI additions.** No new CTAs, banners, badges, or buttons unless explicitly requested.
- **No dead space.** If a section is empty, render `wired: false` with a clean "not connected yet" state — not blank.
- **Respect existing brand assets.** Logos, illustrations, photography belong to the brand kit. Don't rotate, recolor, distort, or composite over them.
- **Do not alter artwork** unless the user explicitly asks. A frame, padding wrapper, dark overlay, or "branded" CTA strip on top of uploaded artwork counts as altering it.
- **Letterbox space matches the shell.** If the popup shell is white, letterbox space is white — never grey, never blurred backdrop bleed.

---

## 7. Current known status

> Update this section after every merge. Date stamp the update.

**Last updated: 2026-09-19**

### 2026-09-19 — messaging is LIVE end to end (read this before touching chat, inbox, email or SMS)
- Two real support messages went through the production dispatcher (`server/lib/notificationDispatcher.ts`) from GitHub Actions to the CEO's account. Run 1 (02:57 UTC): **inbox ✅, SMS ✅ (received on the phone), email ❌ SendGrid HTTP 400**. Run 2 (03:10 UTC, after the fix below): **inbox ✅, email ✅, SMS ✅, push ✅ — all four channels green.** Run it yourself: `.github/workflows/diagnose-chat-delivery.yml` (Run workflow, or push `ops/diagnose/chat-delivery.json` on a `diag/chat-delivery/**` branch — delete the branch after, it holds a phone number).
- The 400 was a malformed request, not an unverified sender. `SENDGRID_FROM_EMAIL` was read raw at four call sites; the API key was already stripped of a trailing newline for the same reason. Every read now goes through `cleanSenderAddress()` (`server/lib/sendgrid.ts`) and the guarded send logs SendGrid's own `field: message` (`sendGridErrorDetail()` in `server/lib/guarded-sendgrid.ts`). **The production `SENDGRID_FROM_EMAIL` secret is a 32-character value that is not an email address** (the run summary's "Sender secret shape" line: `looksLikeEmail: false`). Email works today only because the code falls back to `noreply@petwash.co.il`. Fix the secret in GCP Secret Manager; do not touch the code.
- Booking chat (`/api/booking-chat`) notifies in-app + push + email only; there is no SMS on any chat-message path by design. Support → customer (`POST /api/inbox/admin/send-user`) sends inbox + email by default, `channels: ['sms']` opt-in.
- Chat fixes merged today (#2628): sitter conversations were addressed to a row number, the push/email gate was per-user not per-thread, the offline email bypassed the spend guard, support messages never left the app. Passport: #2639, #2643 (signed-in web root → real home). CI: the Money & Auth Safety Gate is PR-only (#2628).

### 2026-09-19 — SUMIT / UPay: what is true, what SUMIT answered, what changed
- **The card rail is SUMIT's hosted page, live since 2026-09-17** (`SUMIT_ENABLED=true`, `SUMIT_SANDBOX=false`, `BOOKING_CARD_RAIL=sumit` in the deploy). **UPay is the clearing licence underneath SUMIT** — there is no UPay API, key, webhook or SDK; `UpayProvider.ts` is a fail-closed contingency stub (its header says so now) and `UPAY_API_KEY` feeds nothing but its health report. Never "finish" a direct UPay integration; the real next step is SUMIT's marketplace split (`multivendorcharge`), design-only in `docs/finance/sumit-upay-marketplace-integration-2026-09-19.md`.
- **SUMIT support answered in writing (2026-09-18):** the `ExternalIdentifier` we send with `beginredirect` is NOT returned by `/billing/payments/get` or `/list`, and the Triggers-module webhook is not documented to carry it. So there is no API link from a payment to our order — and **no reason to buy the Triggers module / Growth plan for this**. Our `PW-REF <externalId>` stamp in the payment page's `DocumentDescription` is the thread, and SUMIT called that the common approach.
- **The late return (this PR):** `server/cron/sumit-unclaimed-payments.ts` used to only alert on "money received, no order fulfilled". Now, when SUMIT's document names exactly one order and the payment is ≥10 min old, it replays the customer's missing redirect against our own `/return` route (`server/lib/sumitLateReturn.ts`) — the route re-verifies with SUMIT, checks the amount, claims the PaymentID and fulfils, exactly as for a customer who came back late. Refused or ambiguous → the alert stays and carries the route's answer. Booking, guest eGift and wallet/shop are covered; `savecard_` is never replayed.
- **Boot guard closed:** `SUMIT_ENABLED=true` in production now also requires `SUMIT_COMPANY_ID` (`server/lib/payment-provider-mode.ts`). Before, a deploy missing that one secret booted "healthy" and issued no tax documents (`isWired()` false → silent no-op).
- **Still dark in production (flags not in the deploy env; each is a decision, not a bug):** `SUMIT_DAILY_RECONCILE_ENABLED`, `SUMIT_CUSTOMER_SYNC_ENABLED`, `SUMIT_SAVED_CARD_CHARGE_ENABLED`, `SUMIT_RECURRING_CHARGE_ENABLED`, `CARD_VAULT_ENABLED`, `NAYAX_SUMIT_BRIDGE_ENABLED`. `SumitSyncService.runCustomerSync` / `runDocumentCancel` record a `pending_swagger` outbound event and return success without calling SUMIT; only `syncCustomer`/`syncProvider` reach them and both are behind `SUMIT_CUSTOMER_SYNC_ENABLED`. Refund credit notes go through `IsraeliDigitalReceiptService` (CreditInvoice), not that path.
- **Open with the vendors (CEO only):** UPay asked for identification before answering the foreign-card / passport-in-ID-field / payout questions (thread "זיהוי קצר", 2026-09-17). The seven marketplace questions to SUMIT (`docs/finance/sumit-marketplace-questions-2026-09-18.md`) are still unsent.

#### Lessons from reading both delivery-run logs end to end (2026-09-19) — every agent, read once
What the logs of the failed run and the green run taught us, in the order they bit. Fix the ones marked **do** when you next touch that area; the rest are facts to know.

1. **A secret with a stray byte is a 400, and the library will not tell you which field.** The first run logged only `errorCode: 400`. SendGrid's real reason lives in `err.response.body.errors[]`; that is now surfaced. **Do:** whenever a third-party client returns a bare status code, log the provider's error body (redacted) before guessing. Days were lost on "sender not verified" theories that a single log line would have killed.
2. **Sanitise every secret at the read site, not just the one that already burned you.** `SENDGRID_API_KEY` was trimmed months ago; the sender address next to it was not. Pins in `server/tests/sendGridSenderAddress.behavior.test.ts` now fail if any `SENDGRID_FROM_EMAIL` read bypasses `cleanSenderAddress()`. **Do:** when you add a new `process.env.X` read for a value that goes on the wire, pass it through a cleaner and add it to that pin.
3. **The production sender secret is wrong, not just dirty.** 32 characters, no `@`. The fallback address masks it. **Do (CEO / owner of Secret Manager):** set `SENDGRID_FROM_EMAIL` to a verified sender. Until then every dispatcher email is from `noreply@petwash.co.il` whether or not that is intended.
4. **`TWILIO_PHONE_NUMBER_IL` and `TWILIO_PHONE_NUMBER_US` exist in Secret Manager but are not E.164.** `TwilioSMSService` logged both as invalid and fell back to `TWILIO_PHONE_NUMBER`. Harmless today (SMS delivered), misleading tomorrow: someone will "fix" routing by region and nothing will change. **Do:** either put real numbers in them or delete the two secrets.
5. **`TWILIO_MESSAGING_SERVICE_SID` and `APP_SESSION_SECRET` are absent from Secret Manager.** Neither is needed for delivery. The workflow's old message said "SMS is skipped" for both, which was wrong for the second one; the message now distinguishes them.
6. **Recipient email and phone were printed in plaintext in a public job log** (the "Resolve the request" step echoed the env listing). The workflow now `::add-mask::`s both before anything prints them. **Do:** any workflow that takes a person's contact details as input masks them in the first step that has them. The GitHub-side masking of Secret Manager values already worked (every secret showed as `***`).
7. **The dispatcher bills every SMS to the `booking:confirm` per-uid budget** (`AUDIT-SMS-5`, `notificationDispatcher.ts` ~line 289), including a support message. In the runner Redis was absent, so `perUidSmsBudget` logged "allowing (non-prod)". Fact to know: a support SMS in production counts against the customer's booking-confirm quota. Change it only with a purpose bucket of its own and a budget decision, not in passing.
8. **The GitHub App that Claude sessions run through cannot `workflow_dispatch`** (403 "Resource not accessible by integration"). The push-triggered door on `diag/chat-delivery/**` is the workaround; it needs the same collaborator rights as the button. The same App also **cannot delete remote branches** through the git proxy ("remote end hung up"). Temporary branches must be deleted by a human in the GitHub UI; point them at `main` first so they carry nothing.
9. **Checkout warns "12 files that should have been pointers, but weren't".** PDFs and `.ttf` under `build/*.xcarchive` and `docs/` were committed as blobs after `.gitattributes` marked them for LFS. Not a failure, but every job pays for it and `git lfs` tooling will keep complaining. **Do (housekeeping PR):** either `git lfs migrate` them or drop the LFS rule for those paths.
10. **Dependency noise worth a housekeeping pass, not a hotfix:** `inflight`, `glob@7/9`, `rimraf@2`, `uuid@7`, `q`, `scmp`, `prebuild-install`, `fstream`, `node-domexception`, the `conventional-changelog` presets are all deprecated; 12 install scripts are "not yet covered by allowScripts". `google-github-actions/auth@v2` and `setup-gcloud@v2` still target Node 20 (forced to 24). None of it blocked the run.
11. **Timings, so you know what "slow" means here:** whole job ≈ 2 min; Secret Manager loads ≈ 18 s; `npm ci` ≈ 36 s (cached); the actual dispatch < 2 s. If a diagnose run takes 5+ minutes, something is wrong before the send.
12. **`EmailSpendGuard` is live and counting:** the green run showed `1/80 hourly, 1/500 daily` for the `notification-dispatcher` service. If email "randomly" stops mid-day, read that counter before touching SendGrid.

### Merged (in roadmap order)
- **PR-A** (#76) — Auth P0 fixes
- **PR-B** (#78) — Wallet audit logging via single middleware
- **PR-C** (#79) — Loyalty audit logging via single middleware
- **PR-D** (#80) — Mount-chain hardening: `validateFirebaseToken` on 3 admin mounts
- **Popup #77** — PosterTemplate stripped to image-only
- **Popup #81** — Pure-white popup shell (kill dark backdrop / blur / card framing)
- **PR-PREMIUM-CARDS-2** (#255) — Ship premium platform cards on public homepage (default ON); 12 design binaries converted to .webp + relocated to client/public/; legacy PetWashDivisions retained as `VITE_PREMIUM_PLATFORM_CARDS_ENABLED='false'` emergency disable.
- **PR-MOBILE-SCAFFOLD** (#372) — Expo submission scaffold for App Store + Play Store (bundle id `il.co.petwash.staff`, NSFaceIDUsageDescription, Apple Privacy Manifest, EAS build/submit profiles, asset specs). App.tsx auth/biometric runtime untouched. Companion: `docs/finance/sumit-readiness-check-2026-05-23.md` documenting the 5 sequenced PRs needed before a real sumit.co.il send.
- **PR-S5c + PR-OCR-1** (#375) — Israel-tax compliance pair. PR-S5c: 3-way Osek classification (`patur` / `murshe` / `chevra` / `unknown`) on suppliers (migration 0027 + 4 new columns + CHECK constraint), new `osek_vat_mismatch` screening rule (HARD FAIL when a patur supplier invoices VAT > 0 — protects against un-deductible VAT loss), `osek_classification_unknown` warning so finance must classify before approval, full VAT attribution matrix doc covering K9000 100%-revenue model vs marketplace 15%-commission model with worked numeric examples. PR-OCR-1: SHAAM allocation number (מספר הקצאה) regex extraction from receipt OCR text (Hebrew + English label variants, 9–12 digit capture, 18 vitest cases). No wallet/escrow/agent-model touch.

- **Trust & compliance batch** (#623–#628, 2026-06-08) — organic-claim truth-up across site + skill (pet-formulated APVMA-GMP wording, never "certified organic"), retired contact-email fixes, lenient migrations past data conflicts, public Trust & Certifications page (`/trust`), blueprint-vs-roadmap reconciliation doc.
- **Unified verification + identity track** (#629–#645, 2026-06-08/09) — Section-11 execution breakdown (#629); unified verification challenge schema (#630) + runtime guard (#631); bridges: login SMS (#634), signup OTP (#636), e-gift activation (#637), change-email (#639), close-account (#640), 2FA reconcile (#641), payout actions (#642); `identity_accounts` foundation table, additive flag-off (#635); `loginOrLink` linking service, flag-off not wired (#638); identifier-first SmartSignIn, flag-off (#643); dead-auth cleanup — 5 unused OAuth consent dialogs (#632), misleading Gmail inbox-scanner removed (#633), fake button + Replit-era auth pages deleted (#645).
- **Shop track — physical goods** (#646–#656, 2026-06-09/10) — 7 shop tables, additive (#646); flag-gated luxury storefront wired to `/api/shop/*` (#647); example bilingual catalog seed — PLACEHOLDER data, must be replaced before launch (#649); Wolt-vs-Israel-Post delivery router + engraving personalisation (#650, #651); Israeli delivery calendar — holidays/weekends/legal (#652); bespoke engraving panel + international mobile (#654); lawful checkout — total-before-pay disclosure (§17a), delivery-address capture, `/shop/orders` page (#656). Note: #655 was an empty work-claim PR merged by mistake — zero file changes, harmless. **Shop is deployed DARK:** `VITE_SHOP_LIVE_ENABLED` (frontend, build-time) and `SHOP_ENABLED` (backend env) are both OFF in production; flipping them is the launch switch and requires a real catalog + launch checklist first.

### Open PRs
- **#657** — feat(shop): returns & cancellation disclosure — goods + engraving exemption (CLO policy doc `docs/legal/shop-returns-cancellation-policy-2026-06-10.md` + checkout/engraving-panel disclosure UI). Awaiting CEO merge.

### Parked branches (local commits, awaiting approval to push)
- `claude/pr-20-coworker-scaffold` (commit `971c98b78`) — AI Coworker Agents scaffold. Read-only, no Gemini calls, no UI, returns `wired:false` for all 6 families. Awaiting "Approve PR-20 push".

### Risky areas (handle with extreme care)
- Wallet / finance routes (`server/routes/prestige-pass.ts` `/admin/wallet/*`)
- K9000 / Nayax integration (`server/routes/k9000.ts`, `server/routes/nayax-monyx-events.ts`)
- Tranzila payment processing
- `shared/schema.ts` and any Drizzle migrations
- Loyalty rules engine and proof-run / experiment paths

### Current priority order
1. Master A-Z plan delivery (in progress).
2. Sequenced PR-by-PR execution per plan.
3. PR-20 coworker scaffold push (after popup verification cycle complete).
4. PR-21+ AI governance, observability, auth/onboarding audit, provider onboarding fix.

### Update protocol
After every merge, the agent that merged must:
1. Add the PR to the **Merged** list with one-line description.
2. Remove it from **Open PRs** if applicable.
3. Update the **Last updated** date.
4. Commit the SKILL.md change as part of the merging PR or in an immediate follow-up.

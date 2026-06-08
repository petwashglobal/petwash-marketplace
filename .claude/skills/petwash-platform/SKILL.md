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

---

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

**Last updated: 2026-05-23**

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

### Open PRs
- None.

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

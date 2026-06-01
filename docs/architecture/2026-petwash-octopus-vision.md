# PetWash 2026 — Smart System Octopus (CEO Vision Reference)

**Status:** Architecture reference document. Bridges the CEO's operator-eye system vision (the "Smart System Octopus" diagram, 2026-05-25) to the engineering implementation plan in `docs/architecture/OCTOPUS_ARCHITECTURE_RESET_RFC.md`.

**Type:** Docs-only. No runtime change introduced by the PR that ships this document.

**Author:** Operator vision (nir.h@petwash.co.il) + engineering annotation.

**Related documents:**
- `docs/architecture/2026-05-27-petwash-octopus-vision-v2-amendment.md` — **v2 amendment (2026-05-27)**: extends this doc from 9 to 14 tentacles, adds the 5th central-core orb (Pricing & Promotions Engine), splits Tentacle 5 (Partners) into A/B/C, adds the accessibility global-features badge, and adds a Rover.com competitive-positioning frame. Read alongside this v1 doc; v2 does not supersede.
- `docs/architecture/OCTOPUS_ARCHITECTURE_RESET_RFC.md` — authoritative implementation RFC (domain boundaries, role resolvers, state machines, migration phases). This document does NOT supersede it.
- `docs/design/2026-05-25-smart-identity-routing.md` — Smart Identity & Routing SDD (covers tentacle 1).
- `docs/architecture/00-master-roadmap.md` — overall roadmap.

---

## 0. Why this document exists

The CEO produced a comprehensive system diagram on 2026-05-25 — "PETWASH™ 2026 — SMART SYSTEM OCTOPUS — ONE PLATFORM. EVERY ROLE. ONE DATA FLOW." It captures the platform's operating vision in a form that engineering can act on.

This document does three things:

1. **Preserve the vision** — record the diagram's intent in canonical form (sections 1–9 below).
2. **Anchor it to code** — for each of the nine tentacles, name the existing modules that implement it today and call out the gap to the target state.
3. **Surface four improvements** the engineering review proposed for the next iteration of the diagram (section 11).

It is intentionally **operator-readable**, not implementation-detailed. When implementation lands, each tentacle gets its own focused SDD under `docs/design/`.

---

## 1. Five inviolable principles

These are the operator's stated principles, preserved verbatim:

1. **ONE PLATFORM** — one codebase, one deploy, one product narrative
2. **ONE DATABASE** — single source of truth; no "Postgres says X, Firestore says Y" drift
3. **ONE IDENTITY** — a user is the same user across customer, provider candidate, provider, staff, and admin journeys
4. **ONE ECOSYSTEM** — every tentacle reads from and writes to the central core; no parallel data paths
5. **ENDLESS POSSIBILITIES** — new verticals, new partners, new regions add tentacles without surgery on the core

These principles MUST be referenced when any future PR proposes to introduce a parallel data store, a parallel identity system, a parallel notification pipeline, or a parallel auth path. If a PR's design implicitly violates one of these principles, that's a flag, not a feature.

---

## 2. The central core

The diagram shows four central elements:

| Element | What it owns | Module home today |
|---|---|---|
| **Smart Core Intelligence** | Cross-cutting business logic and orchestration | `server/services/OctopusBrainService.ts` + `server/services/*Orchestrator.ts` |
| **Route Controller** (smart traffic orchestrator) | Where every request and event flows next | `server/routes.ts` + `server/routes/post-login.ts:203` (canonical post-login routing) |
| **Security Layer** (Auth, RBAC, Encryption, Audit) | Identity verification, role checks, audit trail | `server/auth/*` + `server/middleware/auditLog.ts` + `server/lib/firebase-admin.ts` |
| **Data Layer** (Unified DB, Events, Analytics, Audit Logs) | Persistence + analytical surface | Postgres (Drizzle, `shared/schema.ts` 446 tables) + GCS object storage + Firebase Auth (identity provider only) |
| **Integration Layer** (payments, email, sms, push, maps, AI, third-party) | Outbound connectors | Today: scattered across `server/services/*` — TARGET: consolidated under a single integration shell per partner |

**Engineering note:** The Smart Core, Route Controller, and Security Layer are real and largely implemented. The Data Layer is partially fragmented today (passkeys split between Firestore `authenticators` collection and Postgres shadow columns; identity not yet linked across providers). The Integration Layer is the most fragmented — each external partner is invoked from many files directly. The OCTOPUS_RESET_RFC §1 "Create domain boundaries" is the corrective path.

---

## 3. The nine tentacles

Each tentacle is a domain. The principle is: tentacles do NOT call each other directly — they communicate via the core (events, shared services, single identity).

### Tentacle 1 — Unified Entry Point (Smart Auth Gateway)

**Vision:** One signup screen offering Google / Apple / Email / Mobile OTP / Passkey (Face ID/Touch ID via WebAuthn). Language & location aware (HE / EN / AR + RTL/LTR).

**Today:** Seven parallel signup pages — `SignUpLuxury.tsx`, `ProviderOnboarding.tsx`, `ProviderApplicationForm.tsx`, `StaffApplication.tsx`, `PrivilegeSignup.tsx`, `ConsentOnboarding.tsx`, plus `/join/walker`, `/join/sitter`, `/join/trainer` inline routes.

**Target:** Four audience-segmented entry points only: `/signup` (consumer), `/become-provider` (provider candidate), `/admin/login` (invite-only), staff backend (hidden).

**Implementation plan:** `docs/design/2026-05-25-smart-identity-routing.md` (Smart Identity SDD). PR-1 (real Turnstile) is shipped; PR-2 through PR-9 sequenced.

### Tentacle 2 — Members & Loyalty Ecosystem

**Vision:** Member dashboard with Membership, Wallet, Loyalty Points, Vouchers, Pet Profiles, Bookings, History/Invoices. Journey: instant sign up → email/phone verify → choose plan → add pets → start using services → earn loyalty.

**Today:** Largely built but spread across `server/routes/prestige-pass.ts` (20,256 LOC — 399 endpoints), `server/routes/loyalty.ts`, wallet routes, pet routes. Member dashboard exists at `client/src/pages/MyAccount.tsx`.

**Crown-jewel boundary:** Wallet runtime is sacred per `.claude/skills/petwash-platform/SKILL.md:197-200`. Refactoring is allowed for the navigational + presentational layer; release/refund/payout math is not.

**Gap to target:** No state machine for membership lifecycle (active / suspended / churned / pending-renewal). Loyalty points calculation is duplicated in multiple services.

### Tentacle 3 — Providers Ecosystem

**Vision:** Provider journey: Apply → Profile Setup → Business Info → Documents/KYC → Bank/Tax Info → Insurance → Terms & Declaration → Pending Review → Admin Review Queue (Verify/Approve/Reject/Request Info/Suspend) → Provider Dashboard. Supports sitters, walkers, trainers, groomers, drivers (PetTrek), academy, suppliers, station services.

**Today:** Provider application exists at `client/src/pages/ProviderApplicationForm.tsx` + `server/routes/provider-applications.ts` + `server/routes/provider-onboarding.ts`. Vertical-specific routes exist for sitters (`sitter-suite.ts`), walkers (`walk-my-pet.ts`), trainers, etc.

**Gap to target:** The state machine is implicit, not formal. The admin review queue at `client/src/pages/admin/AdminProviderTrust.tsx` exists but the approval workflow is partially broken (`ADMIN_APPROVER_EMAIL` unset in production → notifications silently drop).

**Implementation plan:** Provider state machine formalized in Smart Identity SDD §6.2.

### Tentacle 4 — Management & Staff

**Vision:** Six staff role types — Management, Operations, Finance, Compliance, Support, HR. Each with a dedicated dashboard. Cross-cutting capabilities: User Management, Provider Review, Bookings Oversight, Financial Reports, Disputes & Cases, System Settings. Plus Real-Time Insights (dashboards & analytics).

**Today:** ~100 admin pages under `client/src/pages/admin/*` and `server/routes/admin-*`. Role separation is partially encoded but inconsistent — some admin endpoints check `isSuperAdmin` (`server/routes/access-requests.ts:33`), others check email-allowlist (`SUPER_ADMIN_EMAILS`), others check the role enum.

**Gap to target:** No formal RBAC matrix. The role enum at `shared/schema.ts:12341` is `customer | loyalty | provider | staff | management | admin` but `super_admin` is currently email-based, not enum-based (open question §14.8 in the Smart Identity SDD).

### Tentacle 5 — Partners & Integrations

**Vision:** Centralized integration layer with five categories — Payment Gateways (Card, Apple Pay, Google Pay), Maps & Navigation (Routes, ETAs, Geo Services), Communication (Email, SMS, Push, WhatsApp), AI & Automation (Matching, Pricing, Fraud), Third-party APIs (future integrations).

**Today:** Heavily fragmented. Payment vendors (Tranzila, Nayax, Sumit) called from many files. Twilio + SendGrid + FCM + WhatsApp called from ~40+ files each (Inspector B audit, 2026-05-25). Maps split between client-side Google Maps SDK and server-side `/api/google/places-*` proxy.

**Crown-jewel boundary:** Tranzila, Nayax, K9000 payment-terminal integrations are sacred. Visibility only — no runtime behavior changes without separate approval.

**Gap to target:** No single integration shell. Future work: per-partner adapter layer with consistent retry, observability, kill switch, and audit. Each partner gets its own focused SDD when its turn comes (the order matters: payments first, then communications, then maps).

### Tentacle 6 — Franchise & Stations

**Vision:** Franchise Owners (oversight & reports), Station Management (performance & utilization), Revenue Sharing (commissions & payouts), Local Staff & Roles (per station access), Asset Management (equipment & supplies).

**Today:** K9000 station hardware integration exists (`server/routes/k9000.ts`, `pet_wash_stations` table). Nayax payment-terminal integration exists. Franchise role conceptually exists but is not fully separated from `provider` and `management` roles. Revenue sharing math is in `BillingLedger.ts` (crown-jewel).

**Crown-jewel boundary:** K9000 + Nayax runtime, Nayax reconciliation (`docs/architecture/03-nayax-reconciliation.md`), and franchise payout math are all sacred.

**Gap to target:** Franchise dashboard isn't a first-class surface — franchise users use the regular admin dashboard with role-filtered views. The vision is a dedicated franchise tentacle, not a filter over admin. This is a future tentacle reset; not urgent.

### Tentacle 7 — Admin & Platform Control

**Vision:** Super Admin (full system access), Roles & Permissions (RBAC), Audit Logs (all actions tracked), Security Center (monitoring & alerts), System Health (uptime, performance). **Admin access is invite-only** with MFA/Passkey required, role-based access, IP & device check, session monitoring.

**Today:** Audit logging exists (`server/middleware/auditLog.ts:57`). Super-admin pattern exists (email-allowlist). System health exists (`/health`, `/health/strict`). RBAC is partial. **No invite-only admin signup yet** — admins are added by direct DB writes.

**Implementation plan:** Smart Identity SDD §6.3 (admin invite-only state machine) + §7.3 (`admin_invitations` table — REQUIRES APPROVAL per crown-jewel schema rule).

### Tentacle 8 — Data Flow & Intelligence

**Vision:** Events from all modules → Real-time processing engine → Analytics (insights & AI) → Actions (automation) → Notifications (users & staff). Five outputs: Smart Matching, Demand Forecasting, Fraud Detection, Customer Insights, Business Growth.

**Today:** Events are ad-hoc — each route emits to whoever subscribes via in-process callbacks. There's no formal event bus (no Pub/Sub, no Kafka, no Redis Streams). AI features exist (`server/routes/ai-booking.ts`, `OctopusBrainService.ts`, four AI-B features merged but flag-gated OFF). The "five outputs" mostly exist as scattered admin reports, not a unified intelligence layer.

**Gap to target:** This is the LARGEST gap in the vision. An event-sourced architecture is a multi-quarter project. Recommended order: (a) formalize the event schema; (b) pick a transport (Pub/Sub is the GCP-native choice given the deploy); (c) migrate ONE producer/consumer pair at a time behind an adapter; (d) only then layer Analytics + Actions on top.

**Implementation plan:** Out of scope for current SDDs. Belongs to its own future "Event Bus & Intelligence SDD" once the identity work lands and there's bandwidth.

### Tentacle 9 — Communication Hub

**Vision:** Email Templates (triggers & automations), SMS OTP (verifications & alerts), Push Notifications (users & providers), WhatsApp Business (updates & support), In-App Messages (real-time chat & alerts).

**Today:** Each channel is implemented in its own service (`server/emailService.ts` 3,506 LOC for SendGrid, `server/services/TwilioSMSService.ts`, FCM via Firebase Admin, WhatsApp via `docs/META_WHATSAPP_SETUP_GUIDE.md` referenced but not fully wired). Templates live in SendGrid (template IDs in secrets). No unified `NotificationService` — each route picks its channel and template directly.

**Gap to target:** One unified `NotificationService` with channel routing rules ("if customer prefers SMS, use SMS; if SMS fails, fall back to email"), template management, opt-out lists, and per-event audit. This is a substantial refactor (Inspector B estimates 40+ call sites per channel today).

**Implementation plan:** Future "Communication Hub SDD" — sequence after Smart Identity stabilizes.

---

## 4. Global features (cross-cutting)

These apply to every tentacle:

| Feature | Today | Target |
|---|---|---|
| **Multi-language** (HE / EN / AR + RTL) | Hebrew + English wired end-to-end; Arabic partial (`PhoneInput.tsx` country names) | Full Arabic + RTL audit; new languages add by translation file, not code change |
| **Mobile First** (PWA / Native App) | PWA wired (`server/iosCompatibility.ts`); no consumer native iOS app in this repo (Inspector A confirmed); `mobile-app/` is a staff-app Expo scaffold never EAS-initialized | Either ship a Capacitor wrapper of the SPA (cheapest path to App Store + Play Store) OR commit to native iOS/Android repos (highest cost, highest quality) — operator decision needed |
| **Security First** (encrypted & compliant) | Postgres+TLS, Firebase Auth, audit log table, KYC2026 doc encryption (`DOCUMENT_ENCRYPTION_KEY`) | Smart Identity SDD addresses identity-layer hardening; payments crown-jewel; data-encryption-at-rest already met by Postgres+GCS defaults |
| **Scalable Cloud** (high availability) | Cloud Run autoscaling + Firebase Hosting CDN + Neon serverless Postgres | Cloud Run min-instances=1 already set; no obvious next step until traffic warrants |
| **AI Powered** (smart automation) | Gemini 1.5 Flash via Vertex AI; four AI-B features merged but flag-gated OFF; Maya voice AI (`server/routes/maya-voice-twilio.ts`) | Persist SystemConfig flags to durable store (currently in-memory only — `server/services/SystemConfig.ts:8-11`); enable AI-B3 (deterministic slots) first; build admin toggle UI for AI flags |

---

## 5. The four improvements engineering recommends

When the diagram is iterated, these additions would make the implementation path even clearer:

### 5.1 Make the event bus visible

Tentacle 8 (Data Flow & Intelligence) is the most important tentacle architecturally because it's how all the others stay in sync without coupling. The current diagram shows it at the bottom as a workflow strip. In a future iteration, consider drawing event arrows from EVERY tentacle into the central core — visually emphasizing that the bus is the spine, not a separate concern.

### 5.2 Mark crown-jewel boundaries

Some tentacles contain components that are sacred (wallet runtime, K9000 hardware, Nayax/Tranzila payment processing, finance math). Touching these requires explicit approval per `.claude/skills/petwash-platform/SKILL.md:197-200`. A visual indicator on the diagram — red border, lock icon — would make these boundaries unmistakable when planning work. Today the crown-jewel rule is documented in text; the diagram could surface it.

### 5.3 Show the internal/external seam

Tentacle 5 (Partners & Integrations) is the BOUNDARY between PetWash code and external providers (Stripe-equivalent, Twilio, SendGrid, Google Maps, Apple, etc.). A dotted boundary line on the diagram — with PetWash inside, vendors outside, and the Integration Layer as the seam — would clarify which components we control vs. which we depend on. It also clarifies the risk model: vendor outages, vendor pricing changes, vendor API breaks.

### 5.4 Add a "Compliance & Legal" tentacle (or sub-tentacle)

Israeli tax (ITA / Sumit / חשבונית מס), GDPR, KYC2026, recording disclosure (`docs/legal/maya-voice-recording-disclosure.md`), Israeli e-sign — these are real cross-cutting concerns that don't fit cleanly in Admin or Providers. They have their own state machines (KYC verified / pending / expired / rejected), their own data retention rules, and their own audit requirements.

Adding a dedicated Compliance & Legal tentacle (or a clearly-marked sub-tentacle under Tentacle 7) would prevent compliance from being treated as "Operations' problem" or "the lawyer's problem" — it's its own engineering domain.

---

## 6. How this document sequences with existing canon

The architecture documents in `docs/architecture/` already form a coherent stack:

| Doc | What it owns | Status |
|---|---|---|
| `00-master-roadmap.md` | Cross-cutting hard rules + phase boundaries | Current |
| `OCTOPUS_ARCHITECTURE_RESET_RFC.md` | Authoritative engineering RFC for the reset (domain boundaries, role resolver, state machines, migration phases) | Current — **this remains the implementation source of truth** |
| `01-unified-payment-abstraction.md` through `10-global-scaling.md` | Vertical-specific RFCs | Each scoped |
| `2026-petwash-octopus-vision.md` (THIS DOC) | CEO operator-eye vision — bridges to the RFC | New |
| `docs/design/2026-05-25-smart-identity-routing.md` | Smart Identity SDD (Tentacle 1) | New |
| `docs/design/<future>.md` | Per-tentacle SDDs as work begins | Future |

**Sequencing rule:** When work on a tentacle begins, the operator-eye vision (this doc) provides the WHY; the OCTOPUS_ARCHITECTURE_RESET_RFC provides the HOW; a per-tentacle SDD under `docs/design/` provides the WHAT (concrete API, schema, state machine, test plan).

---

## 7. Anti-patterns this vision rules out

Direct corollary of the five principles:

| Anti-pattern | Which principle it violates |
|---|---|
| "Let's add a parallel Firestore collection for [X] because it's faster" | ONE DATABASE |
| "Provider has a separate user table from customer" | ONE IDENTITY |
| "Each vertical (sitter, walker, groomer) gets its own auth" | ONE IDENTITY + ONE ECOSYSTEM |
| "Add a new signup page for the new launch" | ONE PLATFORM (Tentacle 1 already exists; route into it) |
| "Add this feature in a different repo so it's isolated" | ONE PLATFORM (extension goes in a tentacle, not a fork) |
| "Skip the audit log for this admin action because it's a bulk operation" | ONE ECOSYSTEM (audit is core, not optional) |
| "Send the customer SMS directly from this route — no need to call NotificationService" | Future ONE ECOSYSTEM (Tentacle 9 once consolidated) |

When future PRs surface during review, this list of anti-patterns is a useful checklist.

---

## 8. Open vision-level questions for the operator

Distinct from the 12 SDD-level open questions in `docs/design/2026-05-25-smart-identity-routing.md` §14. These are about the **vision** itself:

1. **iOS App** — does the App Store iOS app exist in a separate repo, or does the signup page link to a non-existent app? Determines whether Tentacle 1 (Unified Entry Point) needs a Capacitor wrapper sprint or just a removal of the fake App Store link
2. **Franchise vs Provider** — is "franchise owner" a distinct enough role to be its own tentacle (Tentacle 6 standalone), or a permission level inside the provider tentacle? The diagram has it standalone; the codebase treats it as a permission today
3. **Compliance scope** — should "Compliance & Legal" be added as a tenth tentacle, or sub-folded under Admin (Tentacle 7)? The engineering recommendation is its own tentacle (§5.4 above); confirm or override
4. **Communication channel preference** — does the user OWN their preferred notification channels (per-event opt-in), or does the platform decide based on the event type? Determines the data model for Tentacle 9
5. **Event bus transport** — when Tentacle 8 (Event Bus) is built, the GCP-native choice is Cloud Pub/Sub. The other option is to add Redis Streams (already running for `REDIS_URL`). Choosing now informs the next year of work

These questions don't block any current PRs. They guide the next 6–12 months of architecture decisions.

---

## 9. What this document does NOT do

- Does not introduce any runtime change
- Does not override `OCTOPUS_ARCHITECTURE_RESET_RFC.md` — it complements it
- Does not approve schema migrations, dependency additions, or crown-jewel changes
- Does not commit to implementation dates or sequencing — that lives in the SDDs and per-PR planning
- Does not promise feature parity with Rover / Mad Paws / Wallt — those are size/scope reference points, not feature targets

---

## Appendix A: Diagram source

The originating diagram is the "PETWASH™ 2026 — SMART SYSTEM OCTOPUS" image attached to the operator's 2026-05-25 message. Key text content:

- Title: "PETWASH™ 2026 – SMART SYSTEM OCTOPUS"
- Tagline: "ONE PLATFORM. EVERY ROLE. ONE DATA FLOW."
- Center: "PETWASH™ SMART CORE INTELLIGENCE" with Route Controller (Smart Traffic Orchestrator), Security Layer (Auth, RBAC, Encryption, Audit), Data Layer (Unified DB, Events, Analytics, Audit Logs), Integration Layer (Payments, Email, SMS, Push, Maps, AI, Third-Party)
- Nine tentacles labeled 1–9 (per sections 3.1–3.9 of this doc)
- Global Features bar at bottom: Multi Language (HE / EN / AR + RTL), Mobile First (PWA / Native App), Security First (Encrypted & Compliant), Scalable Cloud (High Availability), AI Powered (Smart Automation)
- Key Principles bar at bottom right: ONE PLATFORM, ONE DATABASE, ONE IDENTITY, ONE ECOSYSTEM, ENDLESS POSSIBILITIES

The diagram itself is not committed to the repo (image binary); this textual canonical form preserves its intent.

---

## Appendix B: Document lifecycle

| Action | Trigger | Result |
|---|---|---|
| **Read** | Any future PR planning a major architectural change | Confirms alignment with the five principles |
| **Update** | The CEO produces a revised vision diagram | New version of this doc, with old version preserved in git history |
| **Reference** | Per-tentacle SDDs cite the relevant section as the operator-vision anchor | Keeps engineering work tethered to operator intent |
| **Retire** | Never — this document is the long-lived operator-eye view, not a tactical plan | Tactical plans (SDDs, RFCs) age out; the vision persists |

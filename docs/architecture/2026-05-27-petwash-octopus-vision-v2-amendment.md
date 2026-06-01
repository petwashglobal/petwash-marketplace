# PetWash 2026 — Smart System Octopus, v2 Amendment

**Status:** Architecture vision amendment. Strategic / vision-level addition to the operator's master Octopus diagram. **Not an implementation SDD.** No runtime change, no schema, no code, no PR opened from this doc itself.

**Type:** Docs-only. Sibling to (not replacement of) the v1 vision doc.

**Author:** Operator (Nir Hadad, CEO, nir.h@petwash.co.il) + engineering annotation. Authored 2026-05-27 in response to the operator's directive after reading the v1 vision doc and the universal payment-and-lifecycle SDD (merged via PR #467).

**Companion document (sibling, do NOT replace):**
- `docs/architecture/2026-petwash-octopus-vision.md` — the v1 vision doc (the nine tentacles, the five inviolable principles, the four engineering improvements). This amendment **does not supersede** v1; it extends it from 9 to 14 tentacles, refines the central core, and adds a Rover.com competitive frame the v1 doc did not anchor.

**Hard cross-links (read alongside this doc):**
- `docs/architecture/OCTOPUS_ARCHITECTURE_RESET_RFC.md` — engineering RFC; remains the source of truth for HOW the reset lands.
- `docs/governance/octopus-brain-doctrine.md` — governance doctrine; all 19 doctrine rules (D1–D19) apply unchanged.
- `docs/octopus-routes.md` — route map.
- `docs/architecture/00-master-roadmap.md` — overall roadmap.
- `docs/design/2026-05-25-smart-identity-routing.md` — Smart Identity SDD (Tentacle 1).
- `docs/design/2026-05-25-commerce-promotions-pricing.md` — Commerce / promotions / pricing SDD (5th central-core orb anchor).
- `docs/design/2026-05-26-shop-module-physical-goods.md` — Shop SDD (Tentacle 13 anchor).
- `docs/design/2026-05-26-payment-provider-routing-and-lifecycle.md` — Universal payment router + lifecycle SDD (PR #467 — anchors Tentacle 5 split + Tentacle 10).
- `docs/design/2026-05-22-supplier-invoice-sumit-fraud-control.md` — Supplier invoice / SUMIT handoff SDD (Tentacle 10 anchor).

---

## 0. Why this amendment exists

The v1 vision doc (`2026-petwash-octopus-vision.md`) preserved the operator's 2026-05-25 "Smart System Octopus" diagram — nine tentacles, five inviolable principles, four engineering-recommended improvements. It did the right thing: anchored the vision to code, named the gaps, sequenced the work to per-tentacle SDDs.

In the two weeks since, three things happened that this amendment now records:

1. **The operator reviewed the v1 doc and the universal payment-and-lifecycle SDD (PR #467)** and identified that the v1 diagram, while correct, is **incomplete at the strategic / scale-ambition level**. Money-out (provider payouts, supplier invoice payments, VAT remittance), regulatory surface (Israeli statutory bodies), trust & safety (pet injury, background-check refresh, abuse detection), shop / physical goods, and vet / pet-health integration are all real domains today — but they're **scattered across other tentacles or invisible on the diagram**. They need to be promoted to first-class tentacles so engineering and the CEO speak the same language about them.

2. **The operator anchored the ambition to Rover.com.** Rover is the canonical US pet-services marketplace (sitter + walker). The operator's directive (Appendix A, verbatim) is to be "as big as rover.com" — not as a clone, but as the **Israeli-regulated, multi-vertical, physical-station-enabled pet ecosystem** that has everything Rover has plus dual-bay K9000 wash stations, integrated commerce, gift cards, wallet, franchise, Hebrew/RTL, and Israeli statutory compliance. The diagram needs to make that strategic frame **visible**, not implicit.

3. **The engineering review of the v1 doc surfaced concrete additions** the operator approved in one sentence: *"do all, call best agent for that"*. This amendment is the record of those additions.

This amendment does three things:

1. **Promote five new tentacles** (Outgoings/AP Engine, Gov/Regulatory, Trust & Safety, Shop/Commerce, Vet/Pet Health) to bring the diagram from 9 to 14 tentacles — without removing or renumbering the original 9.
2. **Refine the central core** (add Pricing & Promotions Engine as the 5th core orb) and refine the existing tentacles (split Tentacle 5 into payment / logistics / marketing partner subdomains, make the identity progression visible in Principle 3, make extension points visible in Principle 5).
3. **Add a Rover.com competitive positioning section** so the strategic frame is explicit and durable — and clear that PetWash 2026 is *not a Rover clone*; it's the Israeli-regulated, multi-vertical, physical-station-enabled pet ecosystem that happens to also do what Rover does.

It is intentionally **operator-readable**, matching the v1 doc's tone. When implementation lands for any of the new tentacles, each gets its own focused SDD under `docs/design/` (the follow-up roadmap is in §7 below).

---

## 1. Relationship to v1 + the five inviolable principles

The five inviolable principles from v1 §1 **do not change**. They are reproduced here verbatim because the new tentacles must obey them just as the original nine do:

1. **ONE PLATFORM** — one codebase, one deploy, one product narrative
2. **ONE DATABASE** — single source of truth; no "Postgres says X, Firestore says Y" drift
3. **ONE IDENTITY** — a user is the same user across customer, provider candidate, provider, staff, and admin journeys
4. **ONE ECOSYSTEM** — every tentacle reads from and writes to the central core; no parallel data paths
5. **ENDLESS POSSIBILITIES** — new verticals, new partners, new regions add tentacles without surgery on the core

The new tentacles (10–14) are explicit applications of **Principle 5**: they extend the system without surgery on the core. The core orb addition (Pricing & Promotions Engine) is an explicit application of **Principle 2**: pricing decisions today are scattered across `pricingPackages`, `intendedPricing`, `petTypePricing`, `addonPricing`, `pricingRules`, hard-coded constants in client pages, and three different "discount" code paths (see `docs/design/2026-05-25-commerce-promotions-pricing.md` §1) — five sources of pricing truth violates Principle 2.

The Israeli statutory tentacle (Tentacle 11) is an explicit application of **Principle 1**: regulatory work today is buried inside Admin (Tentacle 7) and Compliance (a sub-bullet of Tentacle 4), making it invisible at planning time. Promoting it to its own tentacle makes the surface visible to product, engineering, CEO, and counsel simultaneously.

**What the v1 doc remains the source of truth for:**
- Section 2: the central core (this amendment adds a 5th orb but does not change the four existing orbs).
- Section 3: tentacles 1–9 (this amendment does not renumber or relocate them).
- Section 4: global features (this amendment adds an accessibility badge; the existing five badges remain).
- Section 5: the four engineering improvements (this amendment incorporates three of them into the new tentacle structure: event bus visibility stays as v1 §5.1; crown-jewel boundaries stay as v1 §5.2; internal/external seam is realised by the Tentacle 5 split in §5 below; Compliance & Legal tentacle is promoted to Tentacle 11 in §3 below).
- Section 7: the anti-patterns list — unchanged.

**The v1 doc and this amendment together** form the operator-eye vision. The OCTOPUS_ARCHITECTURE_RESET_RFC remains the engineering implementation source of truth. Per-tentacle SDDs under `docs/design/` remain the concrete API/schema/state-machine plans.

---

## 2. Rover.com competitive positioning

**The strategic frame the v1 doc did not anchor.** The operator's directive (Appendix A, verbatim) is to scale to Rover.com's magnitude — Rover is a $1B+ US pet-services marketplace (NASDAQ: ROVR until 2024 acquisition; recent revenue ~$240M / 2023). It is the canonical reference for what a venture-scale pet-services platform looks like in a developed market.

PetWash 2026 is **not building a Rover clone**. The competitive frame is the table below — what Rover has, what PetWash has, and where the **moat** sits.

### 2.1 Side-by-side capability comparison

| Capability | Rover.com | PetWash 2026 (target state) |
|---|---|---|
| **Sitter / walker marketplace** | ✓ Core product | ✓ Tentacle 3 (sitter, walker) |
| **Multi-vertical providers** (trainer / groomer / academy / driver / kiosk operator) | ✗ Sitter + walker only | ✓ Tentacle 3 covers sitter, walker, **trainer, groomer, driver, academy, station operator** |
| **Physical stations** (dual-bay K9000 wash) | ✗ No physical infrastructure | ✓ **MOAT** — Tentacle 6, K9000 hardware, Nayax payment terminals |
| **Integrated commerce** (shop, gift cards, wallet, packages) | Partial (Rover has Rover Store apparel; no wallet) | ✓ Tentacle 13 (shop) + Tentacle 2 (wallet, loyalty, vouchers, packages) |
| **Israeli regulatory compliance** | ✗ US-only (FTC, state-level) | ✓ Tentacle 11 (הרשות המסים, חוק הגנת הצרכן, חוק הגנת הפרטיות, רישוי עסקים, השירותים הוטרינריים, AML, PCI, accessibility) |
| **Hebrew-first / RTL UX** | ✗ English-only | ✓ Global feature; RTL audited per `.claude/skills/petwash-ui-ux/SKILL.md:188-215` |
| **Franchise model** | ✗ Provider-only marketplace | ✓ Tentacle 6 (franchise + station operator separation per OCTOPUS_RESET_RFC) |
| **In-house payment routing** (SUMIT / UPay / Nayax) | ✗ Stripe-dependent | ✓ Tentacle 5A (universal router per `docs/design/2026-05-26-payment-provider-routing-and-lifecycle.md`) |
| **Background-check + provider insurance** | ✓ Rover Care | 🟡 Partial; Tentacle 12 target |
| **Pet injury claims workflow** | ✓ Rover Care | 🟡 Partial; Tentacle 12 target |
| **Vet / pet-health integration** | Partial (Rover-vet partnerships; not deeply integrated) | ❌ Today / ✓ Tentacle 14 target — **white-space differentiation** |
| **Emergency-vet routing** | ✗ | 🟡 Target — Tentacle 14 + PetTrek (driver synergy) |
| **GPS walk tracking** | ✓ | ✓ (Walk My Pet GPS in code) |
| **Owner messaging during service** | ✓ | ✓ (Tentacle 9 — Communication Hub) |
| **Tax invoicing** (חשבונית מס numbering, VAT) | ✗ US-only; no Israeli ITA path | ✓ Tentacle 11 + SUMIT (per supplier-invoice SDD) |
| **AML / KYC for providers and customers** | ✓ (US AML / KYC rules) | ✓ Tentacle 11 — Israeli AML (חוק איסור הלבנת הון) |
| **App Store + Play Store native apps** | ✓ | 🟡 PWA + Expo staff scaffold; native consumer app is open question per v1 §8.1 |
| **Public pet-care content / SEO** | ✓ Rover Resources (large content library) | 🟡 Limited; not in any tentacle today |

### 2.2 The moat

PetWash 2026's defensible position is the **intersection of three things Rover cannot easily copy**:

1. **Physical dual-bay wash stations.** Rover is an asset-light marketplace; PetWash operates physical K9000 hardware in real locations with real franchise/station operators. Replicating this is a capex sprint, not a software sprint. (Tentacle 6 + crown-jewel boundary on K9000 / Nayax runtime.)
2. **Israeli statutory + Hebrew/RTL.** Rover would need to localise to a market with VAT 18%, חשבונית מס numbering rules, monthly 102/126 forms, SHAAM allocation thresholds, חוק הגנת הצרכן cooling-off, חוק הגנת הפרטיות, רישוי עסקים per-station — and an RTL Hebrew-first UI on every surface. This is a multi-year project for a US-anchored company. (Tentacle 11.)
3. **Multi-vertical under one identity.** Rover does sitter + walker. PetWash does sitter + walker + trainer + groomer + driver + academy + station operator + supplier + franchise — all under ONE identity (Principle 3), one application form, one KYC, one tax-status snapshot, one bank record. The per-vertical capability map (`contractorCapabilities` in `shared/schema.ts:9477`, `platforms` enum in `shared/schema.ts:7810`) is the implementation surface that makes this real.

### 2.3 What this means for sequencing

The Rover frame **does not change the OCTOPUS_RESET_RFC migration phases**. Phase 1 (stop the bleeding), Phase 2 (control maps), Phase 3 (domains behind adapters), Phase 4 (money + redemption), Phase 5 (calendar + maps + search) remain unchanged. What the Rover frame **does** change is the operator's mental model when evaluating new feature requests:

- "Should we build X?" becomes "Does X reinforce the moat (physical stations, Israeli regulatory depth, multi-vertical under one identity) or is X a Rover-parity feature we can afford to ship at v2 quality?"
- "Should we hire for X?" becomes "Does X engineering investment widen the moat or close a Rover-parity gap?"
- "Should we spend marketing on X?" becomes "Does X position us as the local Israeli alternative or as a generic pet-app?"

This frame is durable. It belongs to the vision layer, not the implementation layer.

### 2.4 What the Rover frame does NOT do

- Does not authorise feature parity with Rover as an objective. PetWash 2026 is not racing to ship every Rover feature; it is building a different shape of company.
- Does not authorise dropping Israeli statutory work to chase Rover-parity launches. The doctrine rule (D1: immune system vs CEO pressure) holds regardless.
- Does not commit to entering the US market. Israel-first remains the operating reality; entering a second market is a strategic decision for the operator and board, not a default.
- Does not commit to a fundraise, an IPO, or any specific valuation outcome. The Rover comparison is for **scale ambition and product depth**, not for fundraising tactics.

---

## 3. New tentacles 10–14

Each new tentacle follows the v1 doc's "anchor to code" pattern: name the existing modules that touch the domain today, call out the gap, point to which existing SDD covers it (if any), name the follow-up SDD that should be written next.

### Tentacle 10 — OUTGOINGS / AP ENGINE

**Vision:** All money OUT of PetWash, treated as one tentacle with one ledger spine and one approval/audit chain. Provider payouts (commission splits), franchise revenue-share automation, refund engine, supplier invoice payments, salaries / 1099-equivalent contractor payments, VAT remittance to הרשות המסים (monthly 102 / 126 forms), insurance premium outflows. Today scattered; tomorrow one tentacle.

**Today (scattered, cited):**
- Provider payout math lives in `server/services/BillingLedger.ts` (crown-jewel runtime per `.claude/skills/petwash-platform/SKILL.md:197-200`).
- Provider payout service: `server/services/ProviderPayoutService.ts`.
- Refund engine: distributed across `server/services/WalletEngine.ts`, `server/services/UnifiedWalletService.ts`, `EgiftFinancialService.ts`, and per-route ad-hoc refund logic.
- Supplier invoice payments: schema seeds at `shared/schema-corporate.ts:134` (`supplierContracts`, `supplierPayments`) + `shared/schema-finance.ts:20` (`accountsPayable`); SDD already exists at `docs/design/2026-05-22-supplier-invoice-sumit-fraud-control.md`.
- Franchise revenue-share: implicit in `BillingLedger.ts`; no first-class franchise payout surface today.
- VAT remittance (102 / 126 monthly forms): no automation; today handled outside the platform by the accounting firm (רו"ח קופרברג, עזרא ושות' via SUMIT) per the supplier-invoice SDD §0.
- Insurance premium outflows: no platform automation today; handled manually by the operator.

**Gap to target:** No single "money OUT" ledger surface. Each outflow type has its own approval path, its own admin dashboard, its own audit trail. The doctrine rule D3 (ledger as cross-rail bus) and D16 (manual-fallback discipline) both require that every money mutation pass through the same ledger and the same audit chain — Tentacle 10 makes that **visible** as a unified surface.

**Implementation pointer:**
- The universal payment-and-lifecycle SDD (`docs/design/2026-05-26-payment-provider-routing-and-lifecycle.md`, merged via PR #467) covers money **IN** end-to-end with the same primitives Tentacle 10 will reuse (PaymentProviderRouter, PurchaseLifecycle, audit unification). Tentacle 10 is the **money-OUT mirror** of that SDD.
- Supplier invoices have their own SDD (`docs/design/2026-05-22-supplier-invoice-sumit-fraud-control.md`) covering the BEFORE-SUMIT internal control layer (verify provider → verify supplier → scan invoice → match to work → approve → only then send to SUMIT). This SDD already lands the "approval before money goes out" pattern for supplier invoices.

**Follow-up SDD needed (priority HIGH):**
- `docs/design/<date>-outgoings-ap-engine.md` — covers provider payouts, franchise revenue-share, refund engine, VAT remittance, insurance premium outflows under ONE unified outflow lifecycle + audit surface. **Crown-jewel constraint:** the existing payout math in `BillingLedger.ts` and the existing wallet ledger (`walletLedgerEntries` per `shared/schema.ts:11675-11719`) must NOT change behaviour. The Outgoings SDD is an additive coordination layer, not a rewrite.

**Doctrine alignment:** D3 (cross-rail bus), D8 (forbidden shortcuts — no automated provider payout without CPA answers Q5, Q6), D10 (reviewer checklist), D16 (manual-fallback discipline), D18 (sign-off chain — provider payout requires CPA → CEO).

**Operator decisions blocking implementation:** Q5 (self-billing — CPA + Counsel), Q6 (provider tax-status taxonomy — CPA), Q11 (principal vs agent — Counsel), Q12 (trust account — Counsel). All four are tracked in `docs/governance/octopus-brain-doctrine.md` D9.

### Tentacle 11 — GOV / REGULATORY

**Vision:** All Israeli statutory and regulatory surfaces, treated as their own tentacle rather than buried under "Compliance" in Tentacle 4. Each Israeli regulator has its own state machine, its own reporting cadence, its own evidence retention, its own audit surface. The operator must be able to look at one tentacle and ask "are we current with the tax authority? with the privacy commissioner? with the municipality? with the vet authority?" and get a single answer per regulator.

**Today (scattered, cited):**
- VAT + חשבונית מס numbering: `shared/israel-compliance-config.ts` (VAT 0.18, osek-patur ceiling, withholding policy, SHAAM thresholds, COMPANY_TAX_ID); `server/services/VATCalculatorService.ts:5,46,52`; `server/services/FinancialDocumentService.ts:55,75,83`. Documented in `docs/architecture/04-israeli-compliance.md`.
- Cooling-off (חוק הגנת הצרכן — distance sales / מכר מרחוק): cited in the commerce-pricing SDD §9.3 and the shop SDD §3.3 + §13.2; surface-specific (services, goods, gift cards each have their own cooling-off rule).
- Privacy (חוק הגנת הפרטיות + תקנות הגנת הפרטיות אבטחת מידע 2017): cited in `docs/governance/octopus-brain-doctrine.md` D11 (L10) and D15 (insurance routing); no `docs/design/<date>-privacy.md` yet. Doctrine flag: future PR-PRIVACY-1.
- Municipal business license (רישוי עסקים): per-franchise / per-station; no platform surface today.
- Vet authority (השירותים הוטרינריים): pet movement records + vaccination logs; no platform surface today.
- AML (חוק איסור הלבנת הון 2000): cited in D11 (L9) and D9 (Q11, Q12); future PR-AML-1; no surface today.
- PCI DSS: cited in D11 (L7) and D9 (Q15); the card-data boundary is held by deferring all raw-card handling to SUMIT/UPay/Nayax/Tranzila (D8 forbidden shortcuts #16, #17).
- Accessibility (תקנות שוויון זכויות לאנשים עם מוגבלות): no platform-level surface; partial WCAG coverage in the SPA today; **new global feature badge per §6 below**.

**Gap to target:** No single regulatory surface. The doctrine doc (D11) tags each regulator with the authority who classifies (CPA, Counsel, Labor lawyer, Privacy counsel, Insurance broker) but the **platform-level visibility** — what's current, what's pending, what's blocked, what's overdue — is invisible. Tentacle 11 is the operator dashboard for regulatory state.

**Implementation pointer:**
- `docs/architecture/04-israeli-compliance.md` is the most-current single doc; the supplier-invoice SDD §10 + the commerce-pricing SDD §9 + the payment-routing SDD §13 each cover the regulator surface for their domain.
- The CEO personal-liability map (D11 in doctrine) is the durable reference for **which statute applies to which surface**.

**Follow-up SDDs needed (priority HIGH; sequence per D9 Q-order):**
1. `docs/design/<date>-privacy-doctrine-PR-PRIVACY-1.md` — חוק הגנת הפרטיות, data-deletion requests, privacy-by-design, encryption-at-rest documentation, breach-notification path. **Priority: HIGH** per doctrine D8 forbidden item #22 (no production export of PII outside an approved data-flow path).
2. `docs/design/<date>-aml-PR-AML-1.md` — חוק איסור הלבנת הון, KYC + transaction reporting, OFAC-equivalent screening. **Priority: HIGH** per L9 + Q11.
3. `docs/design/<date>-accessibility-PR-A11Y-1.md` — WCAG 2.1 AA audit across every surface; RTL + screen-reader + keyboard-only. **Priority: MEDIUM** (statutory but not money-blocking).
4. `docs/design/<date>-municipal-licensing-PR-LICENSE-1.md` — per-franchise רישוי עסקים tracking + renewal reminders + auto-suspend on lapse. **Priority: MEDIUM**.
5. `docs/design/<date>-vet-authority-PR-VET-AUTH-1.md` — pet movement records + vaccination logs (overlaps with Tentacle 14; sequence Tentacle 14 first to avoid duplication).

**Doctrine alignment:** D9 (authority questions Q1–Q18), D11 (CEO personal-liability map L1–L11), D12 (Payment Services Law 2023 firewall), D15 (insurance authority routing), D18 (sign-off chain).

**Operator decisions blocking implementation:** Almost everything in D9 Q1–Q18 is a regulatory decision that lives in this tentacle. The blocker is **authority routing**, not engineering — exactly the D4 (architecture vs authority decisions) principle.

### Tentacle 12 — TRUST & SAFETY

**Vision:** All trust, safety, dispute, fraud, abuse, and emergency-response surfaces, treated as their own tentacle. Today a checkbox under Admin → "Disputes & Cases." For a pet marketplace with money + animals + people, this is a **domain**, not a checkbox.

**Today (scattered, cited):**
- Provider quality monitoring: `server/services/providerMonitoring.ts`; `server/services/providerDecisionEngine.ts`; admin surface at `client/src/pages/admin/ProviderReview.tsx`, `ProviderKycReview.tsx`.
- Background-check status: provider application captures it once at signup; **no refresh scheduling** today (gap per provider-onboarding flow review).
- Abuse detection: `server/services/GeminiSpamGuard.ts` (Gemini-powered spam guard, 565 LOC); `server/services/GeminiPlatformSecurityMonitor.ts`; `server/services/GeminiSecurityAdvisor.ts`; `server/services/GeminiWatchdogService.ts`.
- Fraud detection: `server/services/ReceiptFraudDetection.ts:61`; `server/ai/fraudScan.ts:202`; `server/services/walletFraudLog.ts`-pattern in schema.
- Disputes: scattered admin routes; no formal dispute state machine; PR-COMPLIANCE-DISPUTES-1 is named as a future doc class in doctrine D11 / D10 but not yet written.
- Pet injury claim: no surface today; no insurance integration today; manual handling outside the platform.
- Emergency vet escalation: no surface today.
- Trust-score / rating cliffs / complaint clustering: no platform-level surface today.

**Gap to target:** Trust & Safety is the **second-largest gap** after the Event Bus (Tentacle 8). For a platform that matches strangers with pets in customers' homes (sitter, walker), that operates physical washing infrastructure with dogs inside (K9000), and that handles money flows in seven distinct rails — having no first-class Trust & Safety tentacle is a strategic exposure that the Rover comparison makes obvious. Rover has Rover Care; PetWash has scattered admin pages and four Gemini services. The doctrine D11 personal-liability map (L1–L11) makes Trust & Safety partly an operator-liability mitigation, not just a product feature.

**Implementation pointer:**
- Existing Gemini services (`GeminiSpamGuard.ts`, `GeminiPlatformSecurityMonitor.ts`, `GeminiWatchdogService.ts`) are the AI substrate Tentacle 12 will plug into. **Per doctrine D5.1, AI is analyst, never executive** — every consequential T&S action requires a human admin click that writes to `audit_events`. Tentacle 12 codifies that pattern instead of leaving it implicit.
- Provider trust admin (`ProviderKycReview.tsx`, `ProviderReview.tsx`) is the existing surface; T&S extends it.
- The supplier-invoice SDD already lands the "verification → approval → audit → release" pattern for one money-touching surface; T&S generalises it to **non-money** surfaces (dispute, abuse, emergency, injury claim).

**Follow-up SDDs needed (priority HIGH):**
1. `docs/design/<date>-trust-safety-doctrine.md` — the umbrella SDD: dispute state machine, abuse-report lifecycle, background-check refresh scheduling, AI-suggestion → human-approval audit pattern (per D5.1). Probably 1500-2000 lines.
2. `docs/design/<date>-pet-injury-claims.md` — pet injury workflow, insurance routing (per D15), evidence collection, payout integration with Tentacle 10. **Priority: HIGH** (operator-liability mitigation per D11 + insurance broker authority routing).
3. `docs/design/<date>-emergency-vet-routing.md` — 911-for-pets: customer-initiated emergency, nearest open vet, optional PetTrek driver dispatch. Overlaps with Tentacle 14; sequence Tentacle 14 first.

**Doctrine alignment:** D5.1 (AI as analyst never executive), D8 (#22: no PII export outside approved data flow), D10 (audit-events mandatory per Q19), D11 (CEO personal-liability — pet injury, provider injury, customer injury), D15 (insurance authority routing — pet injury, provider injury, property damage).

**Operator decisions blocking implementation:** Insurance broker engagement (D15); refund SLA per dispute outcome (Q14); chargeback / dispute lifecycle (Q13).

### Tentacle 13 — SHOP / COMMERCE

**Vision:** Physical-goods commerce as its own tentacle on the diagram, not as a sub-feature of "Members" (Tentacle 2) or "Admin" (Tentacle 7). Product catalog, inventory, order lifecycle, delivery routing (Wolt / Israel Post / pickup), Israeli e-commerce compliance (14-day cooling-off for distance sales / מכר מרחוק). The shop is a **first-class money surface**, not a marketing surface.

**Today (cited):**
- The Shop page exists at `client/src/pages/Shop.tsx:1-292` — honestly disclosed as a waitlist stub ("no invented prices, no fake Buy Now buttons" per operator directive 2026-05-24, `Shop.tsx:4-15`); submits interest via `mailto:shop@petwash.co.il` (`Shop.tsx:138-139`).
- There is **no products table, no orders table, no cart, no checkout, no shipping** in the schema today (per the shop SDD §3.3 gap analysis G1–G6).
- A vending-machine product primitive exists (`kioskProducts` at `shared/schema.ts:3416-3461`; `kioskSales` at `:3464`) — this is **deliberately separate** from the shop e-commerce primitive, because vending hardware and retail e-commerce should not be coupled (per shop SDD §2 non-goals).
- The full shop SDD lands at `docs/design/2026-05-26-shop-module-physical-goods.md` (PR #464 draft / merged) — 100K+ lines of design covering catalog, variants, images, inventory, cart, checkout, order lifecycle, shipping plug-point, admin editor, Israeli cooling-off compliance.

**Gap to target:** The v1 vision diagram has no tentacle for the shop, even though the shop SDD exists. The diagram needs to show the shop as a peer of "Members" and "Providers" because the **information architecture is peer-level**: the shop has its own catalog, its own checkout, its own audit, its own admin surface. Hiding it inside Tentacle 2 understates the engineering surface that exists in the shop SDD.

**Implementation pointer:**
- The shop SDD is the implementation source of truth. The platform-wide universal payment-and-lifecycle SDD (PR #467) generalises the shop's lifecycle to every paid surface; the shop is the **first adopter** of the universal lifecycle per PR #467 §16 rollout phase.
- Shipping integration is a **separate follow-up SDD** per the operator's stated sequence ("full shop module first, shipping after" — shop SDD top of doc). The shop SDD declares the `ShippingProvider` interface; the shipping SDD slots into it without modifying order code paths.

**Follow-up SDD needed (priority MEDIUM):**
- `docs/design/<date>-shipping-integration.md` — Wolt Packages + Israel Post + AfterShip + courier. Per operator's stated sequence. **Priority: MEDIUM** (gated by shop module shipping the first PRs).

**Doctrine alignment:** D8 (#16, #17: no raw card data on PetWash DOM or backend — shop uses Sumit hosted checkout), D10 (every shop money-mutating route writes `audit_events`), D14 (provider-language risk: shop has no providers so this is moot, but vendor-language for suppliers must still avoid employment-coded terms).

**Operator decisions blocking implementation:** Shop visual upgrade reference image (per shop SDD §10 — operator-approved PNG precondition); shipping carrier choice (Wolt vs Israel Post primary).

### Tentacle 14 — VET / PET HEALTH INTEGRATION

**Vision:** Pet health, vet records, vaccinations, insurance integration, emergency vet network, recommended-vet directory. **The white space competitors haven't filled.** This is where 2026-2027 PetWash differentiation lives vs Rover — Rover does sitter / walker but does not deeply integrate with vet infrastructure or pet-health records.

**Today (gaps):**
- Pet master record: `pets` table in `shared/schema.ts` (vaccination text field exists but no structured tracking); provider-safe view derived per `docs/governance/octopus-brain-doctrine.md` D19.
- Vaccination tracking: no structured surface; relies on free-text in pet profile.
- Vet records intake: no surface today.
- Pet insurance: no surface today; doctrine D15 (insurance authority routing) names "Pet injury (third-party liability)" as a coverage area but no platform integration.
- Emergency vet network: no surface today.
- Recommended-vet directory: no surface today.
- PetTrek driver / vet emergency synergy: PetTrek exists conceptually (`server/services/PlatformService.ts` seeds PET_TREK platform); no emergency dispatch wiring.

**Gap to target:** Complete greenfield. No SDD exists, no tables exist, no admin surface exists. This is the **biggest white-space tentacle** and the longest-term differentiator vs Rover.

**Implementation pointer:**
- The provider/platform model (`platforms` enum at `shared/schema.ts:7810` + `contractorCapabilities` at `:9477`) is the substrate to add "veterinarian" as a provider category if vets are onboarded as providers. Alternative model: vets are external partners (Tentacle 5C marketing partners style), not providers — operator decision (§8 open question).
- The pet master record (`pets` table + `pet-onboarding` flow) is the substrate for adding structured vaccination + vet-records fields. Privacy doctrine (future PR-PRIVACY-1) must classify pet medical records before structured storage starts (doctrine D8 #22).

**Follow-up SDDs needed (priority MEDIUM — strategic but not money-blocking):**
1. `docs/design/<date>-pet-health-doctrine.md` — the umbrella SDD: vet records intake, structured vaccination tracking, vet authority compliance (השירותים הוטרינריים), pet-medical-record privacy classification. **Priority: MEDIUM**. Blocked by privacy doctrine (PR-PRIVACY-1) per D8 #22.
2. `docs/design/<date>-pet-insurance-integration.md` — pet insurance carrier integration; overlaps with Tentacle 10 (outgoings — premium payments) + Tentacle 12 (trust & safety — claims). **Priority: LOW** (operator demand-driven).
3. `docs/design/<date>-emergency-vet-routing.md` — also listed under Tentacle 12; canonical home is Tentacle 14.

**Doctrine alignment:** D8 (#22: pet medical records are PII), D11 (L10: privacy / data-security director liability), D15 (insurance — pet injury coverage area).

**Operator decisions blocking implementation:** Are vets providers or external partners (§8 Q-VET-1)? Structured vaccination schema — required at signup or optional (§8 Q-VET-2)? Pet insurance — platform partner or pure referral (§8 Q-VET-3)?

---

## 4. Refinements to the central core — add the 5th orb

The v1 doc §2 names four central orbs: Smart Core Intelligence, Route Controller, Security Layer, Data Layer, Integration Layer. (That's five if you count Smart Core Intelligence as central + four around it; the diagram itself shows four surrounding orbs.)

This amendment adds a **fifth orb**: **PRICING & PROMOTIONS ENGINE**.

### 4.1 Why pricing is core, not a tentacle

Pricing decisions cut across **every** tentacle:

- Tentacle 2 (Members & Loyalty): wallet top-up rates, loyalty redemption rates, membership tier pricing.
- Tentacle 3 (Providers): provider commission splits, dynamic surge pricing, per-vertical pricing rules.
- Tentacle 6 (Franchise & Stations): per-station wash pricing, franchise revenue-share.
- Tentacle 10 (Outgoings — NEW): provider payout calculation depends on the price snapshot at booking time.
- Tentacle 13 (Shop — NEW): product pricing, promo codes, gift-card application.
- Global: VAT 18% applied at every line.

A tentacle is a domain; pricing is a **cross-cutting decision** every domain depends on. That makes it core, like Security, Auth, and the Data Layer.

### 4.2 What lives in the engine

| Component | File:line (existing or proposed) | Status |
|---|---|---|
| `PriceQuoteService.buildQuote()` | Proposed in `docs/design/2026-05-25-commerce-promotions-pricing.md` §8.2 | Design locked; implementation pending |
| `StackingResolver` | Same SDD §5.4 | Design locked |
| `CouponService` | `server/services/CouponService.ts:129` | Exists today |
| `VATCalculatorService` | `server/services/VATCalculatorService.ts:5,46,52,69` | Exists today |
| `couponEligibilityRules` / `couponDeliveryEvents` | `shared/schema.ts:570-651` | Exists today |
| `promotionalCampaigns` + `petAwarenessDays` + `campaignRedemptions` | `shared/schema.ts:6379-6500` | Exists today (with a parallel hard-coded calendar in `globalPromotions.ts:38-232` that needs to retire per commerce SDD §1) |
| Price-history audit trail | Proposed in commerce SDD — does not exist today | Design pending |
| Per-package balance model (`user_package_balances`) | Proposed in commerce SDD §7.2 — does not exist today | Design pending |

### 4.3 What this changes in the diagram

The four existing orbs around Smart Core Intelligence stay where they are. The fifth orb **PRICING & PROMOTIONS ENGINE** sits alongside them. Arrows from every tentacle that needs a price (2, 3, 6, 10, 13) point INTO the engine, and the engine returns a quote. No tentacle re-prices.

### 4.4 What this does not change

- The commerce-pricing SDD (`docs/design/2026-05-25-commerce-promotions-pricing.md`) is the implementation source of truth. This amendment does not modify it.
- The crown-jewel constraint on `walletLedgerEntries` (`schema.ts:11675-11719`) is unchanged.
- Tranzila / SUMIT / Nayax / UPay runtime is unchanged.

---

## 5. Refinements to existing tentacles

### 5.1 Tentacle 5 (Partners & Integrations) — split into A / B / C

The v1 doc §3.5 names Tentacle 5 as a single block: Payment Gateways + Maps & Navigation + Communication + AI & Automation + Third-party APIs. That's **five different vendor categories** with five different operational and risk profiles. Treating them as one tentacle hides the asymmetry.

**Split into three sub-tentacles:**

**Tentacle 5A — Payment Partners.** SUMIT (legal system-of-record per supplier-invoice SDD), UPay (acquirer per universal payment SDD), Nayax (K9000 + machine payment), Tranzila (legacy crown-jewel — visibility only). Anchor: `docs/design/2026-05-26-payment-provider-routing-and-lifecycle.md` — universal PaymentProviderRouter is the integration shell. Doctrine D2 (vendor demotion — payment vendors are rails, not the system) and D8 (forbidden shortcuts list 1, 2, 8, 9, 21) govern this sub-tentacle.

**Tentacle 5B — Logistics Partners.** Wolt Packages, Israel Post, AfterShip, future couriers. Anchor: shop SDD §8 — `ShippingProvider` interface is the integration shell. Sequence: shipping SDD (follow-up after shop module lands first PRs). Doctrine D2 also governs (logistics vendors are rails).

**Tentacle 5C — Marketing Partners.** HubSpot (CRM mirror — per PR #214 HubSpot Master Operating System), Google Ads, Meta Ads, SendGrid (email — Tentacle 9 anchor), Twilio (SMS + WhatsApp — Tentacle 9 anchor), FCM (push). Doctrine D19 (single-source-of-truth) requires: Pet Wash internal DB is source of truth for customer records; HubSpot mirrors via CRM sync; HubSpot must NEVER be the source of truth for customer-record edits.

**What this changes in the diagram:** Tentacle 5 splits into three labelled lanes (5A / 5B / 5C) under one tentacle visual. Each lane has its own internal/external seam (per v1 §5.3 engineering improvement — that improvement is **realised** by this split).

**What this does not change:**
- Per-vendor adapter pattern remains as per doctrine D2 — vendor-specific code lives ONLY in adapter / connector / mapping files (`server/integrations/upay/*`, `server/integrations/sumit/*`, `server/integrations/nayax/*`, etc.).
- The four-quadrant existing integration map (payments / maps / communications / AI) remains conceptually valid; the split just makes the diagram-level visibility match the operational reality.

### 5.2 Principle 3 (ONE IDENTITY) — visualise the role progression ribbon

Today the role-resolver exists in code (`server/routes/post-login.ts:203` is the canonical post-login routing — cited in v1 §2). The role enum at `shared/schema.ts:12341` is `customer | loyalty | provider | staff | management | admin`. The `AccountContext` shape is defined in OCTOPUS_RESET_RFC §2.

But the v1 diagram **doesn't show the progression**. A user becomes:

```
Tentacle 1 (anyone with a phone or email)
  → 2 (member after signup, opt-in loyalty)
    → 3 (provider candidate after applying)
      → 3 (provider after admin approval)
        → 4 (staff or admin if invited and MFA-enrolled)
          → 7 (super admin — invite-only)
```

The same user can be in multiple states simultaneously (Principle 3: one identity, many role experiences — per OCTOPUS_RESET_RFC core law). A pet parent who's also a sitter is BOTH a Tentacle 2 member AND a Tentacle 3 provider — one identity, two dashboards. The role-resolver picks which dashboard surfaces today (`AccountContext.selectedDashboard`).

**What this changes in the diagram:** Add a **role progression ribbon** along the path from Tentacle 1 to Tentacle 7 showing the progression states. Bidirectional arrows (a provider can also be a customer of another provider — Principle 3 makes this explicit).

**What this does not change:**
- The Smart Identity SDD (`docs/design/2026-05-25-smart-identity-routing.md`) remains the implementation source of truth.
- The role enum, the post-login route, the `AccountContext` shape, and the OCTOPUS_RESET_RFC remain unchanged.
- The doctrine rule that admin is invite-only (D8 forbidden item — admin signup is NOT a public surface) remains unchanged.

### 5.3 Principle 5 (ENDLESS POSSIBILITIES) — extension points

Today the principle reads "new verticals, new partners, new regions add tentacles without surgery on the core." It's an assertion. The diagram doesn't show **how**.

**What this changes in the diagram:** Add **dotted-line extension points** around the perimeter — small dashed slots where future tentacles can dock. Concrete examples to draw:
- A dotted slot beyond Tentacle 14 (Vet) labelled "future: international expansion (region-specific tentacle)."
- A dotted slot beyond Tentacle 13 (Shop) labelled "future: B2B / wholesale tentacle."
- A dotted slot beyond Tentacle 6 (Franchise) labelled "future: multi-brand franchise (PetWash + adjacent brand)."

Each dotted slot is a **commitment that the core is closed for surgery but the perimeter is open for extension**. This is the architectural realisation of Principle 5.

**What this does not change:**
- Each dotted slot is illustrative; adding a new tentacle still requires its own SDD per the SDD method.
- No commitment to ship any specific extension; the dotted slots are a **shape** of the system, not a roadmap.

---

## 6. Global features bar — add accessibility

The v1 doc §4 lists five global feature badges along the bottom of the diagram: Multi-Language (HE / EN / AR + RTL), Mobile First (PWA / Native App), Security First (Encrypted & Compliant), Scalable Cloud (High Availability), AI Powered (Smart Automation).

**Add a sixth badge: ACCESSIBILITY (a11y / WCAG).**

### 6.1 Why this is global, not a tentacle

Accessibility cuts across **every** surface. The Israeli accessibility law (תקנות שוויון זכויות לאנשים עם מוגבלות / תשנ"ח-1998 + תקנות שוויון זכויות לאנשים עם מוגבלות, התשע"ג-2013) mandates WCAG-aligned compliance for public-facing digital services. Every customer surface (Tentacle 1, 2, 13) and many provider/staff surfaces (Tentacle 3, 4) are in scope.

### 6.2 What's true today (cited)

- The SPA inherits some accessibility from shadcn/ui + Radix UI primitives (the underlying component library has built-in ARIA + keyboard navigation).
- Hebrew RTL is partial today; per `.claude/skills/petwash-ui-ux/SKILL.md:188-215` the RTL audit is ongoing.
- No formal WCAG audit has been performed.
- No `aria-label` discipline is enforced in lint rules today.
- No accessibility statement page exists on the public site (Israeli law requires one — see `client/src/pages/Accessibility.tsx` if exists, or absence = gap).

### 6.3 What this badge commits

The same level as the other five global badges: a **commitment to enforce a11y on every surface**. The implementation lands as PR-A11Y-1 (named in Tentacle 11 follow-ups) covering:
- WCAG 2.1 AA audit across customer + provider + admin surfaces.
- ARIA-label discipline + lint enforcement.
- Public accessibility statement page (mandated by Israeli law).
- Screen-reader testing pass.
- Keyboard-only flow testing pass.
- Colour-contrast audit (the luxury aesthetic must not violate AA contrast).

### 6.4 What this does not change

- No specific UI changes are committed by this amendment.
- The luxury aesthetic per `.claude/skills/petwash-ui-ux/SKILL.md` remains the visual direction; AA contrast may force minor adjustments but does not change the brand.

---

## 7. Follow-up SDD roadmap

The new tentacles and refinements each generate follow-up SDDs. Below is the **priority order** for those follow-ups. The operator decides timing.

### 7.1 Priority HIGH (operator-liability + money-flow blocking)

These SDDs unblock real operator exposure (D11 personal-liability risks) or unblock money flows that today have manual workarounds outside the platform.

| # | SDD | Anchor tentacle | Why HIGH | Blocked by |
|---|---|---|---|---|
| H1 | `<date>-outgoings-ap-engine.md` | Tentacle 10 | Money OUT is scattered; doctrine D3 + D16 require unified ledger pass-through | CPA Q5, Q6, Q11, Q12 |
| H2 | `<date>-privacy-doctrine-PR-PRIVACY-1.md` | Tentacle 11 | Doctrine D8 #22 + L10 director liability | Privacy counsel engagement |
| H3 | `<date>-aml-PR-AML-1.md` | Tentacle 11 | L9 director liability + Q11 principal/agent decision | Counsel Q11 |
| H4 | `<date>-trust-safety-doctrine.md` | Tentacle 12 | Operator-liability exposure for pet/customer/provider injuries + abuse | Insurance broker D15 + Q13/Q14 |
| H5 | `<date>-pet-injury-claims.md` | Tentacle 12 | Insurance authority routing per D15 | H4 lands first |

### 7.2 Priority MEDIUM (strategic but not money-blocking)

| # | SDD | Anchor tentacle | Why MEDIUM | Blocked by |
|---|---|---|---|---|
| M1 | `<date>-accessibility-PR-A11Y-1.md` | Tentacle 11 + Global Features | Statutory (Israeli accessibility law) but not money-blocking | None |
| M2 | `<date>-shipping-integration.md` | Tentacle 5B + Tentacle 13 | Shop module needs shipping; operator stated sequence "full shop first, shipping after" | Shop module first PR |
| M3 | `<date>-municipal-licensing-PR-LICENSE-1.md` | Tentacle 11 | Per-franchise license tracking | None |
| M4 | `<date>-pet-health-doctrine.md` | Tentacle 14 | Strategic differentiator vs Rover; demands privacy doctrine first | H2 (privacy) lands first |
| M5 | `<date>-emergency-vet-routing.md` | Tentacle 14 (canonical) + Tentacle 12 | Vet network + PetTrek synergy | M4 lands first |
| M6 | `<date>-event-bus-and-intelligence.md` | Tentacle 8 (existing — promoted from v1 §5.1) | Largest gap per v1 §3.8; multi-quarter project | Identity work stabilises first |
| M7 | `<date>-communication-hub-unified.md` | Tentacle 9 (existing — per v1 §3.9) | Fragmentation across 40+ call sites per channel | M6 lands first (event bus is the spine) |

### 7.3 Priority LOW (operator-demand-driven)

| # | SDD | Anchor tentacle | Why LOW |
|---|---|---|---|
| L1 | `<date>-pet-insurance-integration.md` | Tentacle 14 | Operator demand + insurance partner availability |
| L2 | `<date>-vet-authority-PR-VET-AUTH-1.md` | Tentacle 11 | Vet authority compliance; M4 lands first |
| L3 | `<date>-language-audit-PR-LANGUAGE-AUDIT-1.md` | Cross-cutting (D14) | Provider-language risk inventory |

**Sequencing rule:** HIGH first. MEDIUM as resources allow. LOW operator-decision. **No SDD authorises code.** Each follow-up SDD is itself a design brake — it goes through the same five review loops per `.github/skills/sdd-writer-iterative/SKILL.md` §4.

**Doctrine alignment for all follow-up SDDs:** D6 (roadmap as infrastructure) — each SDD slots into a named PR class; each PR has one purpose; each PR has explicit out-of-scope.

---

## 8. Open vision-level questions

Distinct from the per-tentacle SDD open questions and from the doctrine D9 Q1–Q18 authority registry. These are **vision-level** decisions the operator must make to commit (or defer) the new tentacles.

These are intentionally kept small — six items.

### Q-AMEND-1: Vet integration model (Tentacle 14)
Are veterinarians **providers** (onboarded through Tentacle 3 like sitter / walker / trainer) or **external partners** (referenced through Tentacle 5C marketing partners style — directory-only, no payment flow)? Different model = different schema, different KYC, different liability exposure (D11 L4 reclassification risk increases if vets are providers).

### Q-AMEND-2: Pet medical record storage classification (Tentacle 14)
Pet medical records (vaccinations, vet visit history, prescriptions) are PII under חוק הגנת הפרטיות. Are they stored **structured** (queryable, indexed, exportable for vet handoff) or **opaque blob** (encrypted-at-rest, decrypted only on owner-initiated render)? Affects privacy classification by future privacy counsel + database design.

### Q-AMEND-3: Outgoings unification scope (Tentacle 10)
Does Tentacle 10 unify **all** outflows (provider payouts + supplier invoice payments + VAT remittance + insurance premiums + salaries) under ONE coordination layer, or does each outflow type stay in its own lane with Tentacle 10 as a visibility / audit aggregator only? Affects scope of follow-up SDD H1.

### Q-AMEND-4: Trust & Safety AI authority (Tentacle 12)
Per doctrine D5.1, AI is analyst, never executive. But trust & safety has 24/7 obligations (a customer's pet is injured at 2 AM; the AI flags abuse). What is the **maximum AI authority** for T&S without human review — e.g., can Gemini auto-suspend a provider account pending human review, or must every suspension be human-clicked? Affects T&S service design.

### Q-AMEND-5: Rover-parity feature backlog (Strategic frame)
The Rover comparison (§2.1) lists capabilities Rover has that PetWash partially has or doesn't have. Of those, which are **commitments** for 2026-2027 (operator publicly promises to ship), which are **strategic deferrals** (will not ship; the moat justifies the gap), and which are **operator-decides-later**? The amendment lists the gaps; the operator owns the commitment.

### Q-AMEND-6: Diagram update timing
The v1 master Octopus diagram is the operator's own artwork (referenced in v1 Appendix A). Does the operator update the master diagram now (to reflect this amendment's 14 tentacles + 5th core orb + role progression ribbon + extension points + accessibility badge), or does the textual amendment stand alone until a later diagram-update sprint? **Engineering recommendation: textual first, master-diagram update at the operator's pace** — but the diagram update should follow within the quarter to keep operator-facing material aligned.

---

## 9. What this amendment does NOT do

- Does not introduce any runtime change.
- Does not modify the v1 vision doc (`docs/architecture/2026-petwash-octopus-vision.md`). The v1 doc stands; this amendment **extends** it as a sibling document.
- Does not modify OCTOPUS_ARCHITECTURE_RESET_RFC. The RFC remains the engineering implementation source of truth.
- Does not modify the doctrine doc (`docs/governance/octopus-brain-doctrine.md`). All 19 doctrine rules (D1–D19) apply unchanged to the new tentacles.
- Does not author the follow-up SDDs. Each named follow-up SDD is a separate authoring exercise; this amendment only registers them in §7.
- Does not commit a master-diagram artwork update. Appendix B notes the visual changes the operator should make at the operator's chosen pace.
- Does not introduce any new feature flag, schema migration, dependency, or runtime contract.
- Does not promise Rover-parity. The Rover comparison is a strategic frame, not a feature checklist.
- Does not constitute legal advice. The D11 + D12 + D15 routing principles apply: regulatory items in Tentacle 11 must be classified by Counsel / CPA / Labor lawyer / Privacy counsel / Insurance broker per the doctrine authority chains.
- Does not authorise the operator (or any agent) to ship any new tentacle without its own focused SDD going through the five-loop review (Correctness → Fraud/Money → Role/Accessibility → Failure/Edge → Scope/Clarity).

---

## Appendix A: Operator's verbatim quote

The operator's request, preserved verbatim per the SDD method §5 (the user's original wording, unedited):

> "do all, call best agent for that, i want to be as big as rover.com as example, we got also petwash stations dual bay and they dont and much more"

Interpretation (engineering annotation, NOT a substitute for the verbatim quote):
1. **"do all"** — implement all the engineering-proposed strategic additions identified during the v1 vision doc review.
2. **"call best agent for that"** — use the SDD method via the SDD Writer Agent (this amendment is the result).
3. **"i want to be as big as rover.com as example"** — anchor the ambition to Rover.com scale (canonical $1B+ US pet-services marketplace).
4. **"we got also petwash stations dual bay and they dont"** — codify the dual-bay K9000 wash stations as the **moat** Rover cannot replicate.
5. **"and much more"** — the operator's shorthand for the full set of PetWash differentiators: multi-vertical scope (sitter / walker / trainer / academy / groomer / driver / kiosk / shop / gift cards / wallet / loyalty / franchise), Israeli regulatory compliance, Hebrew-first / RTL UX.

The operator's quote is the **authoritative source** for the strategic frame in §2 (Rover.com competitive positioning) and the rationale for promoting the five new tentacles in §3. If the engineering annotation in §2 ever drifts from the operator's intent, the verbatim quote above is the tiebreaker.

---

## Appendix B: Diagram update notes for the master Octopus PNG

The operator's master "PETWASH™ 2026 — SMART SYSTEM OCTOPUS" diagram (referenced in v1 Appendix A) is the operator's own visual artifact. When the operator chooses to update the master PNG to reflect this amendment, the visual changes are:

### B.1 New tentacles (add 5)

Add five new tentacles around the perimeter, labelled and numbered 10–14:

- **10. OUTGOINGS / AP ENGINE** — icon suggestion: outbound-arrow / money-out symbol. Sub-bullets: Provider Payouts, Refunds, Supplier Invoices, VAT Remittance, Insurance, Salaries.
- **11. GOV / REGULATORY** — icon suggestion: government building / scales-of-justice. Sub-bullets: הרשות המסים (Tax), חוק הגנת הצרכן (Consumer), חוק הגנת הפרטיות (Privacy), רישוי עסקים (Municipal), השירותים הוטרינריים (Vet), AML, PCI, Accessibility.
- **12. TRUST & SAFETY** — icon suggestion: shield + heart. Sub-bullets: Disputes, Abuse Detection, Background Check Refresh, Pet Injury Claims, Emergency Vet, Provider Quality.
- **13. SHOP / COMMERCE** — icon suggestion: shopping bag / cart. Sub-bullets: Catalog, Inventory, Orders, Cart, Checkout, Delivery, Returns.
- **14. VET / PET HEALTH** — icon suggestion: vet cross / stethoscope. Sub-bullets: Vet Records, Vaccinations, Pet Insurance, Emergency Network, Vet Directory.

### B.2 Central core (add 5th orb)

Add a fifth orb alongside Route Controller / Security Layer / Data Layer / Integration Layer:

- **PRICING & PROMOTIONS ENGINE** — icon suggestion: tag with percentage / calculator. Sub-bullets: Price Quotes, Promotions, Stacking Rules, VAT, Loyalty Application.

### B.3 Tentacle 5 split

Replace the single Tentacle 5 "Partners & Integrations" label with **three sub-lanes** under one tentacle visual:

- **5A — Payment Partners** (SUMIT, UPay, Nayax, Tranzila)
- **5B — Logistics Partners** (Wolt, Israel Post, AfterShip)
- **5C — Marketing & Communications Partners** (HubSpot, Google Ads, Meta, SendGrid, Twilio, FCM)

### B.4 Principle 3 role progression ribbon

Draw a horizontal ribbon from Tentacle 1 → Tentacle 2 → Tentacle 3 (candidate) → Tentacle 3 (approved) → Tentacle 4 (staff) → Tentacle 7 (super admin) showing the progression. Bidirectional arrows where applicable (a provider is also a customer of other providers).

### B.5 Principle 5 extension points

Draw 3–4 **dotted-line slots** around the perimeter beyond the 14 tentacles, labelled (illustrative):
- "future: international expansion"
- "future: B2B / wholesale"
- "future: multi-brand franchise"
- "future: <operator decides>"

### B.6 Global features bar — sixth badge

Add a sixth badge to the bottom of the diagram:
- **♿ ACCESSIBILITY (a11y / WCAG)** — Israeli accessibility law mandates WCAG 2.1 AA compliance.

### B.7 Crown-jewel boundary indicators (per v1 §5.2)

The v1 doc's engineering recommendation §5.2 (crown-jewel boundaries) is incorporated by adding **lock-icon overlays** on the diagram in the following places:
- Tentacle 2 sub-bullet "Wallet" — lock icon.
- Tentacle 6 sub-bullets "K9000" and "Nayax Reconciliation" — lock icons.
- Tentacle 5A sub-bullets "Tranzila" — lock icon.
- Tentacle 10 sub-bullet "BillingLedger math" — lock icon.

### B.8 Internal/external seam (per v1 §5.3)

Draw a dotted boundary line between Tentacle 5 (A/B/C) and the central core — with PetWash inside the boundary, external vendors outside the boundary, and Tentacle 5 (A/B/C) as the seam. This realises v1 §5.3 as a visual element.

### B.9 What stays unchanged in the diagram

- Title: "PETWASH™ 2026 – SMART SYSTEM OCTOPUS"
- Tagline: "ONE PLATFORM. EVERY ROLE. ONE DATA FLOW."
- Central "PETWASH™ SMART CORE INTELLIGENCE" element.
- Original four core orbs (Route Controller, Security Layer, Data Layer, Integration Layer) — keep all four; add Pricing & Promotions Engine as a fifth.
- Original nine tentacles (1–9) — keep all nine; add tentacles 10–14 around the perimeter.
- Original five global-feature badges — keep all five; add accessibility as the sixth.
- The five inviolable principles bar — UNCHANGED.

---

## Appendix C: Document lifecycle

| Action | Trigger | Result |
|---|---|---|
| **Read** | Any future PR planning a major architectural change | Confirms alignment with the five principles + the 14-tentacle map |
| **Update** | Operator produces a v3 vision, OR engineering identifies a 15th tentacle that must be promoted | New amendment doc (this is the **v2 amendment**; future amendments stack as v3, v4, etc. — old amendments preserved in git history) |
| **Reference** | Per-tentacle SDDs cite the relevant section as the operator-vision anchor | Keeps engineering work tethered to operator intent |
| **Retire** | Never — the vision layer is long-lived | Tactical plans (SDDs, RFCs) age out; the vision persists |

---

## Appendix D: Cross-reference summary (this amendment ↔ v1)

| v1 §  | This amendment §  | Relationship |
|---|---|---|
| §0 Why this doc exists | §0 Why this amendment exists | Amendment explains the delta since v1 |
| §1 Five inviolable principles | §1 Relationship to v1 + principles | Principles unchanged; new tentacles obey them |
| §2 Central core (4 orbs) | §4 Refinements to the central core | Adds 5th orb (Pricing & Promotions Engine) |
| §3 Nine tentacles (1–9) | §3 New tentacles 10–14 | Adds 5 new tentacles; 1–9 unchanged |
| §4 Global features (5 badges) | §6 Global features bar — add accessibility | Adds 6th badge |
| §5 Four engineering improvements | §5 Refinements + Appendix B | §5.1 stays as future event-bus work (Tentacle 8 unchanged); §5.2 realised by crown-jewel lock icons in B.7; §5.3 realised by Tentacle 5 split + seam in B.8; §5.4 promoted to Tentacle 11 (Gov/Regulatory) |
| §6 Sequencing with existing canon | §7 Follow-up SDD roadmap | Names the new SDDs |
| §7 Anti-patterns | (unchanged) | Anti-patterns list applies to new tentacles |
| §8 Open vision questions | §8 Open vision questions | Six new amendment-specific questions; v1 questions still open in v1 |
| §9 What this doc does NOT do | §9 What this amendment does NOT do | Same discipline |
| §A Diagram source | §B Diagram update notes | Operator's diagram updates at operator's pace |
| §B Document lifecycle | §C Document lifecycle | Same lifecycle |

---

**End of amendment.**

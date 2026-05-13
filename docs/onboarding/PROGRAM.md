# Pet Wash Provider Onboarding Program

**Status**: governance only — no schema, no UI, no API, no migrations
**Version**: 2026-05-13
**Counsel-approved**: false (locked until external Counsel sign-off)
**Hebrew-verified**: false (Hebrew prose lives in HE-DRAFT blocks for Counsel)
**Parent agreement**: `shared/legal/providerHostAgreement.ts` (PR-LEGAL-A-REWRITE, PR #251)
**Sister program**: `docs/trust/PROGRAM.md` (TRUST-A, PR #249)
**Wording-drift guard**: `server/tests/providerSurfaceWording.regression.test.ts` (PR-LEGAL-UI-SCRUB, PR #250)

---

## 0. Why this document exists

Pet Wash Ltd (Israeli company number 517145033, פט וואש בע״מ) operates an Israeli pet-care marketplace. Providers may be dog walkers, pet sitters, pet trainers, pet transport operators, home boarders (Hosts), mobile groomers, wash-station operators, freelance occasional providers, independent businesses, franchise operators, and marketplace hosts. The risk profile of these categories varies dramatically. An onboarding architecture that treats them uniformly creates evidence that will be read by an Israeli labour court — under the 2024-2026 Wolt/Yango doctrine — as integration evidence against Pet Wash.

This document is the governance layer that every onboarding PR (PR-ONBOARDING-A through PR-ONBOARDING-L) MUST obey. It locks the rules **before any UI is built**, so the implementation cannot drift toward employment-style supervision or away from the §2 anti-integration cushion in the Provider & Host Services Agreement.

This document is **not** code, **not** schema, **not** UI. It is the contract that the engineers, designers, lawyers and operators agree to honour while the program is built.

---

## 1. Scope and what this program is NOT

### In scope

- The governance shape of provider onboarding (steps, gates, declarations, evidence)
- The hard rules every onboarding PR must obey
- The provider category taxonomy and verification tier matrix
- The click-wrap mechanic and self-declaration design pattern
- The payment-and-withholding boundary (Pet Wash's own ניכוי obligations)
- The selfie / biometric-adjacent handling rules
- The audit-log architecture (refers back to §22 of the Agreement)
- The court-bundle export specification
- The "no dormant control code" rule for the codebase
- The cross-references to existing systems (PR-LEGAL-A-REWRITE, TRUST-A, PR-LEGAL-C, PR-LEGAL-D)

### NOT in scope

- Schema design (lives in PR-LEGAL-C, parallel critical path)
- UI implementation (lives in PR-ONBOARDING-A..L, after PR-LEGAL-C)
- API routes
- Payment code, auth code, wallet code
- Booking-gate enforcement middleware (PR-LEGAL-D, hard-locked)
- Tranzila / Nayax / SUMIT / UPay / K9000 / Stripe integration
- Medical-data wording (excluded by the proportionality rule)
- Employment-style wording (excluded by §2 of the Agreement)
- Insurance promises (excluded by §6 of the Agreement)
- Force majeure clauses (deferred to a separate PR)
- Class-action waiver experiments (excluded by CEO directive)
- Arbitration experiments (excluded by CEO directive)

---

## 2. Hard rules (every PR-ONBOARDING-* PR MUST obey)

**H1.** This PROGRAM is governance-only at this stage. No schema, no UI, no API, no migrations land in PR-ONBOARDING-PROGRAM.

**H2.** Pet Wash NEVER completes Israeli government tax forms on a Provider's behalf. The platform may provide educational pointers and deep-links to רשות המסים, but the form is filled by the Provider personally.

**H3.** Forbidden register. The codebase, copy, FAQ, AI prompts and contractor templates MUST NOT contain: "employee", "staff", "work shifts", "manager approval", "salary", "work hours assigned by platform", "productivity", "performance metrics", "acceptance rate", "optimisation", "behavioural analytics", "dispatch ranking", "provider score". This is already enforced for the wording layer by `server/tests/providerSurfaceWording.regression.test.ts`; the regression test for this doc adds the program-level guards.

**H4.** Per-section checkboxes for every material clause. Single global "I agree" is forbidden for the onerous clauses (§2 independent-contractor, §3 provider responsibility, §6 insurance disclaimer, §19 Hebrew prevails, §22 digital acceptance).

**H5.** Gendered Hebrew throughout. CTA button label is `אני מסכים/ה ומצטרף/ת` / "I agree and join". Never `המשך` / "Continue" for the acceptance gate.

**H6.** Wash-Station Operator category is structurally distinct from Tier W/S providers and follows §4 of this doc verbatim (station-licence shape, operator pays Pet Wash, operator's own business identity visible). See §4 for full carve-out.

**H7.** No Dormant Control Code. See §14 for the explicit ban list. Reserved authority is integration evidence under Wolt/Yango doctrine even when not exercised.

**H8.** Selfie processing requires separate granular consent (not bundled with the general onboarding consent). The biometric template is never persisted by Pet Wash. The vendor DPA must restrict template reuse, cross-customer matching, and training-data use.

**H9.** Criminal self-declaration is a structured checkbox plus a neutral attestation. Free-text narrative storage is forbidden.

**H10.** Vehicle transport, key-holding, and multi-pet Host are gated at the booking engine — not just at the onboarding declaration. The onboarding declaration loads the gate; the booking engine enforces it.

**H11.** §22 acceptance evidence is stored in WORM tier (S3 Object Lock Compliance mode, or equivalent immutable storage). Minimum seven-year retention. Daily Merkle root with external notarisation anchor. Cryptographic-agility migration pattern preserved.

**H12.** AI insight prompts carry the canonical "this is not tax advice" Hebrew disclaimer verbatim. Each prompt includes the explicit guardrail "Insights only — do not include performance assessments, supervision recommendations, or directive instructions." Prompts are templated; never tailored to a Provider's individual facts in a way that crosses the regulated tax-adviser boundary.

**H13.** Court-bundle export is a Provider-self-serve feature. The Provider may at any time download a PDF/A bundle of every Agreement version they accepted, every FAQ rendered at acceptance, every disclosure ack, every Material Change re-acceptance, every document uploaded. Symmetric — protects Provider AND Pet Wash.

**H14.** Re-affirmation cadence: full onboarding pack at signup; delta-pack on Material Change (as defined in §0 of the Agreement); full pack at annual renewal; full pack at station-licence renewal for W+ and F. No per-booking re-affirmation (coercive).

**H15.** Pet Wash never adjudicates civil liability between Customer and Provider. Single §11 / §14 suspension standard from the Agreement. Dispute facilitation only.

**H16.** Hebrew prevails (§19 of the Agreement). The rendered-language hash recorded under §22 evidences the language actually displayed to the Provider at acceptance.

**H17.** Sub-tiers exist beyond the four CEO-named tiers: W+ (pack walking, pet transport, mobile grooming) and S+ (multi-pet Host concurrent, persistent key-holding, multi-day overnight transport). The booking engine gates by sub-tier where the category warrants.

**H18.** Step 1 funnel branch. After phone-OTP identity binding (Step 0), the first decision is: "I provide services personally" → Tier C/W/W+/S/S+ funnel, or "I operate a business or premises" → Tier F funnel. Different funnels carry different declarations.

**H19.** Step 0: phone OTP identity binding anchors all subsequent evidence. No category selection or declaration is accepted before identity is bound.

**H20.** Marketing-comms opt-in is a SEPARATE control from any operational consent. Never bundled. Defaults to off.

**H21.** Database Registrar filing (if required by threshold), DPO appointment (if required by threshold), and the breach-notice runbook must be complete BEFORE the first production Provider is onboarded. Counsel-to-confirm thresholds; the program treats these as launch-blockers.

**H22.** Pet Wash's own ניכוי מס במקור obligation is operationalised. The system collects each Provider's annual אישור פטור / ניכוי certificate. Absent a valid certificate, payouts above the Counsel-set threshold are routed through default-rate withholding logic per Income Tax (Withholding from Payments for Services or Assets) Regulations 5737-1977. The payouts data model is 856-equivalent-ready and DAC7-ready. See §10 for full Payment and Withholding Boundary.

**H23.** Tax-advice boundary. Every tax-adjacent surface carries the canonical Hebrew disclaimer verbatim. AI insight prompts that consume Provider revenue or activity data are templated and bounded; the tax-adviser boundary in Israeli law is licensed and must not be crossed.

**H24.** Operator / Host with multi-pet concurrent: a municipal kennel-licence warranty is captured at onboarding for every Host who accepts more than the per-municipality threshold concurrently. Counsel-to-confirm thresholds per launch city (Tel Aviv, Jerusalem, Haifa, Ramat Gan, Herzliya). The booking engine gates by the warranty.

---

## 3. Provider category taxonomy and risk table

The platform's eleven CEO-named categories collapse into a six-tier risk model. Sub-tiers W+ and S+ exist where domain risk inside Tier W or Tier S exceeds the tier-peer baseline.

### 3.1 Risk table

| Tier | Categories | Risk | Mandatory declarations | Booking-engine gates | Onboarding latency |
|------|-----------|------|------------------------|----------------------|---------------------|
| C    | Customer (pet owner) | n/a — service consumer | terms acceptance, privacy notice ack | none | under 1 minute |
| W    | dog walker (solo daytime), pet sitter (drop-in), pet trainer, freelance occasional | LOW-MEDIUM | independent-contractor self-declaration; phone-OTP identity; Israeli ID number checksum; address in declared service area | leashing, vaccination warranty of walked dog | 1 minute to 24 hours |
| W+   | pack walker (3+ dogs), pet transport (same-day), mobile grooming | MEDIUM-HIGH | W declarations + vehicle annex (transport / mobile grooming) + pack-size cap (pack walking) + water/chemical-disposal declaration (mobile grooming) | vehicle insurance currency, טסט currency, driving licence currency, cargo restraint method, pack-size cap | 24-72 hours |
| S    | pet sitter (overnight in Customer's home), home boarding / Host (single guest pet, no concurrent multi-pet) | MEDIUM-HIGH | W declarations + key-holding declaration + minor-cohabitation safeguarding + overnight-presence acknowledgement + own-pets disclosure | key-holding window time-bound, minor-cohabitation gate, single-pet-at-a-time gate where the Host's premises warrant it | 24-72 hours |
| S+   | home boarding / Host (multi-pet concurrent), persistent key-holding across booking series, multi-day overnight transport | HIGH | S declarations + municipal kennel-licence warranty OR concurrent-pet cap below threshold + extended welfare disclosure | municipal kennel-licence per city (Counsel-to-confirm thresholds), concurrent-cap enforcement | 72 hours+ |
| F    | franchise operator, wash-station operator, independent business with own עוסק, marketplace host (premises-only, no service performed by host) | VERY HIGH | KYB, signatory KYC, beneficial-ownership disclosure, premises insurance held by operator (not Pet Wash, per §6 of the Agreement), accessibility under §8 of the Agreement, station-licence (wash-station only — see §4) | premises insurance currency, business certificate (תעודת עוסק), sanctions screening (PEP / OFAC / EU / מועצת הביטחון designations) for high-tier | 72 hours+ |

### 3.2 The eleven categories mapped to tiers

- **dog walker (solo daytime)** → W
- **dog walker (pack, 3+ dogs)** → W+ (escalated for pack-risk)
- **pet sitter (drop-in daytime)** → W
- **pet sitter (overnight in Customer's home)** → S
- **pet trainer (mobile or at Customer's home)** → W
- **pet transport (same-day)** → W+ (vehicle annex)
- **pet transport (multi-day / long-haul)** → S+ (overnight stop liability)
- **home boarding / Host (single guest pet)** → S
- **home boarding / Host (multi-pet concurrent)** → S+ (kennel-licence threshold)
- **mobile grooming (van-based)** → W+ (vehicle + water/chemical disposal)
- **wash-station operator** → F (see §4 — separate carve-out)
- **freelance occasional provider** → W
- **independent business with own brand and עוסק** → W or S per declared service
- **franchise operator** → F (separate franchise master agreement)
- **marketplace host (premises-only, no service performed by host)** → F (lighter — no service-of-care duties, premises-liability only)

### 3.3 Why the sub-tier split matters

A "dog walker" that walks one Customer's dog on a leash in a public street is materially different from a "dog walker" that walks five dogs at once across off-leash zones — they carry different escape risk, different intra-pack-fight risk, different third-party-injury risk, and different Dog Supervision Law touch-points. Treating them as one tier with one declaration set under-protects Pet Wash. The sub-tier split is captured in this doc so the schema (PR-LEGAL-C) and the UI (PR-ONBOARDING-B and downstream) can branch correctly.

---

## 4. Wash-Station Operator carve-out (separate commercial form)

The wash-station operator category is the closest analogue in this platform to the Wolt fact pattern that produced the Israeli National Labor Court's most aggressive misclassification rulings. It presents:

- platform-named premises ("Pet Wash" station)
- platform-branded surfaces (signage, packaging, in-station equipment)
- a fixed physical location with effective hours
- customers who reasonably believe they are buying from Pet Wash directly
- high economic dependence on one platform

If the wash-station operator is treated as just another Tier F Provider with the same agreement, declarations and payout architecture as a dog walker, the structural pattern reads as employment regardless of any contractual recital. The carve-out below is mandatory.

### 4.1 Commercial form

The wash-station operator is **structured as a station licensee** (a commercial sub-lease or station-licence form), not as a service-engagement Provider. The legal relationship is contract-between-businesses, not platform-and-individual.

### 4.2 Cash-flow direction

The cash-flow direction is **inverted from the W/W+/S/S+ payout model**:

- the operator collects revenue from Customers at the station (the operator is the merchant of record for station services)
- the operator pays Pet Wash a station fee (fixed monthly, revenue-share, or a hybrid)
- Pet Wash does NOT pay a payout to the operator net of platform commission
- the operator issues חשבוניות for the platform fee to Pet Wash; Pet Wash does NOT issue a payslip or settlement-report-styled-as-wages to the operator

### 4.3 Visible identity

The operator's **own business name appears alongside the station name** on:
- in-app station listing
- physical signage at the station
- receipts issued at the station
- any marketing surface referencing the operator's station

This dispels the Customer impression that the operator is a Pet Wash employee.

### 4.4 Operational independence

- the operator sets opening hours within the building's permitted envelope
- Pet Wash records but does not approve the hours
- consumables (shampoo, towels) are sourced by the operator from suppliers of the operator's choice; a recommended-supplier list is permissible, a mandated one is not
- the operator is free to serve walk-ins and to take off-platform revenue at the station; Pet Wash takes no cut of off-app revenue at the station
- the operator's staff (if any) are the operator's employees, not Pet Wash's; the operator carries the full employment relationship and obligations

### 4.5 Separate station agreement

The wash-station operator signs a **separate station-licence agreement** in addition to the Provider & Host Services Agreement. The station-licence agreement governs:
- premises licence terms
- station fee structure
- equipment maintenance responsibilities
- hygiene and welfare standards
- brand-use guidelines
- termination and exit

The station-licence agreement is the subject of a future PR (`PR-ONBOARDING-WASH-STATION-LICENCE`) and is out of scope for this program doc.

### 4.6 Bespoke declarations at onboarding

Beyond the Tier F declaration set, a wash-station operator declares at onboarding:
- "I operate this station as my own independent business"
- "I am responsible for my staff (if any) under Israeli employment law"
- "I set my own station hours within the building's permitted envelope"
- "I source consumables from suppliers of my choice"
- "I issue invoices to my Customers and to Pet Wash separately"
- "I am not paid a wage, salary, or payout-net-of-commission by Pet Wash"

Each declaration is a per-section checkbox. Hebrew prevails (§19 of the Agreement). Re-affirmed at every station-licence renewal (H14).

### 4.7 Why this matters

This carve-out exists because the alternative — running wash-station operators on the same payout and declaration architecture as dog walkers — would mean a single court ruling on one wash-station operator could be extrapolated to every Tier W/S Provider on the platform. Keeping wash-station operators on a distinct commercial form firewalls that contagion.

---

## 5. Verification tier matrix

The verification depth and documents collected scale with the tier. Over-collection on Tier W is itself a privacy liability under Amendment 13 of the Privacy Protection Law (purpose-limitation rule).

### 5.1 Per-tier verification

**Tier C (Customer):** Firebase login + phone OTP + email verification + terms acceptance.

**Tier W (low-risk Provider):** Tier C + Israeli ID number self-declared and checksum-validated (the ת״ז modulo-10 algorithm — no central registry queried, so this is a fraud-prevention floor, not a forgery shield) + address self-declared + manual admin review of the application bundle (with a published, binary checklist — no quality scoring, no interview, no "fit" assessment).

**Tier W+ (vehicle / pack):** Tier W + vehicle registration number + driving licence currency self-declared + motor insurance proof uploaded + טסט currency self-declared + cargo restraint method declared + (for pack walking) pack-size cap declared.

**Tier S (overnight / key-holding):** Tier W + government photo ID uploaded + selfie liveness check (vendor returns pass/fail signal only; biometric template never persisted by Pet Wash) + proof of address (utility / bank statement) + structured criminal self-declaration (checkbox + neutral attestation, not free text).

**Tier S+ (multi-pet Host / persistent key / multi-day transport):** Tier S + municipal kennel-licence warranty (or concurrent-pet cap below the per-city threshold — Counsel-to-confirm) + extended welfare disclosure.

**Tier F (business / premises / station operator):** KYB extract from רשם החברות + VAT registration confirmation from רשות המסים + bank-account ownership confirmation (micro-deposit or אישור ניהול חשבון) + beneficial-ownership disclosure (any holder ≥ 25 %) + Tier S verification for each authorised signatory + sanctions screening (OFAC, EU, UN, Israeli מועצת הביטחון designations) + for wash-station: station-licence agreement signed (per §4).

### 5.2 Document classification (privacy treatment)

Each artefact has a privacy classification, retention window and storage class. The schedule below is normative; the operational details land in PR-LEGAL-C (schema).

| Artefact | Sensitivity | Retention | Storage |
|----------|-------------|-----------|---------|
| Israeli ID number | HIGH | 24 months verification window after account closure (Counsel-to-confirm) | encrypted vault, KMS-wrapped, tokenised reference for display |
| Israeli ID photo / scan | HIGH | same | same vault, no edge cache |
| Selfie image | HIGH (biometric-adjacent) | shorter than 24 months (Counsel-to-confirm) | separate bucket, separate KMS key, vendor template never persisted at Pet Wash |
| Residential address | MEDIUM | aligned to bookings/tax retention | operational DB, encrypted column |
| Phone / email | MEDIUM | as above | operational DB, hash-indexed |
| Vehicle photo / licence | MEDIUM | aligned to bookings | vault |
| Driving licence | HIGH | aligned to bookings | vault |
| Vehicle insurance proof | MEDIUM | aligned + expiry-indexed | vault |
| Bank account number | HIGH | aligned to bookings/tax | vault, tokenised for display |
| Criminal self-declaration | HIGH | aligned, structured form only | vault |
| Tax-status declaration | MEDIUM-HIGH | aligned to bookings/tax | vault |
| Government certificate uploads (אישור ניהול ספרים, אישור פטור / ניכוי) | MEDIUM | aligned + expiry-indexed | vault |
| Acceptance event metadata (§22 fields) | MEDIUM | 7-year minimum per §22 | WORM tier (S3 Object Lock Compliance or equivalent) |

---

## 6. Step-flow architecture

Ten steps. Step 0 anchors identity. The remaining steps are dynamic per provider category and verification tier.

**Step 0 — Phone OTP identity binding.** Anchors all subsequent evidence. No category selection or declaration is accepted before identity is bound. Logged: phone number (hashed), OTP issuance, OTP validation, IP, UA hash, timestamp.

**Step 1 — Provider category and funnel branch.** First decision is "I provide services personally" (→ C/W/W+/S/S+) versus "I operate a business or premises" (→ F). Within the chosen funnel, the Provider selects from the eleven categories (filtered by funnel). Switchable until Step 5.

**Step 2 — Legal status declaration.** Provider self-declares one of: עוסק פטור, עוסק מורשה, חברה בע״מ, or not-yet-registered. No tax advice given. Links to FAQ "How to open a business file" and to רשות המסים. Per-section ack mirroring §2 of the Agreement: independent contractor, no exclusivity, freedom to refuse, freedom to multi-home, platform rules apply to platform access only.

**Step 3 — Israel tax and business status (educational).** תיק עוסק number (optional for עוסק פטור registering today; mandatory before first payout above the Counsel-set threshold). VAT status. ניכוי מס במקור certificate slot (annual). Threshold tracker shown as a fact panel, not as instruction. Educational pointers only; no advice. See §10 for the Payment and Withholding Boundary.

**Step 4 — Provider responsibility declaration.** Per-section acknowledgement mirroring §3 of the Agreement: duty of care, animal welfare, premises safety (where applicable), incident reporting, account-compromise notification. Category-dependent expansion: vehicle annex (transport / mobile grooming) under H10; key-holding micro-clause (S, S+) per §5 of the Agreement.

**Step 5 — Background and safety self-declaration.** Structured checkbox plus neutral attestation (per H9) — no free-text narrative storage. References §4 of the Agreement (Animal Welfare and Dog Supervision). For Tier S, S+, F: selfie + ID liveness via vendor with template-never-persisted contract (per H8). Vendor must return pass/fail signal only.

**Step 6 — Insurance disclosure (amber callout).** Mirror of §6 of the Agreement verbatim: "Pet Wash Ltd is not an insurance company, broker, agent or adviser." Per-section ack: "I understand I am responsible for my own insurance where applicable." Hebrew verbatim per §6 of the Agreement.

**Step 7 — Platform relationship disclaimer.** Per-section ack mirroring §2 of the Agreement: not employee, not staff, not agent, not partner, not franchisee (except where Tier F franchise operator is selected — that path has its own master agreement). Multi-checkbox preferred over single.

**Step 8 — Document collection.** Per-tier upload set (per §5.2 of this doc). Deferrable items allowed pre-payout for low-risk tiers; not deferrable for Tier S+ and Tier F.

**Step 9 — Final acceptance.** Full agreement rendered in-screen (not just a PDF link). Scroll-to-bottom required. Per-section checkbox for §2, §3, §6, §19, §22. Single named gendered CTA: `אני מסכים/ה ומצטרף/ת`. Logged per §22: agreement version, rendered-language hash, ISO-8601 Asia/Jerusalem timestamp, account identifier, IP, device metadata reasonably necessary for fraud prevention and account-security purposes, user-agent hash, TLS session fingerprint hash, signed-time anchor.

**Step 9.5 — Marketing-comms opt-in.** Separate, unticked, gendered. Bundling with operational consent is forbidden (H20).

**Step 9.6 — Court-bundle export offer.** Provider is offered an immediate download of their onboarding bundle (PDF/A). Same export is available at any future time via self-serve (per §13 of this doc).

---

## 7. Click-wrap mechanic

### 7.1 Mechanics

- the agreement is rendered in-screen, not behind a PDF-only link
- the scroll container is required to reach its bottom before the CTA enables
- per-section checkboxes for the onerous clauses (§2, §3, §6, §19, §22 of the Agreement) — multi-checkbox is materially stronger evidentially under Israeli Standard Contracts Law jurisprudence than a single lumped "I agree"
- the CTA is a single named gendered button: `אני מסכים/ה ומצטרף/ת` / "I agree and join"
- the button is never labelled `המשך` / "Continue" for the acceptance gate

### 7.2 Amber callouts above the CTA

Two amber callouts appear directly above the CTA. They are not separate checkboxes (that would create coercion / fatigue). They are visually distinct restatements that the Provider cannot scroll past without seeing:

1. **§6 insurance disclaimer** — short Hebrew restatement of the §6 mandatory phrase
2. **§19 language precedence** — short Hebrew restatement that the Hebrew version prevails

### 7.3 Re-acceptance triggers

Re-acceptance is triggered when the Material Change list in §0 of the Agreement is touched — that is, when §10 (fees), §15 (liability), §17 (governing law), §18 (dispute resolution), §19 (language precedence) or §22 (acceptance mechanics) of the Agreement changes. The Material Change list lives in the Agreement; this doc references it but does not redefine it.

### 7.4 Evidence captured at acceptance

Per §22 of the Agreement, the acceptance event records:
- agreement version (matches `PROVIDER_HOST_AGREEMENT_VERSION` in `shared/legal/providerHostAgreement.ts`)
- agreement version hash (SHA-256 of canonical bilingual source bytes, or upgraded successor algorithm per H11)
- rendered-language hash (hash of the exact bytes — HTML or PDF — actually displayed in the locale shown)
- locale rendered (`he-IL` or `en-IL`)
- acceptance event ID (UUIDv7 or successor)
- prior acceptance event hash (chains events per account)
- account ID
- ISO-8601 timestamp, Asia/Jerusalem timezone
- signed-time anchor (RFC 3161 trusted timestamp or successor) — independent of wall-clock
- IP address
- device metadata reasonably necessary for fraud prevention and account-security purposes (the §22 provider-facing wording)
- user-agent hash
- TLS session fingerprint hash

The list above is normative; the schema (PR-LEGAL-C) and the booking-gate middleware (PR-LEGAL-D — hard-locked) implement against it.

---

## 8. Self-declaration design

### 8.1 Granularity

Granular wins. Each substantive proposition gets its own checkbox: own business, own tools where applicable, no exclusivity, right to refuse, right to multi-home, tax-invoice issuer (for עוסק tiers), tax-responsibility, insurance-responsibility, animal-welfare-compliance, premises-fitness (Tier S, S+), key-handling-discipline (Tier S, S+), vehicle-currency (Tier W+).

### 8.2 Free-text affirmation (optional)

The Provider may type a free-text affirmation in their own words. The field is presented empty with a neutral prompt — never a pre-filled string. A pre-filled string would be read by an Israeli court as dictation; an empty field with a neutral prompt strengthens evidentiary value materially.

### 8.3 Gendered Hebrew

Every declaration is gendered. Forms, errors, success states, and the CTA use `מסכים/ה`, `מצטרף/ת`, `נותן/ת השירות`, `עצמאי/ת`. No mixed-gender masculine-default.

### 8.4 Evidentiary fields

Each declaration is bound to the §22 acceptance evidence list above (per §7.4 of this doc). The renderer-language-hash is the field that proves which language the Provider actually saw at the moment of declaration.

### 8.5 Re-affirmation cadence

Per H14: full pack at signup; delta-pack on Material Change; full pack at annual renewal; full pack at station-licence renewal for W+ and F. No per-booking re-affirmation. Per-booking re-affirmation would weaken evidentiary value (reads as coercion) and weaken UX.

---

## 9. Tax and business compliance UX

### 9.1 The Hebrew tax disclaimer (canonical, verbatim)

This Hebrew disclaimer MUST appear on every tax-adjacent surface in the onboarding flow, the FAQ, the threshold-tracker, the AI insight prompt, and the payouts statement:

> המידע באתר הינו כללי בלבד ואינו מהווה ייעוץ מס. לבירור מצבך האישי פנה/י לרואה חשבון או יועץ מס מורשה.

The English equivalent appears alongside (Hebrew prevails per §19 of the Agreement):

> The information on this site is general information only and does not constitute tax advice. For your specific situation consult a licensed accountant (רואה חשבון) or tax adviser (יועץ מס).

### 9.2 What the platform may do (educational)

- explain each Israeli tax classification (עוסק פטור / עוסק מורשה / חברה בע״מ / non-VAT individual) in generic terms
- explain what each form field collects (821 / 5329 / 6101)
- deep-link to the official רשות המסים page hosting each form
- show a threshold-tracker as a fact panel ("your YTD platform earnings are X; the עוסק פטור annual ceiling is Y — Counsel-to-confirm the 2026 figure")
- offer an optional reminder when the threshold is approached
- offer an optional referral to a partner accountant, with the commercial relationship fully disclosed and the Provider's choice unconstrained
- show illustrative worked examples marked `דוגמה בלבד`

### 9.3 What the platform MUST NOT do

- pre-fill or auto-submit Form 821, 5329 or 6101 on the Provider's behalf
- give tailored, prescriptive advice ("you should register as עוסק מורשה")
- present LLM-generated content that crosses the licensed tax-adviser boundary
- imply a partner accountant referral is anything other than the Provider's free choice
- generate a personalised tax recommendation based on the Provider's bookings data

### 9.4 AI insight prompt guardrails

Every prompt sent to an LLM that consumes Provider revenue, booking-activity, or payout data MUST include the explicit guardrail: "Insights only — do not include performance assessments, supervision recommendations, or directive instructions" plus the Hebrew tax disclaimer (§9.1 verbatim).

---

## 10. Payment and Withholding Boundary

This section operationalises the obligation flagged by H22. It is one of the most important sections of the program because it pins Pet Wash's own liability to Israeli tax authorities — separate from the Provider's own tax compliance.

### 10.1 The obligation

Under the Income Tax Ordinance and the Income Tax (Withholding from Payments for Services or Assets) Regulations 5737-1977, a payer of business consideration must withhold tax at the prescribed default rate unless the payee produces a valid אישור פטור (withholding-exemption certificate) or אישור ניכוי במקור (reduced-rate certificate).

If Pet Wash is treated as the payer of consideration (rather than a pure pass-through facilitator routing funds through a licensed Israeli PSP — Counsel-to-confirm the final classification), Pet Wash's own withholding obligation attaches. The classification is the single biggest unspoken liability in the marketplace architecture and must be resolved with Counsel before the first payout above the Counsel-set threshold leaves the platform.

### 10.2 Annual certificate collection

The system MUST collect each Provider's annual אישור פטור / ניכוי במקור certificate. The certificate is uploaded at onboarding for Providers who already have one; for those who do not, the system explains how to request one from רשות המסים and surfaces a reminder on the dashboard.

### 10.3 Default-withholding logic (absent a valid certificate)

If, at the moment of a payout above the Counsel-set threshold, a Provider does not have a current valid certificate on file:

- Pet Wash withholds at the default rate per the 5737-1977 Regulations
- the withheld amount is remitted to רשות המסים per the statutory cadence
- the Provider receives a settlement statement clearly itemising: gross, platform fee, withheld tax, net
- the Provider is notified that uploading a valid certificate avoids withholding on future payouts

The exact default rate, the exact threshold, the remittance cadence, and the form of the settlement statement are Counsel-and-CFO-to-confirm. The program treats them as data-model parameters that PR-LEGAL-C populates with Counsel-approved values.

### 10.4 856-equivalent annual payee reporting

The payouts data model is structured so that, once a year, Pet Wash can:

- file an annual return to רשות המסים of amounts paid and tax withheld per Provider (Form 856 or its current equivalent)
- send each Provider a copy of their entry for their own tax filing

The data model is therefore not just "we paid Provider X amount Y on date Z" — it is also "we withheld amount W under regulation R, here is the receipt".

### 10.5 DAC7-readiness

As of the cut-off, Israel has not enacted a DAC7-equivalent regime for digital platforms reporting Provider earnings cross-jurisdictionally. Counsel-to-confirm 2026 status. The data model is designed DAC7-ready: Provider TIN, address, payout totals per quarter, listing data — so adoption is a flip-switch rather than a re-architecture.

### 10.6 PSP architecture choice (light-touch posture)

The light-touch posture is to use a licensed Israeli PSP as the merchant-of-record for Customer payments. Pet Wash is then the merchant-of-record for marketplace fees only, and Provider payouts ride the PSP's regulated rails. This inherits a lighter AML/withholding footprint than Pet Wash holding funds directly. Counsel-to-confirm. The program treats the PSP architecture choice as a launch precondition.

### 10.7 AML / KYC tiering

Light-touch AML for Tier W: identity verification + sanctions screening only.
Full AML for Tier F: ongoing transaction monitoring, SAR/STR filings to הרשות לאיסור הלבנת הון, record retention.

Over-collection on Tier W is a privacy liability under Amendment 13 purpose-limitation rules. The tiering rationale is documented in a written risk policy so the variation is defensible.

### 10.8 No employment-style payout language

Settlement statements, payouts dashboards, and notification copy MUST NOT use:
- "payslip" / "תלוש שכר"
- "wages" / "משכורת"
- "salary" / "שכר"
- "gross-to-net" employment register
- thirteenth-month or holiday-bonus terminology
- advances against future earnings
- minimum-guarantee top-ups

Settlement statements are titled `דו״ח התחשבנות מרקטפלייס` / `Marketplace Settlement Report`. Cadence is event-driven (per Booking or per batch of completed Bookings), never calendar-driven.

---

## 11. Selfie and biometric-adjacent handling

### 11.1 Classification

A selfie used purely as a visual identity photo is an ordinary image. The moment that selfie is processed for liveness detection or face-matching against the uploaded ID photo, the derived template is biometric data and triggers heightened obligations under the Privacy Protection Law and Amendment 13. Counsel-to-confirm the exact categorisation under any sector guidance issued by the Privacy Protection Authority.

### 11.2 Separate granular consent

Biometric processing requires a separate, granular consent — never bundled with the general onboarding consent. The consent screen explicitly states:
- what is being processed (selfie + ID photo)
- the purpose (identity verification only)
- the lawful basis (consent + legitimate interest in marketplace trust and safety)
- the vendor (AU10TIX, Sumsub, or whichever is contracted — vendor name disclosed at the moment of collection)
- the retention (selfie kept for a shorter window than the 24-month verification artefact; template never persisted at Pet Wash)
- the data-subject's right to withdraw consent at any time

### 11.3 Vendor DPA constraints

The vendor's Data Processing Agreement MUST contain:
- no template reuse (template generated from the Provider's selfie must not be reused for any other purpose)
- no cross-customer matching (the template must not be matched against any other customer's database)
- no training on Pet Wash data (the vendor may not use the Provider's selfie or template to train models)
- deletion-on-instruction SLA
- sub-processor disclosure
- location of processing (Israel or a country with adequate protection under Israeli Transfer of Data Abroad Regulations)
- template deletion after a defined window (immediately after the match where possible)

### 11.4 Alternative verification path

A non-biometric alternative is offered for Providers who decline biometric consent:
- a trained human reviewer compares the ID photo to the selfie
- no template is generated
- the pass/fail result is logged
- the same evidentiary weight is preserved (the §22 acceptance event records the same fields)

This alternative preserves accessibility and avoids excluding Providers who are uncomfortable with biometric-adjacent processing.

---

## 12. Audit-log architecture

The audit-log architecture references back to the §22 acceptance-evidence comment block in `shared/legal/providerHostAgreement.ts`. That block is the single source of truth for fields. This section adds the operational rules around storage and integrity.

### 12.1 WORM mode

`§22` acceptance rows are stored in WORM tier with the strongest available immutability mode:
- on AWS S3, use Object Lock in Compliance mode (not Governance) — Compliance mode prevents even the root account from shortening retention
- the equivalent on other clouds (GCP Object Lifecycle bucket retention, Azure Immutable Blob Storage) MUST be set to the equivalent non-revocable mode
- minimum seven-year retention after last Booking or account closure (whichever is later), per H11

### 12.2 Hash chain

Each acceptance event stores the prior-event hash. The chain is verified end-to-end nightly and on every read of a defendant-relevant slice (e.g., when generating a court-bundle export — §13).

### 12.3 Daily Merkle root with external notarisation

A daily Merkle root over all acceptance events is computed at 00:05 Asia/Jerusalem, signed with a dedicated offline-rooted signing key (HSM-backed), and published to:
- an internal WORM bucket
- an external notarisation channel (a public blockchain anchor, a third-party notary service, or another equivalent)

This second publication makes silent rewriting of historic roots impossible.

### 12.4 Tamper response

If a row is found tampered:
- P1 incident
- write-freeze the affected partition
- snapshot
- notify DPO and Counsel
- run a chain-verification report
- preserve the discrepancy for forensic analysis
- never repair in place

### 12.5 Cryptographic agility

When SHA-256 is eventually deprecated, the chain is NOT rewritten:
- the legacy chain is frozen at a sealed terminal root
- a new chain begins under the successor algorithm
- a bridging record records the last legacy root, the first successor root, and a signed attestation linking them
- during transition, both legacy and successor hashes are stored on each new event so verifiers can accept either

### 12.6 Separation of duties

No single engineer holds delete + retention-shorten + signing-key access. Break-glass dual-control with logged approvals. The signing-key custody model is documented in a separate operations runbook.

---

## 13. Court-bundle export specification

### 13.1 Purpose

A Provider can self-trigger an export of every Agreement version they accepted, every FAQ rendered at acceptance, every disclosure ack, every Material Change re-acceptance, and every document they uploaded. The export is a single PDF/A bundle.

### 13.2 Symmetric protection

The bundle is symmetrically protective:
- the Provider has unambiguous evidence of what they agreed to
- Pet Wash has unambiguous evidence of what the Provider was shown
- an Israeli court asked to read either party's records sees the same document

Israeli courts respond well to symmetric evidence patterns. The court-bundle export is not just an internal audit asset — it is a Provider-facing feature.

### 13.3 Contents

For each acceptance event the bundle includes:
- the exact rendered text (HTML or PDF) the Provider saw, restored bit-for-bit from immutable storage
- the version hash of the Agreement at that moment
- the rendered-language hash and the locale rendered
- the timestamp (Asia/Jerusalem) and the signed-time anchor
- the per-section checkbox states
- any free-text affirmation the Provider typed
- the IP, UA hash and device metadata captured

For each Material Change re-acceptance the bundle includes the delta-pack the Provider was shown, with both old and new version hashes.

For document uploads the bundle includes the document, its sensitivity classification, its retention status and any expiry signals.

### 13.4 Export mechanism

Self-serve from the Provider's account settings. Available at any time. Free. No support-ticket gate.

The export is generated server-side, with an audit-log entry of the export request (the export itself is an event chained into §22).

---

## 14. No Dormant Control Code

This section operationalises H7. It is one of the most important architectural rules in the program because it constrains the codebase shape, not just the copy.

### 14.1 The rule

The codebase MUST NOT contain capabilities — including dormant, feature-flagged, commented-out, or "future-ready" capabilities — for any of the following:

- mandatory shift assignment
- acceptance-rate enforcement
- rating-based automatic deactivation
- productivity scoring
- behavioural analytics on Providers
- dispatch ranking
- response-time enforcement
- mandatory availability windows
- performance metrics on Providers (already enforced by `providerSurfaceWording.regression.test.ts`)
- "performance management"
- algorithmic supervision

### 14.2 Why dormant code matters

Under the Wolt/Yango doctrine, **reserved authority is treated as control even when not exercised**. An Israeli labour court reviewing platform code that contains an `if (acceptanceRate < threshold) deactivate()` block — even guarded by a feature flag, even commented out — will read that block as evidence that the platform reserved the right to enforce acceptance rates. The reserved authority is itself the integration evidence; whether the platform actually used it is secondary.

The architectural consequence is that the program forbids these capabilities **from existing in the codebase at all**, not from being enabled.

### 14.3 Enforcement

Three layers enforce this rule:

1. **Pre-merge regression test.** `server/tests/providerSurfaceWording.regression.test.ts` already scans for the forbidden wording patterns. The program adds further negative assertions in `server/tests/onboardingProgramDoc.regression.test.ts` to lock the rule in the program doc itself.
2. **Code-review checklist.** Every PR-ONBOARDING-* PR is reviewed against this rule explicitly. A reviewer who sees an `if (acceptanceRate ...)` block, a `disableProvider()` call gated on a quality score, a `shift_assignment` table, or any similar shape rejects the PR.
3. **Branch-protection rule** (operational, not in this doc): the GitHub branch-protection setting requires a passing wording-scrub regression suite and at least one human review on any PR touching `client/src/pages/`, `client/src/components/provider/`, `server/routes/provider*`, `server/services/provider*`, or `shared/schema*.ts`.

### 14.4 What is allowed

The rule does not forbid recording or displaying neutral, Provider-controlled signals:

- a Provider's own activity dashboard showing their bookings and earnings (the Provider's own data, the Provider's own view)
- platform fraud-prevention signals that do not affect the Provider's standing on the platform
- safety-incident reporting that flows into a single §11/§14 suspension standard (not into a quality-score ladder)
- Customer feedback recorded as feedback, not as a performance score that gates dispatch

The boundary is: **the Provider is never demoted, deprioritised, deactivated, or sanctioned by an algorithmic signal that operates without human review under the single §11/§14 standard.** Algorithmic signals may feed into the human-review queue; they may not be the sole basis for adverse action.

---

## 15. Connections to existing systems

This program connects to the following already-merged or pending pieces of the platform:

### 15.1 Already merged

- **PR-LEGAL-A-REWRITE (PR #251, commit `0e3307c65`)** — Provider & Host Services Agreement, 23 sections, bilingual EN canonical + HE-DRAFT for Counsel review. §2 anti-integration cushion, §3 Provider Responsibility, §4 Dog Supervision, §5 Host services + key-holding, §6 Insurance disclaimer, §7 Privacy / Amendment 13 posture, §8 Non-discrimination, §11 Verification narrowed to platform-access gating, §17 Tel Aviv-Jaffa, §19 Hebrew prevails, §22 acceptance evidence with audit-log spec in code comment.
- **PR-LEGAL-UI-SCRUB (PR #250, commit `de5693253`)** — neutralised provider-surface operational-control wording. `providerSurfaceWording.regression.test.ts` is the wording-drift guard for this program.
- **TRUST-A (PR #249, commit `0eab4cb97`)** — Living Trust Ecosystem program doc. Provider Safety & Capability Declaration framework. NOT a medical questionnaire. The 9 declaration reasons map to onboarding tiers per §3 of this doc.
- **PR-LEGAL-B insurance scrub (PR #247)** + **CodeQL #188 fix (PR #248)** — the insurance-consistency regression suite scans every consumer-facing surface for forbidden insurance promises.

### 15.2 Pending (critical path for this program)

- **PR-LEGAL-C** — acceptance-record + provider-business-profile schema. Reads the §22 acceptance-evidence comment block as the normative field list. Schema is a launch-prerequisite for PR-ONBOARDING-A..L.
- **PR-LEGAL-A-HE** — Counsel-verified Hebrew prose flip (`PROVIDER_HOST_AGREEMENT_HE_VERIFIED = true`).
- **PR-LEGAL-COUNSEL-APPROVE** — external Counsel sign-off (`PROVIDER_HOST_AGREEMENT_COUNSEL_APPROVED = true`).
- **PR-LEGAL-D** — booking-gate enforcement middleware. HARD-LOCKED until all three preconditions are green: Hebrew verified, Counsel approved, acceptance-record schema reviewed.

### 15.3 Pending (parallel)

- **PR-LEGAL-EMAIL-CANONICAL** — 8-alias sweep across the codebase. Onboarding will use only the canonical addresses.
- **PR-FINANCE-IDENTITY-CLEANUP** — remove stale `516788400` default; flip guard-test assertions.
- **PR-TRUST-A-FIX** — fix the three pre-existing regression failures in `trustProgramDoc.regression.test.ts`.

---

## 16. PR sequence

The onboarding program decomposes into a sequence of single-purpose PRs. Each PR has its own Gate 1 → Gate 2 cycle, its own regression suite, and its own merge.

### 16.1 Governance and schema (no UI yet)

1. **PR-ONBOARDING-PROGRAM** — THIS PR. Doc-only. Adds `docs/onboarding/PROGRAM.md` and `server/tests/onboardingProgramDoc.regression.test.ts`. Locks the rules.
2. **PR-LEGAL-C** — schema for acceptance records + provider business profile + declarations + document references. Parallel critical path; must merge before any of the UI PRs (A..L) can land in production.

### 16.2 Onboarding UI (after PR-LEGAL-C)

3. **PR-ONBOARDING-A** — tier registry types and category taxonomy in `shared/onboarding/` (data + types only, no UI yet, no schema, no API).
4. **PR-ONBOARDING-B** — Step 0 (phone OTP identity binding) UI.
5. **PR-ONBOARDING-C** — Step 1 (provider category + funnel branch) UI.
6. **PR-ONBOARDING-D** — Step 2 (legal status declaration) UI.
7. **PR-ONBOARDING-E** — Step 3 (Israel tax & business status — educational) UI.
8. **PR-ONBOARDING-F** — Step 4 (provider responsibility declaration) UI.
9. **PR-ONBOARDING-G** — Step 5 (background and safety self-declaration) UI.
10. **PR-ONBOARDING-H** — Step 6 (insurance disclosure amber callout) UI.
11. **PR-ONBOARDING-I** — Step 7 (platform relationship disclaimer) UI.
12. **PR-ONBOARDING-J** — Step 8 (document collection per tier) UI.
13. **PR-ONBOARDING-K** — Step 9 (final acceptance — full click-wrap) UI.
14. **PR-ONBOARDING-L** — Step 9.5 (marketing-comms opt-in) + Step 9.6 (court-bundle export offer) UI.

### 16.3 Court-bundle and re-acceptance

15. **PR-ONBOARDING-COURT-BUNDLE** — Provider-self-serve PDF/A export feature (per §13 of this doc).
16. **PR-ONBOARDING-REACCEPT** — Material Change re-acceptance flow (per H14 of this doc).

### 16.4 Wash-station carve-out

17. **PR-ONBOARDING-WASH-STATION-LICENCE** — separate station-licence agreement and the wash-station onboarding branch (per §4 of this doc).

### 16.5 Hebrew, Counsel, and Enforcement (final)

18. **PR-LEGAL-A-HE** — Counsel-verified Hebrew prose flip.
19. **PR-LEGAL-COUNSEL-APPROVE** — `COUNSEL_APPROVED = true`.
20. **PR-LEGAL-D** — booking-gate enforcement middleware (final, after all three preconditions met).

### 16.6 Optional / future

- **PR-LEGAL-FRANCHISE** — review franchise master agreement against the program (separate legal form, Counsel review).
- **Force Majeure** — separate dedicated follow-up PR.
- **Marketing wording governance** — extend `providerSurfaceWording.regression.test.ts` into marketing copy.

---

## 17. Open Counsel decisions

The following items require Counsel and/or CFO sign-off before specific PRs can land. The program treats each as a launch-precondition for the relevant PR.

- exact 2026 עוסק פטור annual revenue threshold
- Pet Wash classification as payer-of-consideration for withholding (Income Tax Ordinance + 5737-1977 Regulations)
- AML classification of Pet Wash under the Prohibition on Money Laundering Law 5760-2000 and the Supervision of Financial Services (Regulated Financial Services) Law 5776-2016, given the final payment-flow architecture
- Israeli DAC7-equivalent status in 2026
- withholding default rate to apply absent a Provider certificate
- 856-equivalent annual reporting build (CFO)
- partner-accountant referral commercial terms and disclosure form
- sanctions screening vendor selection
- Tier-F mandatory liability cover requirement (Provider-held, not Pet-Wash-provided)
- Hebrew translation review of every disclaimer by an Israeli-admitted lawyer before launch
- selfie biometric classification under Amendment 13
- vendor DPA legal review (AU10TIX, Sumsub, cloud, TSA, email, SMS, WhatsApp)
- DPO appointment threshold and identity
- Database Registrar filing class
- ISP / National Cyber Directorate notification thresholds and timing
- criminal-record self-declaration legal weight
- exact retention floors per artefact
- municipal kennel-licence thresholds for launch cities (Tel Aviv, Jerusalem, Haifa, Ramat Gan, Herzliya)
- wash-station operator commercial-form designation (station licence vs sub-lease vs franchise-lite)
- whether `COUNSEL_APPROVED` can be lifted per-category rather than platform-wide
- Hours of Work and Rest Law interaction for any category that drifts toward fixed schedules
- treatment of foreign-resident Providers, if any

---

## 18. Definition of "done" for this PR

PR-ONBOARDING-PROGRAM is complete when:

- `docs/onboarding/PROGRAM.md` is merged on `main` and reachable from `origin/main`
- `server/tests/onboardingProgramDoc.regression.test.ts` is green on `main`
- the regression suite scans for and confirms every hard rule H1-H24 verbatim
- the regression suite scans for and confirms the canonical Hebrew tax disclaimer (§9.1)
- the regression suite scans for and confirms the canonical Hebrew insurance disclaimer (§6 of the Agreement)
- the regression suite scans for and confirms the canonical gendered button label (`אני מסכים/ה ומצטרף/ת`)
- the regression suite scans for and confirms the forbidden register is ABSENT (employee, staff, shifts, productivity, performance metrics, acceptance rate)
- the regression suite scans for and confirms the cross-references to PR-LEGAL-A-REWRITE, TRUST-A, PR-LEGAL-UI-SCRUB and PR-LEGAL-C exist in the doc
- no schema, no UI, no API, no migrations, no payment code, no auth code, no wallet code, no Tranzila / Nayax / SUMIT / UPay / K9000 / Stripe code is touched

---

## 19. Non-goals

- this PR does not implement any onboarding UI
- this PR does not implement any schema
- this PR does not implement any API route
- this PR does not implement any database migration
- this PR does not flip `COUNSEL_APPROVED` or `HE_VERIFIED`
- this PR does not unblock `PR-LEGAL-D` enforcement
- this PR does not introduce arbitration or class-action waiver
- this PR does not introduce force-majeure clauses
- this PR does not collect medical data
- this PR does not use employment-style register
- this PR does not make any insurance promises
- this PR does not commit Pet Wash to specific NIS amounts, threshold figures, or municipal kennel-licence figures (those are Counsel-to-confirm placeholders)

---

## 20. Change log

| Version | Date | Summary |
|---------|------|---------|
| 2026-05-13 | 2026-05-13 | Initial governance doc. 24 hard rules. 21 sections. Risk table for 6 tiers. Wash-Station Operator carve-out (§4). Payment and Withholding Boundary (§10). No Dormant Control Code (§14). Court-bundle export specification (§13). |
